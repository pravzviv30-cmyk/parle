/** Collection metadata references the existing content owners; it owns no learning state. */
import { CONNECTOR_IDS, DAILY_SCENARIOS, MISSIONS, type DailyScenario, type Mission, type TutorVoiceKey } from '@luvani/core';
import { DAILY_ITEMS, dailyItem, type DailyItem } from '../daily/catalogue.ts';
import { tutorAudioFor, type TutorAudioPack } from '../daily/tutorAudio.ts';
import { EXPLORE_TOPICS, orderByPitch, orderScenarios, searchKey, type ExploreTopic } from './exploreCatalogue.ts';
import type { ExploreAccessRef } from '../purchases/exploreAccess.ts';
export type { ExploreAccessRef } from '../purchases/exploreAccess.ts';
export interface ExploreCollection {
  id: string;
  title: string;
  outcome: string;
  motif: 'cloud' | 'talk' | 'phrases' | 'practice' | 'journal' | 'market' | 'plans' | 'travel' | 'listen' | 'recovery';
  tone: 'plum' | 'teal' | 'rose' | 'ochre';
  kind: 'topics' | 'scenarios' | 'daily' | 'missions';
  topic?: ExploreTopic;
  refs?: readonly ExploreAccessRef[];
}
export type ExploreCollectionItem =
  | { kind: 'scenario'; id: string; source: DailyScenario; title: string; detail: string; tier: 1 | 2 | 3 }
  | { kind: 'daily'; id: string; source: DailyItem; title: string; detail: string; tier?: 1 | 2 | 3; hasAudio: boolean }
  | { kind: 'mission'; id: string; source: Mission; title: string; detail: string };
export const EVERYDAY_COLLECTION: ExploreCollection = {
  id: 'everyday', title: 'Everyday French', outcome: 'Find a conversation for something you want to do, from meeting a neighbour to changing a train ticket.', motif: 'cloud', tone: 'teal', kind: 'topics',
};
export const PRACTICAL_COLLECTIONS: readonly ExploreCollection[] = [
  { id: 'plans-change', title: 'When plans change', outcome: 'Explain a delay, suggest another option and agree on a new plan.', motif: 'plans', tone: 'plum', kind: 'scenarios', refs: [
    { kind: 'scenario', id: 'situation:friends-rain-changes-the-plan' },
    { kind: 'scenario', id: 'situation:study-moving-a-lesson' },
    { kind: 'scenario', id: 'situation:street-changing-your-ticket' },
    { kind: 'scenario', id: 'situation:friends-running-late' },
    { kind: 'scenario', id: 'situation:friends-cancelling-on-the-day' },
    { kind: 'scenario', id: 'situation:work-swapping-a-shift' },
  ] },
  { id: 'tell-it-your-way', title: 'Tell it your way', outcome: 'Tell a story, explain your choice or disagree politely. Leave room for the conversation to go somewhere new.', motif: 'journal', tone: 'rose', kind: 'scenarios', refs: [
    { kind: 'scenario', id: 'situation:friends-telling-a-story' },
    { kind: 'scenario', id: 'situation:friends-a-polite-disagreement' },
    { kind: 'scenario', id: 'situation:work-disagreeing-in-a-meeting' },
    { kind: 'scenario', id: 'situation:friends-why-you-moved-here' },
    { kind: 'scenario', id: 'situation:work-chasing-a-document-by-phone' },
  ] },
  { id: 'find-your-words', title: 'Find your words', outcome: 'Ask someone to repeat, explain a missing word and find your way back into the conversation.', motif: 'talk', tone: 'ochre', kind: 'scenarios', refs: [
    { kind: 'scenario', id: 'situation:friends-back-in-the-conversation' },
    { kind: 'scenario', id: 'situation:friends-a-word-you-cannot-find' },
    { kind: 'scenario', id: 'situation:friends-stay-in-french' },
    { kind: 'scenario', id: 'situation:study-repeat-please' },
    { kind: 'scenario', id: 'situation:work-please-speak-slowly' },
  ] },
];
export const SKILL_COLLECTIONS: readonly ExploreCollection[] = [
  { id: 'hear-and-practise', title: 'Hear & practise', outcome: 'Hear French in your tutor’s voice. Read the meaning, then say the line your way or record and compare.', motif: 'listen', tone: 'teal', kind: 'daily' },
  { id: 'connect-your-ideas', title: 'Keep a conversation going', outcome: 'Join two thoughts, change the subject or buy yourself a moment with useful French expressions.', motif: 'talk', tone: 'plum', kind: 'daily', refs: CONNECTOR_IDS.map(id => ({ kind: 'daily', id })) },
  { id: 'guided-situations', title: 'Start speaking', outcome: 'Live scenes with your tutor, with examples when you want them and writing when you need it.', motif: 'practice', tone: 'ochre', kind: 'missions' },
];
export const TOPIC_COLLECTIONS: readonly ExploreCollection[] = EXPLORE_TOPICS.map(t => ({
  id: `topic:${t.key}`, title: t.title, outcome: 'Choose a situation, prepare a few useful lines if you want to, then speak or write with your tutor.',
  motif: t.motif, tone: t.tone, kind: 'scenarios', topic: t.key,
}));
export const EXPLORE_COLLECTIONS = [EVERYDAY_COLLECTION, ...TOPIC_COLLECTIONS, ...SKILL_COLLECTIONS, ...PRACTICAL_COLLECTIONS] as const;
export function exploreCollection(id: unknown): ExploreCollection | undefined { return EXPLORE_COLLECTIONS.find(c => c.id === id); }
export function exploreScenario(id: unknown): DailyScenario | undefined { return DAILY_SCENARIOS.find(s => s.id === id); }

