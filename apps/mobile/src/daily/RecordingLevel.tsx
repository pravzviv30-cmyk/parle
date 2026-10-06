/**
 * The daily take, heard: a microphone disc with the shared `LevelRing`
 * swelling around it from the recorder's real level (come alive, core loop
 * 3.6). Drawn only while a take is recording and only once the recorder has
 * reported a level, so it never shows a voice nobody heard.
 *
 * Decorative: the note beside it already says a take is recording, and the
 * record pill says how to stop it. Under reduced motion the ring shows its
 * three opacity steps and no scale (`motion/LevelRing.tsx`).
 */

import { StyleSheet, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

import { Icon } from '../icons/Icon.tsx';
import { LevelRing } from '../motion/LevelRing.tsx';
import { colour, decorative, paper } from '../theme.ts';

/** The disc, at the touch floor's size, though it is not a control. */
const DISC = 44;

export function RecordingLevel({ level }: { level: SharedValue<number> }) {
  return (
    <View {...decorative} style={st.box}>
      <LevelRing level={level} size={DISC} color={colour.mint} />
      <View style={st.disc}>
        <Icon name="microphone" size={20} color={paper.ink} />
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  box: { width: DISC, height: DISC, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  disc: {
    position: 'absolute',
    width: DISC,
    height: DISC,
    borderRadius: DISC / 2,
    backgroundColor: colour.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
