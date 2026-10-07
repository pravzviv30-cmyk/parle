/**
 * The beats of every celebration, as data (come alive, motion-sound sections 5
 * and 7, with README Part 5.A's master sound and haptic table).
 *
 * Each template reads its timings from here (`beatAt`), and the frame fires the
 * sounds and haptics from here (`beatEffects`), so the beats a test checks are
 * the beats that play. Pure: no React, no engine; the durations and curves are
 * token names from `motion/tokens.ts`, never numbers of their own.
 *
 * The rules a timeline keeps (`timelines.test.ts`):
 * - its last beat ends by `CELEBRATION_MAX_MS`;
 * - every sound is one of the twelve the founder approved (D18);
 * - nothing sounds or is felt while a microphone or a live room holds the audio
 *   focus (D8): the queue holds the moment, and a beat asked anyway answers
 *   nothing;
 * - under reduced motion the final frame shows at once, and its one sound and
 *   one haptic still play once at t = 0, because they are not motion.
 */

import type { SfxId } from '../sound/sfxIds.ts';
import { DUR, EASE, SPRING, SPRING_SHAPE } from '../motion/tokens.ts';

/** The haptics a beat may ask for, by their names in `motion/haptics.ts`. */
export type HapticCue = 'tick' | 'thump' | 'arrived' | 'celebrate';

export type DurName = keyof typeof DUR;
export type EaseName = keyof typeof EASE;
export type SpringName = keyof typeof SPRING;

/** How a beat moves: a timed travel on a token curve, a token spring, or no movement (a sound or a haptic alone). */
export type BeatMotion =
  | { readonly kind: 'timing'; readonly duration: DurName; readonly ease: EaseName }
  | { readonly kind: 'spring'; readonly spring: SpringName }
  | { readonly kind: 'cue' };

export interface Beat {
  /** When it starts, in ms from the card's first frame. */
  readonly t: number;
  /** The part that moves, by the name its template asks `beatAt` for. */
  readonly element: string;
  /** What moves, in words. Transform and opacity only. */
  readonly transform: string;
  readonly motion: BeatMotion;
  readonly sound?: SfxId;
  readonly haptic?: HapticCue;
}

export type TimelineId =
  | 'purchase-confirmed'
  | 'streak-milestone'
  | 'streak-extended'
  | 'level-up'
  | 'badge-earned'
  | 'end-card'
  | 'end-card-quests'
  | 'toast'
  | 'recap-result'
  | 'postcard-first'
  | 'postcard-again';

export interface Timeline {
  readonly id: TimelineId;
  readonly beats: readonly Beat[];
  /** The card is at its final frame from here. */
  readonly end: number;
  /** The one sound and the one haptic that play at t = 0 when movement is reduced. */
  readonly still: { readonly sound: SfxId | null; readonly haptic: HapticCue | null };
}

const timing = (duration: DurName, ease: EaseName = 'out'): BeatMotion => ({ kind: 'timing', duration, ease });
const springOf = (spring: SpringName): BeatMotion => ({ kind: 'spring', spring });
const cue: BeatMotion = { kind: 'cue' };

/**
 * How long a token spring takes to settle within 2 percent of rest: four time
 * constants, 4 / (ratio * 2 * PI / response), read from the spring's own
 * description so no number is written twice.
 */
export function springSettleMs(name: SpringName): number {
  const { response, ratio } = SPRING_SHAPE[name];
  return Math.ceil((4 * 1000) / ((ratio * 2 * Math.PI) / response));
}

/** How long a beat moves for, in ms. A cue does not move. */
export function beatSpan(beat: Beat): number {
  if (beat.motion.kind === 'timing') return DUR[beat.motion.duration];
  if (beat.motion.kind === 'spring') return springSettleMs(beat.motion.spring);
  return 0;
}

/** The end card's beats, shared by both of its timelines. */
const END_CARD_BEATS: readonly Beat[] = [
  { t: 120, element: 'burst', transform: 'Burst of 36 from the top of the card', motion: timing('burst', 'linear'), sound: 'complete', haptic: 'celebrate' },
  { t: 200, element: 'line', transform: 'translateY 10 to 0', motion: timing('base') },
  { t: 420, element: 'tiles', transform: 'StaggerIn by STAGGER.tiles, each number counting up', motion: timing('count') },
  { t: 1300, element: 'goal', transform: 'the goal ring draws from before to now', motion: timing('reveal', 'inOut') },
  { t: 1500, element: 'rows', transform: 'StaggerIn, translateY 10 to 0', motion: timing('base') },
];

