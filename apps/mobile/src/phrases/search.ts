import type { Phrasebook } from './phrasebook.ts';
const normalized = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[‘’]/g, "'").toLocaleLowerCase('en-GB').trim();
/** Local-only retrieval. Filtering never changes recall evidence or stored phrases. */
export function searchPhrases(book: Phrasebook, query: string): Phrasebook {
  const words = normalized(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return book;
  const matches = (phrase: { front: string; back: string }) => words.every(word => normalized(`${phrase.front} ${phrase.back}`).includes(word));
  return { ...book, groups: book.groups.map(group => ({ ...group, phrases: group.phrases.filter(matches) })).filter(group => group.phrases.length > 0), saved: book.saved.filter(matches) };
}
export function needsPhraseSearch(book: Phrasebook): boolean {
  return book.groups.reduce((n, group) => n + group.phrases.length, 0) + book.saved.length >= 12;
}
