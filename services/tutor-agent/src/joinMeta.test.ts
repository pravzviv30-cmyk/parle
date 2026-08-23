/**
 * What the worker actually reads off the join token.
 *
 * A tripwire, in the `apps/mobile/src/nav/wiring.test.ts` idiom and for the same
 * reason: `agent.ts` is the LiveKit entrypoint, so the only way to drive it is to
 * run a worker against a real room, and the thing worth defending here is one
 * line of plumbing rather than a behaviour.
 *
 * It exists because that one line was missing. The token server signed
 * `missionId` into the metadata, `ParleConversation` accepted it in its
 * constructor, seven tests covering the mission path were green, and the worker
 * never read the field — so every mission tap still paid the ten-to-twenty-five
 * second scene build, and no test could see it, because they all construct
 * `ParleConversation` directly and never come through this door.
 *
 * A value that has to survive four hops needs something watching each hop.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const AGENT = readFileSync(fileURLToPath(new URL('./agent.ts', import.meta.url)), 'utf8');

/** Comments may promise anything; only what runs is under test. */
function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

const CODE = stripComments(AGENT);

describe('the join metadata reaches the conversation it was signed for', () => {
  test('the worker reads the mission id off the join metadata', () => {
    assert.match(
      CODE,
      /type TokenMeta = \{[^}]*missionId\?: unknown[^}]*\}/,
      'the metadata shape has to admit a mission id, or nothing can be read out of it',
    );
    assert.match(
      CODE,
      /const missionId = meta\.missionId;/,
      'and it has to actually be read, which is the line that was missing',
    );
  });

  test('and hands it to the conversation, beside the seed topic it already carried', () => {
    const open = CODE.indexOf('new ParleConversation(');
    assert.ok(open >= 0, 'the worker still builds a conversation');
    const call = CODE.slice(open, CODE.indexOf('})', open));

    assert.match(call, /\bmissionId,/, 'a mission id that is read and not passed on is the same bug one line further down');
    assert.match(call, /\bseedTopic,/, 'and the seed topic still rides the same way');
  });
});
