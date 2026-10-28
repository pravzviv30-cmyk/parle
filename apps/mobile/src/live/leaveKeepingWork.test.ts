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

import { conversationXp } from '@luvani/core';
import { LEAVE_RECAP_WAIT_MS, LOCAL_SETTLE_XP, learnerLine, leaveKeepsWork, leaveOnConfirm, leaveOnTimeout } from './leaveKeepingWork.ts';
import { banksPracticeFor, recapUse, sessionCredit } from '../recap/sessionCredit.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
const open = { stopped: false, reportHeld: false, recapArrived: false };

describe('leaving keeps the work once the learner has replied — F905', () => {
  test('leaving a typed scene after a learner turn keeps a recap, the modelled lines and the minutes', () => {
    // The real sequence, through the functions the screen runs at each step.
    // 1. Leave is confirmed after one agent-confirmed reply: keep the room and ask for the recap.
    const state = { ...open, learnerReplies: 1 };
    assert.deepEqual(leaveOnConfirm(state), [{ kind: 'request-recap' }]);
    // 2. The recap arrives: the recap effect banks the modelled lines and settles the sitting (minutes, XP).
    const stats = { turns: 4, rescues: 1, unassistedRate: 0.75, learnerReplies: 1 };
    const use = recapUse(sessionCredit(stats), 'end');
    assert.equal(use.settle, true, 'the minutes were not settled');
    assert.equal(banksPracticeFor(stats, 0), true);
    // 3. The end card shows: nothing tears the room down until the learner leaves it.
    assert.ok(!leaveOnConfirm(state).some((a) => a.kind === 'teardown'));
  });

  test('the leave sheet hands its commit to the keep-the-work sequence', () => {
    // Source-reading pins: there is no renderer, so the wiring is read as text.
    const screen = read('../ConvoScreen.tsx');
    assert.match(screen, /const leaveKeepingWork = \(\): boolean =>/);
    assert.match(screen, /leaveOnConfirm\(\{/);
    assert.match(screen, /setLeaveWaiting\(true\); setFinishing\(true\); live\.requestRecap\(\);/);
    assert.match(screen, /else if \(!leaveKeepingWork\(\)\) leaveNow\(\);/);
    assert.match(screen, /leaveConfirmCopy\('conversation', learnerReplies\)/);
    // The count is the hook's agent-confirmed scene replies, never the optimistic typed line (F).
    assert.match(screen, /const learnerReplies = live\.sceneReplies \+ carriedRepliesRef\.current;/);
  });

  test('leaving with no reply stays instant', () => {
    assert.deepEqual(leaveOnConfirm({ ...open, learnerReplies: 0 }), [{ kind: 'teardown' }]);
    // A stopped room, a held report or a recap already here never wait either.
    for (const odd of [{ stopped: true }, { reportHeld: true }, { recapArrived: true }]) {
      assert.deepEqual(leaveOnConfirm({ ...open, learnerReplies: 2, ...odd }), [{ kind: 'teardown' }]);
    }
    assert.equal(leaveKeepsWork({ ...open, learnerReplies: 0 }), false);
  });

  test('a recap that never comes falls back to the ordinary leave, and still counts the minutes it promised', () => {
    assert.ok(LEAVE_RECAP_WAIT_MS > 0 && LEAVE_RECAP_WAIT_MS <= 8_000, 'a leave waits longer than about eight seconds');
    // The sheet promised minutes: they are settled locally, at the zero-phrase base XP so activeMs is kept.
    assert.equal(LOCAL_SETTLE_XP, conversationXp({ phraseCount: 0, unassistedRate: 0 }));
    assert.ok(LOCAL_SETTLE_XP > 0, 'a zero XP write would drop the minutes');
    assert.deepEqual(leaveOnTimeout({ confirmedReplies: 2, stopped: false, recapSettled: false }),
      [{ kind: 'settle-local', xp: LOCAL_SETTLE_XP }, { kind: 'teardown' }]);
    // No reply, a stop, or a recap that already settled the sitting: only the ordinary teardown.
    assert.deepEqual(leaveOnTimeout({ confirmedReplies: 0, stopped: false, recapSettled: false }), [{ kind: 'teardown' }]);
    assert.deepEqual(leaveOnTimeout({ confirmedReplies: 2, stopped: true, recapSettled: false }), [{ kind: 'teardown' }]);
    assert.deepEqual(leaveOnTimeout({ confirmedReplies: 2, stopped: false, recapSettled: true }), [{ kind: 'teardown' }]);
    const screen = read('../ConvoScreen.tsx');
    assert.match(screen, /leaveWaiting \? LEAVE_RECAP_WAIT_MS : RECAP_WAIT_MS/);
    assert.match(screen, /recapBailLeave\.current = leaveWaiting \? leaveTimedOut : leaveNow/);
    assert.match(screen, /for \(const action of leaveOnTimeout\(\{/);
  });

  test('a topic picked on the choosing screen does not make Leave wait', () => {
    // The agent's learnerReplies excludes the topic pick (47275ec2); the app must agree.
    // The line is still marked for the transcript, and the hook's count skips it
    // (driven in useLiveSession.test.ts, 'only agent-confirmed scene replies count').
    const topic = learnerLine({ fr: 'Le café', frWritten: null, en: null }, true);
    assert.equal(topic.topic, true);
    assert.equal(learnerLine({ fr: 'Un café', frWritten: null, en: null }, false).topic, undefined);
    assert.deepEqual(leaveOnConfirm({ ...open, learnerReplies: 0 }), [{ kind: 'teardown' }]);

    const hook = read('./useLiveSession.ts');
    assert.equal((hook.match(/addTurn\(learnerLine\(\{/g) ?? []).length, 2, 'a learner line is added without the choosing mark');
    assert.doesNotMatch(hook, /addTurn\(\{ who: 'learner'/);
    assert.match(hook, /setOpening\(null\);\s*choosingRef\.current = false;/);
    assert.match(hook, /setOpening\(\{ prompt: msg\.prompt \}\);\s*choosingRef\.current = true;/);
  });

  test('a recap that lands after the local settle does not settle the sitting twice', () => {
    const credit = sessionCredit({ turns: 4, rescues: 0, unassistedRate: 1, learnerReplies: 2 });
    assert.equal(recapUse(credit, 'end', false).settle, true);
    assert.equal(recapUse(credit, 'end', true).settle, false, 'a recap after the local settle settled the sitting again');
    const screen = read('../ConvoScreen.tsx');
    assert.match(screen, /settledLocallyRef\.current = true;/);
    assert.match(screen, /recapUse\(credit, switchingRef\.current \? 'switch' : 'end', settledLocallyRef\.current\)/);
  });
});