export const TIMELINES: Readonly<Record<TimelineId, Timeline>> = {
  // 5.3, on paper: the flame lights, its sparks rise, the run arrives.
  'streak-extended': {
    id: 'streak-extended',
    beats: [
      { t: 0, element: 'flame', transform: 'lights from an ember, scale 0 to 1.15 to 1', motion: springOf('pop'), sound: 'streak', haptic: 'thump' },
      { t: 160, element: 'sparks', transform: 'Burst of 12, sun and coral, rising', motion: timing('burst', 'linear') },
      { t: 420, element: 'number', transform: 'the run rises in, translateY 24 to 0', motion: timing('base'), haptic: 'arrived' },
      { t: 520, element: 'label', transform: 'day streak fades in', motion: timing('base') },
      { t: 900, element: 'lines', transform: 'StaggerIn, translateY 10 to 0', motion: timing('base') },
    ],
    end: 1600,
    still: { sound: 'streak', haptic: 'thump' },
  },
  // 5.4, on coral: the flame lights, a white ring closes round it, the milestone lands.
  'streak-milestone': {
    id: 'streak-milestone',
    beats: [
      { t: 0, element: 'flame', transform: 'lights from an ember, scale 0 to 1.15 to 1', motion: springOf('pop'), sound: 'streak', haptic: 'thump' },
      { t: 500, element: 'ring', transform: 'a white ring draws 0 to 1 by its dash offset', motion: timing('reveal', 'inOut') },
      { t: 1150, element: 'bloom', transform: 'DiscBloom in sun, scale 0.3 to 1', motion: timing('slow') },
      { t: 1150, element: 'burst', transform: 'Burst of 48 on coral', motion: timing('burst', 'linear'), sound: 'badge', haptic: 'celebrate' },
      { t: 1150, element: 'number', transform: 'the milestone rises in, translateY 24 to 0', motion: timing('base') },
      { t: 1350, element: 'lines', transform: 'StaggerIn, translateY 10 to 0', motion: timing('base') },
    ],
    end: 2600,
    still: { sound: 'streak', haptic: 'celebrate' },
  },
  // 5.7, on blue: the crest rises, the level number changes. A number, never a name.
  'level-up': {
    id: 'level-up',
    beats: [
      { t: 0, element: 'crest', transform: 'scale 0.4 to 1', motion: timing('settle') },
      { t: 0, element: 'bloom', transform: 'DiscBloom in sun, held at rest', motion: timing('slow') },
      { t: 200, element: 'chime', transform: 'nothing moves', motion: cue, sound: 'levelup', haptic: 'celebrate' },
      { t: 600, element: 'title', transform: 'the old level rises out, the new one rises in', motion: timing('base') },
      { t: 600, element: 'burst', transform: 'Burst of 48 on blue', motion: timing('burst', 'linear') },
      { t: 900, element: 'lines', transform: 'StaggerIn, translateY 10 to 0', motion: timing('base') },
    ],
    end: 2400,
    still: { sound: 'levelup', haptic: 'celebrate' },
  },
  // 5.8, on paper: up to three medals drop in together.
  'badge-earned': {
    id: 'badge-earned',
    beats: [
      { t: 0, element: 'medal', transform: 'drops in, translateY -60 to 0', motion: timing('settle') },
      { t: 350, element: 'chime', transform: 'nothing moves', motion: cue, sound: 'badge', haptic: 'arrived' },
      { t: 500, element: 'bloom', transform: 'DiscBloom in sun, scale 0.3 to 1', motion: timing('slow') },
      { t: 600, element: 'lines', transform: 'StaggerIn, translateY 10 to 0', motion: timing('base') },
    ],
    end: 1800,
    still: { sound: 'badge', haptic: 'arrived' },
  },
  // 5.9, on mint, only after a confirmed entitlement: the lock opens, confetti.
  'purchase-confirmed': {
    id: 'purchase-confirmed',
    beats: [
      { t: 0, element: 'ground', transform: 'mint fades in', motion: timing('fast') },
      { t: 200, element: 'lock', transform: 'the lock opens', motion: springOf('snap') },
      { t: 200, element: 'burst', transform: 'Burst of 36, blue, sun and white', motion: timing('burst', 'linear'), sound: 'complete', haptic: 'celebrate' },
      { t: 400, element: 'lines', transform: 'StaggerIn, translateY 10 to 0', motion: timing('base') },
    ],
    end: 1800,
    still: { sound: 'complete', haptic: 'celebrate' },
  },
  // 5.2 as the in-place end card (README Part 6): mint, tiles counting up, the goal ring, quest rows.
  'end-card': {
    id: 'end-card',
    beats: END_CARD_BEATS,
    end: 2400,
    still: { sound: 'complete', haptic: 'celebrate' },
  },
  // The same end card on the sitting that finished the day's third quest (D22): as
  // the quest rows come in, "All three quests done today." lands with the quest
  // sound. One quiet line, never a takeover. Shown still, its one sound is the
  // quest sound D22 pairs with the line, with the end card's own haptic.
  'end-card-quests': {
    id: 'end-card-quests',
    beats: [...END_CARD_BEATS, { t: 1500, element: 'quests', transform: 'nothing moves', motion: cue, sound: 'quest' }],
    end: 2400,
    still: { sound: 'quest', haptic: 'celebrate' },
  },
  // A saved phrase: a small confirmation that comes and goes on its own and blocks nothing.
  toast: {
    id: 'toast',
    beats: [
      { t: 0, element: 'toast', transform: 'drops in, translateY -10 to 0', motion: timing('base'), sound: 'save', haptic: 'arrived' },
      { t: 1900, element: 'leave', transform: 'fades out', motion: timing('micro') },
    ],
    end: 2020,
    still: { sound: 'save', haptic: 'arrived' },
  },
  // Core loop 2.9, the conversation's recap on coral, once the room has let go
  // of the learner's ears (F763): a sun glow opens, the fanfare the room held
  // back, confetti only for a scene finished on the learner's own, and the
  // progress strip counting in.
  'recap-result': {
    id: 'recap-result',
    beats: [
      { t: 0, element: 'bloom', transform: 'DiscBloom in sun, scale 0.3 to 1, then fades', motion: timing('slow') },
      { t: 120, element: 'chime', transform: 'nothing moves', motion: cue, sound: 'complete', haptic: 'celebrate' },
      { t: 300, element: 'burst', transform: 'Burst of 32 from the scene, only when it was earned on your own', motion: timing('burst', 'linear') },
      { t: 420, element: 'strip', transform: 'the progress strip rises in, translateY 10 to 0, its numbers counting up', motion: timing('count') },
    ],
    end: 1800,
    still: { sound: 'complete', haptic: 'celebrate' },
  },
  // Core loop 2.9, a postcard stamped for the first independent finish of a
  // scene: the card drops in, the ink stamp slams on, confetti.
  'postcard-first': {
    id: 'postcard-first',
    beats: [
      { t: 0, element: 'card', transform: 'the postcard drops in, rotate -8 to -3 degrees, scale 1.3 to 1', motion: springOf('snap') },
      { t: 260, element: 'stamp', transform: 'the ink stamp slams in, scale 1.6 to 1, opacity 0 to 1', motion: timing('fast'), sound: 'badge', haptic: 'celebrate' },
      { t: 380, element: 'burst', transform: 'Burst of 32 from the stamp', motion: timing('burst', 'linear') },
    ],
    end: 1800,
    still: { sound: 'badge', haptic: 'celebrate' },
  },
  // The same for a scene finished on the learner's own again: a lighter sound,
  // one success, half the confetti.
  'postcard-again': {
    id: 'postcard-again',
    beats: [
      { t: 0, element: 'card', transform: 'the postcard drops in, rotate -8 to -3 degrees, scale 1.3 to 1', motion: springOf('snap') },
      { t: 260, element: 'stamp', transform: 'the ink stamp slams in, scale 1.6 to 1, opacity 0 to 1', motion: timing('fast'), sound: 'correct', haptic: 'arrived' },
      { t: 380, element: 'burst', transform: 'Burst of 16 from the stamp', motion: timing('burst', 'linear') },
    ],
    end: 1800,
    still: { sound: 'correct', haptic: 'arrived' },
  },
};

