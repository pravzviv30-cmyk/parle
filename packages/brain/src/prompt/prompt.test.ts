import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { RUNGS, directiveFor } from '@parle/core';

import { buildSystemBlocks } from './system.ts';
import { buildTurnContext, type TurnContextInput } from './turnContext.ts';
import { historyViewOfTurn } from './historyView.ts';
import { buildScenarioRequest } from './scenarioPrompt.ts';
import { renderAuthenticityPack } from '../authenticity/render.ts';
import { FR_PACK } from '../authenticity/fr.ts';
import { sampleCoachItem, sampleTurn } from '../contract/samples.ts';

function contextInput(overrides: Partial<TurnContextInput> = {}): TurnContextInput {
  return {
    directive: directiveFor(RUNGS.CUED),
    beat: { id: 'order-drink', goal: 'Commander une boisson', attempt: 1, maxAttempts: 2, forceAdvance: false },
    strictness: 'balanced',
    learner: { cefr: 'A2', confidence: 'low', watchFor: ['ne-retention', 'tu-vous-mixing'] },
    inputKind: 'spoke',
    ...overrides,
  };
}

describe('the stable prefix', () => {
  test('is byte-identical across builds — cache safety', () => {
    assert.deepEqual(buildSystemBlocks(), buildSystemBlocks());
  });

  test('the persona carries the behavioural commitments', () => {
    const { persona } = buildSystemBlocks();
    assert.match(persona, /never remark on the learner hesitating/i);
    assert.match(persona, /take your time/i, 'should name the exact phrases to avoid');
    assert.match(persona, /are you still there/i);
    assert.match(persona, /never say a score/i);
    assert.match(persona, /never say "wrong"/i);
    assert.match(persona, /intelligent adult/i);
    assert.match(persona, /real spoken french/i);
    // The dead-end turn is the competitor failure this product exists to avoid:
    // "the AI makes a statement and that's it, which leaves me blank".
    assert.match(persona, /never leave them with nothing to respond to/i);
    assert.match(persona, /one short english clause/i, 'asking for English is an escape hatch, not a mode switch');
  });

  test('the pack block is exactly the rendered pack — one source of truth', () => {
    assert.equal(buildSystemBlocks().pack, renderAuthenticityPack(FR_PACK));
  });

  test('the contract block briefs every field and every coach kind', () => {
    const { contract } = buildSystemBlocks();
    for (const field of [
      'assessment',
      'coach',
      'coachLine',
      'sceneReply',
      'support',
      'fullLine',
      'options',
      'hintEn',
      'newPhrases',
      'profileSignals',
      'scene',
    ]) {
      assert.ok(contract.includes(field), `contract briefing lost the field "${field}"`);
    }
    for (const kind of ['blocking-error', 'grammar-slip', 'textbook-phrasing', 'register-mismatch', 'anglicism']) {
      assert.ok(contract.includes(kind), `contract briefing lost the kind "${kind}"`);
    }
    assert.match(contract, /English only/i, 'the hint rule must be explicit');
    assert.ok(contract.includes("J'sais pas"), 'the flagship example belongs in the briefing');
  });

  test('no em dashes and no volatile tokens anywhere in the prefix', () => {
    // Prompt text is model-facing, not learner-facing, so it may QUOTE banned
    // words ('never say "wrong"'). Two rules do apply: the model mimics prompt
    // style, so no em dashes; and the prefix is cached, so nothing volatile.
    const blocks = buildSystemBlocks();
    for (const [name, text] of Object.entries(blocks)) {
      assert.doesNotMatch(text, /—/, `${name} contains an em dash`);
      assert.doesNotMatch(text, /\d{4}-\d{2}-\d{2}/, `${name} contains a date`);
    }
  });
});

describe('the per-turn context', () => {
  test('carries the ladder directive verbatim for every rung', () => {
    for (const rung of [RUNGS.ECHO, RUNGS.CUED, RUNGS.PROMPTED, RUNGS.FREE]) {
      const directive = directiveFor(rung);
      const text = buildTurnContext(contextInput({ directive }));
      assert.ok(text.includes(directive.tutorInstruction), `rung ${rung} lost its instruction`);
      assert.ok(text.includes(`rung ${rung} of 4`));
    }
  });

  test('a rescue directive keeps the never-mention-the-pause rule', () => {
    const text = buildTurnContext(contextInput({ directive: directiveFor(RUNGS.CUED, true), inputKind: 'silence' }));
    assert.match(text, /do not mention that they hesitated/i);
    assert.match(text, /treat the bracketed marker as silence/i);
  });

  test('each strictness gets its own policy line, and textbook phrasing is always inline', () => {
    const texts = (['flow', 'balanced', 'strict'] as const).map((strictness) =>
      buildTurnContext(contextInput({ strictness })),
    );
    assert.equal(new Set(texts).size, 3, 'strictness levels produced identical context');
    for (const text of texts) assert.match(text, /textbook phrasing|everything you find/i);
  });

  test('the learner picture rides along', () => {
    const text = buildTurnContext(contextInput());
    assert.ok(text.includes('A2'));
    assert.ok(text.includes('ne-retention, tu-vous-mixing'));
  });

  test('the beat cap changes the instruction', () => {
    const last = buildTurnContext(contextInput({ beat: { id: 'b', goal: 'g', attempt: 2, maxAttempts: 2, forceAdvance: false } }));
    assert.match(last, /last attempt on this beat/i);
    const forced = buildTurnContext(contextInput({ beat: { id: 'b', goal: 'g', attempt: 3, maxAttempts: 2, forceAdvance: true } }));
    assert.match(forced, /resolves it naturally now/i);
  });

  test('is framed as app context, not learner speech', () => {
    assert.match(buildTurnContext(contextInput()), /^\[CONTEXT FROM THE APP, NOT FROM THE LEARNER\]/);
  });
});

describe('the history view', () => {
  test('is deterministic and compact', () => {
    const turn = sampleTurn({ coach: [sampleCoachItem()], coachLine: 'That works, but a local would say "J\'sais pas".' });
    assert.equal(historyViewOfTurn(turn), historyViewOfTurn(turn));
  });

  test('remembers what was said, coached, and taught', () => {
    const turn = sampleTurn({
      coach: [sampleCoachItem()],
      newPhrases: [
        { fr: "j'sais pas", frWritten: 'je sais pas', en: "I don't know", enLiteral: null, register: 'courant', note: null },
      ],
    });
    const view = historyViewOfTurn(turn);
    assert.ok(view.includes('Karim: Ça marche, un café !'));
    assert.ok(view.includes('(noted textbook-phrasing'));
    assert.ok(view.includes("(taught: j'sais pas"));
    assert.ok(view.includes('(beat: order-drink)'));
  });
});

describe('the scenario request', () => {
  test('carries the rules, the learner, and the ask', () => {
    const text = buildScenarioRequest({
      request: "I'm meeting friends at a café in Paris",
      learner: { cefr: 'A2', watchFor: ['ne-retention'] },
    });
    assert.match(text, /3 to 6 beats/);
    assert.match(text, /English only/i);
    assert.ok(text.includes('A2'));
    assert.ok(text.includes("I'm meeting friends at a café in Paris"));
    assert.doesNotMatch(text, /—/);
  });
});
