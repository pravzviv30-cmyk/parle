import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { validateBatch, validateExercise } from './validate.ts';
import type {
  AppropriateReplyExercise,
  BestSentenceExercise,
  DrillExercise,
  FillBlankExercise,
  ListenTypeExercise,
  RepeatThisExercise,
  TapTranslateExercise,
} from './types.ts';

// One known-good exercise per kind. Each rejection test breaks exactly one
// thing in one of these, so a failure names the rule and nothing else.

const goodFill: FillBlankExercise = {
  kind: 'fill-blank',
  id: 'fill',
  phraseKey: "phrase:un café, s'il vous plaît",
  difficulty: 'recognition',
  sentence: "Un ___, s'il vous plaît",
  options: ['café', 'thé', 'chocolat'],
  accepted: ['café', 'thé'],
  en: 'A coffee, please',
};

const goodTypedFill: FillBlankExercise = { ...goodFill, id: 'fill-typed', options: null, difficulty: 'production' };

const goodBest: BestSentenceExercise = {
  kind: 'best-sentence',
  id: 'best',
  phraseKey: 'phrase:bonne journée !',
  difficulty: 'recognition',
  prompt: 'You are heading out the door.',
  candidates: [
    { fr: 'Bonne nuit', en: 'Good night' },
    { fr: 'Bonne journée !', en: 'Have a good day!' },
  ],
  correctIndex: 1,
};

const goodReply: AppropriateReplyExercise = {
  kind: 'appropriate-reply',
  id: 'reply',
  phraseKey: "phrase:sur place, s'il vous plaît",
  difficulty: 'recognition',
  line: { speaker: 'Karim', fr: 'Sur place ou à emporter ?', en: 'To have here or take away?' },
  options: [
    { fr: 'Sur place', en: 'Here' },
    { fr: 'À emporter', en: 'To take away' },
    { fr: 'Oui', en: 'Yes' },
  ],
  acceptableIndexes: [0, 1],
};

const goodListen: ListenTypeExercise = {
  kind: 'listen-type',
  id: 'listen',
  phraseKey: 'phrase:ça marche',
  difficulty: 'production',
  fr: 'Ça marche',
  accepted: ['Ça marche'],
};

const goodRepeat: RepeatThisExercise = {
  kind: 'repeat-this',
  id: 'repeat',
  phraseKey: 'phrase:ça marche',
  difficulty: 'production',
  reference: 'Ça marche',
  referenceEn: 'Works for me',
  ipa: null,
  noMicTwin: { ...goodListen, id: 'repeat-silent' },
};

const goodTap: TapTranslateExercise = {
  kind: 'tap-translate',
  id: 'tap',
  phraseKey: "phrase:un café, s'il vous plaît",
  difficulty: 'recognition',
  en: 'A coffee, please',
  tokens: ['un', 'café', "s'il", 'vous', 'plaît', 'thé'],
  accepted: ["un café s'il vous plaît"],
};

const ALL_GOOD: DrillExercise[] = [goodFill, goodTypedFill, goodBest, goodReply, goodListen, goodRepeat, goodTap];

/** Assert rejection, and that some reason mentions the expected phrase. */
function rejects(exercise: DrillExercise, expected: string): void {
  const result = validateExercise(exercise);
  assert.equal(result.ok, false, `expected a rejection mentioning "${expected}"`);
  if (!result.ok) {
    assert.ok(
      result.reasons.some((r) => r.includes(expected)),
      `no reason mentions "${expected}" in: ${result.reasons.join(' | ')}`,
    );
  }
}

describe('well-formed exercises pass', () => {
  for (const exercise of ALL_GOOD) {
    test(`${exercise.kind} (${exercise.id})`, () => {
      assert.deepEqual(validateExercise(exercise), { ok: true });
    });
  }
});

describe('identity and difficulty', () => {
  test('an empty id is rejected', () => {
    rejects({ ...goodFill, id: '  ' }, 'id is empty');
  });

  test('a phraseKey outside the phrase:/vocab: scheme is rejected', () => {
    rejects({ ...goodFill, phraseKey: 'bonjour' }, 'scheme');
    rejects({ ...goodFill, phraseKey: 'turnkey:bonjour' }, 'scheme');
  });

  test('a phraseKey that is not lowercased is rejected — the deck would never find it', () => {
    rejects({ ...goodFill, phraseKey: 'phrase:Bonjour' }, 'lowercased');
  });

  test('vocab: keys are as welcome as phrase: keys', () => {
    assert.deepEqual(validateExercise({ ...goodFill, phraseKey: 'vocab:café' }), { ok: true });
  });

  test('difficulty must match what the format asks of the learner', () => {
    rejects({ ...goodFill, difficulty: 'production' }, 'difficulty');
    rejects({ ...goodTypedFill, difficulty: 'recognition' }, 'difficulty');
    rejects({ ...goodRepeat, difficulty: 'recognition' }, 'difficulty');
  });
});

describe('accepted answers', () => {
  test('an empty accepted set is rejected', () => {
    rejects({ ...goodTypedFill, accepted: [] }, 'accepted is empty');
  });

  test('two accepted answers that normalise identically are rejected', () => {
    // "café" and "cafe" are the same answer to the grader; listing both means
    // the author believed they were different, which is the bug being caught.
    rejects({ ...goodTypedFill, accepted: ['café', 'cafe'] }, 'collapse');
  });

  test('an accepted answer that normalises to nothing is rejected', () => {
    rejects({ ...goodTypedFill, accepted: ['café', ' ?! '] }, 'normalises to nothing');
  });
});

