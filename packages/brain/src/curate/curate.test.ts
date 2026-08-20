import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  CurationSchema,
  MAX_CURATED_TOPICS,
  MAX_KEPT_PHRASES,
  applyCuration,
  buildCurationRequest,
} from './curate.ts';
import type { NewPhrase } from '../contract/types.ts';

function phrase(fr: string, en = 'x'): NewPhrase {
  return { fr, frWritten: null, en, enLiteral: null, register: 'familier', note: null };
}

const CAFE = { en: 'Ordering at the café', fr: 'Au café' };
const RUGBY = { en: 'Rugby', fr: 'Le rugby' };

describe('the curation request', () => {
  test('carries the instruction, the topics in order, and every phrase verbatim', () => {
    const r = buildCurationRequest({
      topics: [CAFE, RUGBY],
      phrases: [phrase('Ça marche', 'coming up'), phrase("J'sais pas", "dunno")],
    });
    assert.ok(r.includes('at most five phrases'));
    assert.ok(r.indexOf(CAFE.en) < r.indexOf(RUGBY.en), 'topics keep their order');
    assert.ok(r.includes('"Ça marche" = coming up [familier]'));
    assert.ok(r.includes(`"J'sais pas"`));
  });

  test('the schema holds the shape the prompt promises', () => {
    const parsed = CurationSchema.parse({
      topics: [{ titleEn: 'Rugby', titleFr: 'Le rugby', phraseFr: ['Ça marche'] }],
    });
    assert.equal(parsed.topics[0]!.phraseFr[0], 'Ça marche');
  });
});

describe('applyCuration — code disposes', () => {
  const session = [phrase('a'), phrase('b'), phrase('c'), phrase('d'), phrase('e'), phrase('f'), phrase('g')];

  test('matches proposals back to real phrases, case-insensitively', () => {
    const out = applyCuration(
      { topics: [{ titleEn: 'Rugby', titleFr: 'Le rugby', phraseFr: ['  A ', 'B'] }] },
      session,
      [CAFE],
    );
    assert.equal(out.length, 1);
    assert.deepEqual(
      out[0]!.phrases.map((p) => p.fr),
      ['a', 'b'],
    );
  });

  test('a phrase the session never recorded is dropped, not invented', () => {
    const out = applyCuration(
      { topics: [{ titleEn: 'Rugby', titleFr: 'Le rugby', phraseFr: ['zzz', 'a'] }] },
      session,
      [CAFE],
    );
    assert.deepEqual(
      out[0]!.phrases.map((p) => p.fr),
      ['a'],
    );
  });

  test('a phrase claimed by one topic never appears under a second', () => {
    const out = applyCuration(
      {
        topics: [
          { titleEn: 'One', titleFr: 'Un', phraseFr: ['a'] },
          { titleEn: 'Two', titleFr: 'Deux', phraseFr: ['a', 'b'] },
        ],
      },
      session,
      [CAFE],
    );
    assert.deepEqual(out.map((t) => t.phrases.map((p) => p.fr)), [['a'], ['b']]);
  });

  test('the phrase cap holds across topics, whatever the model proposed', () => {
    const out = applyCuration(
      {
        topics: [
          { titleEn: 'One', titleFr: 'Un', phraseFr: ['a', 'b', 'c'] },
          { titleEn: 'Two', titleFr: 'Deux', phraseFr: ['d', 'e', 'f', 'g'] },
        ],
      },
      session,
      [CAFE],
    );
    assert.equal(
      out.reduce((n, t) => n + t.phrases.length, 0),
      MAX_KEPT_PHRASES,
    );
  });

  test('the topic cap holds, and a topic with nothing kept is not a card', () => {
    const out = applyCuration(
      {
        topics: [
          { titleEn: 'One', titleFr: 'Un', phraseFr: ['a'] },
          { titleEn: 'Empty', titleFr: 'Vide', phraseFr: ['zzz'] },
          { titleEn: 'Two', titleFr: 'Deux', phraseFr: ['b'] },
          { titleEn: 'Three', titleFr: 'Trois', phraseFr: ['c'] },
          { titleEn: 'Four', titleFr: 'Quatre', phraseFr: ['d'] },
        ],
      },
      session,
      [CAFE],
    );
    assert.equal(out.length, MAX_CURATED_TOPICS);
    assert.ok(!out.some((t) => t.title.en === 'Empty'));
  });

  test('a failed call falls back to the scene topic with the first phrases met', () => {
    const out = applyCuration(null, session, [CAFE, RUGBY]);
    assert.equal(out.length, 1);
    assert.deepEqual(out[0]!.title, CAFE);
    assert.deepEqual(
      out[0]!.phrases.map((p) => p.fr),
      ['a', 'b', 'c', 'd', 'e'],
    );
  });

  test('an empty proposal falls back the same way', () => {
    const out = applyCuration({ topics: [] }, session, [RUGBY]);
    assert.equal(out.length, 1);
    assert.deepEqual(out[0]!.title, RUGBY);
  });

  test('a session with no phrases curates to nothing at all', () => {
    assert.deepEqual(applyCuration(null, [], [CAFE]), []);
  });
});
