import type { LibraryFilter } from './libraryView.ts';

export interface LibraryPlace { filter: LibraryFilter; query: string; limit: number }
const FIRST: LibraryPlace = { filter: 'saved', query: '', limit: 12 };
let held: { scope: number; place: LibraryPlace } | null = null;

/** Restore only this account's browsing place when practice pops the route. */
export function libraryPlace(scope: number): LibraryPlace {
  return held?.scope === scope ? { ...held.place } : { ...FIRST };
}

export function rememberLibraryPlace(scope: number, place: LibraryPlace): void {
  held = { scope, place: { ...place } };
}

export function pageItems<T>(items: readonly T[], limit: number): readonly T[] {
  const end = Math.max(12, limit);
  return items.slice(Math.max(0, end - 12), end);
}
