/**
 * Turning a pile of phoneme scores into exactly one thing to work on.
 *
 * The temptation is to show the learner everything the scorer produced. That is
 * how you build a dashboard nobody reads. A beginner who finishes a session and
 * sees eleven red bars concludes they are bad at French and closes the app.
 *
 * So this module deliberately throws information away. It ranks by *how much
 * fixing this would help*, not by raw badness, and returns a single focus point.
 *
 * Ranking accounts for four things:
 *   1. How wrong it was            — (100 - score)
 *   2. How hard it is for English speakers — difficulty weight
 *   3. Whether the error changes the word  — meaning-bearing multiplier
 *   4. How sure we are              — confidence ramp on sample count
 *
 * (4) matters more than it looks. Speech scorers are noisy on single utterances.
 * Flagging a phoneme heard once produces advice that contradicts itself session
 * to session, and a learner who is told something different every day stops
 * believing any of it.
 */

import { getPhoneme, type Phoneme } from './inventory.ts';
import { bestDrillFor, type Drill } from './drills.ts';

/** One phoneme, as produced once by the learner, scored 0–100 by the assessor. */
export interface PhonemeObservation {
  ipa: string;
  score: number;
  /** The word it appeared in — makes feedback concrete. */
  word: string;
  /** What the scorer thought they said instead, when it can tell. */
  substituted?: string;
}

export interface PhonemeStat {
  ipa: string;
  meanScore: number;
  sampleCount: number;
  /** The word where they did worst — the example we quote back to them. */
  worstWord: string;
  worstScore: number;
  /** Most frequent substitution across observations, if the scorer reported any. */
  commonSubstitution?: string;
}

export interface FocusPoint {
  phoneme: Phoneme;
  stat: PhonemeStat;
  drill: Drill;
  /** Learner-facing sentence explaining why this was chosen. Never mentions maths. */
  reason: string;
}

export interface SessionPhonemeReport {
  /** Every phoneme observed, best-scoring first. */
  stats: PhonemeStat[];
  /** The single thing to work on, or null when nothing needs work. */
  focus: FocusPoint | null;
  /** Difficulty-weighted overall score, 0–100. */
  overall: number;
  /** Phonemes that scored well and are worth telling them about. */
  wins: PhonemeStat[];
}

/** Below this many samples a phoneme is too noisy to act on. */
export const MIN_SAMPLES_TO_FLAG = 3;
/** Samples at which we fully trust the mean. */
const CONFIDENCE_SATURATION = 5;
/** At or above this score the sound is working; do not nag. */
export const GOOD_ENOUGH = 78;
/** A "win" worth celebrating. */
const WIN_THRESHOLD = 88;
/** Errors that change the word count for more than cosmetic ones. */
const MEANING_BEARING_MULTIPLIER = 1.4;

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function mostCommon(xs: string[]): string | undefined {
  if (xs.length === 0) return undefined;
  const counts = new Map<string, number>();
  for (const x of xs) counts.set(x, (counts.get(x) ?? 0) + 1);
  let best: string | undefined;
  let bestN = 0;
  for (const [k, n] of counts) {
    if (n > bestN) {
      best = k;
      bestN = n;
    }
  }
  return best;
}

/** Collapse raw observations into one row per phoneme. */
export function aggregate(observations: readonly PhonemeObservation[]): PhonemeStat[] {
  const groups = new Map<string, PhonemeObservation[]>();
  for (const o of observations) {
    const list = groups.get(o.ipa);
    if (list) list.push(o);
    else groups.set(o.ipa, [o]);
  }

  const stats: PhonemeStat[] = [];
  for (const [ipa, obs] of groups) {
    let worst = obs[0]!;
    for (const o of obs) if (o.score < worst.score) worst = o;

    stats.push({
      ipa,
      meanScore: mean(obs.map((o) => o.score)),
      sampleCount: obs.length,
      worstWord: worst.word,
      worstScore: worst.score,
      commonSubstitution: mostCommon(obs.map((o) => o.substituted).filter((s): s is string => !!s)),
    });
  }

  return stats.sort((a, b) => b.meanScore - a.meanScore);
}

