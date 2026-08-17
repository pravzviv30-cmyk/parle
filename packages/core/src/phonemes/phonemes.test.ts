import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { FRENCH_PHONEMES, getPhoneme, novelPhonemes, meaningBearingPhonemes } from './inventory.ts';
import { DRILLS, drillsFor, bestDrillFor, getDrill } from './drills.ts';
import { aggregate, buildReport, priority, overallScore, GOOD_ENOUGH, MIN_SAMPLES_TO_FLAG, type PhonemeObservation } from './scoring.ts';

describe('inventory', () => {
  test('covers the full French phoneme set', () => {
    assert.equal(FRENCH_PHONEMES.length, 36);
  });

  test('every phoneme has a unique IPA key', () => {
    const seen = new Set(FRENCH_PHONEMES.map((p) => p.ipa));
    assert.equal(seen.size, FRENCH_PHONEMES.length);
  });

  test('every phoneme carries a learner-facing cue', () => {
    for (const p of FRENCH_PHONEMES) {
      assert.ok(p.cue.length > 10, `${p.ipa} has no usable cue`);
      assert.ok(p.examples.length > 0, `${p.ipa} has no examples`);
    }
  });

  test('the four nasal vowels are present and all marked novel', () => {
    for (const ipa of ['ɑ̃', 'ɛ̃', 'ɔ̃', 'œ̃']) {
      const p = getPhoneme(ipa);
      assert.ok(p, `missing nasal vowel ${ipa}`);
      assert.equal(p.existsInEnglish, false);
      assert.equal(p.class, 'nasal-vowel');
    }
  });

  test('the notorious sounds are rated maximally hard', () => {
    for (const ipa of ['ʁ', 'y', 'ɑ̃', 'ɛ̃', 'ɔ̃', 'ø', 'ɥ']) {
      assert.equal(getPhoneme(ipa)?.difficulty, 5, `${ipa} should be difficulty 5`);
    }
  });

  test('meaning-bearing phonemes each declare the substitution that causes the error', () => {
    for (const p of meaningBearingPhonemes()) {
      assert.ok(p.typicalSubstitution, `${p.ipa} is meaning-bearing but names no substitution`);
    }
  });

  test('novel phonemes are the ones worth spending practice time on', () => {
    const novel = novelPhonemes().map((p) => p.ipa);
    assert.ok(novel.includes('y'));
    assert.ok(novel.includes('ʁ'));
    assert.ok(!novel.includes('m'));
  });
});

describe('drills', () => {
  test('drill ids are unique', () => {
    const seen = new Set(DRILLS.map((d) => d.id));
    assert.equal(seen.size, DRILLS.length);
  });

  test('every drill targets a phoneme that exists in the inventory', () => {
    for (const d of DRILLS) {
      assert.ok(getPhoneme(d.target), `drill ${d.id} targets unknown phoneme ${d.target}`);
      if (d.contrast) assert.ok(getPhoneme(d.contrast), `drill ${d.id} contrasts unknown phoneme ${d.contrast}`);
    }
  });

  test('minimal-pair drills actually carry pairs, and both words differ', () => {
    for (const d of DRILLS.filter((x) => x.kind === 'minimal-pair')) {
      assert.ok(d.pairs && d.pairs.length >= 2, `${d.id} needs at least two pairs`);
      for (const pair of d.pairs!) {
        assert.notEqual(pair.a.word, pair.b.word, `${d.id} has a pair with identical words`);
        assert.notEqual(pair.a.ipa, pair.b.ipa, `${d.id} has a pair with identical pronunciations`);
        assert.ok(pair.a.gloss && pair.b.gloss, `${d.id} has a pair missing a meaning`);
      }
    }
  });

  test('non-minimal-pair drills carry items instead', () => {
    for (const d of DRILLS.filter((x) => x.kind !== 'minimal-pair')) {
      assert.ok(d.items && d.items.length >= 3, `${d.id} needs practice items`);
    }
  });

  test('every difficulty-5 phoneme has at least one drill — no naming a problem we cannot fix', () => {
    for (const p of FRENCH_PHONEMES.filter((x) => x.difficulty === 5)) {
      assert.ok(drillsFor(p.ipa).length > 0, `no drill exists for /${p.ipa}/`);
    }
  });

  test('drills stay at 60 seconds so they never feel like homework', () => {
    for (const d of DRILLS) assert.equal(d.durationSec, 60);
  });

  test('a known substitution selects the drill that contrasts exactly that error', () => {
    const y = getPhoneme('y')!;
    assert.equal(bestDrillFor(y, 'u')?.id, 'y-vs-u');
  });

  test('minimal-pair drills outrank articulation drills for the same sound', () => {
    // /ʁ/ has both kinds; the contrastive one should win by default.
    assert.equal(bestDrillFor(getPhoneme('ʁ')!)?.kind, 'minimal-pair');
  });

  test('getDrill round-trips', () => {
    assert.equal(getDrill('r-vs-l')?.target, 'ʁ');
    assert.equal(getDrill('nope'), undefined);
  });
});

