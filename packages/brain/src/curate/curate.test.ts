import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  CurationSchema,
  MAX_CURATED_TOPICS,
  MAX_EXTENSION_PHRASES,
  MAX_KEPT_PHRASES,
  applyCuration,
  buildCurationRequest,
  extensionViolations,
} from './curate.ts';
import type { NewPhrase } from '../contract/types.ts';

function phrase(fr: string, en = 'x'): NewPhrase {
  return { fr, frWritten: null, en, enLiteral: null, register: 'familier', note: null };
}

const CAFE = { en: 'Ordering at the café', fr: 'Au café' };
const RUGBY = { en: 'Rugby', fr: 'Le rugby' };
const LEARNER = { cefr: 'A1' as const, errorTags: ['word-order'] };

function topic(
  titleEn: string,
  titleFr: string,
  phraseFr: string[],
  extensions: NewPhrase[] = [],
) {
  return { titleEn, titleFr, phraseFr, extensions };
}

describe('the curation request', () => {
  test('carries the instruction, the topics in order, and every phrase verbatim', () => {
    const r = buildCurationRequest({
      topics: [CAFE, RUGBY],
      phrases: [phrase('Ça marche', 'coming up'), phrase("J'sais pas", "dunno")],
      learner: LEARNER,
    });
    assert.ok(r.includes('at most five phrases'));
    assert.ok(r.indexOf(CAFE.en) < r.indexOf(RUGBY.en), 'topics keep their order');
    assert.ok(r.includes('"Ça marche" = coming up [familier]'));
    assert.ok(r.includes(`"J'sais pas"`));
  });

  test('the schema holds the shape the prompt promises', () => {
    const parsed = CurationSchema.parse({
      topics: [topic('Rugby', 'Le rugby', ['Ça marche'])],
    });
    assert.equal(parsed.topics[0]!.phraseFr[0], 'Ça marche');
  });
});

