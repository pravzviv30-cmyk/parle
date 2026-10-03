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
};
export function postcardIllustration(id: MissionId): IllustrationName { return POSTCARD[id]; }
