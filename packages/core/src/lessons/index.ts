import { CAFE_LESSON } from './cafe.ts';
import type { Lesson } from './types.ts';

export { CAFE_LESSON } from './cafe.ts';
export {
  GUEST_SCENE,
  GUEST_SCENE_TURN_IDS,
  GUEST_SCENE_MAX_SECONDS,
  GUEST_CAFE_SCENE,
  isGuestScene,
  isGuestSceneTurnId,
  parseGuestSceneTurnIds,
  guestScenePhrases,
  type GuestScene,
  type GuestSceneTurnId,
} from './guestCafe.ts';
export {
  phonemeCoverage,
  normalise,
  isAcceptable,
  matchAcceptable,
  type AcceptanceMatch,
  type AcceptanceRoute,
  type Lesson,
  type LessonTurn,
  type TurnOption,
  type CefrLevel,
} from './types.ts';

export const LESSONS: readonly Lesson[] = [CAFE_LESSON];

const BY_ID = new Map(LESSONS.map((l) => [l.id, l]));

export function getLesson(id: string): Lesson | undefined {
  return BY_ID.get(id);
}
