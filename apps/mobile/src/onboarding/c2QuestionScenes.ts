import type { C2SceneDefinition } from '../art/flat/c2SceneAssets.ts';

export type C2QuestionPage = 'reason' | 'interests' | 'start-level' | 'confidence' | 'focus' | 'time';

/** Fixed source coordinates keep semantic gesture groups aligned with the scene float. */
export const C2_QUESTION_SCENE: C2SceneDefinition = {
  width: 280, height: 180, bob: -2.4, layers: [],
};
