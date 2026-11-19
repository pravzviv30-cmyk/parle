#!/usr/bin/env node
/**
 * One command for a signed-in learner on the free plan, with nothing paid or remote reached.
 *
 * Starts this checkout's token server on 8787 (the app's local-development URL) and the Expo
 * web build, with Supabase, Upstash, OpenAI, ToneperFect and TypeSafe all unset. The token
 * server answers from a file ledger in the OS temp dir, so the mock learner reads as the
 * free plan, and the web build seeds the canvas learner after any test sign-up.
 *
 *   npm run dev:canvas-free [-- --port 8094]
 *
 * The helpers up top are pure and tested. The machinery below them only spawns and reaps.
 */

import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { devNull, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { parseEnvFile } from '../../services/shared/devPlan.ts';

export const TOKEN_PORT = 8787;
export const DEFAULT_WEB_PORT = 8094;

/** Signals that stop both children, so a closed terminal does not leave them running. */
export const STOP_SIGNALS = ['SIGINT', 'SIGTERM', 'SIGHUP'];

/** Names that would reach something paid or remote. Removed from the web build's environment. */
export const UNSET_NAMES = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'LUVANI_DEV_UNLIMITED_MINUTES',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'OPENAI_API_KEY',
  'TONEPERFECT_API_KEY',
  'TYPESAFE_API_KEY',
];

const withoutUnset = (env) => {
  const out = { ...env };
  for (const name of UNSET_NAMES) delete out[name];
  return out;
};

/** What the token server may take from the shell: the basics a Node process needs, and nothing else. */
const BASIC_NAMES = ['PATH', 'HOME', 'USER', 'LOGNAME', 'SHELL', 'TMPDIR', 'TEMP', 'TMP', 'TERM', 'TZ', 'LANG', 'FORCE_COLOR', 'NO_COLOR'];
const BASIC_PREFIXES = ['LC_', 'NODE_'];

/** The only values the token server takes from the .env. */
const LIVEKIT_NAMES = ['LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET'];

const pick = (source, wanted) => Object.fromEntries(Object.entries(source).filter(([name]) => wanted(name)));

/**
 * The token server's environment, built from nothing: the shell basics, the LiveKit values
 * from the .env text, and this run's own values. An allow-list, so a vendor key nobody has
 * named yet (Deepgram, Speechace, Anthropic, the next one) can never come along.
 */
export function buildTokenEnv({ envText, port, agentSecret, storePath, base }) {
  return {
    ...pick(base, (name) => BASIC_NAMES.includes(name) || BASIC_PREFIXES.some((prefix) => name.startsWith(prefix))),
    ...pick(parseEnvFile(envText), (name) => LIVEKIT_NAMES.includes(name)),
    LUVANI_LOCAL_DEVELOPMENT: '1',
    LUVANI_AGENT_SECRET: agentSecret,
    LUVANI_ALLOWED_ORIGINS: `http://localhost:${port}`,
    ENTITLEMENT_STORE_PATH: storePath,
    // The server loads a .env from its working directory without overriding set values, which
    // would put the unset names back. Point it at nothing.
    DOTENV_CONFIG_PATH: devNull,
  };
}

/**
 * The Expo web build's environment: no token-server secret, Supabase blank, the canvas learner on,
 * the local token server, and no other EXPO_PUBLIC_ value from the shell (a remote server URL or a
 * RevenueCat key would end up in the bundle).
 */
export function buildWebEnv({ base }) {
  return {
    ...pick(withoutUnset(base), (name) => !name.startsWith('EXPO_PUBLIC_')),
    EXPO_PUBLIC_TOKEN_SERVER_URL: `http://localhost:${TOKEN_PORT}`,
    EXPO_PUBLIC_SUPABASE_URL: '',
    EXPO_PUBLIC_SUPABASE_ANON_KEY: '',
    EXPO_PUBLIC_LUVANI_LOCAL_DEVELOPMENT: '1',
    EXPO_PUBLIC_LUVANI_CANVAS_LEARNER: '1',
  };
}

/** The one block this script prints about itself. Names and addresses only, never a value from the env. */
export function printable({ port }) {
  return [
    `token server: http://localhost:${TOKEN_PORT} (local development, file ledger, free plan)`,
    `web build:    http://localhost:${port}`,
    'Create an account with any test email on the web build; the canvas learner seeds itself.',
    'Ctrl-C stops both.',
  ].join('\n');
}

/** Every value in the .env text, plus the agent secret: what forwarded output must never show. */
export function secretValues({ envText, agentSecret }) {
  return [...Object.values(parseEnvFile(envText)), agentSecret];
}

/** Hides secret values in forwarded child output. Short values are left alone: they would match ordinary words. */
export function redact(text, secrets) {
  let out = text;
  for (const value of secrets) if (value && value.length >= 8) out = out.split(value).join('[hidden]');
  return out;
}

