import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { createProfile, learnerSnapshotFrom, type LearnerProfile, type RememberedFact } from './profile.ts';
import { rankPhrasesForScene, recallFacts, recallPatterns, recallTerms } from './recall.ts';

function fact(en: string, fr: string | null = null): RememberedFact {
  return { kind: 'interest', en, fr, happensAround: null, notedAt: 'n', source: 'conversation', updatedAt: 'n' };
}

type Phrase = { fr: string; en: string; frWritten: string | null; timesAssisted: number; timesUsedWell: number };
function phrase(fr: string, en: string, timesAssisted: number, timesUsedWell: number, frWritten: string | null = null): Phrase {
  return { fr, en, frWritten, timesAssisted, timesUsedWell };
}

/** The order `frameTargets` used before recall: helped-only first, then fewest unaided uses, stable. */
function oldFrameOrder(phrases: readonly Phrase[]): Phrase[] {
  const helpedOnly = (p: Phrase) => p.timesAssisted > 0 && p.timesUsedWell === 0;
  return [...phrases].sort((a, b) => Number(helpedOnly(b)) - Number(helpedOnly(a)) || a.timesUsedWell - b.timesUsedWell);
}

function pattern(count: number, sessions: number, example = 'x') {
  return { count, lastSeen: 'n', example, sessions, lastSession: sessions };
}

describe('recallTerms', () => {
  test('folds accents, plurals and elision', () => {
    assert.deepEqual([...recallTerms(['café'])], [...recallTerms(['cafe'])]);
    assert.deepEqual([...recallTerms(['croissants'])], [...recallTerms(['croissant'])]);
    assert.ok(recallTerms(["l'appartement"]).has([...recallTerms(['appartement'])][0]!));
    assert.ok(!recallTerms(["l'appartement"]).has('l'));
  });
  test('drops stopwords and short tokens, splits hyphens', () => {
    assert.deepEqual([...recallTerms(['the and avec pour un'])], []);
    assert.equal(recallTerms(['gender-agreement']).size, 2);
  });
  test('empty input', () => {
    assert.equal(recallTerms([]).size, 0);
  });
});

describe('recallFacts', () => {
  const unrelated = ['Has a dog', 'Works in finance', 'Lives in Leeds', 'Plays tennis', 'Likes jazz', 'Visited Rome'].map((t) => fact(t));
  test('a café fact beats newer unrelated ones', () => {
    const facts = [fact('Loves the café near work', 'Adore le café'), ...unrelated];
    const out = recallFacts(facts, ['Ordering at a cafe']);
    assert.equal(out.length, 5);
    assert.equal(out[0], facts[0]);
    // Fills with the most recent unscored facts, kept in original order.
    assert.deepEqual(out.slice(1), unrelated.slice(-4));
  });
  test('no match or empty scene falls back to slice(-5)', () => {
    assert.deepEqual(recallFacts(unrelated, ['ordering croissants']), unrelated.slice(-5));
    assert.deepEqual(recallFacts(unrelated, []), unrelated.slice(-5));
    assert.deepEqual(recallFacts(unrelated, ['x'], 2), unrelated.slice(-2));
  });
  test('cap holds with many relevant facts, ties go to later ones', () => {
    const cafes = Array.from({ length: 7 }, (_, i) => fact(`Café visit ${i}`));
    const out = recallFacts(cafes, ['café']);
    assert.deepEqual(out, cafes.slice(-5));
  });
  test('higher score wins, returned in original order', () => {
    const a = fact('Café croissant breakfast');
    const b = fact('Café only');
    const facts = [a, ...unrelated, b];
    const out = recallFacts(facts, ['café croissant breakfast'], 2);
    assert.deepEqual(out, [a, b]);
    assert.deepEqual(recallFacts(facts, ['café croissant breakfast'], 1), [a]);
  });
  test('elision matches', () => {
    const facts = [fact('Moving flat', "Cherche l'appartement"), ...unrelated];
    assert.equal(recallFacts(facts, ['visiting an appartement'], 1)[0], facts[0]);
  });
  test('empty facts', () => {
    assert.deepEqual(recallFacts([], ['café']), []);
    assert.deepEqual(recallFacts([], []), []);
  });
});

describe('recallPatterns', () => {
  function profileWith(errorPatterns: LearnerProfile['errorPatterns']): LearnerProfile {
    return { ...createProfile(), errorPatterns };
  }
  const patterns: LearnerProfile['errorPatterns'] = {
    'tu-vous': pattern(2, 1, 'tu es'),
    'gender-agreement': pattern(5, 3, 'le table'),
    'article-cafe': pattern(1, 1, 'un café'),
    'passe-compose': pattern(5, 1, 'je suis mangé'),
    'negation': pattern(3, 2, 'je mange pas'),
    'liaison': pattern(2, 1, 'les amis'),
  };
  test('no match equals learnerSnapshotFrom watchFor', () => {
    const want = learnerSnapshotFrom(profileWith(patterns)).watchFor;
    assert.deepEqual(recallPatterns(patterns, []).map((p) => p.tag), want);
    assert.deepEqual(recallPatterns(patterns, ['zzz qqq']).map((p) => p.tag), want);
  });
  test('relevant suspected never outranks irrelevant recurring', () => {
    const out = recallPatterns(patterns, ['ordering a café']).map((p) => p.tag);
    assert.deepEqual(out, ['gender-agreement', 'negation', 'article-cafe']);
  });
  test('relevance reorders within a status group and returns examples', () => {
    const out = recallPatterns(patterns, ['meeting les amis'], 3);
    assert.deepEqual(out[2], { tag: 'liaison', example: 'les amis' });
  });
  test('cap holds and empty input', () => {
    assert.equal(recallPatterns(patterns, ['café amis table']).length, 3);
    assert.deepEqual(recallPatterns({}, ['café']), []);
  });
});

describe('rankPhrasesForScene', () => {
  const phrases = [
    phrase('Bonjour', 'Hello', 0, 2),
    phrase('Merci', 'Thanks', 1, 0),
    phrase('Je voudrais', 'I would like', 0, 0),
    phrase('Un croissant', 'A croissant', 0, 3),
    phrase('À bientôt', 'See you soon', 2, 0),
    phrase('Pardon', 'Sorry', 0, 0),
  ];
  test('no match equals the old frameTargets order', () => {
    assert.deepEqual(rankPhrasesForScene(phrases, []), oldFrameOrder(phrases));
    assert.deepEqual(rankPhrasesForScene(phrases, ['zzz']), oldFrameOrder(phrases));
  });
  test('a café-scene phrase rises above unrelated weaker ones, plural folded', () => {
    const out = rankPhrasesForScene(phrases, ['buying croissants']);
    assert.equal(out[0]!.fr, 'Un croissant');
    assert.deepEqual(out.slice(1), oldFrameOrder(phrases.filter((p) => p.fr !== 'Un croissant')));
  });
  test('frWritten counts and empty input', () => {
    const p = [phrase('a', 'b', 0, 0), phrase('x', 'y', 0, 5, 'café crème')];
    assert.equal(rankPhrasesForScene(p, ['cafe'])[0], p[1]);
    assert.deepEqual(rankPhrasesForScene([], ['café']), []);
  });
});
