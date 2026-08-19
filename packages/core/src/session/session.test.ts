import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { createSession, currentPrompt, grade, submitTurn, summarise, MAX_ATTEMPTS_PER_TURN, INTELLIGIBLE, type LearnerInput, type SessionState } from './session.ts';
import { CAFE_LESSON } from '../lessons/cafe.ts';
import { RUNGS, STUCK_SILENCE_MS } from '../ladder/ladder.ts';
import type { PhonemeObservation } from '../phonemes/scoring.ts';

const lesson = CAFE_LESSON;

/** A learner who says the right thing, well. */
function said(text: string, score = 95, durationSec = 2): LearnerInput {
  return { type: 'spoke', transcript: text, durationSec, phonemes: [{ ipa: 'ʁ', score, word: text }] };
}

const stuck: LearnerInput = { type: 'silence', durationMs: STUCK_SILENCE_MS };

function step(state: SessionState, input: LearnerInput) {
  return submitTurn(lesson, state, input);
}

describe('what arrives through the speech path but carries no words', () => {
  test('an empty transcript is treated as silence, not a wrong answer', () => {
    const state = createSession(lesson, RUNGS.PROMPTED);
    // A cough, a passing bus, or the tutor's own voice in a speakerphone: the
    // recogniser fired and returned nothing. The learner did not say anything
    // wrong, because the learner did not say anything.
    const { state: after, feedback } = step(state, { type: 'spoke', transcript: '   ', phonemes: [], durationSec: 0 });

    assert.equal(feedback.rescued, true, 'silence is rescued, never marked wrong');
    assert.equal(after.ladder.rescues, 1);
    assert.equal(after.ladder.rung, RUNGS.CUED, 'one rung of extra support, exactly as a real pause gets');
    assert.equal(feedback.message, "Let's take that one together.");
    assert.notEqual(feedback.message, 'Not quite. Listen and try it this way.');
  });

  test('an empty transcript adds nothing to the record of what was said', () => {
    const state = createSession(lesson, RUNGS.PROMPTED);
    const { state: after } = step(state, { type: 'spoke', transcript: '', phonemes: [], durationSec: 0 });
    assert.equal(after.transcript.length, 0, 'nothing was said, so nothing is transcribed');
    assert.equal(after.wordsProduced.size, 0);
  });

  test('a near miss holds the rung instead of dropping it', () => {
    const state = createSession(lesson, RUNGS.PROMPTED);
    const first = step(state, said('Bonjour')); // turn 1, clean
    // Turn 2 is "Un café, s'il vous plaît". They ordered, they forgot the please.
    const { state: after, feedback } = step(first.state, said('un café'));

    assert.equal(feedback.wordsCorrect, false, 'the line was not complete');
    assert.equal(feedback.quality, 'partial');
    assert.equal(after.ladder.rung, first.state.ladder.rung, 'a near miss never costs a rung');
    assert.equal(feedback.message, 'Good. That got the message across.');
  });
});

describe('grading the two independent axes', () => {
  test('right words, good pronunciation is good', () => {
    assert.equal(grade(true, 90), 'good');
  });

  test('right words with a heavy accent still count — the ladder measures composing, not sounding French', () => {
    // A learner whose /ʁ/ scores 44 and whose nasals sit around 60 is a completely
    // typical anglophone beginner. Gating promotion on accent strands them at Echo
    // forever, which is the exact failure this product exists to prevent.
    assert.equal(grade(true, 58), 'good');
  });

  test('only genuinely unintelligible speech holds position', () => {
    assert.equal(grade(true, INTELLIGIBLE - 1), 'partial');
  });

  test('unintelligible speech holds, but never drops the learner a rung', () => {
    const { state } = submitTurn(lesson, createSession(lesson, RUNGS.PROMPTED), {
      type: 'spoke',
      transcript: 'Bonjour', // the right word for turn 1, said badly
      phonemes: [{ ipa: 'ʁ', score: 20, word: 'bonjour' }],
      durationSec: 2,
    });
    assert.equal(state.ladder.rung, RUNGS.PROMPTED);
  });

  test('wrong words is poor no matter how beautifully it was said', () => {
    assert.equal(grade(false, 100), 'poor');
  });

  test('unscored audio is never penalised for the absence of a score', () => {
    assert.equal(grade(true, null), 'good');
  });
});

