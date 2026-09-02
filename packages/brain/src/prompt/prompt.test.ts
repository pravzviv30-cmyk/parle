import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { CAFE_LESSON, RUNGS, TUTOR_VOICES, directiveFor } from '@luvani/core';

// The other shipped prompt. Reached across the workspace on purpose: the claim
// under test is that both real builders carry one block, and a test that
// rebuilt either of them here would prove nothing about what ships.
import {
  baseInstructions as lessonBaseInstructions,
  buildPrompt as buildLessonPrompt,
} from '../../../../services/tutor-agent/src/prompt.ts';
import { SAFETY_CONDUCT } from './safetyConduct.ts';
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

/**
 * Slice a prompt between two anchors, and fail loudly if either has moved.
 *
 * The guards below check that a stretch of prompt text does NOT say something,
 * and `indexOf` returns -1 when an anchor is gone. `slice(-1, n)` is the last
 * character of the file, which contains no city and no age, so a guard whose
 * anchor drifted keeps passing while checking nothing at all. F292 renamed both
 * anchors the F281 guard used, which is how this was found rather than shipped.
 */
function section(source: string, from: string, to: string): string {
  const start = source.indexOf(from);
  const end = source.indexOf(to);
  assert.ok(start >= 0, `the anchor "${from}" is gone, so this guard was about to check nothing`);
  assert.ok(end > start, `the anchor "${to}" is gone, so this guard was about to check nothing`);
  return source.slice(start, end);
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
    // Two opposite failure modes, and the rule has to hold both off at once.
    //
    // The dead-end turn is the competitor failure this product exists to avoid:
    // "the AI makes a statement and that's it, which leaves me blank". So an
    // opening is still mandatory, and that half is unchanged.
    //
    // The other half was ours. Requiring the opening to BE a question made every
    // turn end in one, which the founder heard as being interviewed rather than
    // talked to. So the guarantee is asserted now and the wording is not: leave
    // an opening every turn, and stop making a question the only way to give one.
    assert.match(persona, /leave (the learner|them) an obvious opening/i, 'a turn may never dead-end');
    assert.match(persona, /not always a question/i, 'an opening does not have to be a question');
    assert.match(persona, /never ask two questions in one turn/i);
    assert.match(persona, /one short english clause/i, 'asking for English is an escape hatch, not a mode switch');
  });

  test('the persona is a person before it is a policy', () => {
    // The rewrite this holds. The block used to open "You are a responsive
    // French conversation tutor for an English-speaking learner" and then list
    // twenty-two rules, fourteen beginning with "Never". A model handed only
    // constraints produces constrained output, and that is what "purely
    // robotic" sounded like. Someone deleting Luc to tidy the prompt should
    // have to delete this test too.
    const { persona } = buildSystemBlocks();
    const opening = persona.slice(0, 400);
    assert.match(opening, /you are luc/i, 'the tutor has no name in the first thing the model reads');
    // He has a life, not just rules — that is what this line has always held.
    // It used to prove it with "Lyon". The town came out under F281 because the
    // learner's chosen voice can be Québécois and a persona may assert only what
    // every voice could plausibly claim, so the proof moved to the fact that
    // survived the edit and carries the same weight: twenty years behind a bar.
    //
    // It has now moved a second time, under the same rule and for the same
    // reason. F292 took the age out because Émilie is a young voice and
    // "fifty-two" is the last biography fact a voice could contradict, so the
    // half of this assertion that watched the age watches an opinion instead.
    // An opinion is the safest home for it: no accent and no age can disagree
    // with one, and a rulebook does not have any.
    assert.match(persona, /ran a bar/i, 'he is a person with a life, not a policy');
    assert.match(persona, /a long lunch is never wasted/i, 'and opinions of his own');
    assert.match(persona, /not a teacher/i, 'the one thing he is explicitly not');

    const firstRule = persona.indexOf('- ');
    const firstNever = persona.search(/\bNever\b/);
    assert.ok(firstRule > 0 && firstNever > firstRule, 'the rules arrive before the person again');
  });

  test('he reacts to the learner before he advances the scene', () => {
    // "Respond to what they meant" is about parsing. This is about caring, and
    // its absence is what the founder meant by "it never just reacts".
    const { persona } = buildSystemBlocks();
    assert.match(persona, /react before you do anything else/i);
    assert.match(persona, /answer the person first/i);
  });

  test('the fillers the pack already teaches are asked for in his own lines', () => {
    // The pack has carried these from the start and its own principle says they
    // "belong in the tutor's own lines". Nothing repeated that where the model
    // would act on it, so the tutor spoke textbook French while teaching that
    // textbook French is the thing to fix.
    const { persona } = buildSystemBlocks();
    for (const filler of ['bah', 'du coup', 'en fait', 'voilà']) {
      assert.ok(persona.includes(filler), `the persona never asks him to say "${filler}"`);
    }
  });

  test('his English stays plain, because it is the channel the beginner relies on', () => {
    const { persona } = buildSystemBlocks();
    assert.match(persona, /your english is short and plain/i);
    assert.match(persona, /never put french words inside it/i);
  });

  test('he does not perform himself at the learner', () => {
    // The failure mode a named character invites. A tutor with a biography who
    // keeps mentioning it is worse company than one with no name at all.
    const { persona } = buildSystemBlocks();
    assert.match(persona, /never go on about yourself/i);
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

  test('both shipped prompts carry the one safety conduct block', () => {
    // F138. PRIVACY_AND_SAFETY.md says judgement lives in the prompt and policy
    // lives in code. Before this, grepping both shipped prompt sets for
    // self-harm, crisis, minor, medical or harmful found one hit, and it was
    // the word "weight" in a coach-finding description.
    //
    // A prompt is a string, so this drives the real builders and asserts the
    // block appears verbatim in what each of them produces. Emptying the
    // constant fails the first assertion; dropping either include fails one of
    // the other two.
    assert.ok(
      SAFETY_CONDUCT.trim().length > 400,
      'the safety conduct block has been hollowed out, so both prompts now carry nothing',
    );

    const { persona } = buildSystemBlocks();
    assert.ok(persona.includes(SAFETY_CONDUCT), 'the conversation prompt no longer tells the tutor what to do with a disclosure');

    const lesson = buildLessonPrompt(CAFE_LESSON, CAFE_LESSON.turns[0]!, directiveFor(RUNGS.CUED));
    assert.ok(lesson.includes(SAFETY_CONDUCT), 'the scripted lesson prompt no longer tells the tutor what to do with a disclosure');
  });

  test('the safety conduct block keeps its copy honest', () => {
    // Safety copy is design. These are the specific ways this block could be
    // true and still be wrong.
    assert.match(SAFETY_CONDUCT, /local emergency number/i, 'the one number that is right everywhere is not named');
    assert.match(SAFETY_CONDUCT, /step out of the scene/i, 'nothing tells him to stop being a character');
    assert.match(SAFETY_CONDUCT, /plain English/i, 'a person in trouble is owed the language they can certainly follow');
    assert.match(SAFETY_CONDUCT, /first time/i, 'nothing stops him waiting to see if they say it again');
    assert.match(SAFETY_CONDUCT, /nobody is reading/i, 'the honest half is missing: nothing here is monitored');
    assert.match(SAFETY_CONDUCT, /ce travail va me tuer/i, 'dark vocabulary must be named as practice, or the tutor flinches at French');

    // Never claim somebody is watching or coming. That is the one comfort this
    // product must not offer, because it is not true.
    assert.doesNotMatch(
      SAFETY_CONDUCT,
      /\b(?:we|someone|somebody|a human|staff|luvani)\s+(?:is|are|will be)\s+(?:watching|monitoring|reading|listening|notified)/i,
      'the block claims somebody is watching the conversation',
    );
    assert.doesNotMatch(SAFETY_CONDUCT, /help is (?:on the way|coming)(?! because)/i, 'the block promises help that is not coming');

    // The two phrases the whole product is built to never say, and they are no
    // more welcome in a crisis than in a pause.
    assert.doesNotMatch(SAFETY_CONDUCT, /don'?t worry/i);
    assert.doesNotMatch(SAFETY_CONDUCT, /take your time/i);

    // No scolding, and no em dash. Both are house style, and both matter more
    // here than anywhere else in the prompt.
    assert.doesNotMatch(SAFETY_CONDUCT, /\b(?:wrong|incorrect|inappropriate|misbehav\w*|you should not have)\b/i);
    assert.doesNotMatch(SAFETY_CONDUCT, /—/);
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

describe('the tutor speaks at the length the learner can carry', () => {
  test('the bottom rung asks for one short sentence and one idea', () => {
    // "Match sentence length" on its own was a hope, not an instruction: a model
    // told to match an abstraction picks its own idea of short, and for someone
    // who cannot yet compose a French sentence that is still three sentences of
    // French they cannot hold.
    for (const rung of [RUNGS.ECHO, RUNGS.CUED] as const) {
      const context = buildTurnContext(contextInput({ directive: directiveFor(rung) }));
      const independence = context.split('\n').find((line) => line.startsWith('INDEPENDENCE:'));

      assert.ok(independence, `rung ${rung} has no INDEPENDENCE line at all`);
      assert.match(independence, /one short sentence/i, `rung ${rung} does not say how long a turn may be`);
      assert.match(independence, /one idea/i, `rung ${rung} does not cap how much is in it`);
    }
  });

  test("the top rung stops constraining the tutor's length", () => {
    // A fluent learner being fed one-sentence answers is being talked down to.
    const context = buildTurnContext(contextInput({ directive: directiveFor(RUNGS.FREE) }));
    const independence = context.split('\n').find((line) => line.startsWith('INDEPENDENCE:'));

    assert.ok(independence);
    assert.doesNotMatch(independence, /one short sentence/i, 'the top rung must not be held to a beginner ceiling');
    assert.match(independence, /whatever length/i, 'the top rung should hand the length back to the moment');
  });

  test('every rung says something about length, and no two rungs say the same thing', () => {
    const lines = [RUNGS.ECHO, RUNGS.CUED, RUNGS.PROMPTED, RUNGS.FREE].map((rung) => {
      const context = buildTurnContext(contextInput({ directive: directiveFor(rung) }));
      return context.split('\n').find((line) => line.startsWith('INDEPENDENCE:')) ?? '';
    });

    for (const line of lines) assert.notEqual(line.trim(), '', 'a rung with no independence line tells the model nothing');
    assert.equal(new Set(lines).size, lines.length, 'two rungs give the tutor identical instructions, so one of them is not a rung');
  });

  test('a finished mission tells the tutor to stay, and never to congratulate', () => {
    const carrying = buildTurnContext(contextInput({ missionDone: true }));
    const ordinary = buildTurnContext(contextInput());

    assert.match(carrying, /SCENE GOAL: already reached/, 'the tutor is not told the goal is behind them');
    assert.match(carrying, /stay in character/i);
    assert.match(carrying, /Do not announce the achievement/i);
    assert.doesNotMatch(ordinary, /SCENE GOAL/, 'an unfinished scene must not carry the finished-scene line');
  });
});

describe("the tutor's biography claims nothing a voice can contradict — F281", () => {
  /**
   * A persona may assert only what every voice in the catalogue could plausibly
   * claim. The founder chose a Québécois voice for Luc, and the prompts said he
   * grew up in Lyon and ran a bar near the Saône — so the learner heard one man
   * and read about another. The bar, the twenty years and the warmth survive
   * because no accent contradicts them; the town does not.
   *
   * Both prompts are checked because they are two pipelines describing one
   * person, and the existing coupling test exists precisely because they drifted
   * once already.
   */
  const CITIES = /\b(Lyon|Lyonnais|Sa[oô]ne|Paris|Marseille|Bordeaux|Toulouse|Montr[eé]al|Qu[eé]bec)\b/i;

  test('neither prompt gives the tutor a home town', () => {
    // Both anchors changed under F292, which turned each persona block into a
    // function of the chosen persona: `const PERSONA` became a function and
    // `You are Luc.` became an interpolation. They are re-pointed at text that
    // is not about to move again, and they go through `section` so that the next
    // time one of them does move, this fails instead of quietly passing.
    const brain = readFileSync(new URL('./system.ts', import.meta.url), 'utf8');
    const persona = section(brain, 'WHO YOU ARE', 'THE CONVERSATION');
    const found = persona.match(CITIES);
    assert.equal(found, null, `the brain persona still places him in ${found?.[0]}`);

    const agent = readFileSync(
      new URL('../../../../services/tutor-agent/src/prompt.ts', import.meta.url),
      'utf8',
    );
    const opening = section(agent, 'export function baseInstructions', 'THE SCENE');
    const there = opening.match(CITIES);
    assert.equal(there, null, `the agent prompt still places him in ${there?.[0]}`);
  });
});

describe("the tutor's biography claims no age either — F292", () => {
  /**
   * F281's rule applied to the last fact that broke it. A persona may assert
   * only what EVERY voice in the catalogue could plausibly claim, and the
   * catalogue now contains a young voice: Émilie saying "you are fifty-two" is
   * the same defect as a Québécois voice saying "I grew up in Lyon", and it is
   * the learner's ears that win either argument.
   *
   * What survives is everything an accent and an age leave alone: the bar, the
   * twenty years, the not-a-teacher. Those are asserted here too, because the
   * cheapest way to pass a "says no age" test is to delete the person, and that
   * is the exact rewrite F281 and F292 both exist to prevent.
   *
   * Driven through the real builders for every voice in the catalogue, and only
   * over the part of each prompt that describes the tutor: the café lesson's own
   * scenario is lesson data, and letting it into the slice would test the wrong
   * string.
   */
  const AGE_CLAIM =
    /\b(?:you are|you're|he is|she is|aged)\s+(?:\d{1,3}|twenty|thirty|forty|fifty|sixty|seventy)\b|\byears old\b/i;

  test('the persona line carries no age a young voice can contradict', () => {
    for (const voice of Object.values(TUTOR_VOICES)) {
      const lesson = section(lessonBaseInstructions(CAFE_LESSON, voice.persona), 'You are', 'THE SCENE');
      const conversation = section(
        buildSystemBlocks(voice.persona).persona,
        'WHO YOU ARE',
        'THE CONVERSATION',
      );

      for (const [where, text] of [
        ['lesson', lesson],
        ['conversation', conversation],
      ] as const) {
        const who = voice.persona.name;
        assert.doesNotMatch(text, AGE_CLAIM, `the ${where} prompt still tells ${who} how old she or he is`);
        assert.doesNotMatch(text, /fifty[- ]two/i, `the ${where} prompt still says fifty-two to ${who}`);

        // The person the age was attached to has to still be there.
        assert.match(text, /ran a bar/i, `the ${where} prompt lost the bar along with the age`);
        assert.match(text, /twenty years/i, `the ${where} prompt lost the twenty years, which is a duration and not an age`);
        assert.match(text, /not a teacher/i, `the ${where} prompt lost the one thing the tutor is explicitly not`);
      }
    }
  });
});
