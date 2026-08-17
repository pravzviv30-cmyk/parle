import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { damerauLevenshtein, gradeAnswer } from './grading.ts';
import type {
  AppropriateReplyExercise,
  BestSentenceExercise,
  FillBlankExercise,
  RepeatThisExercise,
  TapTranslateExercise,
} from './types.ts';

/** A typed fill-blank, the plainest free-text exercise. */
function typed(accepted: string[]): FillBlankExercise {
  return { kind: 'fill-blank', id: 'x', phraseKey: 'phrase:x', difficulty: 'production', sentence: '___', options: null, accepted, en: 'x' };
}

function withOptions(accepted: string[], options: string[]): FillBlankExercise {
  return { ...typed(accepted), options, difficulty: 'recognition' };
}

function tap(accepted: string[], tokens: string[]): TapTranslateExercise {
  return { kind: 'tap-translate', id: 'x', phraseKey: 'phrase:x', difficulty: 'recognition', en: 'x', tokens, accepted };
}

describe('damerauLevenshtein', () => {
  // Each pair is checked in both directions; distance is symmetric and a
  // table that only ever passes arguments one way would not prove it.
  const TABLE: [string, string, number][] = [
    ['', '', 0],
    ['café', 'café', 0],
    ['', 'abc', 3],
    ['cafe', 'cave', 1], // substitution
    ['cafe', 'cafes', 1], // insertion
    ['merci', 'merc', 1], // deletion
    ['merci', 'mreci', 1], // adjacent transposition, the case plain Levenshtein bills as two
    ['bonjour', 'bonjuor', 1],
    ['plait', 'palit', 1],
    ['abcd', 'badc', 2], // two independent swaps
    ['bonjour', 'bonsoir', 2],
    ['carte', 'carotte', 2],
    ['kitten', 'sitting', 3],
  ];

  for (const [a, b, expected] of TABLE) {
    test(`d("${a}", "${b}") = ${expected}`, () => {
      assert.equal(damerauLevenshtein(a, b), expected);
      assert.equal(damerauLevenshtein(b, a), expected);
    });
  }

  test('accents are the caller`s business — raw strings are compared raw', () => {
    // Grading normalises before measuring; the metric itself must not guess.
    assert.equal(damerauLevenshtein('été', 'ete'), 2);
  });
});

describe('free text — normalisation before comparison', () => {
  test('dropped accents, apostrophes, and punctuation never fail a right answer', () => {
    const ex = typed(["Un café, s'il vous plaît"]);
    const r = gradeAnswer(ex, 'un cafe sil vous plait');
    assert.equal(r.verdict, 'good');
    assert.equal(r.closest, "Un café, s'il vous plaît", 'the real spelling comes back, not the stripped one');
  });

  test('surrounding whitespace and case are forgiven', () => {
    assert.equal(gradeAnswer(typed(['merci']), '  MERCI  ').verdict, 'good');
  });

  test('matching a different accepted answer is simply correct', () => {
    const r = gradeAnswer(typed(['bonjour', 'bonsoir']), 'bonsoir');
    assert.equal(r.verdict, 'good');
    assert.equal(r.closest, 'bonsoir');
  });

  test('an empty answer is a miss that still points at the target', () => {
    const r = gradeAnswer(typed(['bonjour']), '');
    assert.equal(r.verdict, 'miss');
    assert.equal(r.closest, 'bonjour');
  });

  test('an answer of the wrong shape is a miss, never a crash', () => {
    assert.equal(gradeAnswer(typed(['bonjour']), 3).verdict, 'miss');
    assert.equal(gradeAnswer(typed(['bonjour']), [1, 2]).verdict, 'miss');
  });
});

describe('the typo window — one edit, five letters, both words', () => {
  test('a single substitution in a long enough word is a typo', () => {
    const r = gradeAnswer(typed(['merci']), 'merki');
    assert.equal(r.verdict, 'typo');
    assert.equal(r.closest, 'merci');
  });

  test('an adjacent transposition is one slip, not two errors', () => {
    assert.equal(gradeAnswer(typed(['merci']), 'mreci').verdict, 'typo');
    assert.equal(gradeAnswer(typed(['santé']), 'satne').verdict, 'typo');
  });

  test('a missing letter is a typo when what remains still clears the bar', () => {
    assert.equal(gradeAnswer(typed(['bonjour']), 'bonjor').verdict, 'typo');
  });

  test('four letters is below the bar — one edit is too large a share of the word', () => {
    // "merc" is one deletion from "merci", but the answer given has only four
    // letters, and at that length a quarter of the word is missing.
    assert.equal(gradeAnswer(typed(['merci']), 'merc').verdict, 'miss');
  });

  test('five letters is exactly the bar', () => {
    // The same one-edit shape on either side of the boundary: four letters
    // given is a miss, five letters given is a typo.
    assert.equal(gradeAnswer(typed(['salut']), 'salu').verdict, 'miss');
    assert.equal(gradeAnswer(typed(['salute']), 'salut').verdict, 'typo');
  });

  test('the bar also belongs to the word being learned', () => {
    // "cafés" has five letters, but the accepted word normalises to four.
    // Forgiving an edit there would forgive a quarter of the target.
    assert.equal(gradeAnswer(typed(['café']), 'cafés').verdict, 'miss');
  });

  test('two edits is a different word', () => {
    assert.equal(gradeAnswer(typed(['bonjour']), 'bonjr').verdict, 'miss');
  });
});