describe('session flow', () => {
  test('opens on the lesson’s opening rung with the full line shown', () => {
    const s = createSession(lesson);
    const p = currentPrompt(lesson, s);
    assert.equal(p.directive.rung, RUNGS.ECHO);
    assert.equal(p.support.kind, 'full-line');
    assert.equal(p.position, 1);
    assert.equal(p.total, lesson.turns.length);
  });

  test('a correct answer advances the lesson', () => {
    const { state, feedback } = step(createSession(lesson), said('Bonjour'));
    assert.equal(feedback.advanced, true);
    assert.equal(feedback.quality, 'good');
    assert.equal(currentPrompt(lesson, state).position, 2);
  });

  test('a brief pause changes absolutely nothing', () => {
    const before = createSession(lesson);
    const { state, feedback } = step(before, { type: 'silence', durationMs: STUCK_SILENCE_MS - 1 });
    assert.equal(state, before, 'a thinking pause must be a no-op');
    assert.equal(feedback.advanced, false);
  });

  test('support is withdrawn as the learner succeeds', () => {
    let s = createSession(lesson);
    s = step(s, said('Bonjour')).state;
    s = step(s, said("Un café, s'il vous plaît")).state;
    assert.equal(currentPrompt(lesson, s).support.kind, 'options', 'two good turns should withdraw the full line');
  });

  test('never shows more than three options — four is homework', () => {
    let s = createSession(lesson);
    s = step(s, said('Bonjour')).state;
    s = step(s, said("Un café, s'il vous plaît")).state;
    const support = currentPrompt(lesson, s).support;
    assert.equal(support.kind, 'options');
    if (support.kind === 'options') assert.ok(support.options.length <= 3);
  });
});

describe('the stuck learner — the behaviour the whole product rests on', () => {
  test('going silent re-attempts the same turn with more support, rather than skipping it', () => {
    const s0 = createSession(lesson, RUNGS.PROMPTED);
    const { state, feedback } = step(s0, stuck);
    assert.equal(feedback.rescued, true);
    assert.equal(feedback.advanced, false, 'a rescue must not skip the turn');
    assert.equal(currentPrompt(lesson, state).position, 1, 'still on the same turn');
    // The turn they just froze on is answered with the answer, whatever rung the
    // freeze happened at. The rung drop governs what comes next, not this.
    assert.equal(currentPrompt(lesson, state).support.kind, 'full-line', 'a freeze is answered with the line');
    assert.equal(state.ladder.rung, RUNGS.CUED, 'and the rung still drops for the next attempt');
  });

  test('a rescue hands over the full line from every rung', () => {
    for (const rung of [RUNGS.ECHO, RUNGS.CUED, RUNGS.PROMPTED, RUNGS.FREE] as const) {
      const { state, feedback } = step(createSession(lesson, rung), stuck);
      assert.equal(feedback.rescued, true, `rung ${rung} should rescue`);
      assert.equal(
        currentPrompt(lesson, state).support.kind,
        'full-line',
        `a learner who froze at rung ${rung} must be handed the line, not asked to compose again`,
      );
      assert.ok(state.ladder.rung < rung || rung === RUNGS.ECHO, 'the rung still drops, except at the floor');
    }
  });

  test('the line is a rescue courtesy, not a new rung — support returns on the next turn', () => {
    const rescued = step(createSession(lesson, RUNGS.FREE), stuck);
    assert.equal(currentPrompt(lesson, rescued.state).support.kind, 'full-line');
    // They answer it. Support goes back to what the dropped rung actually offers.
    const next = step(rescued.state, said('Bonjour'));
    assert.equal(currentPrompt(lesson, next.state).support.kind, 'hint', 'rung 3 support, as the drop intended');
  });

  test('the rescue message offers help without ever naming the struggle', () => {
    const { feedback } = step(createSession(lesson, RUNGS.PROMPTED), stuck);
    assert.equal(feedback.message, "Let's take that one together.");
    assert.doesNotMatch(feedback.message, /wrong|incorrect|failed|try again/i);
  });

  test('a learner who is silent throughout still reaches the end of the lesson', () => {
    let s = createSession(lesson);
    for (let i = 0; i < lesson.turns.length * MAX_ATTEMPTS_PER_TURN + 5 && !s.finished; i++) {
      s = step(s, stuck).state;
    }
    assert.equal(s.finished, true, 'the lesson must always terminate — nobody gets trapped on turn one');
  });

  test('a wrong answer re-attempts once, then the conversation moves on', () => {
    const s0 = createSession(lesson);
    const first = step(s0, said('Je voudrais un éléphant'));
    assert.equal(first.feedback.quality, 'poor');
    assert.equal(first.feedback.advanced, false, 'first miss gets another go');

    const second = step(first.state, said('Toujours un éléphant'));
    assert.equal(second.feedback.advanced, true, 'a human tutor moves on rather than drilling you into the ground');
  });

  test('asking for help is never scored against the learner', () => {
    const { feedback } = step(createSession(lesson, RUNGS.FREE), { type: 'help' });
    assert.equal(feedback.rescued, true);
    assert.doesNotMatch(feedback.message, /wrong|no|incorrect/i);
  });

  test('no mid-session message ever scolds or quotes a number', () => {
    const inputs: LearnerInput[] = [said('Bonjour'), said('nonsense'), stuck, { type: 'help' }, { type: 'skip' }, said('Bonjour', 40)];
    let s = createSession(lesson);
    for (const i of inputs) {
      const { state, feedback } = step(s, i);
      s = state;
      assert.doesNotMatch(feedback.message, /\d/, `message quotes a number: "${feedback.message}"`);
      assert.doesNotMatch(feedback.message, /wrong|bad|failed|incorrect/i, `message scolds: "${feedback.message}"`);
    }
  });
});

