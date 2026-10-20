/**
 * What the direction B Explore tab shows, decided here so the tab file is only
 * layout (B1, 2026-10-20, artboard B-Explore).
 *
 * Every fact a filter or a meta line reads is derived from data that already
 * ships: the scene's authored tier, the minutes `home/estimate.ts` gives, the
 * free-sample list in `purchases/exploreAccess.ts` and the bundled recordings.
 * Nothing is stored and nothing is guessed. A section with nothing behind a
 * chosen filter is hidden rather than filled.
 */

import type { DailyScenario, Mission, TutorVoiceKey } from '@luvani/core';
import { estimateMinutes, missionMinutes } from '../home/estimate.ts';
import { isFreeExploreContent } from '../purchases/exploreAccess.ts';
import { tutorAudioFor, type TutorAudioPack } from '../daily/tutorAudio.ts';
import type { DailyItem } from '../daily/catalogue.ts';
import { missionTopic, scenarioTopic, type ExploreTopic } from './exploreCatalogue.ts';

export type ExploreFilter = 'starting' | 'short' | 'offline' | 'tutor';

/** The four chips, in the artboard's order. */
export const EXPLORE_FILTERS: readonly { key: ExploreFilter; label: string }[] = [
  { key: 'starting', label: 'Starting out' },
  { key: 'short', label: 'Under 5 min' },
  { key: 'offline', label: 'Free, offline' },
  { key: 'tutor', label: 'With your tutor' },
];

/** "Under 5 min" means strictly under five estimated minutes. */
export const SHORT_MINUTES = 5;

export interface AudioEnv {
  audio: TutorAudioPack;
  voice: TutorVoiceKey;
}

/** One situation row's facts. */
export interface SituationFacts {
  kind: 'scenario' | 'mission';
  id: string;
  title: string;
  /** The "Practise ..." line under the title. */
  practise: string;
  minutes: number;
  /** Tier 1 for a daily scene, A0 for a guided mission. */
  startingOut: boolean;
  /** Always false: a situation is a live conversation, which uses speaking time. */
  offline: false;
  /** Every situation is a conversation with the tutor. */
  tutor: true;
  /** The catalogue topic, which picks the row's drawing (main/exploreArt.ts); null for a mission with none. */
  topic: ExploreTopic | null;
}

function lowerFirst(text: string): string {
  return text.length === 0 ? text : text[0]!.toLocaleLowerCase('en') + text.slice(1);
}

export function scenarioFacts(scenario: DailyScenario, _env?: AudioEnv): SituationFacts {
  return {
    kind: 'scenario',
    id: scenario.id,
    title: scenario.titleEn,
    // The French is what is practised; the English sits in brackets.
    practise: `Practise saying “${scenario.openingFr}” (${scenario.openingEn})`,
    minutes: estimateMinutes({ kind: 'scenario', lines: scenario.lines.length }),
    startingOut: scenario.tier === 1,
    // Never offline: a situation row leads to a live conversation that uses
    // speaking time, so "Free, offline" keeps only words and phrases (B1
    // learning-science review, 2026-10-20). Free samples still say so through
    // the access label.
    offline: false,
    tutor: true,
    topic: scenarioTopic(scenario)?.key ?? null,
  };
}

export function missionFacts(mission: Mission): SituationFacts {
  return {
    kind: 'mission',
    id: mission.id,
    title: mission.titleEn,
    practise: `Practise how to ${lowerFirst(mission.canDoEn)}`,
    minutes: missionMinutes(mission),
    startingOut: mission.cefr === 'A0',
    // A mission has no bundled recording anywhere (missions/preview.ts).
    offline: false,
    tutor: true,
    topic: missionTopic(mission)?.key ?? null,
  };
}

/** Every chosen filter holds. No filter chosen keeps everything. */
export function matchesFilters(facts: { minutes: number; startingOut: boolean; offline: boolean; tutor: boolean }, filters: ReadonlySet<ExploreFilter>): boolean {
  for (const filter of filters) {
    if (filter === 'starting' && !facts.startingOut) return false;
    if (filter === 'short' && !(facts.minutes < SHORT_MINUTES)) return false;
    if (filter === 'offline' && !facts.offline) return false;
    if (filter === 'tutor' && !facts.tutor) return false;
  }
  return true;
}

/** Turn a filter on or off, returning a new set. */
export function toggleFilter(filters: ReadonlySet<ExploreFilter>, filter: ExploreFilter): ReadonlySet<ExploreFilter> {
  const next = new Set(filters);
  if (next.has(filter)) next.delete(filter);
  else next.add(filter);
  return next;
}

