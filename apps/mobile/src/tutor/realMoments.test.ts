import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';

import { guiltIn } from '../copy/guilt.ts';
import { MAX_SEED_BRIEF_CHARS, MAX_SEED_TOPIC_CHARS, REAL_MOMENTS, REAL_MOMENT_COPY, detailCap, fitDetail, kindOf, prefillFor, seedFor } from './realMoments.ts';

const SERVER_TOKENS = path.resolve(import.meta.dirname, '..', '..', '..', '..', 'services', 'token-server', 'src', 'tokens.ts');

describe('bring a real moment — the seed it becomes (F548)', () => {
  test('a real moment seeds an authored French title and the learner\'s English detail within the server\'s cap, never typed English in the French slot', () => {
    const interview = kindOf('interview')!;
    // The French is the kind's own, whatever the learner typed.
    const seed = seedFor(interview, 'Thursday morning, for a nursing post, and they will ask why I want it');
    assert.equal(seed.fr, interview.fr);
    assert.ok(!seed.fr.includes('Thursday'), 'the learner\'s English reached the half the tutor speaks aloud');
    assert.ok(seed.brief!.endsWith('Thursday morning, for a nursing post, and they will ask why I want it'));

    // Within the caps, for every kind, however long the line.
    const long = 'x'.repeat(400);
    for (const kind of REAL_MOMENTS) {
      const fitted = seedFor(kind, long);
      assert.ok(fitted.fr.length <= MAX_SEED_TOPIC_CHARS && fitted.en.length <= MAX_SEED_TOPIC_CHARS, `${kind.key} is over the title cap`);
      assert.ok(fitted.brief.length <= MAX_SEED_BRIEF_CHARS, `${kind.key}'s brief is over the cap, so the server would drop it`);
      assert.equal(fitDetail(kind, long).length, detailCap(kind));
    }
    // And the cap is the server's, read out of the server's own source.
    const tokens = readFileSync(SERVER_TOKENS, 'utf8');
    const declared = tokens.match(/const MAX_SEED_TOPIC_CHARS = (\d+);/);
    assert.ok(declared, 'the token server no longer declares MAX_SEED_TOPIC_CHARS, so this test reads nothing');
    assert.equal(Number(declared![1]), MAX_SEED_TOPIC_CHARS, 'the app and the server disagree about the seed cap');
    const brief = tokens.match(/const MAX_SEED_BRIEF_CHARS = (\d+);/);
    assert.ok(brief, 'the token server no longer declares MAX_SEED_BRIEF_CHARS');
    assert.equal(Number(brief![1]), MAX_SEED_BRIEF_CHARS, 'the app and the server disagree about the brief cap');

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

describe('a real moment as a fresh topic (F929)', () => {
  test('a real moment opens as a fresh topic on its title', () => {
    // The title is what the room shows and the tutor says; a brief marks it
    // fresh ("Let's talk about it", not "again"). The learner's detail rides
    // in the brief, never in the title.
    for (const kind of REAL_MOMENTS) {
      for (const detail of ['', 'Thursday morning, for a nursing post']) {
        const seed = seedFor(kind, detail);
        assert.equal(seed.en, kind.en, `${kind.key}: the title carries more than the moment's name`);
        assert.equal(seed.fr, kind.fr);
        assert.ok(seed.brief.length > 0, `${kind.key} opens as a continuation`);
        assert.ok(seed.brief.includes(kind.en));
        if (detail) assert.ok(seed.brief.includes(detail), `${kind.key} lost the learner's detail`);
      }
    }
    // The longest detail the box accepts fits whole, and a longer one is cut on a word.
    for (const kind of REAL_MOMENTS) {
      assert.ok(detailCap(kind) >= 150, `${kind.key} leaves too little room for the learner's words`);
      const max = 'word '.repeat(100).slice(0, detailCap(kind));
      assert.ok(seedFor(kind, max).brief.length <= MAX_SEED_BRIEF_CHARS);
    }
    const cut = fitDetail(kindOf('other')!, 'café '.repeat(80));
    assert.ok(!/caf$|ca$|c$/.test(cut) && cut.endsWith('café'), `cut mid-word: "${cut.slice(-12)}"`);
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