describe('vocabulary and progress accounting', () => {
  test('only correctly-said words are credited — the card must not lie', () => {
    const good = step(createSession(lesson), said('Bonjour')).state;
    assert.deepEqual(summarise(good).wordsProduced, ['bonjour']);

    const bad = step(createSession(lesson), said('Je voudrais un éléphant')).state;
    assert.deepEqual(summarise(bad).wordsProduced, [], 'a garbled answer must not inflate vocabulary');
  });

  test('words accumulate across turns without duplicates', () => {
    let s = createSession(lesson);
    s = step(s, said('Bonjour')).state;
    s = step(s, said("Un café, s'il vous plaît")).state;
    const words = summarise(s).wordsProduced;
    assert.ok(words.includes('bonjour'));
    assert.equal(new Set(words).size, words.length);
  });

  test('the vocabulary list keeps real French spelling, not the matching form', () => {
    let s = createSession(lesson);
    s = step(s, said('Bonjour')).state; // turn 1
    s = step(s, said("Un café, s'il vous plaît")).state; // turn 2
    const words = summarise(s).wordsProduced;
    assert.ok(words.includes('café'), `accents must survive to the carnet: ${words.join(', ')}`);
    assert.ok(words.includes('plaît'));
    assert.ok(words.includes("s'il"), 'apostrophes are part of the word, not punctuation to strip');
    assert.ok(!words.includes('cafe'), 'the stripped matching form must never be shown to a French learner');
    assert.ok(!words.includes('sil'));
  });

  test('longest unbroken French turn is tracked', () => {
    let s = createSession(lesson);
    s = step(s, said('Bonjour', 95, 1.5)).state;
    s = step(s, said("Un café, s'il vous plaît", 95, 4.2)).state;
    assert.equal(summarise(s).longestTurnSec, 4.2);
  });

  test('rescues are counted for the fingerprint but never surfaced as failures', () => {
    let s = createSession(lesson, RUNGS.PROMPTED);
    s = step(s, stuck).state;
    assert.equal(summarise(s).rescues, 1);
  });

  test('speaking share is bounded to a sensible fraction', () => {
    const s = step(createSession(lesson), said('Bonjour', 95, 3)).state;
    const share = summarise(s).speakingShare;
    assert.ok(share >= 0 && share <= 1);
  });

  test('an untouched session summarises without throwing', () => {
    const sum = summarise(createSession(lesson));
    assert.equal(sum.pronunciation.focus, null);
    assert.deepEqual(sum.wordsProduced, []);
    assert.equal(sum.unassistedRate, 0);
    assert.equal(sum.speakingShare, 0);
  });
});

