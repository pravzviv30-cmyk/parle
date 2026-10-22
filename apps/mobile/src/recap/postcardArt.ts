import type { MissionId } from '@luvani/core';
import type { IllustrationName } from '../art/flat/index.ts';
const POSTCARD: Record<MissionId, IllustrationName> = {
  'mission:premier-cafe': 'postcard-cafe-counter',
  'mission:cafe': 'postcard-cafe-terrace',
  'mission:hotel': 'postcard-hotel',
  'mission:marche': 'postcard-market',
  'mission:chemin': 'postcard-directions',
  'mission:journee': 'postcard-day',
  'mission:amis': 'postcard-apero',
  // Placeholders by place until each scene has its own postcard drawn.
  'mission:pharmacie': 'postcard-directions',
  'mission:gare': 'postcard-directions',
  'mission:medecin': 'postcard-directions',
  'mission:voisin': 'postcard-day',
  'mission:collegues': 'postcard-day',
  'mission:telephone': 'postcard-day',
  'mission:appartement': 'postcard-day',
  'mission:colis': 'postcard-market',
  'mission:retour': 'postcard-market',
  'mission:restaurant': 'postcard-cafe-terrace',
  'mission:week-end': 'postcard-apero',
  'mission:belle-famille': 'postcard-apero',
};
export function postcardIllustration(id: MissionId): IllustrationName { return POSTCARD[id]; }