describe('applyCuration — code disposes', () => {
  const session = [phrase('a'), phrase('b'), phrase('c'), phrase('d'), phrase('e'), phrase('f'), phrase('g')];

  test('matches proposals back to real phrases, case-insensitively', () => {
    const out = applyCuration(
      { topics: [topic('Rugby', 'Le rugby', ['  A ', 'B'])] },
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
      { topics: [topic('Rugby', 'Le rugby', ['zzz', 'a'])] },
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
          topic('One', 'Un', ['a']),
          topic('Two', 'Deux', ['a', 'b']),
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
          topic('One', 'Un', ['a', 'b', 'c']),
          topic('Two', 'Deux', ['d', 'e', 'f', 'g']),
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
          topic('One', 'Un', ['a']),
          topic('Empty', 'Vide', ['zzz']),
          topic('Two', 'Deux', ['b']),
          topic('Three', 'Trois', ['c']),
          topic('Four', 'Quatre', ['d']),
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

  test('closely related extensions can create practice even when no phrase was taught verbatim', () => {
    const extension = phrase('Vous pouvez répéter ?', 'Can you repeat?');
    const out = applyCuration(
      { topics: [topic('Speaking with a teacher', 'Luvanir avec un professeur', [], [extension])] },
      [],
      [CAFE],
    );

    assert.equal(out.length, 1);
    assert.deepEqual(out[0]!.phrases, [extension]);
  });

  test('extensions are capped and cannot duplicate a session phrase', () => {
    const out = applyCuration(
      {
        topics: [
          topic('One', 'Un', ['a'], [phrase('a'), phrase('new one'), phrase('new two'), phrase('new three')]),
        ],
      },
      session,
      [CAFE],
    );

    assert.deepEqual(out[0]!.phrases.map((p) => p.fr), ['a', 'new one', 'new two']);
  });

  test('the kept-phrase cap does not hide an extension proposed under a later topic', () => {
    const out = applyCuration(
      {
        topics: [
          topic('One', 'Un', ['a', 'b', 'c', 'd', 'e']),
          topic('Two', 'Deux', [], [phrase('transfer line')]),
        ],
      },
      session,
      [CAFE],
    );

    assert.equal(out.length, 2);
    assert.deepEqual(out[1]!.phrases.map((p) => p.fr), ['transfer line']);
  });
});

/**
 * What the model authored, held to the same bar as what it generated.
 *
 * Every other phrase in a curated batch was matched back to a line the session
 * actually recorded, so the only thing in here nobody has ever seen is the
 * extension. Drills built from the same keep-list pass core's linter before
 * they reach a screen; until this check the extension went from a model
 * response onto a review card with nothing in between.
 */
describe('the content check an extension has to pass', () => {
  const clean = phrase('On y va', 'Off we go');

  test('an extension that fails the content check never becomes a card', () => {
    const warnings: string[] = [];
    const realWarn = console.warn;
    console.warn = (...args: unknown[]) => void warnings.push(args.map(String).join(' '));

    // One of each rule, so a checker that quietly stopped running one of them
    // still fails here. The last is the leak `carriesFrench` was written for:
    // an English gloss that is actually French, which reaches a card back.
    const emDash = phrase('Ça marche', 'That works — really');
    const scold = phrase('Tant pis', 'You said it wrong');
    const score = phrase('Pas mal', 'A 7 out of 10 answer');
    const frenchGloss = phrase('À plus', "À plus tard");

    let out: ReturnType<typeof applyCuration>;
    try {
      out = applyCuration(
        { topics: [topic('Leaving', 'Partir', [], [emDash, scold, score, frenchGloss, clean])] },
        [],
        [CAFE],
      );
    } finally {
      console.warn = realWarn;
    }

    assert.deepEqual(
      out[0]!.phrases.map((p) => p.fr),
      [clean.fr],
      'a phrase the learner never heard reached a card without passing the content check',
    );
    assert.equal(
      warnings.filter((line) => line.includes('curation rejected the extension')).length,
      4,
      'a rejection was dropped silently instead of being counted like a drill rejection',
    );
    assert.ok(
      warnings.some((line) => line.includes('curation rejected 4 of 5 extensions')),
      'the batch total was never reported',
    );
  });

  test('a rejected extension does not spend the slot a good one needed', () => {
    // The cap counts what shipped, not what was proposed, or one bad line
    // would cost the learner the transfer challenge that followed it.
    const warn = console.warn;
    console.warn = () => {};
    try {
      const out = applyCuration(
        {
          topics: [
            topic('Leaving', 'Partir', [], [
              phrase('Bof', 'Meh — whatever'),
              phrase('À demain', 'See you tomorrow'),
              clean,
              phrase('Bonne soirée', 'Have a good evening'),
            ]),
          ],
        },
        [],
        [CAFE],
      );
      assert.deepEqual(out[0]!.phrases.map((p) => p.fr), ['À demain', 'On y va']);
      assert.equal(out[0]!.phrases.length, MAX_EXTENSION_PHRASES);
    } finally {
      console.warn = warn;
    }
  });

  test('the checker names what is wrong rather than just saying no', () => {
    assert.deepEqual(extensionViolations(clean), []);
    // Digits are speech in the French and a score in the English, which is
    // copy.ts's own carve-out rather than a rule invented here.
    assert.deepEqual(extensionViolations(phrase('Ça fait 2 euros', 'That is two euros')), []);
    assert.deepEqual(extensionViolations({ ...clean, en: '' }), ['en is empty']);
    assert.deepEqual(extensionViolations({ ...clean, note: 'Simply say it' }), ['note breaks the filler copy rule']);
    assert.deepEqual(extensionViolations({ ...clean, enLiteral: 'we go there — now' }), [
      'enLiteral breaks the em-dash copy rule',
    ]);
  });
});

describe('what the learner already uses', () => {
  const session = [phrase('a'), phrase('b'), phrase('c'), phrase('d'), phrase('e'), phrase('f'), phrase('g')];

  test('curation is told what the learner already uses and spends no slot on it', () => {
    // Phase 4 made the evidence record canonical and curation never read it, so
    // a keep slot could go on a phrase the learner already produces unprompted.
    const request = buildCurationRequest({
      topics: [CAFE],
      phrases: [phrase('Ça marche', 'coming up')],
      learner: LEARNER,
      knownPhrases: ['a', 'Ça marche'],
    });
    assert.ok(request.includes('PHRASES THIS LEARNER ALREADY USES'), 'the model is still being asked blind');
    assert.ok(request.includes('- "Ça marche"'), 'the list is named but empty');

    // The model proposes the known phrase first. It is skipped, and the skip
    // costs nothing: five slots still buy five phrases the learner needs.
    const out = applyCuration(
      { topics: [topic('One', 'Un', ['A', 'b', 'c', 'd', 'e', 'f', 'g'])] },
      session,
      [CAFE],
      ['  a  '],
    );
    assert.deepEqual(out[0]!.phrases.map((p) => p.fr), ['b', 'c', 'd', 'e', 'f']);
    assert.equal(out[0]!.phrases.length, MAX_KEPT_PHRASES, 'a skipped phrase silently cost the learner a slot');

    // An extension is language the learner has never heard, so one they
    // already use is not an extension at all.
    const known = phrase('On y va', 'Off we go');
    assert.deepEqual(applyCuration({ topics: [topic('Two', 'Deux', [], [known])] }, [], [CAFE], ['on y va']), []);

    // And the deterministic fallback spends its slots on the same terms.
    const fallback = applyCuration(null, session, [CAFE], ['a', 'b']);
    assert.deepEqual(fallback[0]!.phrases.map((p) => p.fr), ['c', 'd', 'e', 'f', 'g']);
  });

  test('a learner nobody has measured yet curates exactly as before', () => {
    // The field is absent on every call until the agent supplies it, and an
    // absent list must not change one phrase of what ships today.
    const proposal = { topics: [topic('One', 'Un', ['a', 'b'])] };
    assert.deepEqual(applyCuration(proposal, session, [CAFE], []), applyCuration(proposal, session, [CAFE]));
    assert.equal(buildCurationRequest({ topics: [CAFE], phrases: [], learner: LEARNER }).includes('ALREADY USES'), false);
  });
});
