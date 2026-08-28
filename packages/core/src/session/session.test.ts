import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  createSession,
  currentPrompt,
  grade,
  submitTurn,
  summarise,
  MAX_ATTEMPTS_PER_TURN,
  INTELLIGIBLE,
  CORRECTION_COOLDOWN_TURNS,
  MOVED_ON_LINES,
  type LearnerInput,
  type SessionState,
  FEEDBACK_FAMILIES,
} from './session.ts';
import { CAFE_LESSON } from '../lessons/cafe.ts';
import { RUNGS, STUCK_SILENCE_MS } from '../ladder/ladder.ts';
import type { PhonemeObservation } from '../phonemes/scoring.ts';

const lesson = CAFE_LESSON;

/** A learner who says the right thing, well. */
function said(text: string, score = 95, durationSec = 2): LearnerInput {
  return { type: 'spoke', transcript: text, durationSec, phonemes: [{ ipa: 'ʁ', score, word: text }] };
}

const stuck: LearnerInput = { type: 'silence', durationMs: STUCK_SILENCE_MS };

/** A confident answer that is not the line, on any turn of this lesson. */
function wrong(): LearnerInput {
  return { type: 'spoke', transcript: 'un éléphant', durationSec: 2, phonemes: [] };
}

/**
 * Walk `count` lesson turns of nothing but misses, keeping every line the tutor
 * said, grouped by the lesson turn it was said on.
 */
