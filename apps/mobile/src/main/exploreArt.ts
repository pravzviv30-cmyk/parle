/**
 * Which canvas drawing, which pastel and which badge each Explore and Scene
 * preview place takes (2026-10-20 UI-008, artboards B-Explore and
 * B-ScenePreview). Decided here so the screens are layout.
 *
 * Every name is a drawing in assets/b-art (art-names.json maps the canvas blob
 * ids to them) and every ground is a `useB()` pastel key, so both modes draw
 * from the same rule. Imports types only: testable without React Native.
 */

import type { BArtName } from '../art/BArt.tsx';
import type { BTokens } from '../palette.ts';
import type { ExploreTopic } from './exploreCatalogue.ts';

/** The four pastel tokens the artboards set under art. */
export type Pastel = keyof Pick<BTokens, 'peach' | 'lavender' | 'sage' | 'butter'>;

export interface TopicTile {
  art: BArtName;
  width: number;
  height: number;
  ground: Pastel;
  /** The soft floor ellipse under the drawing; the paper plane flies, so it has none. */
  ellipse: boolean;
  /** The drawing sits on the floor (margin-bottom) or floats centred (margin-top). */
  seat: { bottom: number } | { top: number };
  /** The artboard's short line under the title. */
  line: string;
}

/** The four "French for real life" tiles, exactly as drawn. */
export const TOPIC_TILES: Readonly<Partial<Record<ExploreTopic, TopicTile>>> = {
  food: { art: 'cafe-table', width: 148, height: 135, ground: 'peach', ellipse: true, seat: { bottom: -4 }, line: 'Order, ask, pay' },
  friends: { art: 'friends-cheer', width: 150, height: 137, ground: 'lavender', ellipse: true, seat: { bottom: -6 }, line: 'Meet, invite, catch up' },
  travel: { art: 'map-route', width: 146, height: 133, ground: 'sage', ellipse: true, seat: { bottom: -4 }, line: 'Trains, métro, directions' },
  work: { art: 'paper-plane', width: 156, height: 130, ground: 'butter', ellipse: false, seat: { top: 8 }, line: 'Introduce yourself, meetings' },
};

/**
 * The tile's circle and floor ellipse. The canvas draws them as lighter and
 * darker shades of each pastel; with no per-pastel shade token they are the
 * card white and the scrim over the pastel, at an opacity per mode, so dark
 * keeps a faint glow rather than a white disc.
 */
export function tileDecoration(mode: 'light' | 'dark'): { circle: number; ellipse: number } {
  return mode === 'dark' ? { circle: 0.06, ellipse: 0.28 } : { circle: 0.45, ellipse: 0.08 };
}

/** A situation row's 52pt tile: the small icon drawing on its topic's pastel. */
export function situationTile(topic: ExploreTopic | null): { art: BArtName; width: number; height: number; ground: Pastel } {
  switch (topic) {
    case 'food': case 'out': return { art: 'icon-cafe', width: 30, height: 28, ground: 'peach' };
    case 'travel': return { art: 'icon-suitcase', width: 24, height: 28, ground: 'sage' };
    case 'friends': case 'culture': return { art: 'icon-friends', width: 32, height: 26, ground: 'lavender' };
    case 'home': return { art: 'icon-house', width: 30, height: 28, ground: 'butter' };
    case 'work': case 'admin': case 'shops': case 'health': return { art: 'icon-briefcase', width: 30, height: 28, ground: 'butter' };
    default: return { art: 'icon-friends', width: 32, height: 26, ground: 'lavender' };
  }
}

/** "A little practice" cards: art, size, pastel and the artboard's line, by door. */
export const PRACTICE_CARDS: Readonly<Record<string, { art: BArtName; width: number; height: number; ground: Pastel; line: string }>> = {
  sound: { art: 'voice-chat', width: 104, height: 95, ground: 'lavender', line: 'One sound at a time' },
  'hear-and-practise': { art: 'cloud-heart', width: 110, height: 84, ground: 'peach', line: 'In your tutor’s voice' },
  'guided-situations': { art: 'watering-plant', width: 100, height: 91, ground: 'sage', line: 'Guided basics' },
  // Not on the artboard (it shows three of the four real doors); the nearest canvas drawing.
  'connect-your-ideas': { art: 'cloud-cheer', width: 104, height: 90, ground: 'butter', line: 'Join two thoughts' },
};

/** "Take the conversation further" rows, by collection id. */
export const FURTHER_TILES: Readonly<Record<string, { art: BArtName; width: number; height: number; ground: Pastel; line: string }>> = {
  'plans-change': { art: 'alarm-clock', width: 46, height: 42, ground: 'butter', line: 'Explain a delay, agree a new plan' },
  'tell-it-your-way': { art: 'phrasebook', width: 46, height: 42, ground: 'peach', line: 'Tell a story, disagree politely' },
  'find-your-words': { art: 'compass', width: 40, height: 40, ground: 'sage', line: 'Ask to repeat, get back on track' },
};

/**
 * The badge at the end of a "further" row, from the access note
 * (`collectionAccessNote` over `purchases/exploreAccess` labels): any free
 * sample is the lavender words pill, saying what is true; a collection that
 * is plan-only is the round lock; a covered plan shows nothing.
 */
export function furtherBadge(note: string | null): { kind: 'pill'; label: string } | { kind: 'lock' } | null {
  if (note === null) return null;
  if (note === 'Included with a plan') return { kind: 'lock' };
  return { kind: 'pill', label: note };
}

/**
 * The meta line split for the artboard's accent: "free sample" is set in the
 * mint words at 700; every other part stays in the muted 13. Commas, not
 * middots (Phase B copy).
 */
export function metaParts(meta: string): { plain: string; accent: string | null } {
  const tail = ', free sample';
  return meta.endsWith(tail) ? { plain: meta.slice(0, -tail.length + 2), accent: 'free sample' } : { plain: meta, accent: null };
}

/** The scene band's drawing: the scene's topic drawing where the canvas has one, else the café table. */
export function sceneArt(topic: ExploreTopic | null | undefined): BArtName {
  const tile = topic ? TOPIC_TILES[topic] : undefined;
  return tile?.art ?? 'cafe-table';
}