/** When an element's beat starts. Every element a template asks for is in its timeline (`timelines.test.ts`). */
export function beatAt(timeline: Timeline, element: string): number {
  const beat = timeline.beats.find((b) => b.element === element);
  if (beat === undefined) throw new Error(`${timeline.id} has no ${element} beat`);
  return beat.t;
}

/** Every moment the clock has to stop at, in order: each beat's start and the end. */
export function beatTimes(timeline: Timeline): number[] {
  return [...new Set([...timeline.beats.map((b) => b.t), timeline.end])].sort((a, b) => a - b);
}

/** Who holds the learner's ears right now (`sound/audioFocus.ts`). */
export interface FocusNow {
  readonly micLive: boolean;
  readonly liveRoom: boolean;
}

export interface Effects {
  readonly sound: SfxId | null;
  readonly haptic: HapticCue | null;
}

const NOTHING: Effects = { sound: null, haptic: null };

/** What a beat sounds and how it is felt now. Nothing at all while a microphone or a live room is open. */
export function beatEffects(beat: Beat, focus: FocusNow): Effects {
  if (focus.micLive || focus.liveRoom) return NOTHING;
  return { sound: beat.sound ?? null, haptic: beat.haptic ?? null };
}

/**
 * Whether a card drawn final before its clock ever ran plays its one still
 * sound and haptic. Only when it is still because movement is reduced: a card
 * that a hold (a sheet, the app leaving the screen) or a skip landed before it
 * started stays silent, because a hold and a skip both ask for quiet.
 */
export function playsStill(card: { readonly reduced: boolean; readonly stopped: boolean }): boolean {
  return card.reduced && !card.stopped;
}

/** The one sound and haptic of a card shown still, under reduced motion. Nothing while a microphone or a live room is open. */
export function stillEffects(timeline: Timeline, focus: FocusNow): Effects {
  if (focus.micLive || focus.liveRoom) return NOTHING;
  return timeline.still;
}
