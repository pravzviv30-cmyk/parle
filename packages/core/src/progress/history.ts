/**
 * Progress across sessions.
 *
 * This is the retention mechanic the research pointed at. Streaks tell people they
 * showed up. This tells them they got better, with evidence: which sound moved,
 * how many words they can say now, how long they can keep talking.
 *
 * The same restraint as the end-of-session card applies here. At most three
 * headline facts. A learner who sees a wall of trends stops reading all of them.
 *
 * Everything here is pure. The app stores an array of SessionSummary records
 * (AsyncStorage on device) and hands it in. Nothing touches storage or the clock.
 */

import { getPhoneme } from '../phonemes/inventory.ts';
import type { SessionSummary } from '../session/session.ts';

export interface StoredSession {
  /** Epoch ms when the session ended. */
  endedAt: number;
  summary: SessionSummary;
}

export interface PhonemeTrend {
  ipa: string;
  /** Mean score across the earliest third of sessions that heard this sound. */
  earlyScore: number;
  /** Mean score across the latest third. */
  recentScore: number;
  delta: number;
}

export interface ProgressReport {
  sessionCount: number;
  /** Distinct words said correctly across all sessions. */
  wordsKnown: string[];
  /** Best improvement first. Only sounds heard in enough sessions to trust. */
  trends: PhonemeTrend[];
  longestTurnEverSec: number;
  /** At most three plain sentences. The card the learner actually reads. */
  headlines: string[];
}

/** A sound needs this many sessions of data before a trend means anything. */
export const MIN_SESSIONS_FOR_TREND = 2;

function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Per-session mean score for one phoneme, oldest first. */
function phonemeSeries(sessions: readonly StoredSession[], ipa: string): number[] {
  const series: number[] = [];
  for (const s of sessions) {
    const stat = s.summary.pronunciation.stats.find((x) => x.ipa === ipa);
    if (stat && stat.sampleCount >= 2) series.push(stat.meanScore);
  }
  return series;
}

export function buildTrends(sessions: readonly StoredSession[]): PhonemeTrend[] {
  const seen = new Set<string>();
  for (const s of sessions) for (const stat of s.summary.pronunciation.stats) seen.add(stat.ipa);

  const trends: PhonemeTrend[] = [];
  for (const ipa of seen) {
    if (!getPhoneme(ipa)) continue;
    const series = phonemeSeries(sessions, ipa);
    if (series.length < MIN_SESSIONS_FOR_TREND) continue;

    // Compare the first and last thirds so one lucky session cannot fake a trend.
    const slice = Math.max(1, Math.floor(series.length / 3));
    const early = mean(series.slice(0, slice));
    const recent = mean(series.slice(-slice));
    trends.push({ ipa, earlyScore: Math.round(early), recentScore: Math.round(recent), delta: Math.round(recent - early) });
  }

  return trends.sort((a, b) => b.delta - a.delta);
}

export function buildReport(sessions: readonly StoredSession[]): ProgressReport {
  const ordered = [...sessions].sort((a, b) => a.endedAt - b.endedAt);

  const words = new Set<string>();
  let longest = 0;
  for (const s of ordered) {
    for (const w of s.summary.wordsProduced) words.add(w);
    longest = Math.max(longest, s.summary.longestTurnSec);
  }

  const trends = buildTrends(ordered);
  const headlines: string[] = [];

  // Headline 1: the best genuinely improved hard sound. The proof that practice works.
  const best = trends.find((t) => t.delta >= 5 && (getPhoneme(t.ipa)?.difficulty ?? 0) >= 3);
  if (best) headlines.push(`Your /${best.ipa}/ went from ${best.earlyScore} to ${best.recentScore}. That practice paid off.`);

  // Headline 2: vocabulary they produced, not vocabulary they saw.
  if (words.size > 0) headlines.push(`You can say ${words.size} French words out loud now.`);

  // Headline 3: stamina, only once it is worth saying.
  if (longest >= 3) headlines.push(`Your longest run of French so far is ${longest.toFixed(1)} seconds without stopping.`);

  return {
    sessionCount: ordered.length,
    wordsKnown: [...words].sort(),
    trends,
    longestTurnEverSec: longest,
    headlines: headlines.slice(0, 3),
  };
}
