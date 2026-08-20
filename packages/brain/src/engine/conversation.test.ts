import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { STUCK_SILENCE_MS, directiveFor } from '@parle/core';

import {
  MAX_ATTEMPTS_PER_BEAT,
  MAX_SESSION_TOPICS,
  applyNonSpokenInput,
  createConversation,
  integrateTurn,
  openingRungFor,
  prepareTurn,
  type ConversationState,
  type LearnerSnapshot,
} from './conversation.ts';
import { CAFE_FRAME } from '../fixtures.ts';
import { sampleCoachItem, sampleTurn } from '../contract/samples.ts';
import type { TutorTurn } from '../contract/types.ts';

function learner(overrides: Partial<LearnerSnapshot> = {}): LearnerSnapshot {
  return { cefr: 'A2', confidence: 'low', watchFor: [], lastRung: null, sessions: 0, ...overrides };
}

function fresh(overrides: { strictness?: 'flow' | 'balanced' | 'strict'; maxTurns?: number } = {}, who = learner()): ConversationState {
  return createConversation(CAFE_FRAME, who, { strictness: overrides.strictness ?? 'balanced', maxTurns: overrides.maxTurns ?? 24 }, 1_000);
}

function spoke(text = 'Bonjour !'): { type: 'spoke'; text: string } {
  return { type: 'spoke', text };
}

/** A turn graded poor: English only, task not achieved. */
function poorTurn(overrides: Partial<TutorTurn> = {}): TutorTurn {
  return sampleTurn({
    assessment: { understood: true, taskAchieved: false, comprehensibility: 'clear', language: 'english', cefrEvidence: null },
    ...overrides,
  });
}

describe('opening rung', () => {
  test('a brand-new learner opens at the base rung for their level', () => {
    assert.equal(openingRungFor(learner({ cefr: 'A0' })), 1);
    assert.equal(openingRungFor(learner({ cefr: 'A2' })), 3);
    assert.equal(openingRungFor(learner({ cefr: 'B2' })), 4);
  });

  test('a returning learner starts one rung below where they could be', () => {
    assert.equal(openingRungFor(learner({ cefr: 'B2', lastRung: 4, sessions: 3 })), 3);
    assert.equal(openingRungFor(learner({ cefr: 'A2', lastRung: 2, sessions: 1 })), 1);
  });

  test('never below Echo', () => {
    assert.equal(openingRungFor(learner({ cefr: 'A0', lastRung: 1, sessions: 5 })), 1);
  });
});

describe('createConversation', () => {
  test('the scene opens spoken-for: opening line in history, support ready', () => {
    const state = fresh();
    assert.equal(state.history.length, 1);
    assert.ok(state.history[0]!.text.includes(CAFE_FRAME.openingLine.fr));
    assert.deepEqual(state.lastSupport, CAFE_FRAME.openingSupport);
    assert.equal(state.currentBeat, 'greet');
  });
});

describe('prepareTurn', () => {
  test('is byte-stable for identical state — cache safety', () => {
    const state = fresh();
    assert.deepEqual(prepareTurn(state, spoke()), prepareTurn(state, spoke()));
  });

  test('does not mutate state', () => {
    const state = fresh();
    const before = structuredClone(state);
    prepareTurn(state, spoke());
    assert.deepEqual(state, before);
  });

  test('carries the scene plan first and the app context last', () => {
    const request = prepareTurn(fresh(), spoke('Un café, s\'il vous plaît'));
    assert.ok(request.messages[0]!.text.startsWith('[SCENE PLAN FROM THE APP]'));
    const last = request.messages[request.messages.length - 1]!;
    assert.equal(last.role, 'system');
    assert.ok(last.text.startsWith('[CONTEXT FROM THE APP'));
    const learnerMsg = request.messages[request.messages.length - 2]!;
    assert.equal(learnerMsg.role, 'user');
    assert.equal(learnerMsg.text, "Un café, s'il vous plaît");
  });
});