function missEveryTurn(count: number): { saidOnTurn: string[][]; state: SessionState } {
  let s = createSession(lesson);
  const saidOnTurn: string[][] = Array.from({ length: count }, () => []);
  let guard = 0;
  while (s.turnIndex < count && !s.finished && guard++ < count * MAX_ATTEMPTS_PER_TURN + 4) {
    const on = s.turnIndex;
    const out = step(s, wrong());
    saidOnTurn[on]!.push(out.feedback.message);
    s = out.state;
  }
  return { saidOnTurn, state: s };
}

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
    // Each outcome is a small family rotated on the turn now, so the assertion
    // is which family answered, not which words came out of it. The intent is
    // unchanged and is the whole point of the test: a rescue is a hand offered,
    // never a telling-off.
    assert.ok(
      FEEDBACK_FAMILIES.rescued.includes(feedback.message),
      `a rescue said something outside the rescue family: "${feedback.message}"`,
    );
    assert.ok(
      !FEEDBACK_FAMILIES.missed.includes(feedback.message),
      'silence was answered as a miss, which is the thing this test exists to stop',
    );
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
    assert.ok(
      FEEDBACK_FAMILIES.partial.includes(feedback.message),
      `a near miss said something outside the partial family: "${feedback.message}"`,
    );
    assert.ok(
      !FEEDBACK_FAMILIES.missed.includes(feedback.message),
      'they got the meaning across and were told they missed',
    );
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

  test('every line of every feedback family is safe, distinct, and says something', () => {
    // The sweep below drives real turns, so it only ever samples the variants
    // those turns happen to land on. This walks all of them: a family exists so
    // a twelve-turn lesson does not say the identical three words twelve times,
    // and a variant nobody checked is exactly where a scold gets in.
    const seen = new Set<string>();
    for (const [name, family] of Object.entries(FEEDBACK_FAMILIES)) {
      assert.ok(family.length >= 2, `${name} is not a family, it is one line`);
      for (const line of family) {
        assert.doesNotMatch(line, /\d/, `${name} quotes a number: "${line}"`);
        assert.doesNotMatch(line, /wrong|bad|failed|incorrect/i, `${name} scolds: "${line}"`);
        assert.doesNotMatch(line, /don'?t worry|take your time/i, `${name} reassures: "${line}"`);
        assert.ok(line.trim().length > 0, `${name} has an empty line`);
        assert.ok(!seen.has(line), `"${line}" appears in two families, so the outcome is not legible`);
        seen.add(line);
      }
    }
  });

  test('the rotation is a function of the turn, so the same turn always says the same thing', () => {
    const first = step(createSession(lesson), said('Bonjour'));
    const again = step(createSession(lesson), said('Bonjour'));
    assert.equal(first.feedback.message, again.feedback.message);
  });

  test('a run of the same outcome is not a run of the same sentence', () => {
    // The repetition a learner actually hears as a machine. Twelve turns of
    // "Très bien." is a machine; the same praise said three ways is a person.
    let s = createSession(lesson);
    const said_: string[] = [];
    for (let i = 0; i < 4; i += 1) {
      const out = step(s, { type: 'skip' });
      s = out.state;
      said_.push(out.feedback.message);
    }
    assert.ok(new Set(said_).size > 1, `four skips in a row all said "${said_[0]}"`);
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

describe('a beginner who keeps missing the line', () => {
  test('six missed turns do not earn six corrections', () => {
    // The shape K1 already ruled out in conversation: a correction budget of one
    // per turn, spent on every turn, is still a correction on every turn. A
    // beginner corrected on everything stops talking.
    const { saidOnTurn, state } = missEveryTurn(6);
    const corrected = saidOnTurn.map((lines) => lines.some((line) => FEEDBACK_FAMILIES.missed.includes(line)));

    assert.ok(
      corrected.filter(Boolean).length < saidOnTurn.length,
      `all ${saidOnTurn.length} missed turns were corrected out loud: ${JSON.stringify(saidOnTurn)}`,
    );
    for (let i = 1; i < corrected.length; i += 1) {
      assert.ok(
        !(corrected[i] && corrected[i - 1]),
        `turns ${i} and ${i + 1} both broke the scene to correct, which is the rhythm K1 already ruled out`,
      );
    }
    assert.equal(
      state.struggledTurnIds.length,
      6,
      'a correction held back must still reach the review deck, or staying quiet loses the miss',
    );
    for (const lines of saidOnTurn) {
      for (const line of lines) {
        assert.ok(line.trim().length > 0, 'a miss answered with nothing at all leaves the learner mid-scene');
      }
    }
  });

  test('the first thing they get wrong is answered, never held back', () => {
    // The cooldown is about the second correction and the third. A learner whose
    // very first miss goes unremarked has been left to guess what happened.
    const { feedback } = step(createSession(lesson), wrong());
    assert.ok(
      FEEDBACK_FAMILIES.missed.includes(feedback.message),
      `the first miss of the session was held back: "${feedback.message}"`,
    );
  });

  test('a learner still inside the cooldown is told the line is coming round again', () => {
    const first = step(createSession(lesson), wrong()); // corrected, and the clock starts
    const second = step(first.state, wrong()); // same turn, attempts spent, lesson moves on
    const held = step(second.state, wrong()); // next turn, missed again, too soon to correct

    assert.ok(
      FEEDBACK_FAMILIES.again.includes(held.feedback.message),
      `a held-back miss said something outside the family for it: "${held.feedback.message}"`,
    );
    assert.equal(held.feedback.advanced, false, 'holding the correction must not also skip the turn');
    assert.equal(currentPrompt(lesson, held.state).position, 2, 'they are still on the line they just missed');
    assert.equal(
      currentPrompt(lesson, held.state).support.kind,
      'full-line',
      'the correction waits, but the support the rung owes them does not',
    );
  });

  test('a learner is corrected no more often here than in conversation', () => {
    // K1 settled this number for the live conversation, and the scripted lesson
    // used to keep its own copy of it. It does not any more: this declaration is
    // the number, and packages/brain/src/engine/grading.ts re-exports it as
    // INLINE_COACH_COOLDOWN_TURNS (F186). So changing it here changes both modes
    // at once, which is what makes it one decision rather than two that agree.
    assert.equal(
      CORRECTION_COOLDOWN_TURNS,
      2,
      'K1 settled this for both modes; brain reads this declaration, so a change here is a change to the live conversation too',
    );
  });
});

describe('feedback when the lesson has already left the line behind', () => {
  test('feedback copy never asks for a retry the lesson will not give', () => {
    const line = lesson.turns[0]!.target;

    // Two misses spends the attempts, so the engine moves on and the next thing
    // the learner hears is the tutor's next question, not another go at this one.
    const first = step(createSession(lesson), wrong());
    assert.equal(first.feedback.advanced, false, 'the first miss really does get another go');
    const missed = step(first.state, wrong());
    assert.equal(missed.feedback.advanced, true, 'the second miss really does move the lesson on');

    // A learner who froze twice is in exactly the same place.
    const frozeOnce = step(createSession(lesson), stuck);
    const froze = step(frozeOnce.state, stuck);
    assert.equal(froze.feedback.advanced, true, 'the second freeze really does move the lesson on');

    for (const { feedback } of [missed, froze]) {
      assert.doesNotMatch(
        feedback.message,
        /listen|try it|try again|another go|once more|have a go|together/i,
        `the lesson has left "${line}" behind and the copy still asks for another attempt: "${feedback.message}"`,
      );
      assert.ok(
        !FEEDBACK_FAMILIES.missed.includes(feedback.message),
        `the retry copy was used on a turn that is over: "${feedback.message}"`,
      );
      assert.ok(
        feedback.message.includes(line),
        `moving past "${line}" without ever saying it leaves the learner with nothing: "${feedback.message}"`,
      );
    }
  });

  test('every line said on the way past a missed turn hands the line over and asks for nothing', () => {
    // The sweep above only lands on whichever variant those two turns rotate to.
    // A variant nobody checked is exactly where a request for a retry gets back in.
    const target = "Un café, s'il vous plaît";
    const seen = new Set<string>();
    assert.ok(MOVED_ON_LINES.length >= 2, 'moving on is not a family, it is one line said every time');

    for (const variant of MOVED_ON_LINES) {
      const said = variant(target);
      assert.ok(said.includes(target), `the lesson moved on without ever saying the line: "${said}"`);
      assert.doesNotMatch(said, /listen|try it|try again|another go|once more|have a go/i, `asks for a retry: "${said}"`);
      assert.doesNotMatch(said, /\d/, `quotes a number: "${said}"`);
      assert.doesNotMatch(said, /wrong|bad|failed|incorrect/i, `scolds: "${said}"`);
      assert.doesNotMatch(said, /don'?t worry|take your time/i, `reassures: "${said}"`);
      assert.ok(!seen.has(said), `"${said}" appears twice, so the family is not a family`);
      seen.add(said);
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

describe('what the end card is allowed to claim', () => {
  test('a session with nothing scored reports pronunciation unavailable', () => {
    // The live path used to end here on every single session: no audio ever
    // reached the scorer, so there were no observations, so there was no focus
    // — and an empty focus renders exactly like a clean one.
    let state = createSession(lesson, RUNGS.FREE);
    state = step(state, { type: 'spoke', transcript: 'Bonjour', phonemes: [], durationSec: 2 }).state;
    const summary = summarise(state);

    assert.equal(summary.utterancesScored, 0);
    assert.equal(summary.pronunciation.focus, null);
    assert.equal(summary.pronunciationStatus, 'unavailable', 'never heard is not the same as nothing to fix');
  });

  test('a session that was scored and went well reports clean, not unavailable', () => {
    let state = createSession(lesson, RUNGS.FREE);
    state = step(state, said('Bonjour', 96)).state;
    const summary = summarise(state);

    assert.ok(summary.utterancesScored > 0);
    assert.equal(summary.pronunciationStatus, 'clean');
  });

  test('a session with a real problem reports it as scored', () => {
    const bad = (text: string): LearnerInput => ({
      type: 'spoke',
      transcript: text,
      durationSec: 2,
      phonemes: [
        { ipa: 'ʁ', score: 30, word: text, substituted: 'l' },
        { ipa: 'ʁ', score: 28, word: text, substituted: 'l' },
        { ipa: 'ʁ', score: 33, word: text, substituted: 'l' },
      ],
    });
    let state = createSession(lesson, RUNGS.FREE);
    state = step(state, bad('Bonjour')).state;
    const summary = summarise(state);

    assert.equal(summary.pronunciationStatus, 'scored');
    assert.equal(summary.pronunciation.focus?.phoneme.ipa, 'ʁ');
  });
});
