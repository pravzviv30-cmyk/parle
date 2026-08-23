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
import { copyViolations } from '../copy.ts';
import { carriesFrench } from '../frenchLeak.ts';
import { sampleCoachItem, sampleTurn } from '../contract/samples.ts';
import type { TutorTurn } from '../contract/types.ts';

function learner(overrides: Partial<LearnerSnapshot> = {}): LearnerSnapshot {
  return { cefr: 'A2', confidence: 'low', watchFor: [], lastRung: null, sessions: 0, name: null, ...overrides };
}

function fresh(overrides: { strictness?: 'flow' | 'balanced' | 'strict'; maxTurns?: number } = {}, who = learner()): ConversationState {
  return createConversation(CAFE_FRAME, who, { strictness: overrides.strictness ?? 'balanced', maxTurns: overrides.maxTurns ?? 24 }, 1_000);
}

function spoke(text = 'Bonjour !'): { type: 'spoke'; text: string } {
  return { type: 'spoke', text };
}

/**
 * A turn graded poor: they tried in French and it did not do its job.
 *
 * This used to be an English turn, which is no longer poor — G5 moved reaching
 * for English to `partial`, because that is a beginner reaching for words, not
 * a beginner failing. A French attempt that misses is the honest example of the
 * thing the ladder is actually for.
 */