describe('silence and aide-moi — the rescue, before any model call', () => {
  test('a short pause is thinking; nothing happens at all', () => {
    const state = fresh();
    const { state: after, view } = applyNonSpokenInput(state, { type: 'silence', durationMs: 1_500 });
    assert.deepEqual(after, state);
    assert.equal(view.rescued, false);
  });

  test('four seconds of nothing drops a rung and hands over more support instantly', () => {
    const state = fresh(); // A2 opens at rung 3 (hint)
    const { state: after, view } = applyNonSpokenInput(state, { type: 'silence', durationMs: STUCK_SILENCE_MS });
    assert.equal(after.ladder.rung, 2);
    assert.equal(after.ladder.rescues, 1);
    assert.equal(view.rescued, true);
    // The support renders instantly from material the last turn already carried —
    // and a rescue renders the whole line, not the rung's usual scaffolding. The
    // learner who just froze is handed the answer; the rung drop is for next time.
    assert.equal(view.supportView.kind, 'full-line');
  });

  test('a rescue never leaves the learner composing French they just could not compose', () => {
    // The A2 learner opens at rung 3 and freezes. Dropping to rung 2 alone would
    // hand back options; from rung 4 it would hand back an English hint, which is
    // the original stranding bug wearing a different hat.
    for (const rung of [1, 2, 3, 4] as const) {
      const state = { ...fresh(), ladder: { ...fresh().ladder, rung }, directive: directiveFor(rung) };
      const { view } = applyNonSpokenInput(state, { type: 'silence', durationMs: STUCK_SILENCE_MS });
      assert.equal(view.supportView.kind, 'full-line', `a freeze at rung ${rung} must be answered with the line`);
    }
  });

  test('the rescued directive reaches the next prepared prompt', () => {
    const state = fresh();
    const { state: after } = applyNonSpokenInput(state, { type: 'silence', durationMs: STUCK_SILENCE_MS });
    const request = prepareTurn(after, { type: 'silence', durationMs: STUCK_SILENCE_MS });
    const context = request.messages[request.messages.length - 1]!.text;
    assert.match(context, /do not mention that they hesitated/i);
    const learnerMsg = request.messages[request.messages.length - 2]!;
    assert.equal(learnerMsg.text, '[silence]');
  });

  test('aide-moi rescues the same way and is never scored against the learner', () => {
    const state = fresh();
    const { state: after, view } = applyNonSpokenInput(state, { type: 'help' });
    assert.equal(view.rescued, true);
    assert.equal(after.ladder.rung, 2);
    assert.equal(after.ladder.rescues, 1);
  });

  test('integrating the model reply after a rescue does not move the ladder again', () => {
    const state = fresh();
    const { state: rescued } = applyNonSpokenInput(state, { type: 'silence', durationMs: STUCK_SILENCE_MS });
    const { state: after } = integrateTurn(rescued, { type: 'silence', durationMs: STUCK_SILENCE_MS }, sampleTurn());
    assert.equal(after.ladder.rung, rescued.ladder.rung);
    assert.equal(after.ladder.rescues, 1);
  });
});

describe('the ladder in free conversation', () => {
  test('two good turns promote — same streak as scripted lessons', () => {
    let state = fresh(); // rung 3
    state = integrateTurn(state, spoke(), sampleTurn()).state;
    state = integrateTurn(state, spoke(), sampleTurn()).state;
    assert.equal(state.ladder.rung, 4);
  });

  test('a poor turn drops a rung', () => {
    const state = fresh(); // rung 3
    const { state: after } = integrateTurn(state, spoke('I want a coffee please'), poorTurn());
    assert.equal(after.ladder.rung, 2);
  });

  test('coaching alone never blocks promotion', () => {
    let state = fresh(); // rung 3
    const coached = sampleTurn({ coach: [sampleCoachItem({ kind: 'textbook-phrasing' })] });
    state = integrateTurn(state, spoke(), coached).state;
    state = integrateTurn(state, spoke(), coached).state;
    assert.equal(state.ladder.rung, 4);
  });
});