/** Deletes a file, quietly when it is already gone. */
export function removeFile(path) {
  rmSync(path, { force: true });
}

/** The main checkout is the first entry of `git worktree list --porcelain`. */
export function mainCheckoutRoot(porcelain) {
  const first = porcelain.split('\n').find((line) => line.startsWith('worktree '));
  return first ? first.slice('worktree '.length).trim() : null;
}

// ------------------------------------------------------------------ machinery

const ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');
const RESET = '\x1b[0m';
const COLOURS = { token: '\x1b[33m', web: '\x1b[32m', dev: '\x1b[34m' };

function parsePort(argv) {
  const at = argv.indexOf('--port');
  if (at === -1) return DEFAULT_WEB_PORT;
  const port = Number(argv[at + 1]);
  if (!Number.isInteger(port) || port < 1 || port > 65535 || port === TOKEN_PORT) {
    throw new Error(`--port needs a whole number from 1 to 65535 other than ${TOKEN_PORT}.`);
  }
  return port;
}

/** This checkout's token-server .env, else the main checkout's. Never a hard-coded path. */
function findEnvFile() {
  const own = join(ROOT, 'services/token-server/.env');
  if (existsSync(own)) return own;
  const listed = spawnSync('git', ['worktree', 'list', '--porcelain'], { cwd: ROOT, encoding: 'utf8' });
  const main = listed.status === 0 ? mainCheckoutRoot(listed.stdout) : null;
  const shared = main ? join(main, 'services/token-server/.env') : null;
  return shared && existsSync(shared) ? shared : null;
}

function main() {
  const port = parsePort(process.argv.slice(2));
  const envFile = findEnvFile();
  if (!envFile) throw new Error('No services/token-server/.env in this checkout or the main one. Copy .env.example and fill the LiveKit values.');
  const agentSecret = randomBytes(24).toString('hex');
  const envText = readFileSync(envFile, 'utf8');
  const storePath = join(tmpdir(), `luvani-canvas-free-${process.pid}-entitlements.json`);
  const tokenEnv = buildTokenEnv({ envText, port, agentSecret, storePath, base: process.env });
  const secrets = secretValues({ envText, agentSecret });
  process.on('exit', () => removeFile(storePath));
  const webEnv = buildWebEnv({ base: process.env });

  const children = [];
  let stopping = false;
  const say = (label, line, out = process.stdout) =>
    out.write(`${COLOURS[label] ?? ''}${label.padEnd(6)}${RESET} | ${redact(line, secrets)}\n`);

  const stop = (code) => {
    if (stopping) return;
    stopping = true;
    process.exitCode = code;
    say('dev', 'stopping.');
    for (const { child } of children) {
      try { process.kill(-child.pid, 'SIGTERM'); } catch { /* already gone */ }
    }
    setTimeout(() => {
      for (const { child } of children) {
        try { process.kill(-child.pid, 'SIGKILL'); } catch { /* already gone */ }
      }
      process.exit(code);
    }, 3000).unref();
  };

  const launch = (label, command, args, env) => {
    const child = spawn(command, args, { cwd: ROOT, detached: true, stdio: ['ignore', 'pipe', 'pipe'], env });
    children.push({ label, child });
    for (const [source, out] of [[child.stdout, process.stdout], [child.stderr, process.stderr]]) {
      let held = '';
      source.setEncoding('utf8');
      source.on('data', (chunk) => {
        held += chunk;
        const lines = held.split('\n');
        held = lines.pop() ?? '';
        for (const line of lines) if (line.trim() !== '') say(label, line, out);
      });
    }
    child.on('error', (error) => {
      say('dev', `${label} could not start: ${error.message}`, process.stderr);
      stop(1);
    });
    child.on('exit', (code, signal) => {
      if (!stopping) say('dev', `${label} exited (${signal ?? `code ${code}`}). Stopping the other.`, process.stderr);
      if (!stopping) stop(code === 0 ? 1 : (code ?? 1));
      if (children.every((entry) => entry.child.exitCode !== null || entry.child.signalCode !== null)) process.exit(process.exitCode ?? 0);
    });
  };

  say('dev', `checkout: ${ROOT}`);
  say('dev', `token-server settings read from ${envFile.replace(ROOT, '.')}`);
  process.stdout.write(`${printable({ port })}\n`);
  launch('token', process.execPath, ['--experimental-strip-types', 'services/token-server/src/server.ts'], tokenEnv);
  launch('web', 'npm', ['run', 'web', '--workspace=@luvani/mobile', '--', '--port', String(port)], webEnv);

  for (const signal of STOP_SIGNALS) process.on(signal, () => stop(0));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}