function poorTurn(overrides: Partial<TutorTurn> = {}): TutorTurn {
  return sampleTurn({
    assessment: { understood: true, taskAchieved: false, comprehensibility: 'clear', language: 'french', cefrEvidence: null },
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

  test('four seconds of nothing drops a rung and reveals only an English hint', () => {
    const state = fresh(); // A2 opens at rung 3 (hint)
    const { state: after, view } = applyNonSpokenInput(state, { type: 'silence', durationMs: STUCK_SILENCE_MS });
    assert.equal(after.ladder.rung, 2);
    assert.equal(after.ladder.rescues, 1);
    assert.equal(view.rescued, true);
    assert.equal(after.assistanceDepth, 1);
    assert.equal(view.supportView.kind, 'hint');
  });

  test('the first rescue never gives away the answer, whatever the learner level', () => {
    for (const rung of [1, 2, 3, 4] as const) {
      const state = { ...fresh(), ladder: { ...fresh().ladder, rung }, directive: directiveFor(rung) };
      const { view } = applyNonSpokenInput(state, { type: 'silence', durationMs: STUCK_SILENCE_MS });
      assert.equal(view.supportView.kind, 'hint', `a freeze at rung ${rung} must reveal only a hint`);
    }
  });

  test('a second explicit rescue reveals the full line', () => {
    const first = applyNonSpokenInput(fresh(), { type: 'help' });
    const second = applyNonSpokenInput(first.state, { type: 'help' });
    assert.equal(second.state.assistanceDepth, 2);
    assert.equal(second.view.supportView.kind, 'full-line');
  });

  test('the rescued directive reaches the next prepared prompt', () => {
    const state = fresh();
    const { state: after } = applyNonSpokenInput(state, { type: 'silence', durationMs: STUCK_SILENCE_MS });
    const request = prepareTurn(after, { type: 'silence', durationMs: STUCK_SILENCE_MS });
    const context = request.messages[request.messages.length - 1]!.text;
    assert.match(context, /Never mention the pause/i);
    assert.match(context, /only support\.hintEn/i);
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
    for (let i = 0; i < MAX_ATTEMPTS_PER_BEAT; i += 1) {
      state = integrateTurn(state, spoke(), poorTurn()).state;
      if (i < MAX_ATTEMPTS_PER_BEAT - 1) assert.equal(state.forceAdvance, false);
    }
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

  test('ordinary turns never render support, regardless of ladder promotion', () => {
    let state = fresh();
    const view1 = integrateTurn(state, spoke(), sampleTurn()).view;
    assert.equal(view1.supportView.kind, 'none');

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

  test('the next turn context requests a French recast after the English attempt', () => {
    const { state: after } = integrateTurn(fresh(), spoke('Can I have a coffee please?'), englishTurn());
    const context = prepareTurn(after, spoke()).messages.at(-1)!.text;
    assert.match(context, /previous turn used English/);
    assert.match(context, /english-to-french/);
    assert.match(context, /after their attempt/i);
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

  test('earned help survives a question asked in English', () => {
    // G6. assistanceDepth reset on any spoken turn, on the doctrine that
    // speaking a real reply resets it. Asking "how do I say this?" in English
    // is not a real reply — which is exactly why the beat does not complete —
    // so the help they had already earned was binned at the worst moment.
    const helped = applyNonSpokenInput(fresh(), { type: 'help' }).state;
    assert.equal(helped.assistanceDepth, 1);
    const after = integrateTurn(helped, spoke('How do I say I want a coffee?'), englishTurn()).state;
    assert.equal(after.assistanceDepth, 1, 'the earned card was thrown away by an English question');
  });

  test('a real reply in French still resets the earned help', () => {
    const helped = applyNonSpokenInput(fresh(), { type: 'help' }).state;
    const after = integrateTurn(helped, spoke('Un café, s’il vous plaît'), sampleTurn()).state;
    assert.equal(after.assistanceDepth, 0);
  });

  test('the coach line on an English turn leads with the hand-back, not the correction', () => {
    // G7. blocking-error wins the single inline slot at flow and is picked as
    // the lead, so the learner who politely asked how to say something heard
    // "Not quite. Try …" and never got their answer.
    const turn = englishTurn({
      coachLine: null,
      coach: [
        sampleCoachItem({ kind: 'blocking-error', quote: 'x', better: 'je voudrais un café' }),
        sampleCoachItem({ kind: 'english-to-french', quote: 'y', better: 'un café, s’il vous plaît' }),
      ],
    });
    const { view } = integrateTurn(fresh({ strictness: 'flow' }), spoke('How do I ask for a coffee?'), turn);
    assert.ok(view.coachLine !== null);
    assert.ok(
      view.coachLine!.includes('un café, s’il vous plaît'),
      `the hand-back lost the slot to the correction: "${view.coachLine}"`,
    );
    assert.doesNotMatch(view.coachLine!, /^not quite/i);
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

describe('the learner plays themselves — the support card is their line, never the scene’s', () => {
  /** A turn where the model let one line do both jobs: the barista's question, handed back as the card. */
  function collapsedTurn(overrides: Partial<TutorTurn> = {}): TutorTurn {
    return sampleTurn({
      sceneReply: { speaker: 'Karim', fr: 'Bonjour, vous désirez ?', frWritten: null, en: 'Hello, what would you like?' },
      support: {
        fullLine: { fr: 'Bonjour, vous désirez ?', frWritten: null, en: 'Hello, what would you like?' },
        options: [
          { fr: 'Bonjour, vous désirez ?', en: 'Hello, what would you like?' },
          { fr: "Un café, s'il vous plaît", en: 'A coffee, please' },
        ],
        hintEn: 'Greet him back and order a drink.',
      },
      ...overrides,
    });
  }

  test('ordinary turns hide support while repairing the next rescue material', () => {
    const state = fresh({}, learner({ cefr: 'A0' }));
    assert.equal(state.ladder.rung, 1, 'this test needs the Echo rung, where the whole line is shown');

    const { state: after, view } = integrateTurn(state, spoke('euh'), collapsedTurn());

    assert.equal(view.supportView.kind, 'none');
    assert.notEqual(
      after.lastSupport.fullLine.fr,
      view.sceneReply.fr,
      'the card told the learner to say the barista’s own question back to the barista',
    );
    // Repaired from material this same turn already carried, never invented.
    assert.equal(after.lastSupport.fullLine.fr, "Un café, s'il vous plaît");
  });

  test('the learner level never exposes options before an attempt', () => {
    const state = fresh({}, learner({ cefr: 'A1' }));
    assert.equal(state.ladder.rung, 2);

    const { state: after, view } = integrateTurn(state, spoke('euh'), collapsedTurn());
    assert.equal(view.supportView.kind, 'none');
    assert.ok(after.lastSupport.options.every((o) => o.fr !== 'Bonjour, vous désirez ?'));
  });

  test('a repeated rescue with no safe line left falls back to the hint', () => {
    const state = fresh({}, learner({ cefr: 'A0' }));
    const turn = collapsedTurn({
      support: {
        fullLine: { fr: 'Bonjour, vous désirez ?', frWritten: null, en: 'Hello, what would you like?' },
        options: [{ fr: 'Bonjour, vous désirez ?', en: 'Hello, what would you like?' }],
        hintEn: 'Greet him back and order a drink.',
      },
    });

    const after = integrateTurn(state, spoke('euh'), turn).state;
    const first = applyNonSpokenInput(after, { type: 'help' }).state;
    const { view } = applyNonSpokenInput(first, { type: 'help' });
    assert.equal(view.supportView.kind, 'hint');
    assert.equal(view.supportView.kind === 'hint' ? view.supportView.hint : null, 'Greet him back and order a drink.');
  });

  test('a rescue after a collapsed turn does not replay the scene’s line either', () => {
    const state = fresh({}, learner({ cefr: 'A0' }));
    const { state: after } = integrateTurn(state, spoke('euh'), collapsedTurn());
    assert.notEqual(after.lastSupport.fullLine.fr, 'Bonjour, vous désirez ?');

    const first = applyNonSpokenInput(after, { type: 'help' });
    assert.equal(first.view.supportView.kind, 'hint');
    const second = applyNonSpokenInput(first.state, { type: 'help' });
    assert.equal(second.view.supportView.kind, 'full-line');
    assert.notEqual(
      second.view.supportView.kind === 'full-line' ? second.view.supportView.line : null,
      'Bonjour, vous désirez ?',
    );
  });

  test('a genuine reply is left exactly as the model wrote it', () => {
    const state = fresh({}, learner({ cefr: 'A0' }));
    const { state: after, view } = integrateTurn(state, spoke('Bonjour'), sampleTurn());
    assert.deepEqual(after.lastSupport, sampleTurn().support);
    assert.equal(view.supportView.kind, 'none');
  });

  test('an opening frame that collapses the two lines is repaired before turn one', () => {
    const collapsed = {
      ...CAFE_FRAME,
      openingSupport: {
        ...CAFE_FRAME.openingSupport,
        fullLine: { fr: "Bonjour ! Qu'est-ce que je vous sers ?", frWritten: null, en: 'Hello! What can I get you?' },
      },
    };
    const state = createConversation(collapsed, learner({ cefr: 'A0' }), { strictness: 'balanced', maxTurns: 24 }, 1_000);
    assert.notEqual(state.lastSupport.fullLine.fr, collapsed.openingLine.fr);
    assert.equal(state.lastSupport.fullLine.fr, "Un café, s'il vous plaît");
  });

  test('a well-built frame is untouched', () => {
    const state = fresh();
    assert.deepEqual(state.lastSupport, CAFE_FRAME.openingSupport);
  });
});

describe('the scene the learner is handed — G2', () => {
  /** CAFE_FRAME with one deliberately broken opening narration. */
  function frameWithNarration(en: string) {
    return { ...CAFE_FRAME, openingNarration: { ...CAFE_FRAME.openingNarration, en } };
  }

  function opened(en: string, request = 'ordering a coffee in Paris') {
    return createConversation(frameWithNarration(en), learner(), { strictness: 'flow', maxTurns: 12, request }, 1_000)
      .frame.openingNarration;
  }

  test('a healthy narration is left exactly as the model wrote it', () => {
    const good = 'Imagine the scene. You push open the door of a small cafe and the smell of coffee hits you.';
    assert.equal(opened(good).en, good);
  });

  test('a frame whose opening narration is missing is repaired before the scene opens', () => {
    // The schema accepts a bare line with no floor, so a model that returns
    // two words opened the scene on nothing and the first thing the learner
    // heard was French they were never set up for.
    for (const empty of ['', '   ', 'Bonjour.']) {
      const repaired = opened(empty);
      assert.ok(repaired.en.trim().length >= 40, `"${empty}" was left as the spoken setup: "${repaired.en}"`);
      assert.equal(repaired.speaker, 'narration');
    }
  });

  test('a frame whose English narration is actually French is repaired', () => {
    const leaked = opened('Imaginez la scène. Vous poussez la porte du café et vous vous asseyez à côté de la fenêtre.');
    assert.doesNotMatch(leaked.en, /Imaginez/, `the French narration was spoken as the English setup: "${leaked.en}"`);
  });

  test('an accented word the learner themself used is not a French leak', () => {
    // The same allowance the offline eval makes: repeating the learner's own
    // loanword back to them is not handing over a French answer.
    const en = 'Imagine the scene. You are standing at the counter of a busy café and someone turns to you.';
    assert.equal(opened(en, 'ordering at a busy café in Paris').en, en);
  });

  test('a repaired narration still names the scene the learner asked for', () => {
    const repaired = opened('');
    assert.ok(
      repaired.en.includes(CAFE_FRAME.titleEn),
      `the recovery narration lost the scene: "${repaired.en}"`,
    );
    assert.deepEqual(copyViolations(repaired.en), []);
  });

  test('the repair never leaves the narration in French either', () => {
    // Judged by the same rule the repair uses, not by a bare accent: this
    // frame is called "At the corner café", and café is an English word.
    const repaired = opened('Bonjour.');
    assert.equal(carriesFrench(repaired.en), false, `the recovery narration carries French: "${repaired.en}"`);
  });
});

describe('the tutor does not correct on every single turn', () => {
  /**
   * The founder's report was that the tutor "never just reacts". The cause was
   * not the prompt: at A0 every utterance is textbook French, textbook-phrasing
   * surfaces inline at every strictness because it is the finding this product
   * exists for, and INLINE_CAP is a budget per turn, so a budget of one was
   * spent every turn. grading.test.ts holds the rule; this holds the wiring,
   * which is the half that can be silently absent.
   */
  const textbookTurn = (quote: string): TutorTurn =>
    sampleTurn({
      coach: [sampleCoachItem({ kind: 'textbook-phrasing', quote, better: 'j’sais pas' })],
      coachLine: 'A local would say "j’sais pas".',
    });

  function run(turns: number, start = fresh({ strictness: 'flow' })) {
    let state = start;
    const spokenLines: (string | null)[] = [];
    for (let i = 0; i < turns; i += 1) {
      const out = integrateTurn(state, spoke(`essai ${i}`), textbookTurn(`quote-${i}`));
      state = out.state;
      spokenLines.push(out.view.coachLine);
    }
    return { state, spokenLines };
  }

  test('a run of textbook turns is not a run of corrections', () => {
    const { spokenLines } = run(6);
    const corrected = spokenLines.filter((l) => l !== null).length;
    assert.ok(corrected > 0, 'the product still coaches; this is about rate, not silence');
    assert.ok(
      corrected < spokenLines.length,
      `every one of ${spokenLines.length} turns carried a correction, which is the bug`,
    );
  });

  test('two consecutive turns never both interrupt', () => {
    const { spokenLines } = run(8);
    for (let i = 1; i < spokenLines.length; i += 1) {
      assert.ok(
        spokenLines[i] === null || spokenLines[i - 1] === null,
        `turns ${i - 1} and ${i} both corrected, so the cooldown is not wired to the state`,
      );
    }
  });

  test('what the cooldown holds back reaches the recap instead', () => {
    const { state, spokenLines } = run(6);
    const spoken = spokenLines.filter((l) => l !== null).length;
    assert.equal(spoken + state.deferred.length, 6, 'every finding is either said now or queued for the end card');
  });

  test('the clock starts unset, so a session never opens mid-cooldown', () => {
    assert.equal(fresh().lastInterruptedTurn, null);
    const { view } = integrateTurn(fresh({ strictness: 'flow' }), spoke(), textbookTurn('a'));
    assert.notEqual(view.coachLine, null, 'the first finding of a session is said');
  });
});

describe('finishing a mission is a win, not closing time', () => {
  /** Walk a scene to the end of its beats with ordinary good turns. */
  function throughEveryBeat(start: ConversationState): { state: ConversationState; view: ReturnType<typeof integrateTurn>['view'] } {
    let state = start;
    let view = integrateTurn(state, spoke(), sampleTurn()).view;
    // The line above is only here for its view; the walk itself starts clean.
    for (const beat of CAFE_FRAME.beats) {
      const done = integrateTurn(state, spoke(), sampleTurn({ scene: { beat: beat.id, beatDone: true, sceneDone: false } }));
      state = done.state;
      view = done.view;
    }
    return { state, view };
  }

  function mission(overrides: { maxTurns?: number } = {}): ConversationState {
    return createConversation(
      CAFE_FRAME,
      learner(),
      { strictness: 'balanced', maxTurns: overrides.maxTurns ?? 24, mission: true },
      1_000,
    );
  }

  test('finishing the beats of a mission raises the win and does not end the session', () => {
    const { state, view } = throughEveryBeat(mission());

    assert.equal(view.missionDone, true, 'the learner finished what they came in to do and nothing said so');
    assert.equal(
      view.recapDue,
      false,
      'ending the session on the turn a beginner first got through a real French exchange takes the achievement away in the same breath as giving it',
    );
    assert.equal(state.missionDone, true, 'the win must survive into the next turn, or the card flickers away');
  });

  test('a generated-frame session still ends when its beats are done', () => {
    // The path this round did NOT touch. A scene built from a learner's own
    // request has no authored win line to raise, and every beat done has always
    // been its ending.
    const { view } = throughEveryBeat(fresh());

    assert.equal(view.recapDue, true, 'a generated scene must end exactly as it did before missions existed');
    assert.equal(view.missionDone, false, 'a scene nobody authored cannot raise a win nobody wrote');
  });

  test('scene-done and the turn ceiling still end a mission session', () => {
    // Removing every exit would be its own trap: metered minutes have to stay
    // bounded, and a character who decides the conversation is over is right.
    //
    // Driven from a finished mission that is still open, rather than from two
    // isolated cases, and that is the whole point. Asserting sceneDue on a fresh
    // scene would pass just as well against an engine that had never heard of
    // missions, because every beat done used to end the session on its own. The
    // state this starts from is one the engine could not reach before, so
    // getting there is half the proof and leaving it is the other half.
    const open = throughEveryBeat(mission({ maxTurns: 12 }));
    assert.equal(open.view.recapDue, false, 'the beats are done and the session is still open, or there is nothing here to end');

    const closed = integrateTurn(
      open.state,
      spoke(),
      sampleTurn({ scene: { beat: 'leave', beatDone: false, sceneDone: true } }),
    );
    assert.equal(closed.view.recapDue, true, 'a mission whose scene says it is over must still end');

    // The ceiling, from that same open state. There is no beat left to finish,
    // so nothing but the turn count can close it, which is exactly the case
    // where a missing ceiling would run the meter until the learner noticed.
    let running = open.state;
    let ended = false;
    for (let i = 0; i < 20 && !ended; i += 1) {
      const next = integrateTurn(running, spoke(), sampleTurn());
      running = next.state;
      ended = next.view.recapDue;
    }

    assert.equal(ended, true, 'a mission with its beats behind it must still reach an end on its own');
    assert.ok(
      running.turnCount >= 12,
      `the turn ceiling is what ended it, and it ended at turn ${running.turnCount} instead`,
    );
  });

  test('after the win the tutor is told the goal is reached, never told to say so', () => {
    const { state } = throughEveryBeat(mission());
    const request = prepareTurn(state, spoke('Il fait beau aujourd’hui.'));
    const context = request.messages.filter((m) => m.role === 'system').map((m) => m.text).join('\n');

    assert.match(context, /SCENE GOAL: already reached/, 'the tutor is not told the scene goal is behind them');
    assert.match(context, /follow wherever they take it/i, 'the learner who kept talking must be followed, not steered back');
    assert.match(context, /Do not announce the achievement/i);
    assert.match(context, /congratulate/i, 'the one thing the tutor must not do has to be said, because the app already said it');
  });

  test('a mission that nobody finished carries no win', () => {
    let state = mission();
    state = integrateTurn(state, spoke(), sampleTurn({ scene: { beat: 'greet', beatDone: true, sceneDone: false } })).state;
    const view = integrateTurn(state, spoke(), sampleTurn()).view;

    assert.equal(view.missionDone, false, 'one beat out of five is not a mission');
    assert.equal(view.recapDue, false);
  });
});
