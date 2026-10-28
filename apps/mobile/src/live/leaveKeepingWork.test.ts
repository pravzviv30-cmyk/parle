/**
 * Leaving with work kept (F905, founder decision 2026-10-28).
 *
 * Leave used to tear the room down at once, so the agent's recap was published
 * into a closed room: no lines saved, no minutes counted. After one learner
 * reply, Leave now does what Finish does and waits a short while for the recap.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { LEAVE_RECAP_WAIT_MS, learnerLine, learnerRepliesInRoom, leaveKeepsWork } from './leaveKeepingWork.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
const line = (who: 'tutor' | 'learner' | 'narration', fr = 'x') => ({ id: `${who}-${fr}`, who, fr, frWritten: null, en: null });
const open = { stopped: false, reportHeld: false, recapArrived: false };

describe('leaving keeps the work once the learner has replied — F905', () => {
  test('leaving a typed scene after a learner turn keeps a recap, the modelled lines and the minutes', () => {
    const turns = [line('narration'), line('tutor', 'Bonjour'), line('learner', 'Un café')];
    assert.equal(learnerRepliesInRoom(turns), 1);
    assert.equal(leaveKeepsWork({ ...open, learnerReplies: learnerRepliesInRoom(turns) }), true);

    // Wiring: the leave sheet's commit asks first, and keeping the work is the
    // Finish path (room kept, recap requested), so the recap effect banks the
    // practice and settles the minutes exactly as it does for Finish.
    const screen = read('../ConvoScreen.tsx');
    assert.match(screen, /const leaveKeepingWork = \(\): boolean =>/);
    assert.match(screen, /leaveKeepsWork\(\{/);
    assert.match(screen, /setLeaveWaiting\(true\); setFinishing\(true\); live\.requestRecap\(\);/);
    assert.match(screen, /else if \(!leaveKeepingWork\(\)\) leaveNow\(\);/);
    assert.match(screen, /leaveConfirmCopy\('conversation', learnerReplies\)/);
  });

  test('leaving with no reply stays instant', () => {
    // Tutor lines, narration and rescues are never learner replies.
    const turns = [line('narration'), line('tutor', 'Bonjour'), line('tutor', 'Je vous écoute')];
    assert.equal(learnerRepliesInRoom(turns), 0);
    assert.equal(leaveKeepsWork({ ...open, learnerReplies: 0 }), false);
    // A stopped room, a held report or a recap already here never wait either.
    assert.equal(leaveKeepsWork({ ...open, learnerReplies: 2, stopped: true }), false);
    assert.equal(leaveKeepsWork({ ...open, learnerReplies: 2, reportHeld: true }), false);
    assert.equal(leaveKeepsWork({ ...open, learnerReplies: 2, recapArrived: true }), false);
  });

  test('a recap that never comes falls back to the ordinary leave', () => {
    assert.ok(LEAVE_RECAP_WAIT_MS > 0 && LEAVE_RECAP_WAIT_MS <= 8_000, 'a leave waits longer than about eight seconds');
    const screen = read('../ConvoScreen.tsx');
    // The bail timer is the Finish one, shortened for a leave, and its exit is leaveNow.
    assert.match(screen, /leaveWaiting \? LEAVE_RECAP_WAIT_MS : RECAP_WAIT_MS/);
    assert.match(screen, /recapBailLeave\.current = leaveNow/);
  });

  test('a topic picked on the choosing screen does not make Leave wait', () => {
    // The agent's learnerReplies excludes the topic pick (47275ec2); the app must agree.
    const topic = { id: 'l1', ...learnerLine({ fr: 'Le café', frWritten: null, en: null }, true) };
    assert.equal(topic.topic, true);
    const turns = [line('tutor', 'What shall we talk about?'), topic, line('tutor', 'Bonjour')];
    assert.equal(learnerRepliesInRoom(turns), 0, 'a topic pick counted as a scene reply');
    assert.equal(leaveKeepsWork({ ...open, learnerReplies: learnerRepliesInRoom(turns) }), false);
    const reply = { id: 'l2', ...learnerLine({ fr: 'Un café', frWritten: null, en: null }, false) };
    assert.equal(reply.topic, undefined);
    assert.equal(learnerRepliesInRoom([...turns, reply]), 1);

    // The hook marks both learner paths, the confirmed transcript and the typed
    // optimistic line, by the choosing phase that 'opening' starts and the scene's first view ends.
    const hook = read('./useLiveSession.ts');
    assert.equal((hook.match(/addTurn\(learnerLine\(\{/g) ?? []).length, 2, 'a learner line is added without the choosing mark');
    assert.doesNotMatch(hook, /addTurn\(\{ who: 'learner'/);
    assert.match(hook, /setOpening\(null\);\s*choosingRef\.current = false;/);
    assert.match(hook, /setOpening\(\{ prompt: msg\.prompt \}\);\s*choosingRef\.current = true;/);
  });
});
