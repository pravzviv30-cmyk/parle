/**
 * The wait before the tutor speaks, and the three places that draw it.
 *
 * Founder, 2026-11-01: while the learner waits, the screen says "Waiting for
 * {the tutor they picked}" and nothing else. One helper, `waitingFor`, holds
 * the words; the connecting branch and the waiting branch of both live screens
 * and the first live practice draw it.
 *
 * Ceiling, stated plainly: apps/mobile has no renderer (docs/TESTING.md), so the
 * words are asked of the helper and the wiring is read from the `.tsx` files as
 * text. That proves which words each branch is handed, not that a pixel landed.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { TUTOR_VOICES } from '@luvani/core';

import { LEAVE_LABEL, waitingFor, waitingView } from '../tutor/waitingView.ts';

const SRC = new URL('..', import.meta.url).pathname;
const read = (name: string) => readFileSync(SRC + name, 'utf8');

/** One branch, not merely the file it lives in. */
const branchOf = (source: string, opens: string): string => {
  const from = source.indexOf(opens);
  assert.notEqual(from, -1, `the branch opening "${opens}" is gone; this test is stale`);
  const to = source.indexOf('\n  }\n', from);
  assert.notEqual(to, -1, `the branch at "${opens}" no longer closes at component level`);
  return source.slice(from, to);
};

describe('the wait for the tutor says who, and nothing else', () => {
  test('the line names the tutor the learner picked, with no ellipsis', () => {
    const names = Object.values(TUTOR_VOICES).map((voice) => voice.persona.name);
    assert.ok(new Set(names).size > 1, 'the catalogue has one tutor, so this cannot tell a name from a constant');
    for (const name of names) {
      assert.equal(waitingFor(name), `Waiting for ${name}`);
      assert.equal(waitingView({ safety: { kind: 'none' }, tutorName: name }).headline, waitingFor(name));
    }
  });

  test('both live screens draw the connecting and waiting pages from the helper, door included, with no other line', () => {
    for (const [name, file, waitingOpens] of [
      ['the lesson', 'LiveSessionScreen.tsx', 'if (!live.prompt) {'],
      ['the conversation', 'ConvoScreen.tsx', 'if (!view) {'],
    ] as const) {
      const source = read(file);
      const connecting = branchOf(source, "if (live.status.phase === 'connecting'");
      assert.match(connecting, /<RoomWait state="connecting" title=\{waitingFor\(tutorName\)\} leaveLabel=\{LEAVE_LABEL\} onLeave=\{leaveNow\} \/>/,
        `${name} connects under some other line, or without the door`);
      const waiting = branchOf(source, waitingOpens);
      assert.match(waiting, /<RoomWait title=\{waiting\.headline\} leaveLabel=\{waiting\.leaveLabel\} onLeave=\{leaveNow\}/,
        `${name} waits under a second line, or without the door`);
      assert.doesNotMatch(source, /connectingView|CONNECTING_|connectingMs|waitingNote/, `${name} still carries the old staged wait`);
    }
    assert.equal(LEAVE_LABEL, 'Leave');
  });

  test('the first live practice says the same while it connects', () => {
    const practice = read('onboarding/FirstLivePractice.tsx');
    assert.match(practice, /!ready \? waitingFor\(name\) :/);
    assert.doesNotMatch(practice, /Connecting to/);
  });
});
