import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';

import { guiltIn } from '../copy/guilt.ts';
import { MAX_SEED_TOPIC_CHARS, REAL_MOMENTS, REAL_MOMENT_COPY, detailCap, fitDetail, kindOf, prefillFor, seedFor } from './realMoments.ts';

const SERVER_TOKENS = path.resolve(import.meta.dirname, '..', '..', '..', '..', 'services', 'token-server', 'src', 'tokens.ts');

describe('bring a real moment — the seed it becomes (F548)', () => {
  test('a real moment seeds an authored French title and the learner\'s English detail within the server\'s cap, never typed English in the French slot', () => {
    const interview = kindOf('interview')!;
    // The French is the kind's own, whatever the learner typed.
    const seed = seedFor(interview, 'Thursday morning, for a nursing post, and they will ask why I want it');
    assert.equal(seed.fr, interview.fr);
    assert.equal(seed.en, `${interview.en}. Thursday morning, for a nursing post, and they will ask why I want it`);
    assert.ok(!seed.fr.includes('Thursday'), 'the learner\'s English reached the half the tutor speaks aloud');

    // No detail: the kind alone, with nothing invented after it.
    assert.deepEqual(seedFor(interview, '   '), { fr: interview.fr, en: interview.en });

    // Within the cap on both halves, for every kind, however long the line.
    const long = 'x'.repeat(400);
    for (const kind of REAL_MOMENTS) {
      const fitted = seedFor(kind, long);
      assert.ok(fitted.fr.length <= MAX_SEED_TOPIC_CHARS, `${kind.key}'s French is over the cap`);
      assert.ok(fitted.en.length <= MAX_SEED_TOPIC_CHARS, `${kind.key}'s English is over the cap, so the server would drop the seed and open a generic conversation`);
      assert.equal(fitDetail(kind, long).length, detailCap(kind));
    }
    // And the cap is the server's, read out of the server's own source.
    const tokens = readFileSync(SERVER_TOKENS, 'utf8');
    const declared = tokens.match(/const MAX_SEED_TOPIC_CHARS = (\d+);/);
    assert.ok(declared, 'the token server no longer declares MAX_SEED_TOPIC_CHARS, so this test reads nothing');
    assert.equal(Number(declared![1]), MAX_SEED_TOPIC_CHARS, 'the app and the server disagree about the seed cap');

    // Eight kinds, each with authored French that is not the English.
    assert.equal(REAL_MOMENTS.length, 8);
    assert.equal(new Set(REAL_MOMENTS.map((kind) => kind.key)).size, 8, 'two kinds share a key');
    for (const kind of REAL_MOMENTS) {
      assert.notEqual(kind.fr, kind.en, `${kind.key} has English where its French should be`);
      assert.ok(kind.fr.length > 0 && kind.en.length > 0 && kind.gloss.length > 0);
    }
    assert.equal(kindOf('not-a-kind'), null);

    for (const line of REAL_MOMENT_COPY) {
      assert.equal(guiltIn(line), undefined, `"${line}" carries "${guiltIn(line)}"`);
      assert.doesNotMatch(line, /—|\d/, `"${line}" carries an em dash or a digit`);
    }
  });
});

describe('the Explore prefill (B1, 2026-10-20, B-Explore)', () => {
  test('words typed on Explore open "Something else", cut to fit, and nothing opens empty', () => {
    assert.deepEqual(prefillFor(undefined), { key: null, detail: '' });
    assert.deepEqual(prefillFor('   '), { key: null, detail: '' });
    assert.deepEqual(prefillFor(7), { key: null, detail: '' });
    const typed = prefillFor('  Dinner with my partner’s parents in Lyon ');
    assert.equal(typed.key, 'other');
    assert.equal(typed.detail, 'Dinner with my partner’s parents in Lyon');
    const long = prefillFor('x'.repeat(MAX_SEED_TOPIC_CHARS * 2));
    assert.ok(long.detail.length <= detailCap(kindOf('other')!), 'the prefill is cut to what fits beside its kind');
  });

  test('the route carries the param to the screen, and the screen starts from it', () => {
    const types = readFileSync(path.join(import.meta.dirname, '..', 'nav', 'types.ts'), 'utf8');
    const nav = readFileSync(path.join(import.meta.dirname, '..', 'nav', 'RootNavigator.tsx'), 'utf8');
    const screen = readFileSync(path.join(import.meta.dirname, 'RealMomentScreen.tsx'), 'utf8');
    assert.match(types, /RealMoment: \{ textMode\?: boolean; detail\?: string \} \| undefined;/);
    assert.match(nav, /initialDetail=\{route\.params\?\.detail\}/);
    assert.match(screen, /const \[prefill\] = useState\(\(\) => prefillFor\(initialDetail\)\);/);
    assert.match(screen, /useState<RealMomentKey \| null>\(prefill\.key\)/);
  });
});
