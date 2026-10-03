export type RecapPage = 'result' | 'lines' | 'sound' | 'ability' | 'next';

/** Page identity is stable when owned evidence arrives after the cover. */
export function recapPages(content: {
  lines: boolean;
  phrase: boolean;
  repair: boolean;
  sound: boolean;
  ability: boolean;
  next: boolean;
}): readonly RecapPage[] {
  const pages: RecapPage[] = ['result'];
  if (content.lines || content.phrase || content.repair) pages.push('lines');
  if (content.sound) pages.push('sound');
  if (content.ability) pages.push('ability');
  if (content.next) pages.push('next');
  return pages;
}

export function adjacentRecapPage(pages: readonly RecapPage[], current: RecapPage, direction: -1 | 1): RecapPage | null {
  const index = pages.indexOf(current);
  return index < 0 ? null : pages[index + direction] ?? null;
}
