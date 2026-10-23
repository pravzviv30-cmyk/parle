/** Pure helpers for rateSpeechClips.mjs: validate a clip manifest and teacher ratings,
 * measure how well raters agree, and compare consensus ratings with the pronunciation
 * vendor's scores. No I/O, no network.
 * Labels are usable for calibration when mean pairwise QWK >= QWK_USABLE (0.6), counting
 * only rater pairs that share at least MIN_SHARED_CLIPS clips: a kappa on a handful of
 * clips says nothing.
 */

export const QWK_USABLE = 0.6;
export const MIN_SHARED_CLIPS = 30;
export const MIN_PHONEME_PAIRS = 5;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RATER = /^[a-z0-9_-]{2,32}$/;
const BANDS = new Set(['A0', 'A1', 'A2']);
const FORBIDDEN_KEYS = ['transcript', 'text', 'userId', 'email'];
const PHONEME_VALUES = new Set(['fine', 'off']);

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

function refuseForbidden(obj, where) {
  for (const key of FORBIDDEN_KEYS) {
    if (Object.hasOwn(obj, key)) throw new Error(`${where}: key "${key}" is not allowed (the manifest holds no learner identity or transcript)`);
  }
}

/** Validate a parsed manifest.json object. Returns the clips or throws a clear Error. */
export function parseManifest(json) {
  if (!isObject(json)) throw new Error('manifest: must be an object');
  refuseForbidden(json, 'manifest');
  if (json.version !== 1) throw new Error(`manifest: version must be 1, got ${JSON.stringify(json.version)}`);
  if (!Array.isArray(json.clips)) throw new Error('manifest: clips must be an array');
  const seen = new Set();
  return json.clips.map((clip, i) => {
    const where = `manifest clip ${i + 1}`;
    if (!isObject(clip)) throw new Error(`${where}: must be an object`);
    refuseForbidden(clip, where);
    if (typeof clip.id !== 'string' || !UUID.test(clip.id)) throw new Error(`${where}: id must be a uuid`);
    if (seen.has(clip.id)) throw new Error(`${where}: duplicate id ${clip.id}`);
    seen.add(clip.id);
    if (clip.file !== `${clip.id}.wav`) throw new Error(`${where}: file must be "${clip.id}.wav"`);
    if (typeof clip.reference !== 'string' || clip.reference.trim() === '') throw new Error(`${where}: reference must be a non-empty string`);
    if (!BANDS.has(clip.cefrBand)) throw new Error(`${where}: cefrBand must be A0, A1 or A2`);
    if (!Array.isArray(clip.focusPhonemes) || clip.focusPhonemes.some((p) => typeof p !== 'string' || p.length < 1 || p.length > 4)) {
      throw new Error(`${where}: focusPhonemes must be an array of short strings`);
    }
    if (typeof clip.vendor !== 'string' || clip.vendor === '') throw new Error(`${where}: vendor must be a non-empty string`);
    if (!Array.isArray(clip.vendorScores)) throw new Error(`${where}: vendorScores must be an array`);
    clip.vendorScores.forEach((s, j) => {
      if (!isObject(s)) throw new Error(`${where}: vendorScores[${j}] must be an object`);
      refuseForbidden(s, `${where} vendorScores[${j}]`);
      if (typeof s.ipa !== 'string' || s.ipa === '') throw new Error(`${where}: vendorScores[${j}].ipa must be a string`);
      if (typeof s.score !== 'number' || !Number.isFinite(s.score) || s.score < 0 || s.score > 100) {
        throw new Error(`${where}: vendorScores[${j}].score must be a number from 0 to 100`);
      }
    });
    return clip;
  });
}

/** Validate one rating object. Throws a plain Error without the line prefix. */
function checkRating(r) {
  if (!isObject(r)) throw new Error('rating must be a JSON object');
  if (typeof r.clipId !== 'string' || !UUID.test(r.clipId)) throw new Error('clipId must be a uuid');
  if (typeof r.rater !== 'string' || !RATER.test(r.rater)) throw new Error('rater must be a pseudonym matching ^[a-z0-9_-]{2,32}$');
  if (!Number.isInteger(r.overall) || r.overall < 1 || r.overall > 5) throw new Error('overall must be an integer from 1 to 5');
  if (!isObject(r.phonemes)) throw new Error('phonemes must be an object');
  for (const [ipa, value] of Object.entries(r.phonemes)) {
    if (!PHONEME_VALUES.has(value)) throw new Error(`phonemes["${ipa}"] must be "fine" or "off"`);
  }
  if (typeof r.ratedAt !== 'string' || Number.isNaN(Date.parse(r.ratedAt))) throw new Error('ratedAt must be an ISO date string');
  return { clipId: r.clipId, rater: r.rater, overall: r.overall, phonemes: { ...r.phonemes }, ratedAt: r.ratedAt };
}

