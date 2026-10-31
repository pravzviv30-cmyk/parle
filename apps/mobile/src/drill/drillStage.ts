/**
 * Which stage a drill or practice surface stands on (drill B v2, UI-016).
 *
 * Every practice surface shares one frame (`drill/DrillFrame.tsx`). The kind
 * decides only two things about it: the family, which sets the stage band's
 * colour, and the answer control. This module answers the first, as token names
 * of `useB()` rather than hexes, so the colours stay in `palette.ts`.
 *
 * Families: Choose (lavender), Build (butter), Write (sage), Speak (peach),
 * and Review (butter). A Fixes surface takes the family of its answer: say it
 * is Speak, type it is Write.
 *
 * The eyebrow is `link` on every band but one: the dark link on the dark
 * butter is 4.4:1, under the floor for words, so that one pairing takes
 * `text` (drill-b.md, risk 4; drillStage.test.ts measures every pairing).
 *
 * Pure: imports nothing that draws.
 */
import type { DrillExercise } from '@luvani/core';

/** A drill exercise kind, as core defines it. */
export type DrillExerciseKind = DrillExercise['kind'];

/** Every surface that stands on a stage: the eight kinds and the practice surfaces around them. */
export type StageSurface = DrillExerciseKind | 'review' | 'sound-drill' | 'sound-check' | 'fixes-say' | 'fixes-type';

export type StageFamily = 'choose' | 'build' | 'write' | 'speak' | 'review';
export type StageBand = 'lavender' | 'butter' | 'sage' | 'peach';
export type StageEyebrow = 'link' | 'text';

export interface DrillStage {
  family: StageFamily;
  /** The stage band's ground: a `useB()` token name. */
  band: StageBand;
  /** The eyebrow's colour: a `useB()` token name. */
  eyebrow: StageEyebrow;
}

const BAND: Readonly<Record<StageFamily, StageBand>> = {
  choose: 'lavender',
  build: 'butter',
  write: 'sage',
  speak: 'peach',
  review: 'butter',
};

/** The family a surface belongs to. Exhaustive: a new kind fails to compile here. */
export function stageFamily(surface: StageSurface): StageFamily {
  switch (surface) {
    case 'best-sentence':
    case 'appropriate-reply':
      return 'choose';
    case 'fill-blank':
    case 'tap-translate':
      return 'build';
    case 'translate':
    case 'listen-type':
    case 'fixes-type':
      return 'write';
    case 'repeat-this':
    case 'own-words':
    case 'sound-drill':
    case 'sound-check':
    case 'fixes-say':
      return 'speak';
    case 'review':
      return 'review';
    default: {
      const never: never = surface;
      throw new Error(`no stage for ${String(never)}`);
    }
  }
}

export function drillStage(surface: StageSurface, mode: 'light' | 'dark'): DrillStage {
  const family = stageFamily(surface);
  const band = BAND[family];
  return { family, band, eyebrow: mode === 'dark' && band === 'butter' ? 'text' : 'link' };
}
