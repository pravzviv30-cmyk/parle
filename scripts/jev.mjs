/**
 * Ask TypeSafe's Jev a typed question from the command line.
 *
 * A dev tool for the session orchestrator: copy checks, doc drift checks and
 * report checks, where the whole answer is a judgment. It reuses the brain's
 * TypeSafe client, so there is no HTTP code here.
 *
 *   npm run jev -- --ask "Is this copy warm and plain?" --state copy.txt
 *   git diff | npm run jev -- --ask "Does this diff make the README section wrong?"
 *   npm run jev -- --questions q.json --state report.md
 *
 * Exit codes: 0 ok (or --pass met), 1 error, 2 --pass not met.
 *
 * Data boundary: send repo code, docs, diffs, plans and agent reports only.
 * Never .env contents, keys, learner or account data, or production logs.
 * See ../CLAUDE.md, "Jev in the session workflow".
 */

import { readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import { DEFAULT_JEV_MODEL, TypeSafeClient, priceUsage } from '@luvani/brain/llm';

export const MAX_STATE_BYTES = 200 * 1024;
/** Where the key lives when the shell does not export it, in lookup order. */
export const KEY_FILES = ['services/token-server/.env', 'services/tutor-agent/.env'];

const USAGE = `Usage: npm run jev -- (--ask "<yes/no instruction>" | --questions <file.json>) [--state <file|->] [--pass <0..1>]

  --ask         One yes/no question, answered as a noul under the id "answer".
  --questions   JSON file: { "<id>": { "type": "noul"|"choice"|"score", ... } }.
  --state       File to judge, or - for stdin (default). JSON is passed through,
                anything else is sent as { "text": ... }. Max 200 KB.
  --pass        0..1, single noul question only. Exit 0 if noul >= pass, 2 if below.

Output is JSON on stdout. Key comes from TYPESAFE_API_KEY, then
services/token-server/.env, then services/tutor-agent/.env.`;

class UsageError extends Error {}

/** KEY=value lines, with optional `export`, quotes and trailing comments. */
export function parseEnvValue(text, name) {
  let found = '';
  for (const raw of text.split(/\r?\n/)) {
    const match = raw.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (match === null || match[1] !== name) continue;
    let value = match[2].trim();
    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.indexOf(quote, 1) > 0) {
      value = value.slice(1, value.indexOf(quote, 1));
    } else {
      value = value.replace(/\s+#.*$/, '').trim();
    }
    found = value;
  }
  return found;
}

function findKey({ env, readFile, root }) {
  const fromEnv = (env.TYPESAFE_API_KEY ?? '').trim();
  if (fromEnv !== '') return fromEnv;
  for (const rel of KEY_FILES) {
    let text;
    try {
      text = readFile(path.join(root, rel));
    } catch {
      continue;
    }
    const value = parseEnvValue(text, 'TYPESAFE_API_KEY').trim();
    if (value !== '') return value;
  }
  return '';
}

function isEnvPath(file, realpath) {
  if (path.basename(file).startsWith('.env')) return true;
  try {
    return path.basename(realpath(file)).startsWith('.env');
  } catch {
    return false;
  }
}

const tooBig = (label) => `${label} is over ${MAX_STATE_BYTES / 1024} KB. Send a smaller excerpt or diff.`;

function checkSize(text, label) {
  if (Buffer.byteLength(text) > MAX_STATE_BYTES) throw new UsageError(tooBig(label));
}

async function readStdin(stdin) {
  if (stdin === undefined || stdin.isTTY) {
    throw new UsageError('No state given. Pass --state <file>, or pipe text on stdin.');
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of stdin) {
    const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
    size += buffer.length;
    if (size > MAX_STATE_BYTES) throw new UsageError(tooBig('State on stdin'));
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * Objects, arrays and strings that parse as JSON are passed through. Anything
 * else, including a bare number or `null` that is really just text, is wrapped.
 */
export function toState(text) {
  try {
    const parsed = JSON.parse(text);
    if (parsed !== null && ['object', 'string'].includes(typeof parsed)) return parsed;
  } catch {
    // Not JSON: plain text.
  }
  return { text };
}

export function parseCli(argv) {
  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      strict: true,
      allowPositionals: false,
      options: {
        ask: { type: 'string' },
        questions: { type: 'string' },
        state: { type: 'string' },
        pass: { type: 'string' },
        help: { type: 'boolean', short: 'h' },
      },
    }));
  } catch (error) {
    throw new UsageError(error.message);
  }
  if (values.help) return { help: true };
  const hasAsk = values.ask !== undefined;
  const hasQuestions = values.questions !== undefined;
  if (hasAsk === hasQuestions) throw new UsageError('Pass exactly one of --ask or --questions.');
  if (hasAsk && values.ask.trim() === '') throw new UsageError('--ask needs a non-empty instruction.');
  let pass;
  if (values.pass !== undefined) {
    pass = values.pass.trim() === '' ? NaN : Number(values.pass);
    if (!Number.isFinite(pass) || pass < 0 || pass > 1) throw new UsageError('--pass must be a number from 0 to 1.');
  }
  return { ask: values.ask, questions: values.questions, state: values.state ?? '-', pass };
}