describe('beats — the conversation always moves', () => {
  test('a rescue never completes the beat the learner froze on', () => {
    const state = fresh();
    const silence = { type: 'silence', durationMs: STUCK_SILENCE_MS } as const;
    const { state: rescued } = applyNonSpokenInput(state, silence);
    const beatBefore = rescued.currentBeat;

    // The model has just modelled the line, so it reports the beat done — of
    // course it does, it heard itself say it. The learner has still not said a
    // word, and the beat they froze on is exactly the one they need again.
    const { state: after, view } = integrateTurn(rescued, silence, sampleTurn({ scene: { beat: 'greet', beatDone: true, sceneDone: false } }));

    assert.equal(after.currentBeat, beatBefore, 'the beat they froze on is still the beat');
    assert.equal(view.advancedBeat, false);
  });

  test('a frozen learner still moves on once the attempt cap trips', () => {
    const silence = { type: 'silence', durationMs: STUCK_SILENCE_MS } as const;
    let state = fresh();
    // Freeze twice: applyNonSpokenInput counts the attempts and latches
    // forceAdvance, which is what guarantees nobody is stuck on one beat.
    for (let i = 0; i < MAX_ATTEMPTS_PER_BEAT; i++) {
      state = applyNonSpokenInput(state, silence).state;
      state = integrateTurn(state, silence, sampleTurn({ scene: { beat: 'greet', beatDone: true, sceneDone: false } })).state;
    }
    assert.equal(state.currentBeat, 'order-drink', 'the cap carries the scene forward, however silent the learner');
  });

  test('beatDone advances the spine and resets attempts', () => {
    const state = fresh();
    const { state: after, view } = integrateTurn(state, spoke(), sampleTurn({ scene: { beat: 'greet', beatDone: true, sceneDone: false } }));
    assert.equal(after.currentBeat, 'order-drink');
    assert.equal(after.attemptsOnBeat, 0);
    assert.equal(view.advancedBeat, true);
    assert.equal(view.beat.position, 2);
  });

  test(`after ${MAX_ATTEMPTS_PER_BEAT} stuck attempts the scene is forced forward`, () => {
    let state = fresh();
    state = integrateTurn(state, spoke(), poorTurn()).state;
    assert.equal(state.forceAdvance, false);
    state = integrateTurn(state, spoke(), poorTurn()).state;
    assert.equal(state.forceAdvance, true);

    const context = prepareTurn(state, spoke()).messages.at(-1)!.text;
    assert.match(context, /resolves it naturally now/i);

    // Whatever the next turn's quality, the beat moves.
    const { state: moved, view } = integrateTurn(state, spoke(), poorTurn());
    assert.equal(view.advancedBeat, true);
    assert.equal(moved.currentBeat, 'order-drink');
    assert.equal(moved.forceAdvance, false);
  });
});

describe('coaching surfaces by policy', () => {
  test('at balanced, a grammar slip waits for the recap and the coach stays quiet', () => {
    const turn = sampleTurn({
      coach: [sampleCoachItem({ kind: 'grammar-slip' })],
      coachLine: 'Small fix: "à la boulangerie".',
    });
    const { state, view } = integrateTurn(fresh(), spoke(), turn);
    assert.equal(view.coachNow.length, 0);
    assert.equal(view.coachLine, null, "the model's line must not leak when policy defers");
    assert.equal(state.deferred.length, 1);
  });

  test('a clean model coach line is kept when something surfaces inline', () => {
    const turn = sampleTurn({
      coach: [sampleCoachItem()],
      coachLine: 'That works, but a local would say "j\'sais pas".',
    });
    const { view } = integrateTurn(fresh(), spoke('Je ne sais pas'), turn);
    assert.equal(view.coachLine, 'That works, but a local would say "j\'sais pas".');
    assert.equal(view.coachNow.length, 1);
  });

  test('a scolding model line is replaced by the tested template', () => {
    const turn = sampleTurn({
      coach: [sampleCoachItem()],
      coachLine: 'Wrong! Say "j\'sais pas".',
    });
    const { view } = integrateTurn(fresh(), spoke('Je ne sais pas'), turn);
    assert.match(view.coachLine!, /^That works, but a local would say/);
  });

  test('an em dash in the coach line is repaired, not rejected', () => {
    const turn = sampleTurn({
      coach: [sampleCoachItem()],
      coachLine: 'That works — but locals say "j\'sais pas".',
    });
    const { view } = integrateTurn(fresh(), spoke(), turn);
    assert.equal(view.coachLine, 'That works, but locals say "j\'sais pas".');
  });
});