describe('end-of-session pronunciation report', () => {
  test('a consistently weak sound becomes the single focus, with a drill', () => {
    const weakR = (word: string): LearnerInput => ({
      type: 'spoke',
      transcript: word,
      durationSec: 2,
      phonemes: [{ ipa: 'ʁ', score: 38, word, substituted: 'l' }],
    });

    let s = createSession(lesson);
    s = step(s, weakR('Bonjour')).state;
    s = step(s, weakR("Un café, s'il vous plaît")).state;
    s = step(s, weakR("Sur place, s'il vous plaît")).state;

    const report = summarise(s).pronunciation;
    assert.ok(report.focus, 'three weak samples of a difficulty-5 sound should produce a focus');
    assert.equal(report.focus.phoneme.ipa, 'ʁ');
    assert.equal(report.focus.drill.id, 'r-vs-l', 'should pick the drill contrasting the exact substitution');
  });

  test('a strong session produces no focus rather than manufacturing a problem', () => {
    let s = createSession(lesson);
    for (const t of ['Bonjour', "Un café, s'il vous plaît", "Sur place, s'il vous plaît"]) {
      s = step(s, said(t, 96)).state;
    }
    assert.equal(summarise(s).pronunciation.focus, null);
  });
});

describe('what the session hands the review deck', () => {
  // Struggled turns become tomorrow's "say it in French" cards. Recording them
  // silently, and re-asking later, is the mistakes-queue alternative to marking
  // anything wrong in the moment.

  test('a rescue records the turn for later review', () => {
    const { state } = step(createSession(lesson, RUNGS.PROMPTED), stuck);
    assert.deepEqual(state.struggledTurnIds, [lesson.turns[0]!.id]);
  });

  test('a wrong answer records the turn too', () => {
    const { state } = step(createSession(lesson), said('Je voudrais un éléphant'));
    assert.deepEqual(state.struggledTurnIds, [lesson.turns[0]!.id]);
  });

  test('missing the same turn twice queues it once — one card, not a pile', () => {
    let s = createSession(lesson);
    s = step(s, said('Je voudrais un éléphant')).state;
    s = step(s, said('Toujours un éléphant')).state;
    assert.deepEqual(s.struggledTurnIds, [lesson.turns[0]!.id]);
  });

  test('clean turns leave no trace — the queue holds struggles, not history', () => {
    let s = createSession(lesson);
    s = step(s, said('Bonjour')).state;
    s = step(s, said("Un café, s'il vous plaît")).state;
    assert.deepEqual(s.struggledTurnIds, []);
  });

  test('the summary carries the struggled turns out of the session', () => {
    const { state } = step(createSession(lesson, RUNGS.PROMPTED), stuck);
    assert.deepEqual(summarise(state).struggledTurnIds, [lesson.turns[0]!.id]);
  });

  test('the next session opens one rung below where this one finished', () => {
    // Starting cold at the edge of your ability is how a session dies in its
    // first thirty seconds; the ladder climbs back within two good turns anyway.
    let s = createSession(lesson, RUNGS.FREE);
    s = step(s, said('Bonjour')).state;
    assert.equal(s.ladder.rung, RUNGS.FREE);
    assert.equal(summarise(s).nextStartRung, RUNGS.PROMPTED);
  });

  test('a learner who finished on the bottom rung starts there again, never below', () => {
    const sum = summarise(createSession(lesson, RUNGS.ECHO));
    assert.equal(sum.nextStartRung, RUNGS.ECHO, 'the rung is clamped at Echo; there is no rung zero');
  });
});

describe('a complete run through the lesson', () => {
  test('a competent learner finishes, climbs to free conversation, and is never rescued', () => {
    let s = createSession(lesson);
    let guard = 0;
    while (!s.finished && guard++ < 50) {
      const prompt = currentPrompt(lesson, s);
      const obs: PhonemeObservation[] = prompt.turn.focusPhonemes.map((ipa) => ({ ipa, score: 92, word: prompt.turn.target }));
      s = step(s, { type: 'spoke', transcript: prompt.turn.target, phonemes: obs, durationSec: 2.5 }).state;
    }

    assert.equal(s.finished, true);
    assert.equal(s.ladder.rescues, 0);
    assert.equal(s.ladder.rung, RUNGS.FREE, 'a learner who gets everything right should end unscaffolded');

    const sum = summarise(s);
    assert.equal(sum.turnsCompleted, lesson.turns.length);
    assert.ok(sum.wordsProduced.length > 15, `expected a real vocabulary haul, got ${sum.wordsProduced.length}`);
    assert.ok(sum.unassistedRate > 0.5, 'most turns should have been composed unaided');
    assert.equal(sum.pronunciation.focus, null, 'nothing to fix after a clean run');
  });
});