/** Parse JSONL ratings. Blank lines are skipped; a bad line throws with its 1-based line number. */
export function parseRatings(text) {
  const out = [];
  String(text).split(/\r?\n/).forEach((line, index) => {
    if (line.trim() === '') return;
    const where = `ratings line ${index + 1}`;
    let parsed;
    try { parsed = JSON.parse(line); } catch { throw new Error(`${where}: not valid JSON`); }
    try { out.push(checkRating(parsed)); } catch (error) { throw new Error(`${where}: ${error.message}`); }
  });
  return out;
}

/** Quadratic weighted kappa for pairs [a, b] of ordinal scores 1..k from two raters.
 * Returns null when it is undefined: fewer than 2 pairs, or zero expected disagreement
 * (both raters used one single value throughout). null, not NaN, so callers cannot
 * average it by accident. */
export function quadraticWeightedKappa(pairs, k = 5) {
  if (!Array.isArray(pairs) || pairs.length < 2) return null;
  const n = pairs.length;
  const rowA = new Array(k).fill(0);
  const rowB = new Array(k).fill(0);
  const observed = Array.from({ length: k }, () => new Array(k).fill(0));
  for (const [a, b] of pairs) {
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 1 || a > k || b < 1 || b > k) {
      throw new Error(`scores must be integers from 1 to ${k}`);
    }
    observed[a - 1][b - 1] += 1;
    rowA[a - 1] += 1;
    rowB[b - 1] += 1;
  }
  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < k; i += 1) {
    for (let j = 0; j < k; j += 1) {
      const weight = ((i - j) ** 2) / ((k - 1) ** 2);
      numerator += weight * observed[i][j];
      denominator += weight * ((rowA[i] * rowB[j]) / n);
    }
  }
  if (denominator === 0) return null;
  return 1 - numerator / denominator;
}

function averageRanks(values) {
  const order = values.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]);
  const ranks = new Array(values.length);
  for (let i = 0; i < order.length;) {
    let j = i;
    while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j += 1;
    const rank = (i + j) / 2 + 1;
    for (let m = i; m <= j; m += 1) ranks[order[m][1]] = rank;
    i = j + 1;
  }
  return ranks;
}