describe('fill-blank', () => {
  test('the sentence must actually contain a blank', () => {
    rejects({ ...goodFill, sentence: "Un café, s'il vous plaît" }, 'no ___ blank');
  });

  test('at least one option must be an accepted answer, or the exercise is unwinnable', () => {
    rejects({ ...goodFill, options: ['chocolat', 'lait'] }, 'no option is an accepted answer');
  });

  test('options that normalise identically are rejected', () => {
    rejects({ ...goodFill, options: ['café', 'Cafe', 'thé'] }, 'collapse');
  });

  test('a single option is no choice at all', () => {
    rejects({ ...goodFill, options: ['café'] }, 'no real choice');
  });
});

describe('best-sentence and appropriate-reply', () => {
  test('correctIndex must land inside the candidates', () => {
    rejects({ ...goodBest, correctIndex: 2 }, 'out of range');
    rejects({ ...goodBest, correctIndex: -1 }, 'out of range');
    rejects({ ...goodBest, correctIndex: 0.5 }, 'out of range');
  });

  test('duplicate candidates are rejected', () => {
    rejects(
      { ...goodBest, candidates: [...goodBest.candidates, { fr: 'bonne journée', en: 'Have a good day' }] },
      'collapse',
    );
  });

  test('acceptableIndexes must be present, in range, and unrepeated', () => {
    rejects({ ...goodReply, acceptableIndexes: [] }, 'acceptableIndexes is empty');
    rejects({ ...goodReply, acceptableIndexes: [0, 3] }, 'out of range');
    rejects({ ...goodReply, acceptableIndexes: [0, 0] }, 'repeats');
  });
});

describe('repeat-this and its twin', () => {
  test('a missing twin is rejected — suppressMic must never come up empty', () => {
    rejects({ ...goodRepeat, noMicTwin: undefined as unknown as DrillExercise }, 'no noMicTwin');
  });

  test('a twin that still needs the mic is rejected', () => {
    rejects({ ...goodRepeat, noMicTwin: { ...goodRepeat, id: 'other' } }, 'itself a repeat-this');
  });

  test('a twin drilling a different phrase is rejected', () => {
    rejects({ ...goodRepeat, noMicTwin: { ...goodListen, id: 'twin', phraseKey: 'phrase:autre chose' } }, 'different phraseKey');
  });

  test('a twin sharing its parent id is rejected — attempts are tracked by id', () => {
    rejects({ ...goodRepeat, noMicTwin: { ...goodListen, id: goodRepeat.id } }, 'shares its id');
  });

  test('an invalid twin fails the parent, with the reason attributed', () => {
    rejects({ ...goodRepeat, noMicTwin: { ...goodListen, id: 'twin', accepted: [] } }, 'noMicTwin: accepted is empty');
  });
});

describe('tap-translate and listen-type', () => {
  test('some accepted answer must be assemblable from the tokens', () => {
    rejects({ ...goodTap, accepted: ['un chocolat chaud'] }, 'assembled from the tokens');
  });

  test('a token that normalises to nothing is rejected', () => {
    rejects({ ...goodTap, tokens: [...goodTap.tokens, '?!'] }, 'normalises to nothing');
  });

  test('typing exactly what was played must be accepted', () => {
    rejects({ ...goodListen, accepted: ['ça roule'] }, 'played line');
  });
});

describe('copy rules — the linter reads like the copy tests', () => {
  test('an em dash anywhere learner-visible is rejected', () => {
    rejects({ ...goodBest, prompt: 'You are leaving — say goodbye.' }, 'em dash');
  });

  test('scold words are rejected', () => {
    rejects({ ...goodFill, en: 'A coffee, please (wrong answers exist)' }, 'scold');
  });

  test('digits are rejected — numbers belong on the end card only', () => {
    rejects({ ...goodFill, sentence: 'Il est 5 heures, un ___', accepted: ['café'] }, 'digit');
  });

  test('accepted answers count as learner-visible: the miss line quotes them', () => {
    rejects({ ...goodTypedFill, accepted: ['café', 'café 2'] }, 'digit');
  });

  test('a French-accented English gloss is rejected', () => {
    rejects({ ...goodFill, en: 'A café, please' }, 'looks French');
  });

  test('the French side is allowed its accents, and names are not glosses', () => {
    // Chloé stays Chloé in any language; the heuristic must not touch her.
    const chloe: AppropriateReplyExercise = {
      ...goodReply,
      line: { speaker: 'Chloé', fr: 'On se fait un resto samedi ?', en: 'Shall we do a restaurant on Saturday?' },
    };
    assert.deepEqual(validateExercise(chloe), { ok: true });
  });
});

describe('validateBatch', () => {
  test('a clean batch passes whole', () => {
    assert.deepEqual(validateBatch(ALL_GOOD), { ok: true });
  });

  test('reasons carry the offending exercise id', () => {
    const result = validateBatch([goodFill, { ...goodTypedFill, accepted: [] }]);
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(result.reasons.some((r) => r.startsWith('fill-typed: ')));
  });

  test('duplicate ids across the batch are rejected', () => {
    const result = validateBatch([goodFill, { ...goodBest, id: goodFill.id }]);
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(result.reasons.some((r) => r.includes('duplicate exercise id')));
  });

  test('a twin colliding with another exercise id is caught too', () => {
    const result = validateBatch([goodRepeat, { ...goodListen, id: 'repeat-silent' }]);
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(result.reasons.some((r) => r.includes('duplicate exercise id "repeat-silent"')));
  });
});
