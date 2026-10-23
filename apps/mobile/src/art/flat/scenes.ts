/**
 * Which flat drawing belongs to which scene.
 *
 * The registry (`index.ts`, generated) says what exists; this says who draws
 * it, so a screen never spells a drawing's name for a scene and a drawing can
 * be swapped by editing one line here.
 *
 * By mission rather than by place, unlike the watercolours it replaces: the
 * café has two scenes (the first coffee at the counter and the terrace round
 * the corner) and ILLUSTRATIONS.md draws each. A mission added to the
 * catalogue is a compile error on the `Record` until somebody names its
 * drawing.
 *
 * This file imports types only, so node can load it: `index.ts` imports the
 * drawings, which are react-native-svg components node cannot run.
 */

import type { MissionId } from '@luvani/core';

import type { IllustrationName } from './index.ts';

/** The place drawing behind each scene. */
export const SCENE_ILLUSTRATION: Record<MissionId, IllustrationName> = {
  'mission:premier-cafe': 'place-cafe-counter',
  'mission:cafe': 'place-cafe-terrace',
  'mission:hotel': 'place-hotel',
  'mission:marche': 'place-market',
  'mission:chemin': 'place-directions',
  'mission:journee': 'place-day',
  'mission:amis': 'place-apero',
  'mission:restaurant': 'place-restaurant',
  'mission:pharmacie': 'place-pharmacy',
  'mission:gare': 'place-station',
  'mission:colis': 'place-parcel',
  'mission:voisin': 'place-neighbour',
  'mission:week-end': 'place-weekend',
  'mission:collegues': 'place-workplace',
  'mission:telephone': 'place-phone',
  'mission:medecin': 'place-doctor',
  'mission:retour': 'place-shop-return',
  'mission:appartement': 'place-flat',
  'mission:belle-famille': 'place-family-dinner',
  'mission:club': 'place-club',
  'mission:banque': 'place-bank',
  'mission:sortie': 'place-plans',
  'mission:montreal': 'place-montreal-coat',
  'mission:coup-de-main': 'place-office-help',
  'mission:anniversaire': 'place-birthday',
  'mission:fuite': 'place-leak',
  'mission:galere': 'place-story',
  'mission:avis': 'place-film-talk',
  'mission:entretien': 'place-interview',
  'mission:teletravail': 'place-remote-work',
  'mission:souvenirs': 'place-grandmother',
};

/** The drawing for one scene. Total, because the parameter is the closed union. */
export function sceneIllustration(id: MissionId): IllustrationName {
  return SCENE_ILLUSTRATION[id];
}
