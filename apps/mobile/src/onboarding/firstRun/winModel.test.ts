/**
 * The first win (F754; come alive, README Part 5.C row 8).
 *
 * The rules are `winModel.ts`, held here against real checks from core rather
 * than invented feedback: the learner's own line beside the natural line, the
 * celebration only for an accepted reply the learner really gave, and the calm
 * page for everything else. The second half reads the screen, because the
 * coral ground, the moment and its sound are wired in `PreAccountOnboarding.tsx`
 * and there is no renderer in this suite (docs/TESTING.md).
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { checkStarter, starterTasks } from '@luvani/core';
import { evidence } from '../../../test/evidence.ts';
import { BURST_MAX } from '../../motion/tokens.ts';
import { FIRST_RUN_COPY } from './copy.ts';
import { ECHO_LINE, WIN_BURST, winEffects, winView } from './winModel.ts';

const [drink] = starterTasks('food', 'coffee', 5);
const [hello] = starterTasks('family', 'coffee', 5);

describe('the first win — F754', () => {
  test("the win shows the learner's line beside the natural line and celebrates only an accepted real reply", () => {
    assert.ok(drink && hello, 'the starter routes this test reads are gone');

    // An accepted typed reply in the learner's own words: their line, then the
    // natural one, and the one celebration with its sound and haptic.
    const typed = 'je prends un café';
    const accepted = { reply: typed, feedback: checkStarter(drink, typed, 'typed') };
    assert.equal(accepted.feedback.accepted, true, 'core no longer accepts a real variant; pick another reply');
    const won = winView(accepted, drink.model, true);
    assert.equal(won.celebrate, true, 'an accepted reply the learner typed is not celebrated');
    assert.equal(won.said, typed, 'the learner does not see the words they actually gave');
    assert.equal(won.model, drink.model, 'the natural line is not the task model');
    assert.equal(won.showModel, true, 'the natural line is hidden beside a reply that differs from it');
    assert.equal(won.identical, false);
    assert.equal(won.modelLabel, FIRST_RUN_COPY.naturalWay);
    assert.equal(won.title, 'That reply works.');
    assert.deepEqual(winEffects(won), { sound: 'correct', haptic: 'celebrate' }, 'the win plays something other than correct and celebrate()');

    // Spoken counts the same as typed: it is the learner's own reply.
    const spoken = winView({ reply: typed, feedback: checkStarter(drink, typed, 'spoken') }, drink.model, false);
    assert.equal(spoken.celebrate, true, 'an accepted spoken reply is not celebrated');

    // A played model is accepted but is nobody's reply: no celebration.
    const played = winView({ reply: drink.model, feedback: checkStarter(drink, drink.model, 'model') }, drink.model, false);
    assert.equal(played.celebrate, false, 'a played model was celebrated as the learner\'s win');
    assert.deepEqual(winEffects(played), { sound: 'nearly', haptic: 'soft' });

    // Not accepted: calm, the model to try, nearly and one soft haptic.
    const missed = winView({ reply: 'je ne sais pas', feedback: checkStarter(drink, 'je ne sais pas', 'typed') }, drink.model, false);
    assert.equal(missed.celebrate, false, 'a reply the check did not accept was celebrated');
    assert.equal(missed.title, 'Try this small change.');
    assert.equal(missed.modelLabel, FIRST_RUN_COPY.tryItLikeThis);
    assert.equal(missed.showModel, true, 'a reply that was not accepted is not shown the line to try');
    assert.deepEqual(winEffects(missed), { sound: 'nearly', haptic: 'soft' }, 'a calm page plays a win sound');

    // The natural line said exactly: one row says so instead of repeating it.
    const exact = winView({ reply: ` ${drink.model} `, feedback: checkStarter(drink, drink.model, 'typed') }, drink.model, false);
    assert.equal(exact.identical, true, 'the natural line said exactly is not recognised');
    assert.equal(exact.showModel, false, 'the same line is shown twice');
    assert.equal(exact.celebrate, true);

    // An echo (D20): core refuses it and its text already holds the model once.
    const echo = { reply: hello.prompt, feedback: checkStarter(hello, hello.prompt, 'typed') };
    assert.equal(echo.feedback.accepted, false, 'core accepts the question read back as an answer');
    assert.ok(echo.feedback.text.startsWith(ECHO_LINE), 'core no longer says the reply repeats the question');
    assert.ok(echo.feedback.text.includes(hello.model), 'the echo line no longer carries the model');
    const echoed = winView(echo, hello.model, false);
    assert.equal(echoed.echo, true);
    assert.equal(echoed.celebrate, false, 'an echo was celebrated');
    assert.equal(echoed.showModel, false, 'the model is shown a second time after an echo');

    // The primary action: the next real exchange while one remains, then Continue.
    assert.equal(winView(accepted, drink.model, true).primary, FIRST_RUN_COPY.nextExchange);
    assert.equal(winView(accepted, drink.model, false).primary, FIRST_RUN_COPY.continue);
    assert.equal(WIN_BURST, BURST_MAX.phone, 'the first win throws more confetti than a phone allows, or less than the spec');

    // The screen: coral only for a celebrated win, the moment only on a real
    // submit, and the sound and haptic the model chose.
    const screen = evidence('apps/mobile/src/onboarding/PreAccountOnboarding.tsx');
    assert.doesNotMatch(screen, /<WinArt|<WinCard|const submit =/);
    assert.match(screen, /next\.live\?\.outcome === 'completed' \? 'recap' : 'keep'/);
    const celebration = evidence('apps/mobile/src/onboarding/FirstSessionResult.tsx');
    assert.match(celebration, /record\.outcome === 'completed'/);
    assert.match(celebration, /haptic\.current = true; celebrate\(\)/);
    assert.match(celebration, /<Burst seed=\{`first-session:/);
    assert.match(celebration, /<TimedExit/);
    assert.doesNotMatch(screen, /icon="back"|label="Back"/);

    assert.match(celebration, /firstLiveSummary\(record\)/);
    assert.match(celebration, /record\.outcome !== 'completed'\) \{ done\(\); return;/);
    assert.match(celebration, /!reduced && <View/);
  });
});