/**
 * How much would fixing this phoneme improve the learner's French?
 * Higher means more worth their next sixty seconds. Not shown to the user.
 */
export function priority(stat: PhonemeStat, phoneme: Phoneme): number {
  if (stat.sampleCount < MIN_SAMPLES_TO_FLAG) return 0;
  if (stat.meanScore >= GOOD_ENOUGH) return 0;

  const wrongness = 100 - stat.meanScore;
  const difficultyWeight = phoneme.difficulty / 5;
  const confidence = Math.min(1, stat.sampleCount / CONFIDENCE_SATURATION);
  const meaning = phoneme.meaningBearing ? MEANING_BEARING_MULTIPLIER : 1;

  return wrongness * difficultyWeight * confidence * meaning;
}

function buildReason(phoneme: Phoneme, stat: PhonemeStat): string {
  // Strongest framing: name the real word they accidentally said.
  if (phoneme.meaningBearing && stat.commonSubstitution) {
    return `In "${stat.worstWord}" you said /${stat.commonSubstitution}/ instead of /${phoneme.ipa}/. In French that makes a different word.`;
  }
  if (phoneme.meaningBearing) {
    return `A small slip on /${phoneme.ipa}/ changes which word you said. Yours drifted in "${stat.worstWord}".`;
  }
  if (!phoneme.existsInEnglish) {
    return `English does not have /${phoneme.ipa}/, so there is nothing to lean on. It came up ${stat.sampleCount} times today, most clearly in "${stat.worstWord}".`;
  }
  return `Your /${phoneme.ipa}/ was inconsistent today, weakest in "${stat.worstWord}".`;
}

/** Difficulty-weighted overall score. Hard sounds count for more. */
export function overallScore(stats: readonly PhonemeStat[]): number {
  let weighted = 0;
  let weight = 0;
  for (const s of stats) {
    const p = getPhoneme(s.ipa);
    if (!p) continue;
    const w = (p.difficulty / 5) * s.sampleCount;
    weighted += s.meanScore * w;
    weight += w;
  }
  return weight === 0 ? 0 : Math.round(weighted / weight);
}

/**
 * The whole end-of-session pronunciation report.
 *
 * Returns at most one focus point by design — see the note at the top of the file.
 */
export function buildReport(observations: readonly PhonemeObservation[]): SessionPhonemeReport {
  const stats = aggregate(observations);

  const ranked: { stat: PhonemeStat; phoneme: Phoneme; score: number }[] = [];
  for (const stat of stats) {
    const phoneme = getPhoneme(stat.ipa);
    if (!phoneme) continue; // unknown symbol from the scorer — ignore rather than guess
    const score = priority(stat, phoneme);
    if (score > 0) ranked.push({ stat, phoneme, score });
  }
  ranked.sort((a, b) => b.score - a.score);

  // A phoneme with no drill built yet must not become the focus — we would be
  // naming a problem and offering no way to fix it, which is worse than silence.
  // But that is a reason to skip the phoneme, not to abandon the report: /œ/ is
  // difficulty 4 with no drill in the bank, and letting it win the ranking used
  // to mean a learner who also mangled /ʁ/ was told nothing at all.
  let focus: FocusPoint | null = null;
  for (const candidate of ranked) {
    const drill = bestDrillFor(candidate.phoneme, candidate.stat.commonSubstitution);
    if (!drill) continue;
    focus = { phoneme: candidate.phoneme, stat: candidate.stat, drill, reason: buildReason(candidate.phoneme, candidate.stat) };
    break;
  }

  const wins = stats.filter(
    (s) => s.meanScore >= WIN_THRESHOLD && s.sampleCount >= MIN_SAMPLES_TO_FLAG && (getPhoneme(s.ipa)?.difficulty ?? 0) >= 3,
  );

  return { stats, focus, overall: overallScore(stats), wins };
}
