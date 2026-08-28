/**
 * The finish wait.
 *
 * Ceiling, stated plainly: there is no renderer in this suite
 * (docs/TESTING.md). The first test calls the module, which is where the whole
 * decision now lives. The second reads ConvoScreen.tsx as text, so it can prove
 * the branch exists, asks the module, draws the module's answer and keeps the
 * bail that was already there — and cannot prove anything about how it looks.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { LEAVE_LABEL, RECAP_COMING, RECAP_COMING_NOTE, recapWait } from './recapWait.ts';

const convo = readFileSync(new URL('../ConvoScreen.tsx', import.meta.url).pathname, 'utf8');

describe('pressing Finish and waiting for the recap — F155', () => {
  test('the finish wait says a recap is coming and keeps the door', () => {
    // The bug: `finishing` was true and nothing on the screen said so, so the
    // learner sat in front of the ordinary scene for up to fifteen seconds.
    const waiting = recapWait({ finishing: true, recapArrived: false });
    assert.notEqual(waiting, null, 'pressing Finish still shows the learner nothing, which is F155 exactly');
    assert.equal(waiting?.headline, RECAP_COMING);
    assert.equal(waiting?.note, RECAP_COMING_NOTE);

    // It names the thing that was promised. A wait that does not mention the
    // recap is a spinner, which is what was already there.
    assert.match(waiting!.headline, /recap/i, 'the wait never says what is being waited for');

    // Nobody is held in here. The fifteen second bail is a floor under this,
    // not a substitute for it: a learner who does not want to wait leaves.
    assert.equal(waiting?.leaveLabel, LEAVE_LABEL, 'the finish wait strands the learner');

    // Not shown when it is not the thing on the screen. In particular it never
    // outlives its own answer: the recap has a whole surface of its own.
    assert.equal(recapWait({ finishing: false, recapArrived: false }), null, 'a wait appeared with nothing to wait for');
    assert.equal(recapWait({ finishing: true, recapArrived: true }), null, 'a spinner sat on top of a finished recap');
    assert.equal(recapWait({ finishing: false, recapArrived: true }), null);

    // House copy rules. No numbers mid-session, no em dash, and above all no
    // verdict: the recap is where the session gets described, and a line here
    // that graded it would be the app reaching a conclusion the tutor has not.
    for (const line of [RECAP_COMING, RECAP_COMING_NOTE, LEAVE_LABEL]) {
      assert.ok(!/\d/.test(line), `"${line}" carries a number`);
      assert.ok(!/—/.test(line), `"${line}" carries an em dash`);
      assert.ok(line.length <= 60, `"${line}" is too long for the calm slot`);
      assert.ok(
        !/score|percent|%|well done|great job|nice work|sorry|hang on/i.test(line),
        `"${line}" grades the session or apologises for the wait`,
      );
    }
  });

  test('the convo screen shows the recap wait while finishing', () => {
    assert.match(convo, /recapWait\(\{ finishing, recapArrived: live\.recap !== null \}\)/,
      'the screen decides the finish wait for itself, so nothing can ask it a question');
    assert.match(convo, /\{finishWait\.headline\}/, 'the screen draws a line the module did not give it');
    assert.match(convo, /\{finishWait\.note\}/, 'the second line was dropped on the way to the screen');
    assert.match(
      convo,
      /<GhostButton label=\{finishWait\.leaveLabel\} onPress=\{leaveNow\}/,
      'the finish wait has no door out of it',
    );

    // The wait is a surface with a spinner, drawn instead of the scene. Leaving
    // the scene underneath is what put a text box inviting more conversation in
    // front of somebody who had just ended it.
    const branch = convo.slice(convo.indexOf('if (finishWait)'), convo.indexOf('const listening ='));
    assert.ok(branch.length > 0, 'the finish wait is no longer a branch of its own; this test is stale');
    assert.match(branch, /<ActivityIndicator/, 'the wait says something is happening without showing it');
    assert.match(branch, /accessibilityLiveRegion="polite"/, 'the screen changed under a screen reader in silence');

    // And the two things the ledger says stay exactly as they were.
    assert.match(convo, /const RECAP_WAIT_MS = 15_000;/, 'the bail under the wait moved or changed length');
    assert.match(
      convo,
      /if \(!finishing \|\| live\.recap\) return;[\s\S]{0,200}setTimeout\(\(\) => leaveNow\(\), RECAP_WAIT_MS\)/,
      'the fifteen second bail out of the finish wait is gone, so a recap that never comes strands the learner',
    );
  });
});