/**
 * The row's meta line: "5 min, with your tutor, starting out", then the
 * access truth: the label `useExploreAccess` gives ("Free sample", "Included with a plan"), or
 * nothing when the plan already covers it.
 */
export function situationMeta(facts: SituationFacts, accessLabel: string | null): string {
  const parts = [`${facts.minutes} min`, 'with your tutor'];
  if (facts.startingOut) parts.push('starting out');
  if (accessLabel !== null) parts.push(lowerFirst(accessLabel));
  // The artboard's middots are commas: copy/punctuation.test.ts takes no new file.
  return parts.join(', ');
}

/** A word or phrase row's facts. Daily items are always free (exploreAccess.ts). */
export function phraseFacts(item: DailyItem, env: AudioEnv): { startingOut: boolean; offline: boolean; hasAudio: boolean } {
  const hasAudio = tutorAudioFor(env.audio, item.id, env.voice) !== undefined;
  return { startingOut: item.tier === 1, offline: hasAudio && isFreeExploreContent({ kind: 'daily', id: item.id }), hasAudio };
}

/**
 * Which sections a filter leaves standing.
 *
 * A door section has no minutes or tier of its own, so it stands only when
 * every chosen filter is one it truly meets: the tutor-led doors meet "With
 * your tutor" and nothing else. Words and phrases have a tier and recordings
 * but no estimate and no tutor, so "Under 5 min" and "With your tutor" hide
 * them. Situations are filtered row by row.
 */
export type ExploreSection = 'prepare' | 'topics' | 'situations' | 'next' | 'practice' | 'further' | 'words';
const SECTION_MEETS: Record<ExploreSection, readonly ExploreFilter[]> = {
  prepare: ['tutor'],
  topics: [],
  situations: ['starting', 'short', 'tutor'],
  next: ['tutor'],
  practice: [],
  further: ['tutor'],
  words: ['starting', 'offline'],
};
export function sectionShown(section: ExploreSection, filters: ReadonlySet<ExploreFilter>): boolean {
  for (const filter of filters) if (!SECTION_MEETS[section].includes(filter)) return false;
  return true;
}

/** The words row passes the chosen filters that apply to it. */
export function phraseMatches(facts: { startingOut: boolean; offline: boolean }, filters: ReadonlySet<ExploreFilter>): boolean {
  if (!sectionShown('words', filters)) return false;
  if (filters.has('starting') && !facts.startingOut) return false;
  if (filters.has('offline') && !facts.offline) return false;
  return true;
}

/**
 * Situations for you: daily scenes in the catalogue's own order, then the
 * guided missions, filtered, and cut to `limit`.
 */
export function situationsFor(
  scenarios: readonly DailyScenario[],
  missions: readonly Mission[],
  filters: ReadonlySet<ExploreFilter>,
  env: AudioEnv,
  limit: number,
): SituationFacts[] {
  const out: SituationFacts[] = [];
  for (const facts of [...scenarios.map((s) => scenarioFacts(s, env)), ...missions.map(missionFacts)]) {
    if (out.length >= limit) break;
    if (matchesFilters(facts, filters)) out.push(facts);
  }
  return out;
}

/** Every situation row opens the scene preview with its own id. */
export function situationRoute(facts: Pick<SituationFacts, 'id'>): { screen: 'ScenePreview'; params: { missionId: string } } {
  return { screen: 'ScenePreview', params: { missionId: facts.id } };
}

/**
 * The search's own-topic row. When the search found nothing it says plainly
 * that the tutor can still talk about it; the start path is unchanged.
 */
export function seedRowTitle(hasSeed: boolean, nothingFound: boolean): string {
  if (hasSeed && nothingFound) return 'Talk about this with your tutor';
  return hasSeed ? 'Talk about this topic' : 'Talk about your own topic';
}

/**
 * A practical collection's access line from its scenes' labels, so a
 * collection is never called free when only one sample in it is.
 */
export function collectionAccessNote(labels: readonly (string | null)[]): string | null {
  const free = labels.some((label) => label === 'Free sample');
  const plan = labels.some((label) => label === 'Included with a plan');
  if (free && plan) return 'Includes a free sample';
  if (plan) return 'Included with a plan';
  if (free) return 'Free sample';
  return null;
}

/** The real-moment prefill: the typed words, trimmed, or nothing. */
export function realMomentParams(detail: string): { detail?: string } {
  const text = detail.trim();
  return text ? { detail: text } : {};
}