function validateQuestions(parsed) {
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed) || Object.keys(parsed).length === 0) {
    throw new UsageError('--questions file must be a JSON object of { id: question }, with at least one question.');
  }
  for (const [id, question] of Object.entries(parsed)) {
    if (question === null || typeof question !== 'object' || !['noul', 'choice', 'score'].includes(question.type)) {
      throw new UsageError(`Question "${id}" needs a type of noul, choice or score.`);
    }
    if (question.instructions === undefined || question.instructions === '') {
      throw new UsageError(`Question "${id}" needs instructions.`);
    }
  }
  return parsed;
}

/**
 * Run the CLI. Returns what to print instead of printing it, so a test can
 * look at both streams. Nothing here writes to the process.
 */
export async function main(argv, io = {}) {
  const env = io.env ?? process.env;
  const root = io.root ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const cwd = io.cwd ?? process.cwd();
  const readFile = io.readFile ?? ((file) => readFileSync(file, 'utf8'));
  const realpath = io.realpath ?? realpathSync;
  const fetchFn = io.fetch ?? globalThis.fetch;
  let key = '';

  const fail = (message, code = 1) => ({
    code,
    stdout: '',
    // The key must never reach a terminal, whatever an upstream error says.
    stderr: `jev: ${key === '' ? message : message.split(key).join('[redacted]')}\n`,
  });

  try {
    const cli = parseCli(argv);
    if (cli.help) return { code: 0, stdout: `${USAGE}\n`, stderr: '' };

    const resolve = (file) => path.resolve(cwd, file);
    const readUserFile = (file, label) => {
      if (isEnvPath(resolve(file), realpath)) {
        throw new UsageError(`Refusing to read ${label} "${path.basename(file)}": .env files never go to Jev.`);
      }
      let text;
      try {
        text = readFile(resolve(file));
      } catch {
        throw new UsageError(`Could not read ${label} file "${file}".`);
      }
      return text;
    };

    let questions;
    if (cli.ask !== undefined) {
      questions = { answer: { type: 'noul', instructions: cli.ask } };
    } else {
      const text = readUserFile(cli.questions, '--questions');
      try {
        questions = validateQuestions(JSON.parse(text));
      } catch (error) {
        if (error instanceof UsageError) throw error;
        throw new UsageError(`--questions file "${cli.questions}" is not valid JSON.`);
      }
    }
    if (cli.pass !== undefined) {
      const entries = Object.values(questions);
      if (entries.length !== 1 || entries[0].type !== 'noul') {
        throw new UsageError('--pass only works with a single noul question.');
      }
    }

    let stateText;
    if (cli.state === '-') {
      stateText = await readStdin(io.stdin ?? process.stdin);
    } else {
      stateText = readUserFile(cli.state, '--state');
      checkSize(stateText, 'State');
    }
    if (stateText.trim() === '') throw new UsageError('State is empty.');
    const state = toState(stateText);

    key = findKey({ env, readFile, root });
    if (key === '') {
      throw new UsageError(
        `No TypeSafe key. Set TYPESAFE_API_KEY, or add it to ${KEY_FILES.join(' or ')}.`,
      );
    }

    const model = (env.TYPESAFE_MODEL ?? '').trim() || DEFAULT_JEV_MODEL;
    const client = new TypeSafeClient({ apiKey: key, model }, fetchFn);
    const result = await client.systemOne(state, questions);

    const priced = priceUsage(result.usage);
    const output = {
      model: result.model,
      answers: result.answers,
      usage: result.usage,
      ...(priced.exact ? { costUsd: priced.usd } : {}),
    };
    let code = 0;
    if (cli.pass !== undefined) {
      const [id] = Object.keys(questions);
      code = result.answers[id].noul >= cli.pass ? 0 : 2;
    }
    return { code, stdout: `${JSON.stringify(output, null, 2)}\n`, stderr: '' };
  } catch (error) {
    if (error instanceof UsageError) return fail(error.message);
    if (error?.name === 'TypeSafeError') return fail(error.message);
    return fail(`${error?.name ?? 'Error'}: ${error?.message ?? 'request failed'}`);
  }
}

const invokedDirectly = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  const { code, stdout, stderr } = await main(process.argv.slice(2));
  if (stdout !== '') process.stdout.write(stdout);
  if (stderr !== '') process.stderr.write(stderr);
  process.exitCode = code;
}
