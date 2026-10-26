/** Presentation over owned conversation packs and the one review deck. Ported by path from ce1fa976 (B3, 2026-10-20). */
import { phraseKeyOf, type ConversationPack, type ReviewCard } from '@luvani/core';
import { orderedConversationPacks } from '../conversationPacks/model.ts';
import { practiceStatusOf } from '../conversationPacks/practiceStatus.ts';

const folded = (value: string): string => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim();
const wordsOf = (query: string): string[] => folded(query).split(/\s+/).filter(Boolean);
const contains = (content: string, query: string): boolean => {
  const text = folded(content);
  return wordsOf(query).every(word => text.includes(word));
};

export interface LibraryTopic { key: string; title: string }

/** Topics describe this page only; no fabricated categories fill an empty library. */
export function conversationTopics(packs: readonly ConversationPack[]): LibraryTopic[] {
  const topics = new Map<string, LibraryTopic>();
  for (const pack of orderedConversationPacks(packs)) {
    for (const topic of pack.topics) {
      const title = topic.en.trim() || topic.fr.trim();
      const key = folded(title);
      if (key !== '' && !topics.has(key)) topics.set(key, { key, title });
    }
  }
  return [...topics.values()];
}

/** Search the supplied page, including its saved French, never imply server-wide search. */
export function conversationsMatching(packs: readonly ConversationPack[], query: string, topic: string | null): ConversationPack[] {
  const available = conversationTopics(packs);
  const selected = available.some(item => item.key === topic) ? topic : null;
  return orderedConversationPacks(packs).filter(pack => {
    if (selected !== null && !pack.topics.some(item => folded(item.en.trim() || item.fr.trim()) === selected)) return false;
    return contains([
      pack.title.en, pack.title.fr, pack.summary,
      ...pack.topics.flatMap(item => [item.en, item.fr]),
      ...pack.keyPhrases.flatMap(item => [item.fr, item.frWritten ?? '', item.en]),
    ].join(' '), query);
  });
}

export interface LibraryPhrase {
  card: ReviewCard;
  /** The newest surviving source, or null; deleted sources are never recreated. */
  source: Pick<ConversationPack, 'id' | 'title'> | null;
}

/** The owned deck is the phrase collection; this view never creates a second saved store. */
export function libraryPhrases(deck: readonly ReviewCard[], packs: readonly ConversationPack[], query: string): LibraryPhrase[] {
  const sources = new Map<string, Pick<ConversationPack, 'id' | 'title'>>();
  for (const pack of orderedConversationPacks(packs)) {
    if (pack.state !== 'ready') continue;
    const phrases = [...pack.keyPhrases.map(item => item.fr), ...pack.corrections.map(item => item.better)];
    for (const phrase of phrases) if (!sources.has(phraseKeyOf(phrase))) sources.set(phraseKeyOf(phrase), { id: pack.id, title: pack.title });
  }
  return deck.filter(card => card.kind !== 'phoneme' && contains(`${card.front} ${card.back} ${card.context}`, query))
    .map(card => ({ card, source: sources.get(card.id) ?? null }));
}

export function conversationStateLine(pack: ConversationPack): string {
  switch (pack.state) {
    case 'ready': return practiceStatusOf(pack) === 'preparing' ? 'Your learning notes are being prepared' : 'Phrases and learning notes';
    case 'generating': return 'Your learning notes are being prepared';
    case 'failed': return 'Learning notes are not ready yet';
    case 'archived': return 'Archived conversation';
  }
}

/** Local development has no server cursor; it still pages its owned finite cache. */
export function localConversationPage(packs: readonly ConversationPack[], cursor: string | null, size: number): { packs: ConversationPack[]; nextCursor: string | null } {
  const offset = cursor !== null && /^local:\d+$/.test(cursor) ? Number(cursor.slice('local:'.length)) : 0;
  const from = Number.isSafeInteger(offset) && offset >= 0 ? offset : 0;
  const ordered = orderedConversationPacks(packs);
  const page = ordered.slice(from, from + size);
  return { packs: page, nextCursor: from + size < ordered.length ? `local:${from + size}` : null };
}