describe('scoring', () => {
  const obs = (ipa: string, score: number, word: string, substituted?: string): PhonemeObservation => ({ ipa, score, word, substituted });

  test('aggregate averages per phoneme and records the worst example', () => {
    const stats = aggregate([obs('y', 40, 'tu'), obs('y', 60, 'rue'), obs('m', 95, 'merci')]);
    const y = stats.find((s) => s.ipa === 'y')!;
    assert.equal(y.meanScore, 50);
    assert.equal(y.sampleCount, 2);
    assert.equal(y.worstWord, 'tu');
    assert.equal(y.worstScore, 40);
  });

  test('aggregate reports the most frequent substitution', () => {
    const stats = aggregate([obs('y', 40, 'tu', 'u'), obs('y', 45, 'rue', 'u'), obs('y', 50, 'sur', 'i')]);
    assert.equal(stats[0]!.commonSubstitution, 'u');
  });

  test('a phoneme heard fewer than three times is never flagged', () => {
    const stat = { ipa: 'y', meanScore: 10, sampleCount: MIN_SAMPLES_TO_FLAG - 1, worstWord: 'tu', worstScore: 10 };
    assert.equal(priority(stat, getPhoneme('y')!), 0);
  });

  test('a phoneme scoring above the good-enough line is never flagged', () => {
    const stat = { ipa: 'y', meanScore: GOOD_ENOUGH + 1, sampleCount: 10, worstWord: 'tu', worstScore: 80 };
    assert.equal(priority(stat, getPhoneme('y')!), 0);
  });

  test('at equal badness, the harder sound is prioritised', () => {
    const base = { meanScore: 50, sampleCount: 6, worstWord: 'x', worstScore: 50 };
    const hard = priority({ ...base, ipa: 'ʁ' }, getPhoneme('ʁ')!); // difficulty 5
    const easy = priority({ ...base, ipa: 'b' }, getPhoneme('b')!); // difficulty 1
    assert.ok(hard > easy, 'harder phoneme should rank higher');
  });

  test('at equal badness and difficulty, the meaning-changing sound wins', () => {
    const base = { meanScore: 50, sampleCount: 6, worstWord: 'x', worstScore: 50 };
    // /y/ and /ø/ are both difficulty 5 and meaning-bearing; /œ̃/ is 4 and is not.
    const bearing = priority({ ...base, ipa: 'y' }, getPhoneme('y')!);
    const cosmetic = priority({ ...base, ipa: 'œ̃' }, getPhoneme('œ̃')!);
    assert.ok(bearing > cosmetic);
  });

  test('confidence ramps with sample count', () => {
    const mk = (n: number) => priority({ ipa: 'y', meanScore: 40, sampleCount: n, worstWord: 'tu', worstScore: 40 }, getPhoneme('y')!);
    assert.ok(mk(3) < mk(5));
    assert.equal(mk(5), mk(50), 'confidence saturates so a long session does not inflate priority');
  });

  test('report surfaces exactly one focus point, with a drill attached', () => {
    const report = buildReport([
      obs('y', 35, 'tu', 'u'),
      obs('y', 40, 'rue', 'u'),
      obs('y', 45, 'sur', 'u'),
      obs('m', 95, 'merci'),
      obs('m', 92, 'madame'),
      obs('m', 97, 'moi'),
    ]);

    assert.ok(report.focus, 'expected a focus point');
    assert.equal(report.focus.phoneme.ipa, 'y');
    assert.equal(report.focus.drill.id, 'y-vs-u');
    assert.match(report.focus.reason, /different word/);
  });

  test('a clean session produces no focus point rather than inventing one', () => {
    const report = buildReport([obs('m', 95, 'merci'), obs('m', 92, 'madame'), obs('m', 97, 'moi'), obs('y', 90, 'tu'), obs('y', 93, 'rue'), obs('y', 91, 'sur')]);
    assert.equal(report.focus, null);
  });

  test('unknown symbols from the scorer are ignored, not guessed at', () => {
    const report = buildReport([obs('☂', 10, 'x'), obs('☂', 12, 'y'), obs('☂', 11, 'z')]);
    assert.equal(report.focus, null);
  });

  test('overall score weights hard phonemes more heavily than easy ones', () => {
    // Same raw numbers, swapped: failing the hard sound should hurt more.
    const failHard = overallScore(aggregate([obs('ʁ', 20, 'rue'), obs('ʁ', 20, 'riz'), obs('m', 100, 'moi'), obs('m', 100, 'ma')]));
    const failEasy = overallScore(aggregate([obs('m', 20, 'moi'), obs('m', 20, 'ma'), obs('ʁ', 100, 'rue'), obs('ʁ', 100, 'riz')]));
    assert.ok(failHard < failEasy, 'failing a hard phoneme should drag the overall down further');
  });

  test('wins only celebrate genuinely hard sounds, not free ones', () => {
    const report = buildReport([obs('ʁ', 95, 'rue'), obs('ʁ', 92, 'riz'), obs('ʁ', 90, 'roi'), obs('m', 99, 'moi'), obs('m', 99, 'ma'), obs('m', 99, 'mes')]);
    const won = report.wins.map((w) => w.ipa);
    assert.ok(won.includes('ʁ'), 'nailing the French R deserves credit');
    assert.ok(!won.includes('m'), 'nailing /m/ as an English speaker is not an achievement');
  });

  test('empty input does not throw', () => {
    const report = buildReport([]);
    assert.equal(report.focus, null);
    assert.equal(report.overall, 0);
    assert.deepEqual(report.stats, []);
  });
});
