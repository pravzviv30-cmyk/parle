/**
 * The brain that runs on a Claude subscription rather than an API key.
 *
 * Same trade as the Groq adapter and for the same reason: no server-side
 * structured outputs, so the schema travels in the prompt and the contract is
 * enforced here with zod plus one repair round-trip. What is different is the
 * transport — a subprocess rather than a request — and the two things that
 * follow from that, which is what these tests are about: the CLI answers with
 * its own envelope around the model's text, and it must not be run anywhere it
 * would read a CLAUDE.md and mistake this repo's instructions for the tutor's.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { ClaudeCliBrainClient, type ClaudeCliRun } from './claudeCli.ts';
import { BrainParseError } from './client.ts';
import { buildSystemBlocks } from '../prompt/system.ts';

const blocks = () => buildSystemBlocks();

const EXTRACTION = { facts: [], openerFr: null, openerEn: null };

/** The CLI's own JSON envelope, with the model's answer in `result`. */
const envelope = (result: string, usage: Record<string, number> = {}) =>
  JSON.stringify({
    is_error: false,
    result,
    usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 2, cache_creation_input_tokens: 1, ...usage },
  });

function recordingRun(replies: string[]): { run: ClaudeCliRun; calls: { args: readonly string[]; prompt: string; cwd: string }[] } {
  const calls: { args: readonly string[]; prompt: string; cwd: string }[] = [];
  const run: ClaudeCliRun = async (args, prompt, cwd) => {
    calls.push({ args, prompt, cwd });
    return { code: 0, stdout: replies.shift() ?? envelope(JSON.stringify(EXTRACTION)), stderr: '' };
  };
  return { run, calls };
}

describe('ClaudeCliBrainClient — talking to the command line', () => {
  test('the model answer is unwrapped from the CLI envelope and validated', async () => {
    const { run } = recordingRun([envelope(JSON.stringify(EXTRACTION))]);
    const client = new ClaudeCliBrainClient({ run });

    const { extraction, usage } = await client.extract({ kind: 'extract', system: blocks(), request: 'what did we learn' });

    assert.deepEqual(extraction, EXTRACTION);
    assert.equal(usage.inputTokens, 10);
    assert.equal(usage.outputTokens, 5);
    assert.equal(usage.cacheReadTokens, 2);
    assert.equal(usage.cacheWriteTokens, 1);
  });

  test('it runs outside the repo, so no CLAUDE.md is read as tutor instructions', async () => {
    // The failure this prevents is quiet and strange: run in the repo, the CLI
    // loads this project's CLAUDE.md into its own system prompt, and the tutor
    // brain starts answering with a share of the repo's engineering rules in
    // its head. Neutral working directory, always.
    const { run, calls } = recordingRun([envelope(JSON.stringify(EXTRACTION))]);
    await new ClaudeCliBrainClient({ run }).extract({ kind: 'extract', system: blocks(), request: 'x' });

    const repoRoot = process.cwd();
    assert.ok(calls[0], 'the CLI was invoked');
    assert.notEqual(calls[0]!.cwd, repoRoot);
    assert.ok(!calls[0]!.cwd.includes('Parle'), `ran in ${calls[0]!.cwd}, which is inside the project`);
  });

  test('the routed model is the one asked for, per activity', async () => {
    const { run, calls } = recordingRun([envelope(JSON.stringify(EXTRACTION))]);
    await new ClaudeCliBrainClient({ run }).extract({ kind: 'extract', system: blocks(), request: 'x' });

    const modelFlag = calls[0]!.args.indexOf('--model');
    assert.ok(modelFlag >= 0, 'the model is pinned rather than left to whatever the CLI defaults to');
    assert.equal(calls[0]!.args[modelFlag + 1], 'claude-opus-5', 'extraction is analyst work, per routing.ts');
  });

  test('a fenced answer is still read, because a CLI answers like a chat', async () => {
    const fenced = ['```json', JSON.stringify(EXTRACTION), '```'].join('\n');
    const { run } = recordingRun([envelope(fenced)]);
    const { extraction } = await new ClaudeCliBrainClient({ run }).extract({ kind: 'extract', system: blocks(), request: 'x' });
    assert.deepEqual(extraction, EXTRACTION);
  });

  test('a malformed answer gets one repair round-trip, then gives up honestly', async () => {
    const { run, calls } = recordingRun([envelope('not json at all'), envelope('still not json')]);
    await assert.rejects(
      () => new ClaudeCliBrainClient({ run }).extract({ kind: 'extract', system: blocks(), request: 'x' }),
      BrainParseError,
      'a brain that cannot hold the contract must say so, not return something shaped wrong',
    );
    assert.equal(calls.length, 2, 'exactly one repair attempt, the same budget the Groq adapter has');
  });

  test('a CLI that exits non-zero is an error with its own words in it', async () => {
    const run: ClaudeCliRun = async () => ({ code: 1, stdout: '', stderr: 'Invalid API key · Please run /login' });
    await assert.rejects(
      () => new ClaudeCliBrainClient({ run }).extract({ kind: 'extract', system: blocks(), request: 'x' }),
      /login/,
      'an expired subscription login should say so, not surface as a parse failure',
    );
  });
});
