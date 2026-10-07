/**
 * The confetti, still: the flat `celebrate-confetti` drawing laid over the top
 * of a celebration's stage.
 *
 * It is the final frame of a `Burst` where the burst itself cannot be the final
 * frame: under reduced motion, where a burst draws nothing at all, and on the
 * web once the burst has fallen (motion-sound review finding 1). It is also the
 * one place the catalogue's confetti drawing is drawn, so the pinned 29 flat
 * drawings all still reach a screen (J14, F599).
 *
 * Decorative and untouchable: the words of the moment say what happened.
 */

import { StyleSheet, View } from 'react-native';

import { Illustration } from '../art/flat/Illustration.tsx';
import { decorative } from '../theme.ts';

export function ConfettiStill() {
  return (
    <View {...decorative} style={st.layer}>
      <Illustration name="celebrate-confetti" style={st.art} />
    </View>
  );
}

const st = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFill, alignItems: 'center', pointerEvents: 'none' },
  // The drawing scales to the stage it sits on, keeping its own proportions.
  art: { width: '100%', height: '100%' },
});
