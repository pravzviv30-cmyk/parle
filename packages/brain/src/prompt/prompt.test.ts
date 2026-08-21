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
    assistance: 'hidden',
    ...overrides,
  };
}

describe('the stable prefix', () => {
  test('is byte-identical across builds — cache safety', () => {
    assert.deepEqual(buildSystemBlocks(), buildSystemBlocks());
  });

  test('the persona carries the behavioural commitments', () => {
    const { persona } = buildSystemBlocks();
    assert.match(persona, /never remark on hesitation/i);
    assert.match(persona, /take your time/i, 'should name the exact phrases to avoid');
    assert.match(persona, /are you still there/i);
    assert.match(persona, /never say a score/i);
    assert.match(persona, /never say "wrong"/i);
    assert.match(persona, /intelligent adult/i);
    assert.match(persona, /real spoken french/i);
    // The dead-end turn is the competitor failure this product exists to avoid:
    // "the AI makes a statement and that's it, which leaves me blank".
    assert.match(persona, /End with a question or an obvious conversational opening/i);
    assert.match(persona, /one short english clause/i, 'asking for English is an escape hatch, not a mode switch');
  });

  test('the persona still says reaching for English is never failing', () => {
    // G8. The rebuild dropped this framing and the tutor got colder with it.
    // The clause is restored; the "invite the same moment again" half is not,
    // because the hand-back loop implements that in code now and a repo does
    // not want two ladders.
    const { persona } = buildSystemBlocks();
    assert.match(persona, /reaching for words, never failing/i);
  });

  test('the contract asks for an acknowledgement before the French', () => {
    // G8, the root cause. The contract used to say "Name the better French
    // directly", which is an instruction to be terse, and it beat the warmer
    // persona line because the contract is what describes the output field.
    const { contract } = buildSystemBlocks();
    assert.match(contract, /acknowledg/i, 'the coachLine contract never asks for an acknowledgement');
    assert.match(contract, /vary/i, 'nothing asks the tutor to vary the acknowledgement');
    assert.match(contract, /their name/i, 'the contract never mentions using the learner’s name');
    assert.doesNotMatch(contract, /Name the better French directly/i, 'the terse instruction is still there');
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
    for (const kind of [
      'blocking-error',
      'english-to-french',
      'grammar-slip',
      'textbook-phrasing',
      'register-mismatch',
      'anglicism',
    ]) {
      assert.ok(contract.includes(kind), `contract briefing lost the kind "${kind}"`);
    }
    assert.match(contract, /English only/i, 'the hint rule must be explicit');
    assert.ok(contract.includes("J'sais pas"), 'the flagship example belongs in the briefing');
  });

  test('the contract says support is the learner’s side of the scene, not the tutor’s', () => {
    // The defect this pins: at Echo the ladder tells the tutor to say the target
    // line and invite a repeat, which to a model also playing the barista reads
    // as permission to put its own question on the learner's card.
    const { contract } = buildSystemBlocks();
    assert.match(contract, /never (a copy of )?your(s| own| sceneReply)/i, 'support must be marked as theirs, not the tutor’s');
    assert.match(contract, /answers it|reply .*back to/i, 'fullLine must be named as the answer to the line just said');
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
  test('uses the ladder only for pacing and never exposes its old answer script', () => {
    for (const rung of [RUNGS.ECHO, RUNGS.CUED, RUNGS.PROMPTED, RUNGS.FREE]) {
      const directive = directiveFor(rung);
      const text = buildTurnContext(contextInput({ directive }));
      assert.match(text, /INDEPENDENCE:/);
      assert.match(text, /never pre-fill the learner's reply/i);
      assert.ok(!text.includes(directive.tutorInstruction), `rung ${rung} leaked its old answer script`);
    }
  });

  test('a rescue keeps the never-mention-the-pause rule and the answer off the voice track', () => {
    const text = buildTurnContext(
      contextInput({ directive: directiveFor(RUNGS.CUED, true), inputKind: 'silence', assistance: 'hint' }),
    );
    assert.match(text, /Never mention the pause/i);
    assert.match(text, /Treat the marker as silence/i);
    assert.match(text, /Do not speak support\.fullLine/i);
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

  test('assistance is progressive and independent of learner level', () => {
    const hidden = buildTurnContext(contextInput({ assistance: 'hidden' }));
    const hint = buildTurnContext(contextInput({ assistance: 'hint' }));
    const line = buildTurnContext(contextInput({ assistance: 'full-line' }));
    assert.match(hidden, /first attempt/i);
    assert.match(hint, /only support\.hintEn/i);
    assert.match(line, /after repeated help/i);
  });

  test('whenever the whole line is handed over, the context says whose line it is', () => {
    // full-line is the one assistance tier that puts a whole French sentence on
    // the learner's card. To a model that is also playing the shopkeeper, "the
    // app revealed the line" reads as permission to let one line do both jobs,
    // which is how the barista's own question reached the SAY THIS card. The tier
    // that hands a line over is the tier that has to name whose line it is.
    const text = buildTurnContext(contextInput({ assistance: 'full-line' }));
    assert.match(text, /support\.fullLine/, 'the handover tier must name what the app revealed');
    assert.match(
      text,
      /sceneReply must still be your character's side/i,
      'the handover tier did not say whose line sceneReply is',
    );
  });

  test('an English attempt earns a translation correction after the attempt', () => {
    const text = buildTurnContext(contextInput({ lastLanguage: 'english' }));
    assert.match(text, /english-to-french/);
    assert.match(text, /feedback after their attempt, never a prompt/i);
  });

  test("the turn context carries the learner's name", () => {
    // G1. Per-turn and per-learner, so it belongs here and never in the frozen
    // prefix, which has to stay byte-identical for the prompt cache to hit.
    const text = buildTurnContext(contextInput({ learner: { cefr: 'A2', confidence: 'low', watchFor: [], name: 'Sam' } }));
    assert.match(text, /Sam/);
    assert.match(text, /not every line/i, 'nothing stops the tutor saying the name every turn');
  });

  test('a learner with no name adds no name line at all', () => {
    const text = buildTurnContext(contextInput({ learner: { cefr: 'A2', confidence: 'low', watchFor: [], name: null } }));
    assert.doesNotMatch(text, /LEARNER NAME/i);
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
    assert.match(text, /2 to 5 flexible beats/);
    assert.match(text, /English only/i);
    assert.match(text, /openingNarration[\s\S]*no French words/i);
    assert.ok(text.includes('A2'));
    assert.ok(text.includes("I'm meeting friends at a café in Paris"));
    assert.match(text, /request is binding/i);
    assert.match(text, /source of truth/i);
    assert.match(text, /people, relationship, place, activity, and learning goal/i);
    assert.doesNotMatch(text, /—/);
  });

  test('carries account-specific memory without letting it override the current request', () => {
    const text = buildScenarioRequest({
      request: 'I need to speak to my teacher about an assignment',
      learner: {
        cefr: 'A1',
        watchFor: [],
        facts: ['Studies physics'],
        recentScenarios: ['At a café'],
        unmasteredPhrases: ['Vous pouvez répéter ?'],
      },
    });
    assert.match(text, /Studies physics/);
    assert.match(text, /At a café/);
    assert.match(text, /Vous pouvez répéter/);
    assert.match(text, /Never override the learner's current choice/i);
  });

  test('the scenario request names the learner', () => {
    // G1. The scene designer writes the opening narration and the first line
    // the learner ever hears; it should know who it is writing for.
    const text = buildScenarioRequest({
      request: 'walking with my friends and looking at the trees',
      learner: { cefr: 'A1', watchFor: [], name: 'Sam' },
    });
    assert.match(text, /Sam/);
  });

  test('an unnamed learner leaves the scenario request exactly as it was', () => {
    const named = buildScenarioRequest({ request: 'a walk', learner: { cefr: 'A1', watchFor: [], name: null } });
    const bare = buildScenarioRequest({ request: 'a walk', learner: { cefr: 'A1', watchFor: [] } });
    assert.equal(named, bare);
  });
});