/** Spearman rank correlation with average ranks for ties. null when n < 3 or either side has no variance. */
export function spearman(xs, ys) {
  if (xs.length !== ys.length) throw new Error('spearman: xs and ys must be the same length');
  const n = xs.length;
  if (n < 3) return null;
  const rx = averageRanks(xs);
  const ry = averageRanks(ys);
  const mx = mean(rx);
  const my = mean(ry);
  let sxy = 0; let sxx = 0; let syy = 0;
  for (let i = 0; i < n; i += 1) {
    sxy += (rx[i] - mx) * (ry[i] - my);
    sxx += (rx[i] - mx) ** 2;
    syy += (ry[i] - my) ** 2;
  }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

/** One rating per (clip, rater): the latest ratedAt wins, so a re-rating replaces the old one. */
function latestPerRater(ratings) {
  const byKey = new Map();
  for (const r of ratings) {
    const key = `${r.clipId}\u0000${r.rater}`;
    const old = byKey.get(key);
    if (!old || r.ratedAt >= old.ratedAt) byKey.set(key, r);
  }
  return [...byKey.values()];
}

function groupByClip(ratings) {
  const byClip = new Map();
  for (const r of latestPerRater(ratings)) {
    if (!byClip.has(r.clipId)) byClip.set(r.clipId, []);
    byClip.get(r.clipId).push(r);
  }
  return byClip;
}

/** Per clip: mean overall, rater count, and per phoneme the share of raters who flagged it off. */
export function consensus(ratings) {
  const out = new Map();
  for (const [clipId, rs] of groupByClip(ratings)) {
    const tally = {};
    for (const r of rs) {
      for (const [ipa, value] of Object.entries(r.phonemes)) {
        tally[ipa] ??= { off: 0, total: 0 };
        tally[ipa].total += 1;
        if (value === 'off') tally[ipa].off += 1;
      }
    }
    const offShare = {};
    for (const [ipa, t] of Object.entries(tally)) offShare[ipa] = t.off / t.total;
    out.set(clipId, { meanOverall: mean(rs.map((r) => r.overall)), raters: rs.length, offShare });
  }
  return out;
}

/** Pairwise QWK per rater pair on shared clips, the mean of the defined ones, and how many rated clips have 2+ raters. */
export function agreementReport(ratings) {
  const byClip = groupByClip(ratings);
  const raters = [...new Set(latestPerRater(ratings).map((r) => r.rater))].sort();
  const pairs = [];
  for (let i = 0; i < raters.length; i += 1) {
    for (let j = i + 1; j < raters.length; j += 1) {
      const scores = [];
      for (const rs of byClip.values()) {
        const a = rs.find((r) => r.rater === raters[i]);
        const b = rs.find((r) => r.rater === raters[j]);
        if (a && b) scores.push([a.overall, b.overall]);
      }
      pairs.push({ a: raters[i], b: raters[j], n: scores.length, qwk: quadraticWeightedKappa(scores) });
    }
  }
  const defined = pairs.filter((p) => p.qwk !== null).map((p) => p.qwk);
  const enough = pairs.filter((p) => p.qwk !== null && p.n >= MIN_SHARED_CLIPS).map((p) => p.qwk);
  const clipCount = byClip.size;
  const multi = [...byClip.values()].filter((rs) => rs.length >= 2).length;
  return {
    raters,
    clipsRated: clipCount,
    pairs,
    meanPairwiseQwk: defined.length ? mean(defined) : null,
    /** The mean over pairs sharing at least MIN_SHARED_CLIPS clips; the verdict reads this one. */
    verdictQwk: enough.length ? mean(enough) : null,
    shareMultiRated: clipCount ? multi / clipCount : null,
  };
}

/** Spearman between consensus and the vendor, overall and per focus phoneme (n >= MIN_PHONEME_PAIRS). */
export function calibrationReport(clips, ratings) {
  const cons = consensus(ratings);
  const overallX = []; const overallY = [];
  const perPhoneme = new Map();
  for (const clip of clips) {
    const c = cons.get(clip.id);
    if (!c) continue;
    if (clip.vendorScores.length) {
      overallX.push(c.meanOverall);
      overallY.push(mean(clip.vendorScores.map((s) => s.score)));
    }
    for (const ipa of clip.focusPhonemes) {
      const scores = clip.vendorScores.filter((s) => s.ipa === ipa).map((s) => s.score);
      if (!scores.length || c.offShare[ipa] === undefined) continue;
      if (!perPhoneme.has(ipa)) perPhoneme.set(ipa, { x: [], y: [] });
      perPhoneme.get(ipa).x.push(mean(scores));
      perPhoneme.get(ipa).y.push(1 - c.offShare[ipa]);
    }
  }
  const phonemes = [...perPhoneme.entries()].sort(([p], [q]) => p.localeCompare(q)).map(([ipa, { x, y }]) => (
    x.length >= MIN_PHONEME_PAIRS
      ? { ipa, n: x.length, spearman: spearman(x, y), tooFew: false }
      : { ipa, n: x.length, spearman: null, tooFew: true }
  ));
  return { overall: { n: overallX.length, spearman: spearman(overallX, overallY) }, phonemes };
}

const fmt = (v) => (v === null ? 'n/a' : v.toFixed(2));

/** Plain-text report with the decision rule. */
export function formatReport(agreement, calibration) {
  const lines = [];
  lines.push('Rater agreement');
  lines.push(`  raters: ${agreement.raters.length ? agreement.raters.join(', ') : 'none'}`);
  lines.push(`  clips rated: ${agreement.clipsRated}`);
  lines.push(`  clips with 2+ raters: ${agreement.shareMultiRated === null ? 'n/a' : `${Math.round(agreement.shareMultiRated * 100)}%`}`);
  for (const p of agreement.pairs) lines.push(`  ${p.a} vs ${p.b}: QWK ${fmt(p.qwk)} (n=${p.n})`);
  lines.push(`  mean pairwise QWK: ${fmt(agreement.meanPairwiseQwk)}`);
  lines.push('');
  lines.push('Vendor calibration (Spearman, consensus vs vendor score)');
  lines.push(`  overall: ${fmt(calibration.overall.spearman)} (n=${calibration.overall.n})`);
  for (const p of calibration.phonemes) {
    lines.push(p.tooFew ? `  /${p.ipa}/: too few (n=${p.n}, need ${MIN_PHONEME_PAIRS})` : `  /${p.ipa}/: ${fmt(p.spearman)} (n=${p.n})`);
  }
  lines.push('');
  lines.push(`Decision rule: labels are usable when mean pairwise QWK >= ${QWK_USABLE}, over rater pairs sharing at least ${MIN_SHARED_CLIPS} clips.`);
  const q = agreement.verdictQwk;
  lines.push(q === null ? `Verdict: cannot tell yet (no rater pair shares ${MIN_SHARED_CLIPS} clips).` : q >= QWK_USABLE ? 'Verdict: labels are usable.' : 'Verdict: labels are not usable yet.');
  return lines.join('\n');
}
