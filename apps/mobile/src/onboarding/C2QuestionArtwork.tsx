import { memo, useCallback } from 'react';
import type { SharedValue } from 'react-native-reanimated';
import { c } from './boldRhythm.ts';
import { C2_QUESTION_SCENE, type C2QuestionPage } from './c2QuestionScenes.ts';
import { createC2QuestionGestureDrawings } from './c2QuestionDrawings.ts';
import { C2Artwork, C2VectorPart } from './motion/C2Scene.tsx';

// Palette and drawings stay fixed; selecting an answer does not recreate the art.
const drawings = createC2QuestionGestureDrawings(c);

export const C2QuestionArtwork = memo(function C2QuestionArtwork({ page, width, active = true }: { page: C2QuestionPage; width: number; active?: boolean }) {
  const renderVectors = useCallback((phase: SharedValue<number>) => drawings[page].map(part =>
    <C2VectorPart key={part.id} part={part} phase={phase} width={C2_QUESTION_SCENE.width} height={C2_QUESTION_SCENE.height} />
  ), [page]);
  return <C2Artwork key={page} scene={C2_QUESTION_SCENE} width={width} active={active} renderVectors={renderVectors} />;
});
