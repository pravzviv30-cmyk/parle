import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import type { DrillExercise } from '@luvani/core';

import { DrillBatchSchema, buildDrillGenerationRequest, type DrillGenerationInput } from './generate.ts';
import type { NewPhrase } from '../contract/types.ts';

const PHRASE_KEY = 'phrase:je voudrais un café';

const sessionPhrase: NewPhrase = {
  fr: "j'veux bien un café",
  frWritten: 'je veux bien un café',
  en: "I'd happily take a coffee",
  enLiteral: null,
  register: 'familier',
  note: null,
};

const profilePhrase = { fr: 'on y va', frWritten: null, en: 'let us get going' };

function input(overrides: Partial<DrillGenerationInput> = {}): DrillGenerationInput {
  return {
    sessionPhrases: [sessionPhrase],
    profilePhrases: [profilePhrase],
    errorTags: ['ne-retention', 'vous-to-friend'],
    topics: [{ en: 'Ordering at a café', fr: 'Commander au café' }],
    ...overrides,
  };
}

function base(kind: string) {
  // `transfer` is required by the schema and false here, which is what an
  // ordinary exercise looks like: the mark is claimed, never assumed.
  return { id: `gen:${PHRASE_KEY}:${kind}`, phraseKey: PHRASE_KEY, transfer: false };
}

const fillBlank = {
  kind: 'fill-blank',
  ...base('fill-blank'),
  difficulty: 'recognition',
  sentence: 'Je ___ un café.',
  options: ['voudrais', 'veux', 'vouloir'],
  accepted: ['voudrais'],
  en: 'I would like a coffee.',
} as const;

const bestSentence = {
  kind: 'best-sentence',
  ...base('best-sentence'),
  difficulty: 'recognition',
  prompt: 'You want to order a coffee at the counter.',
  candidates: [
    { fr: 'Je voudrais un café.', en: 'I would like a coffee.' },
    { fr: 'Donne le café.', en: 'Give the coffee.' },
  ],
  correctIndex: 0,
} as const;

const appropriateReply = {
  kind: 'appropriate-reply',
  ...base('appropriate-reply'),
  difficulty: 'recognition',
  line: { speaker: 'Karim', fr: 'Vous prenez quoi ?', en: 'What will you have?' },
  options: [
    { fr: 'Un café, merci.', en: 'A coffee, thanks.' },
    { fr: 'Il pleut souvent.', en: 'It often rains.' },
  ],
  acceptableIndexes: [0],
} as const;

const tapTranslate = {
  kind: 'tap-translate',
  ...base('tap-translate'),
  difficulty: 'recognition',
  en: 'I would like a coffee.',
  tokens: ['je', 'voudrais', 'un', 'café', 'gare', 'train'],
  accepted: ['je voudrais un café'],
} as const;

const listenType = {
  kind: 'listen-type',
  ...base('listen-type'),
  difficulty: 'production',
  fr: 'je voudrais un café',
  accepted: ['je voudrais un café', "j'voudrais un café"],
} as const;

const repeatThis = {
  kind: 'repeat-this',
  ...base('repeat-this'),
  difficulty: 'production',
  reference: 'Je voudrais un café.',
  referenceEn: 'I would like a coffee.',
  ipa: null,
  noMicTwin: listenType,
} as const;

