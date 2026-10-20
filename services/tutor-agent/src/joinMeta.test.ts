/**
 * What the worker actually reads off the join token.
 *
 * A tripwire, in the `apps/mobile/src/nav/wiring.test.ts` idiom and for the same
 * reason: `agent.ts` is the LiveKit entrypoint, so the only way to drive it is to
 * run a worker against a real room, and the thing worth defending here is one
 * line of plumbing rather than a behaviour.
 *
 * It exists because that one line was missing. The token server signed
 * `missionId` into the metadata, `LuvaniConversation` accepted it in its
 * constructor, seven tests covering the mission path were green, and the worker
 * never read the field — so every mission tap still paid the ten-to-twenty-five
 * second scene build, and no test could see it, because they all construct
 * `LuvaniConversation` directly and never come through this door.
 *
 * A value that has to survive four hops needs something watching each hop.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DEFAULT_TUTOR_VOICE } from '@luvani/core';
import { ELEVEN_VOICES, resolveTutorVoice } from './voice.ts';

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
    const open = CODE.indexOf('new LuvaniConversation(');
    assert.ok(open >= 0, 'the worker still builds a conversation');
    const call = CODE.slice(open, CODE.indexOf('})', open));

    assert.match(call, /\bmissionId,/, 'a mission id that is read and not passed on is the same bug one line further down');
    assert.match(call, /\bseedTopic,/, 'and the seed topic still rides the same way');
  });
});

/**
 * The chosen voice is the same four-hop value, with one difference that makes
 * the tripwire worth more than the mission one: this hop has an ORDER as well
 * as a wire.
 *
 * `buildTTS()` used to run before `ctx.connect()`, which is fine when the voice
 * is a constant and silently wrong the moment it belongs to a learner: the TTS
 * would be built, and the vendor chosen, before anyone knew who had joined.
 * Nothing about that reads as a bug at the call site. Both halves would look
 * connected, every voice test would pass, and every learner would hear Luc.
 */
describe('the chosen voice reaches the vendor and the persona reaches the tutor', () => {
  test('the worker reads the tutor voice off the join metadata and builds the voice after reading it', () => {
    assert.match(
      CODE,
      /type TokenMeta = \{[^}]*tutorVoice\?: unknown[^}]*\}/,
      'the metadata shape has to admit a tutor voice, or nothing can be read out of it',
    );

    const parsed = CODE.indexOf('const meta = parseMeta(');
    const resolved = CODE.search(/resolveTutorVoice\(\s*meta\.tutorVoice\s*\)/);
    const built = CODE.indexOf('buildTTS(');

    assert.ok(parsed >= 0, 'the worker still parses the join metadata');
    assert.ok(resolved >= 0, 'the tutor voice has to be resolved from the metadata, not from an env var');
    assert.ok(built >= 0, 'the worker still builds a TTS');

    assert.ok(parsed < resolved, 'the voice cannot be resolved before the metadata carrying it has been read');
    assert.ok(
      resolved < built,
      'buildTTS runs before the voice is known, so every learner would hear the default however they chose',
    );
  });

  test('an unknown tutor voice resolves to the default and never reaches the vendor', () => {
    // The behaviour, not the wiring. `resolveTutorVoice` is what stands between
    // a string the app sent and a path segment in a billed vendor URL, so the
    // guarantee under test is that its output can only ever index the id table.
    const hostile: unknown[] = [undefined, null, '', 'retired-voice', '../../v1/user', 'toString', 7, { key: 'luc' }];
    const known = new Set(Object.values(ELEVEN_VOICES));

    for (const value of hostile) {
      const key = resolveTutorVoice(value);
      assert.equal(key, DEFAULT_TUTOR_VOICE, `${JSON.stringify(value)} must become the default`);
      assert.ok(known.has(ELEVEN_VOICES[key]), 'and the id it maps to must be one this account owns');
    }

    // And the worker uses that resolve rather than trusting the signed value.
    // The token server deliberately only shape-checks it (F284), so a signature
    // proves who sent it and nothing at all about whether the voice exists.
    assert.doesNotMatch(
      CODE,
      /voice:\s*meta\.tutorVoice/,
      'the raw metadata value must never be handed to buildTTS unresolved',
    );
  });

  test('the worker hands the persona to both tutors', () => {
    // Two of the eight voices are women. A persona that reaches only one of the
    // two tutor classes means Céline introduces herself as a man on whichever
    // path was forgotten, and no prompt wording fixes a mismatch the plumbing
    // created. Both doors or neither.
    assert.match(
      CODE,
      /tutorVoice\([A-Za-z]+\)\.persona/,
      'the persona has to come from the catalogue entry for the chosen key, not from a literal',
    );

    const convoAt = CODE.indexOf('new LuvaniConversation(');
    const tutorAt = CODE.indexOf('new LuvaniTutor(');
    assert.ok(convoAt >= 0 && tutorAt >= 0, 'the worker still builds both tutors');

    assert.match(
      CODE.slice(convoAt, CODE.indexOf('})', convoAt)),
      /\bpersona\b/,
      'free conversation speaks far more lines than the lesson; a wrong name there is the loudest',
    );
    assert.match(
      CODE.slice(tutorAt, CODE.indexOf('})', tutorAt)),
      /\bpersona\b/,
      'and the scripted lesson opens with an introduction, so it is the first thing a learner hears',
    );
  });
  test('the worker reads the free-tier memory lock strictly and hands it to the conversation', () => {
    assert.match(CODE, /type TokenMeta = \{[^}]*memoryLocked\?: unknown[^}]*\}/);
    assert.match(CODE, /memoryLocked: memoryLockedFrom\(meta\.memoryLocked\)/);
  });
});