export function collectionItems(collection: ExploreCollection, options: { tier?: 1 | 2 | 3; audio?: TutorAudioPack; voice?: TutorVoiceKey } = {}): readonly ExploreCollectionItem[] {
  if (collection.kind === 'topics') return [];
  if (collection.kind === 'missions') return MISSIONS.map(source => ({ kind: 'mission', id: source.id, source, title: source.titleEn, detail: `${source.goalEn.replace(/[.\s]+$/, '')}. A live scene with your tutor.` }));
  if (collection.kind === 'scenarios') {
    const theme = EXPLORE_TOPICS.find(t => t.key === collection.topic)?.theme;
    const ids = new Set(collection.refs?.filter(ref => ref.kind === 'scenario').map(ref => ref.id));
    const scenarios = DAILY_SCENARIOS.filter(s => theme ? s.theme === theme : ids.has(s.id));
    return orderScenarios(scenarios, options.tier).map(source => ({ kind: 'scenario', id: source.id, source, title: source.titleEn, detail: source.bodyEn, tier: source.tier }));
  }
  const refs = collection.refs?.filter(ref => ref.kind === 'daily');
  const candidates = refs ? refs.map(ref => dailyItem(ref.id)).filter((item): item is DailyItem => item !== undefined) : DAILY_ITEMS;
  const hasAudio = (id: string) => options.audio !== undefined && options.voice !== undefined && tutorAudioFor(options.audio, id, options.voice) !== undefined;
  // The listening collection is the selected voice's real inventory, never the generic text catalogue.
  const items = collection.id === 'hear-and-practise' ? candidates.filter(item => hasAudio(item.id)) : candidates;
  return orderByPitch(items, options.tier).map(source => ({ kind: 'daily', id: source.id, source, title: source.fr, detail: source.en, tier: source.tier, hasAudio: hasAudio(source.id) }));
}
export function collectionCount(collection: ExploreCollection, options: Parameters<typeof collectionItems>[1] = {}): number {
  return collection.kind === 'topics' ? TOPIC_COLLECTIONS.length : collectionItems(collection, options).length;
}
export function collectionCountLine(collection: ExploreCollection, count: number): string {
  const noun = collection.kind === 'topics' ? 'topics' : collection.kind === 'scenarios' ? 'conversation starters' : collection.kind === 'missions' ? 'guided beginner activities' : collection.id === 'hear-and-practise' ? 'recorded words and phrases' : 'useful expressions';
  return `${count} ${noun}`;
}
export function searchCollectionItems(items: readonly ExploreCollectionItem[], query: string): readonly ExploreCollectionItem[] {
  const needle = searchKey(query.trim());
  if (!needle) return items;
  return items.filter(item => {
    const extra = item.kind === 'scenario'
      ? [item.id.replace(/^situation:/, '').replace(/-/g, ' '), item.source.titleFr, item.source.openingFr, item.source.openingEn, ...item.source.lines.flatMap(line => [line.fr, line.en])].join(' ')
      : item.kind === 'daily' ? `${item.source.note} ${item.source.exampleFr ?? ''} ${item.source.exampleEn ?? ''}` : item.source.title;
    return searchKey(`${item.title} ${item.detail} ${extra}`).includes(needle);
  });
}
export function searchCollections(query: string): readonly ExploreCollection[] {
  const q = searchKey(query.trim());
  return q ? EXPLORE_COLLECTIONS.filter(c => searchKey(`${c.title} ${c.outcome}`).includes(q)) : [];
}