describe('session memory and the recap trigger', () => {
  test('phrases dedupe, credit and error tags accumulate', () => {
    const turn = sampleTurn({
      newPhrases: [
        { fr: "j'sais pas", frWritten: 'je sais pas', en: "I don't know", enLiteral: null, register: 'courant', note: null },
      ],
      profileSignals: {
        errorPatterns: [{ tag: 'Ne Retention!', example: 'je ne sais pas' }],
        usedWell: ['Bonjour'],
      },
    });
    let state = fresh();
    state = integrateTurn(state, spoke(), turn).state;
    state = integrateTurn(state, spoke(), turn).state;
    assert.equal(state.phrases.length, 1, 'phrases must dedupe');
    assert.equal(state.errorTags['ne-retention'], 2, 'tags normalize to kebab and count');
    assert.deepEqual(state.usedWell, ['Bonjour', 'Bonjour']);
  });

  test('the recap comes due at scene end and at the turn budget', () => {
    const done = integrateTurn(fresh(), spoke(), sampleTurn({ scene: { beat: 'greet', beatDone: false, sceneDone: true } }));
    assert.equal(done.view.recapDue, true);

    const budget = integrateTurn(fresh({ maxTurns: 1 }), spoke(), sampleTurn());
    assert.equal(budget.view.recapDue, true);
  });

  test('support for the next turn renders at the new directive level', () => {
    let state = fresh(); // rung 3: hint
    const view1 = integrateTurn(state, spoke(), sampleTurn()).view;
    assert.equal(view1.supportView.kind, 'hint');

    state = integrateTurn(state, spoke(), sampleTurn()).state;
    state = integrateTurn(state, spoke(), sampleTurn()).state; // promoted to 4
    const view3 = integrateTurn(state, spoke(), sampleTurn()).view;
    assert.equal(view3.supportView.kind, 'none');
  });
});

describe('reaching for English — the hand-back loop', () => {
  /** They said it in English and it worked in the scene. Still not a completed beat. */
  function englishTurn(overrides: Partial<TutorTurn> = {}): TutorTurn {
    return sampleTurn({
      assessment: { understood: true, taskAchieved: true, comprehensibility: 'clear', language: 'english', cefrEvidence: null },
      scene: { beat: 'greet', beatDone: true, sceneDone: false },
      ...overrides,
    });
  }

  test('an English turn never completes a beat, whatever the model reported', () => {
    const { state: after, view } = integrateTurn(fresh(), spoke('How do I say I want a coffee?'), englishTurn());
    assert.equal(after.currentBeat, 'greet', 'the beat is invited again, in French');
    assert.equal(view.advancedBeat, false);
    assert.equal(view.reachedForEnglish, true);
    assert.equal(after.lastLanguage, 'english');
  });

  test('the next turn context tells the tutor to hand back the French', () => {
    const { state: after } = integrateTurn(fresh(), spoke('Can I have a coffee please?'), englishTurn());
    const context = prepareTurn(after, spoke()).messages.at(-1)!.text;
    assert.match(context, /reached for English/);
    assert.match(context, /support\.fullLine/);
  });

  test('still bounded: after the attempt cap the scene moves on regardless', () => {
    let state = fresh();
    for (let i = 0; i < MAX_ATTEMPTS_PER_BEAT; i += 1) {
      state = integrateTurn(state, spoke('In English again'), englishTurn()).state;
    }
    assert.equal(state.forceAdvance, true, 'nobody loops on a beat forever');
  });

  test('a French turn clears the memory and the context line with it', () => {
    let state = integrateTurn(fresh(), spoke('Coffee please?'), englishTurn()).state;
    state = integrateTurn(state, spoke('Un café, s’il vous plaît'), sampleTurn()).state;
    assert.equal(state.lastLanguage, null);
    const context = prepareTurn(state, spoke()).messages.at(-1)!.text;
    assert.doesNotMatch(context, /reached for English/);
  });

  test('mixed French-English is remembered for the context but does not pin the beat', () => {
    const mixed = sampleTurn({
      assessment: { understood: true, taskAchieved: true, comprehensibility: 'clear', language: 'mixed', cefrEvidence: null },
      scene: { beat: 'greet', beatDone: true, sceneDone: false },
    });
    const { state: after, view } = integrateTurn(fresh(), spoke('Un café… with milk?'), mixed);
    assert.equal(view.advancedBeat, true, 'half-French that does the job moves the scene');
    assert.equal(view.reachedForEnglish, false);
    assert.equal(after.lastLanguage, 'mixed');
  });
});