describe('the drill batch schema mirrors core', () => {
  test('a batch with every kind parses and IS a core exercise list', () => {
    const parsed = DrillBatchSchema.parse({
      exercises: [fillBlank, bestSentence, appropriateReply, tapTranslate, listenType, repeatThis],
    });
    // The runtime companion to generate.ts's compile-time _shapeCheck: the
    // parsed exercises assign to core's union with no cast.
    const asCore: DrillExercise[] = parsed.exercises;
    assert.equal(asCore.length, 6);
    assert.equal(new Set(asCore.map((e) => e.kind)).size, 6);
  });

  test('the transfer mark is required and survives to core', () => {
    // A batch that forgot the mark is refused rather than read as "no". The
    // difference matters: absent would silently mean no transfer ever
    // happened, and a whole learner's transfer evidence would be a typo away
    // from vanishing without a single error.
    const { transfer: _dropped, ...markless } = fillBlank;
    assert.throws(() => DrillBatchSchema.parse({ exercises: [markless] }));

    const parsed = DrillBatchSchema.parse({
      exercises: [{ ...bestSentence, transfer: true }, fillBlank],
    });
    const asCore: DrillExercise[] = parsed.exercises;
    assert.equal(asCore[0]!.transfer, true, 'the mark did not reach the core exercise');
    assert.equal(asCore[1]!.transfer, false);

    // The model is told what the mark means, in the same request that asks for
    // the transfer exercises. An instruction without the field, or a field the
    // instruction never explains, produces marks nobody can trust.
    const request = buildDrillGenerationRequest(input());
    assert.ok(request.includes('At least one third of the exercises must test transfer'));
    assert.ok(request.includes('transfer: true on exactly those exercises'));
  });

  test('an unknown kind is rejected', () => {
    assert.throws(() => DrillBatchSchema.parse({ exercises: [{ ...fillBlank, kind: 'karaoke' }] }));
  });

  test('a repeat-this cannot hide inside a noMicTwin', () => {
    // The silent twin exists so a mic exercise can always be swapped away.
    // A twin that itself needs the mic would defeat the swap; the union
    // excludes it by construction and this pins that on purpose.
    const nested = { ...repeatThis, noMicTwin: { ...repeatThis, id: `gen:${PHRASE_KEY}:repeat-this-2` } };
    assert.throws(() => DrillBatchSchema.parse({ exercises: [nested] }));
  });

  test('fixed-format difficulty is enforced by the structured-output schema', () => {
    assert.throws(() => DrillBatchSchema.parse({ exercises: [{ ...listenType, difficulty: 'recognition' }] }));
    assert.throws(() =>
      DrillBatchSchema.parse({
        exercises: [{ ...repeatThis, noMicTwin: { ...listenType, difficulty: 'recognition' } }],
      }),
    );
    assert.throws(() => DrillBatchSchema.parse({ exercises: [{ ...tapTranslate, difficulty: 'production' }] }));
  });

  test('survives JSON serialization, the shape it actually arrives in', () => {
    const wire = JSON.parse(JSON.stringify({ exercises: [repeatThis] }));
    assert.deepEqual(DrillBatchSchema.parse(wire).exercises[0], repeatThis);
  });
});

describe('the generation request renders its material', () => {
  test('all three sections render, freshest first', () => {
    const request = buildDrillGenerationRequest(input());
    const today = request.indexOf("Today's phrases:");
    const unmastered = request.indexOf('Still unmastered from before:');
    const errors = request.indexOf('Recurring errors to aim fill-blanks at: ne-retention, vous-to-friend');
    assert.ok(today > -1 && unmastered > -1 && errors > -1);
    assert.ok(today < unmastered && unmastered < errors);
    assert.ok(request.includes('Discussed topics:\n- Ordering at a café (Commander au café)'));
  });

  test('an empty input omits its section entirely', () => {
    const request = buildDrillGenerationRequest(
      input({ sessionPhrases: [], profilePhrases: [], errorTags: [], topics: [] }),
    );
    assert.ok(!request.includes("Today's phrases:"));
    assert.ok(!request.includes('Still unmastered from before:'));
    assert.ok(!request.includes('Recurring errors'));
  });

  test('a written form renders beside the spoken one, and null renders nothing', () => {
    const request = buildDrillGenerationRequest(input());
    assert.ok(request.includes(`- "j'veux bien un café" (written: je veux bien un café) = I'd happily take a coffee`));
    assert.ok(request.includes('- "on y va" = let us get going'));
  });

  test('the instruction carries the id and phraseKey conventions verbatim', () => {
    // A wrong key orphans the exercise from its review card, so the exact
    // convention must reach the model in every request.
    const request = buildDrillGenerationRequest(input());
    assert.ok(request.includes(`id: 'gen:<phraseKey>:<kind>'`));
    assert.ok(request.includes(`EXACTLY 'phrase:' followed by the phrase's French line, trimmed and lowercased`));
    assert.ok(request.includes('every repeat-this carries noMicTwin'));
  });

  test('the phraseKey convention, applied, is what the review deck expects', () => {
    assert.equal('phrase:' + ' Je Voudrais un Café '.trim().toLowerCase(), PHRASE_KEY);
  });
});
