/**
 * The game art (come alive D10): flat vectors built in code from `shapes.ts`.
 * Screens and celebrations draw these components; nothing else draws a flame,
 * a chest, a medal, a crest, a freeze or a repair.
 *
 * Kept apart from the flat illustration registry in `art/flat/`, whose 29
 * drawings are generated from ILLUSTRATIONS.md and pinned.
 */

export { Flame, type FlameProps } from './Flame.tsx';
export { Chest, type ChestProps } from './Chest.tsx';
export { Medal, type MedalProps } from './Medal.tsx';
export { Crest, type CrestProps } from './Crest.tsx';
export { FreezeMark, type FreezeMarkProps } from './FreezeMark.tsx';
export { RepairMark, type RepairMarkProps } from './RepairMark.tsx';
export type { ArtGround, FlameState, FreezeState, MedalState } from './shapes.ts';