describe('pace — slower is sticky', () => {
  test('once slow, every later turn context says so', () => {
    const state: ConversationState = { ...fresh(), pace: 'slow' };
    const context = prepareTurn(state, spoke()).messages.at(-1)!.text;
    assert.match(context, /PACE: they asked you to slow down/);
    assert.match(context, /Do not speed back up/);
  });

  test('the default pace adds nothing', () => {
    const context = prepareTurn(fresh(), spoke()).messages.at(-1)!.text;
    assert.doesNotMatch(context, /PACE:/);
  });

  test('pace survives a turn — nothing in integration resets it', () => {
    const state: ConversationState = { ...fresh(), pace: 'slow' };
    const after = integrateTurn(state, spoke(), sampleTurn()).state;
    assert.equal(after.pace, 'slow');
  });
});

describe('narration — the scene-shift channel', () => {
  test('most turns carry none', () => {
    const { view } = integrateTurn(fresh(), spoke(), sampleTurn());
    assert.equal(view.narration, null);
  });

  test('a narrated shift reaches the view sanitized and enters the transcript history', () => {
    const narrated = sampleTurn({
      narration: {
        speaker: 'narration',
        fr: 'Le serveur s’en va — une femme se tourne vers vous.',
        frWritten: null,
        en: 'The waiter leaves — a woman at the next table turns to you.',
      },
    });
    const { state: after, view } = integrateTurn(fresh(), spoke(), narrated);
    assert.notEqual(view.narration, null);
    assert.ok(!view.narration!.en.includes('—'), 'learner-visible narration obeys the copy rules');
    assert.ok(!view.narration!.fr.includes('—'));
    const remembered = after.history.at(-1)!.text;
    assert.match(remembered, /^\(narration\) /);
  });
});

describe('topics — the learner steers, the tutor follows, code remembers', () => {
  const steer = (en: string, fr: string) => sampleTurn({ topicShift: { en, fr } });

  test("a conversation opens on the frame's own topic", () => {
    const state = fresh();
    assert.equal(state.topics.length, 1);
    assert.equal(state.topics[0]!.en, CAFE_FRAME.titleEn);
    assert.equal(state.topics[0]!.fr, CAFE_FRAME.title);
  });

  test('a reported shift is appended with the turn it happened on', () => {
    const { state } = integrateTurn(fresh(), spoke(), steer('Rugby', 'Le rugby'));
    assert.equal(state.topics.length, 2);
    assert.deepEqual(state.topics[1], { en: 'Rugby', fr: 'Le rugby', turn: 1 });
  });

  test('a null shift leaves the list untouched', () => {
    const { state } = integrateTurn(fresh(), spoke(), sampleTurn());
    assert.equal(state.topics.length, 1);
  });

  test('the same steer twice is recorded once, whatever the casing', () => {
    let state = fresh();
    state = integrateTurn(state, spoke(), steer('Rugby', 'Le rugby')).state;
    state = integrateTurn(state, spoke(), steer('  rugby ', 'Le rugby')).state;
    assert.equal(state.topics.length, 2);
  });

  test('an empty steer is dropped rather than recorded as nothing', () => {
    const { state } = integrateTurn(fresh(), spoke(), steer('   ', ''));
    assert.equal(state.topics.length, 1);
  });

  test('the list caps so a chatty model cannot flood the recap', () => {
    let state = fresh();
    for (const name of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
      state = integrateTurn(state, spoke(), steer(`Topic ${name}`, `Sujet ${name}`)).state;
    }
    assert.equal(state.topics.length, MAX_SESSION_TOPICS);
  });

  test('a steer never completes a beat by itself', () => {
    const before = fresh();
    const { state, view } = integrateTurn(before, spoke(), steer('Rugby', 'Le rugby'));
    assert.equal(view.advancedBeat, false);
    assert.equal(state.currentBeat, before.currentBeat);
  });

  test('a steer rides the next turn context; the frame topic alone does not', () => {
    const before = prepareTurn(fresh(), spoke());
    assert.ok(!before.messages.at(-1)!.text.includes('TOPIC:'), 'no steer, no line');
    const { state } = integrateTurn(fresh(), spoke(), steer('Rugby', 'Le rugby'));
    const after = prepareTurn(state, spoke());
    assert.ok(after.messages.at(-1)!.text.includes('TOPIC: they steered the conversation to: Rugby'));
  });
});
