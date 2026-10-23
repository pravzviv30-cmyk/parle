import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  agreementReport, calibrationReport, consensus, formatReport, parseManifest, parseRatings,
  quadraticWeightedKappa, spearman,
} from './speechRatings.mjs';

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const clip = (n, extra = {}) => ({
  id: id(n), file: `${id(n)}.wav`, reference: 'Je voudrais un café.', cefrBand: 'A1',
  focusPhonemes: ['ʁ'], vendor: 'speechace', vendorScores: [{ ipa: 'ʁ', score: 60, word: 'voudrais' }], ...extra,
});
const manifest = (clips, extra = {}) => ({ version: 1, clips, ...extra });
const rating = (n, rater, overall, phonemes = { 'ʁ': 'fine' }) => ({ clipId: id(n), rater, overall, phonemes, ratedAt: '2026-10-22T10:00:00Z' });
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} is not close to ${b}`);

test('parseManifest accepts a good manifest', () => {
  const clips = parseManifest(manifest([clip(1), clip(2)]));
  assert.equal(clips.length, 2);
});

test('parseManifest refuses each bad shape with a clear message', () => {
  assert.throws(() => parseManifest(null), /must be an object/);
  assert.throws(() => parseManifest({ version: 2, clips: [] }), /version must be 1/);
  assert.throws(() => parseManifest({ version: 1 }), /clips must be an array/);
  assert.throws(() => parseManifest(manifest([clip(1, { id: 'nope' })])), /id must be a uuid/);
  assert.throws(() => parseManifest(manifest([clip(1, { file: 'x.wav' })])), /file must be/);
  assert.throws(() => parseManifest(manifest([clip(1, { cefrBand: 'B1' })])), /cefrBand/);
  assert.throws(() => parseManifest(manifest([clip(1, { focusPhonemes: 'ʁ' })])), /focusPhonemes/);
  assert.throws(() => parseManifest(manifest([clip(1, { focusPhonemes: ['toolongphoneme'] })])), /focusPhonemes/);
  assert.throws(() => parseManifest(manifest([clip(1, { vendorScores: [{ ipa: 'ʁ', score: 101 }] })])), /score must be/);
  assert.throws(() => parseManifest(manifest([clip(1, { vendorScores: 'x' })])), /vendorScores must be an array/);
  assert.throws(() => parseManifest(manifest([clip(1), clip(1)])), /duplicate id/);
});

test('parseManifest refuses any key outside the allow-list, at every level', () => {
  const unknown = ['user_id', 'deviceId', 'name', 'transcript'];
  for (const key of unknown) {
    const message = new RegExp(`"${key}" is not allowed.*no identity or free text`);
    assert.throws(() => parseManifest(manifest([clip(1)], { [key]: 'x' })), message, `top level ${key}`);
    assert.throws(() => parseManifest(manifest([clip(1, { [key]: 'x' })])), message, `clip ${key}`);
    assert.throws(
      () => parseManifest(manifest([clip(1, { vendorScores: [{ ipa: 'ʁ', score: 5, [key]: 'x' }] })])),
      message,
      `vendorScores ${key}`,
    );
  }
  // The old block-list names stay refused too.
  for (const key of ['text', 'userId', 'email']) {
    assert.throws(() => parseManifest(manifest([clip(1, { [key]: 'x' })])), new RegExp(`"${key}" is not allowed`));
  }
});

test('parseManifest still accepts every allowed key', () => {
  const full = clip(1, { vendorScores: [{ ipa: 'ʁ', score: 60, word: 'voudrais', substituted: 'w' }] });
  assert.equal(parseManifest(manifest([full])).length, 1);
});

test('parseRatings reads JSONL, skips blank lines and reports the line number on errors', () => {
  const good = JSON.stringify(rating(1, 'teacher-a', 4));
  assert.equal(parseRatings(`${good}\n\n${good}\n`).length, 2);
  const bad = (r) => `${good}\n\n${JSON.stringify(r)}\n`;
  assert.throws(() => parseRatings(`${good}\n{oops`), /line 2: not valid JSON/);
  assert.throws(() => parseRatings(bad(rating(1, 'teacher-a', 6))), /line 3: overall/);
  assert.throws(() => parseRatings(bad(rating(1, 'teacher-a', 3.5))), /line 3: overall/);
  assert.throws(() => parseRatings(bad(rating(1, 'Teacher A', 3))), /line 3: rater/);
  assert.throws(() => parseRatings(bad(rating(1, 'a', 3))), /line 3: rater/);
  assert.throws(() => parseRatings(bad(rating(1, 'teacher-a', 3, { 'ʁ': 'maybe' }))), /line 3: phonemes/);
  assert.throws(() => parseRatings(bad({ ...rating(1, 'teacher-a', 3), ratedAt: 'yesterday' })), /line 3: ratedAt/);
  assert.throws(() => parseRatings(bad({ ...rating(1, 'teacher-a', 3), clipId: 'x' })), /line 3: clipId/);
});

test('parseRatings refuses any key outside the allow-list', () => {
  for (const key of ['user_id', 'deviceId', 'name', 'transcript']) {
    const line = JSON.stringify({ ...rating(1, 'teacher-a', 4), [key]: 'x' });
    assert.throws(() => parseRatings(line), new RegExp(`line 1: key "${key}" is not allowed.*no identity or free text`));
  }
});

test('quadraticWeightedKappa: perfect agreement is 1', () => {
  close(quadraticWeightedKappa([[1, 1], [2, 2], [3, 3], [5, 5]]), 1);
});

test('quadraticWeightedKappa: hand-computed case (k=3, 0.8)', () => {
  // observed disagreement 0.25; expected 1.25; kappa = 1 - 0.25 / 1.25
  close(quadraticWeightedKappa([[1, 1], [2, 3], [3, 3], [2, 2]], 3), 0.8);
});

test('quadraticWeightedKappa: opposite ends of the scale give a negative value', () => {
  assert.ok(quadraticWeightedKappa([[1, 5], [5, 1], [1, 5], [5, 1]]) < 0);
});

test('quadraticWeightedKappa: undefined cases return null', () => {
  assert.equal(quadraticWeightedKappa([]), null);
  assert.equal(quadraticWeightedKappa([[3, 3]]), null);
  assert.equal(quadraticWeightedKappa([[3, 3], [3, 3], [3, 3]]), null);
  assert.throws(() => quadraticWeightedKappa([[0, 3], [3, 3]]), /integers from 1 to 5/);
});

test('spearman: monotonic, reversed, ties and a known value', () => {
  close(spearman([1, 2, 3, 4], [10, 20, 30, 99]), 1);
  close(spearman([1, 2, 3, 4], [4, 3, 2, 1]), -1);
  // ys ranks 1, 2, 3.5, 5, 3.5 -> 8 / sqrt(10 * 9.5)
  close(spearman([1, 2, 3, 4, 5], [5, 6, 7, 8, 7]), 8 / Math.sqrt(95));
});

test('spearman: null for n < 3 or zero variance', () => {
  assert.equal(spearman([1, 2], [1, 2]), null);
  assert.equal(spearman([1, 2, 3], [4, 4, 4]), null);
  assert.equal(spearman([2, 2, 2], [1, 2, 3]), null);
  assert.throws(() => spearman([1, 2, 3], [1, 2]), /same length/);
});

test('consensus: mean overall, rater count and share flagged off per phoneme', () => {
  const c = consensus([
    rating(1, 'teacher-a', 4, { 'ʁ': 'off', y: 'fine' }),
    rating(1, 'teacher-b', 2, { 'ʁ': 'off', y: 'off' }),
    rating(1, 'teacher-c', 3, { 'ʁ': 'fine' }),
    rating(2, 'teacher-a', 5, { 'ʁ': 'fine' }),
  ]);
  const one = c.get(id(1));
  assert.equal(one.raters, 3);
  close(one.meanOverall, 3);
  close(one.offShare['ʁ'], 2 / 3);
  close(one.offShare.y, 0.5);
  assert.equal(c.get(id(2)).raters, 1);
});

test('consensus: a re-rating by the same rater replaces the earlier one', () => {
  const later = { ...rating(1, 'teacher-a', 5), ratedAt: '2026-10-23T10:00:00Z' };
  const c = consensus([rating(1, 'teacher-a', 1), later]);
  assert.equal(c.get(id(1)).raters, 1);
  assert.equal(c.get(id(1)).meanOverall, 5);
});

test('agreementReport: three raters, pairwise QWK with n, mean and multi-rated share', () => {
  const scores = { a: [1, 2, 3, 4, 5], b: [1, 2, 3, 4, 5], c: [5, 4, 3, 2, 1] };
  const ratings = [];
  for (let n = 0; n < 5; n += 1) {
    ratings.push(rating(n + 1, 'rater-a', scores.a[n]), rating(n + 1, 'rater-b', scores.b[n]), rating(n + 1, 'rater-c', scores.c[n]));
  }
  ratings.push(rating(6, 'rater-a', 3)); // a clip only one rater saw
  const report = agreementReport(ratings);
  assert.deepEqual(report.raters, ['rater-a', 'rater-b', 'rater-c']);
  assert.equal(report.pairs.length, 3);
  const ab = report.pairs.find((p) => p.a === 'rater-a' && p.b === 'rater-b');
  const ac = report.pairs.find((p) => p.a === 'rater-a' && p.b === 'rater-c');
  assert.equal(ab.n, 5);
  close(ab.qwk, 1);
  assert.ok(ac.qwk < 0);
  close(report.meanPairwiseQwk, (1 + ac.qwk + report.pairs.find((p) => p.a === 'rater-b' && p.b === 'rater-c').qwk) / 3);
  close(report.shareMultiRated, 5 / 6);
  assert.equal(report.clipsRated, 6);
});

test('agreementReport: no ratings gives nulls, not a crash', () => {
  const report = agreementReport([]);
  assert.equal(report.meanPairwiseQwk, null);
  assert.equal(report.shareMultiRated, null);
});

test('calibrationReport: overall Spearman and the "too few" path for phonemes', () => {
  const clips = [1, 2, 3, 4].map((n) => clip(n, { vendorScores: [{ ipa: 'ʁ', score: n * 20 }] }));
  const ratings = [1, 2, 3, 4].map((n) => rating(n, 'rater-a', n, { 'ʁ': n > 2 ? 'fine' : 'off' }));
  const cal = calibrationReport(clips, ratings);
  assert.equal(cal.overall.n, 4);
  close(cal.overall.spearman, 1);
  assert.equal(cal.phonemes.length, 1);
  assert.equal(cal.phonemes[0].tooFew, true);
  assert.equal(cal.phonemes[0].n, 4);
  assert.equal(cal.phonemes[0].spearman, null);
});

test('calibrationReport: phoneme Spearman is reported once n >= 5', () => {
  const clips = [1, 2, 3, 4, 5].map((n) => clip(n, { vendorScores: [{ ipa: 'ʁ', score: n * 10 }] }));
  const ratings = [1, 2, 3, 4, 5].flatMap((n) => [
    rating(n, 'rater-a', n, { 'ʁ': n > 3 ? 'fine' : 'off' }),
    rating(n, 'rater-b', n, { 'ʁ': n > 1 ? 'fine' : 'off' }),
  ]);
  const p = calibrationReport(clips, ratings).phonemes[0];
  assert.equal(p.tooFew, false);
  assert.equal(p.n, 5);
  // not-off shares 0, .5, .5, 1, 1 (ties) against scores 10..50 -> 9 / sqrt(10 * 9)
  close(p.spearman, 9 / Math.sqrt(90));
});

test('calibrationReport ignores ratings for clips not in the manifest', () => {
  const cal = calibrationReport([clip(1)], [rating(9, 'rater-a', 3)]);
  assert.equal(cal.overall.n, 0);
  assert.equal(cal.overall.spearman, null);
});

test('formatReport states the 0.6 decision rule and a verdict', () => {
  const ratings = [1, 2, 3, 4].flatMap((n) => [rating(n, 'rater-a', n), rating(n, 'rater-b', n)]);
  const text = formatReport(agreementReport(ratings), calibrationReport([1, 2, 3, 4].map((n) => clip(n)), ratings));
  assert.match(text, /mean pairwise QWK >= 0\.6, over rater pairs sharing at least 30 clips/);
  assert.match(text, /rater-a vs rater-b: QWK 1\.00 \(n=4\)/);
  // Perfect agreement on four clips is still too few to trust.
  assert.match(text, /cannot tell yet \(no rater pair shares 30 clips\)/);
  assert.match(text, /too few/);
  assert.doesNotMatch(text, /—/);
  assert.match(formatReport(agreementReport([]), calibrationReport([], [])), /cannot tell yet/);
});

test('the verdict counts only rater pairs that share enough clips', () => {
  const many = Array.from({ length: 30 }, (_, i) => i + 1);
  const agree = many.flatMap((n) => [rating(n, 'rater-a', (n % 5) + 1), rating(n, 'rater-b', (n % 5) + 1)]);
  assert.match(formatReport(agreementReport(agree), calibrationReport([], agree)), /Verdict: labels are usable\./);
  const apart = many.flatMap((n) => [rating(n, 'rater-a', (n % 5) + 1), rating(n, 'rater-b', 5 - (n % 5))]);
  assert.match(formatReport(agreementReport(apart), calibrationReport([], apart)), /Verdict: labels are not usable yet\./);
});

test('the rating scripts make no network calls', () => {
  for (const file of ['speechRatings.mjs', 'rateSpeechClips.mjs']) {
    const source = readFileSync(new URL(`./${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /\bfetch\(/, `${file} must not call fetch`);
    assert.doesNotMatch(source, /node:(http|https|net|dgram|tls|http2)\b/, `${file} must not import network modules`);
    assert.doesNotMatch(source, /from ['"](http|https|net)['"]/, `${file} must not import network modules`);
  }
});
