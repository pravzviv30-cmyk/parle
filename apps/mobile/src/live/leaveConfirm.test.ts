/**
 * The one leave-confirmation's words, held to the product's rules.
 *
 * The copy lives in a plain module rather than in the two live screens, so the
 * question "is this honest, and does it obey the mid-session rules" can be asked
 * once here instead of read out of JSX on two surfaces. Same move as
 * `connectingView.ts`: the words a screen assembles for itself are the words
 * nothing can test.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { leaveConfirmCopy } from './leaveConfirm.ts';

const ROOMS = ['lesson', 'conversation'] as const;

describe('the leave confirm asks honestly and keeps the mid-session rules — F310', () => {
  test('both rooms return the four strings, and the answers are Stay and Leave', () => {
    for (const room of ROOMS) {
      const copy = leaveConfirmCopy(room);
      assert.equal(typeof copy.title, 'string');
      assert.equal(typeof copy.body, 'string');
      assert.ok(copy.title.length > 0, `${room} has no title`);
      assert.ok(copy.body.length > 0, `${room} has no body`);
      // Stay first and Leave second is the design-system's own ordering; the
      // words are fixed so the sheet cannot drift into a native "OK/Cancel".
      assert.equal(copy.stay, 'Stay', `${room} does not offer to stay`);
      assert.equal(copy.leave, 'Leave', `${room} does not name the way out Leave`);
    }
  });

  test('nothing in the copy remarks, scores, counts, or carries an em dash', () => {
    for (const room of ROOMS) {
      const copy = leaveConfirmCopy(room);
      for (const line of [copy.title, copy.body, copy.stay, copy.leave]) {
        assert.ok(!/—/.test(line), `${room}: "${line}" carries an em dash`);
        assert.ok(!/\d/.test(line), `${room}: "${line}" carries a digit; minutes are not counted at the door`);
        assert.ok(!/hesitat/i.test(line), `${room}: "${line}" remarks on the learner hesitating`);
        assert.ok(!/score/i.test(line), `${room}: "${line}" mentions a score`);
        assert.ok(!/pronunc/i.test(line), `${room}: "${line}" mentions pronunciation`);
      }
    }
  });

  test('the body is honest that the meter stops', () => {
    for (const room of ROOMS) {
      const copy = leaveConfirmCopy(room);
      assert.match(copy.body, /minutes stop/, `${room}: the body does not say the minutes stop here`);
    }
  });

  test('each room speaks about the room the learner is actually in', () => {
    assert.match(leaveConfirmCopy('lesson').title, /lesson/i);
    assert.match(leaveConfirmCopy('conversation').title, /conversation/i);
  });
});
