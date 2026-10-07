/**
 * The scene's place drawing on Home's brief (F767; retention spec 1.4).
 *
 * The flat drawing the scene map names for this scene (`art/flat/scenes.ts`),
 * at the catalogue's small size, arriving once with the brief through the
 * shared stagger, which lands on its final frame under Reduce Motion.
 * Decorative and never pressable: the words on the brief say which scene it
 * is, and the Start is the brief's one target.
 */

import { StyleSheet, View } from 'react-native';
import type { MissionId } from '@luvani/core';

import { Illustration } from '../art/flat/Illustration.tsx';
import { sceneIllustration } from '../art/flat/scenes.ts';
import { StaggerIn } from '../motion/StaggerIn.tsx';
import { decorative } from '../theme.ts';

export function SceneArt({ mission }: { mission: MissionId }) {
  return (
    <View {...decorative} style={st.art}>
      <StaggerIn from="up">
        <Illustration name={sceneIllustration(mission)} fit="small" />
      </StaggerIn>
    </View>
  );
}

const st = StyleSheet.create({
  art: { alignItems: 'center', pointerEvents: 'none' },
});
