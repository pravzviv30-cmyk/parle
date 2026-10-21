/**
 * The plan's "Your first three scenes" rows (DECISIONS.md UI-008, 2026-10-21,
 * artboard B-OB-Plan). Each row's title, line and tile drawing come from the
 * same scene, so a row can never pair one scene's name with another's goal
 * (simulator check, 2026-10-21). Every tile carries a drawing: the scene's
 * place picks it, falling back to the café.
 */
import type { MissionPlace } from '@luvani/core';
import type { BArtName } from '../art/BArt.tsx';
import type { PlanView } from './plan.ts';

const PLACE_ART: Readonly<Record<MissionPlace, BArtName>> = {
  cafe: 'icon-cafe',
  market: 'icon-cafe',
  hotel: 'icon-suitcase',
  street: 'icon-suitcase',
  friends: 'icon-friends',
  home: 'icon-house',
};

export function sceneIcon(place: MissionPlace | string | undefined): BArtName {
  return PLACE_ART[place as MissionPlace] ?? 'icon-cafe';
}

export interface PlanSceneRow { id: string; title: string; line: string; icon: BArtName }

/** `line` is the scene's own can-do, made one finished sentence. */
export function planSceneRows(scenes: PlanView['scenes'], sentence: (canDo: string) => string): PlanSceneRow[] {
  return scenes.map(scene => ({ id: scene.id, title: scene.titleFr, line: sentence(scene.canDoEn), icon: sceneIcon(scene.place) }));
}