describe('a slip that lands on another real word is a miss', () => {
  test('typing a distractor token exactly is a choice, not a typo', () => {
    // "poison" is one letter from "poisson" and also sitting right there on a
    // tile. They picked the other word; they did not mistype this one.
    const r = gradeAnswer(tap(['poisson'], ['poisson', 'poison', 'le']), 'poison');
    assert.equal(r.verdict, 'miss');
    assert.equal(r.closest, 'poisson');
  });

  test('the same slip without the rival word on screen stays a typo', () => {
    assert.equal(gradeAnswer(tap(['poisson'], ['poisson', 'le']), 'poison').verdict, 'typo');
  });

  test('a fill-blank option is a rival word too', () => {
    const ex = withOptions(['carte'], ['carte', 'tarte', 'porte']);
    assert.equal(gradeAnswer(ex, 'tarte').verdict, 'miss', 'landing on the distractor option');
    assert.equal(gradeAnswer(ex, 'carre').verdict, 'typo', 'an ordinary slip is still forgiven');
    assert.equal(gradeAnswer(ex, 'carte').verdict, 'good');
  });
});

describe('closest — the form worth quoting back', () => {
  test('the nearest accepted answer wins', () => {
    const r = gradeAnswer(typed(['un thé', 'un café']), 'un cafi');
    assert.equal(r.verdict, 'typo');
    assert.equal(r.closest, 'un café');
  });

  test('on a tie, the first listed accepted answer speaks', () => {
    // "bonjoir" is one edit from both; the author put "bonjour" first.
    const r = gradeAnswer(typed(['bonjour', 'bonsoir']), 'bonjoir');
    assert.equal(r.closest, 'bonjour');
  });

  test('a distant miss still names the target', () => {
    const r = gradeAnswer(typed(['bonjour']), 'salut');
    assert.equal(r.verdict, 'miss');
    assert.equal(r.closest, 'bonjour');
  });
});

describe('index kinds — taps have no typos', () => {
  const bs: BestSentenceExercise = {
    kind: 'best-sentence',
    id: 'bs',
    phraseKey: 'phrase:x',
    difficulty: 'recognition',
    prompt: 'Pick one.',
    candidates: [
      { fr: 'Un café.', en: 'A coffee.' },
      { fr: "Bonjour, un café s'il vous plaît", en: 'Hello, a coffee please' },
      { fr: 'Je veux un café', en: 'I want a coffee' },
    ],
    correctIndex: 1,
  };

  test('the correct index is good, with nothing to point at', () => {
    assert.deepEqual(gradeAnswer(bs, 1), { verdict: 'good', closest: null });
  });

  test('any other index is a miss that shows the right sentence', () => {
    const r = gradeAnswer(bs, 0);
    assert.equal(r.verdict, 'miss');
    assert.equal(r.closest, "Bonjour, un café s'il vous plaît");
  });

  test('an out-of-range index and a text answer are both misses', () => {
    assert.equal(gradeAnswer(bs, 7).verdict, 'miss');
    assert.equal(gradeAnswer(bs, 'un café').verdict, 'miss');
  });

  const ar: AppropriateReplyExercise = {
    kind: 'appropriate-reply',
    id: 'ar',
    phraseKey: 'phrase:x',
    difficulty: 'recognition',
    line: { speaker: 'Karim', fr: 'Sur place ou à emporter ?', en: 'Here or to go?' },
    options: [
      { fr: 'Sur place', en: 'Here' },
      { fr: 'Oui', en: 'Yes' },
      { fr: 'À emporter', en: 'To go' },
    ],
    acceptableIndexes: [0, 2],
  };

  test('any acceptable reply is good — this drills conversation, not a single key', () => {
    assert.equal(gradeAnswer(ar, 0).verdict, 'good');
    assert.equal(gradeAnswer(ar, 2).verdict, 'good');
  });

  test('a set of picks is good only when every pick would have been', () => {
    assert.equal(gradeAnswer(ar, [0, 2]).verdict, 'good');
    assert.equal(gradeAnswer(ar, [0, 1]).verdict, 'miss');
    assert.equal(gradeAnswer(ar, []).verdict, 'miss');
  });

  test('a miss points at the first acceptable reply', () => {
    assert.equal(gradeAnswer(ar, 1).closest, 'Sur place');
  });
});

describe('repeat-this and tap-translate grade like free text', () => {
  const rt: RepeatThisExercise = {
    kind: 'repeat-this',
    id: 'rt',
    phraseKey: 'phrase:x',
    difficulty: 'production',
    reference: "Un café, s'il vous plaît",
    referenceEn: 'A coffee, please',
    ipa: null,
    noMicTwin: typed(["Un café, s'il vous plaît"]),
  };

  test('a transcript matching the reference is good, accents and all stripped', () => {
    assert.equal(gradeAnswer(rt, 'un cafe sil vous plait').verdict, 'good');
  });

  test('a one-letter slip in the transcript is a typo against the reference', () => {
    assert.equal(gradeAnswer(rt, "un café s'il vous plai").verdict, 'typo');
  });

  test('the assembled token string is graded like typing', () => {
    const ex = tap(["un café s'il vous plaît"], ['un', 'café', "s'il", 'vous', 'plaît', 'thé']);
    assert.equal(gradeAnswer(ex, "un café s'il vous plaît").verdict, 'good');
    assert.equal(gradeAnswer(ex, "un thé s'il vous plaît").verdict, 'miss');
  });
});
