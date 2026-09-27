/**
 * What the daily collection says and shows, out of the screen — Stage 3.
 *
 * The Saved tab used to open on the catalogue's size, "1,000 words and 1,000
 * phrases", above an empty list and a line sending the learner back to Home.
 * A learner cannot do anything with the size of a catalogue. So:
 *
 * - an empty Saved tab leads with a few starters, each one a real card that can
 *   be heard and saved right here;
 * - the size line moves to the Words and Phrases tabs, where it describes the
 *   thing being browsed, and its numbers are counted rather than typed;
 * - every card says whether it has tutor audio before anybody taps, from the
 *   same manifest lookup that decides whether Hear is drawn at all.
 *
 * Pure functions and constants only, so `libraryView.test.ts` can ask them.
 */

import { DAILY_PHRASES } from '@luvani/core';

import { DAILY_ITEMS, type DailyItem } from './catalogue.ts';
import { VOICED_PHRASE_IDS } from './voicedSelection.ts';

export type LibraryFilter = 'saved' | 'words' | 'phrases';

/** What sits above the list: starters, the catalogue's size, or nothing. */
export type LibraryLead = 'starter' | 'inventory' | 'none';

export const SEARCH_PLACEHOLDER = 'Search French or English';
export const STARTER_TITLE = 'A few to start with';
export const STARTER_NOTE = 'Hear one, then save it. Saved items gather here.';
export const NO_MATCH = 'Nothing matches that search yet. Try a shorter word, in French or English.';

/** Said on a card whose line has a bundled recording in the chosen tutor's voice. */
export const AUDIO_YES = 'Tutor audio included.';
/**
 * Said on a card with no recording. It says what is true and what still works,
 * and promises nothing about a future pack nobody has recorded.
 */
export const AUDIO_NO = 'Text only. You can still say it and record yourself.';

/** How many starters an empty Saved tab offers. A handful, not a list. */
const STARTERS = 3;

/** One line, and the only place on the screen with numbers, all counted. */
export function inventoryLine(voicedWords: number, voicedPhrases: number): string {
  const words = DAILY_ITEMS.filter((item) => item.id.startsWith('word:')).length;
  const phrases = DAILY_ITEMS.filter((item) => item.id.startsWith('phrase:')).length;
  return `${words.toLocaleString('en-GB')} words and ${phrases.toLocaleString('en-GB')} phrases. Tutor audio is included for ${voicedWords} words and ${voicedPhrases} phrases.`;
}

/** Which lead to draw. Starters only on an empty, unsearched Saved tab. */
export function libraryLead(filter: LibraryFilter, savedCount: number, query: string): LibraryLead {
  if (filter !== 'saved') return 'inventory';
  return savedCount === 0 && query.trim() === '' ? 'starter' : 'none';
}

/** The items a tab shows, searched across French and English. */
export function libraryItems(filter: LibraryFilter, saved: ReadonlySet<string>, query: string): DailyItem[] {
  const needle = query.trim().toLocaleLowerCase();
  return DAILY_ITEMS.filter((item) => {
    const inTab = filter === 'saved' ? saved.has(item.id) : filter === 'words' ? item.id.startsWith('word:') : item.id.startsWith('phrase:');
    return inTab && (needle === '' || `${item.fr} ${item.en}`.toLocaleLowerCase().includes(needle));
  });
}

/**
 * A small, stable set of first-tier phrases that all have tutor audio, so the
 * first thing a learner meets here can be heard in their tutor's voice.
 * Deterministic: the same three on every visit, in authored order.
 */
export function starterItems(): DailyItem[] {
  const voiced = new Set(VOICED_PHRASE_IDS);
  const easy = new Set(DAILY_PHRASES.filter((p) => p.tier === 1 && voiced.has(p.id)).map((p) => p.id));
  return DAILY_ITEMS.filter((item) => easy.has(item.id)).slice(0, STARTERS);
}

/** Whether a card has tutor audio, said before it is tapped. */
export function audioLine(hasAudio: boolean): string {
  return hasAudio ? AUDIO_YES : AUDIO_NO;
}

/** Every fixed line this screen and its cards say, for the copy scans. */
export const LIBRARY_COPY: readonly string[] = [SEARCH_PLACEHOLDER, STARTER_TITLE, STARTER_NOTE, NO_MATCH, AUDIO_YES, AUDIO_NO];
