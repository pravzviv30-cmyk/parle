/**
 * Where the learner is in a sitting, as a bar that only fills (README Part 5.E
 * "LivingBar in sittings (position only, no digits) + combo glow").
 *
 * The fill is the share of the sitting's phrases already settled
 * (`practice/sittingProgress.ts`), drawn by the shared `LivingBar`, which
 * springs to it from the left. It carries no number, no "of" and no
 * percentage: a number mid-sitting is the first thing that reads as a score.
 * The bar itself is decorative, because the header's words already say where
 * the learner is to a screen reader.
 *
 * A run of real passes (`drill/combo.ts`) lights a sun halo behind the bar: a
 * flat layer at a low opacity, never a shadow (F569). It fades in when the run
 * reaches the glow and fades away when the run ends, with no words either way.
 * Under reduced motion the fill jumps and the halo simply is or is not there.
 */

import { StyleSheet, View } from 'react-native';

import { LivingBar } from '../motion/LivingBar.tsx';
import { Enter, Exit } from '../motion/layout.tsx';
import { DUR } from '../motion/tokens.ts';
import { colour, decorative, paper, radius, space } from '../theme.ts';

const HEIGHT = 10;
/** How far the halo stands out around the bar on every side. */
const HALO = 3;
/** The halo's opacity at rest: a warm light, never a fill. */
const HALO_OPACITY = 0.35;

export function SittingBar({ fill, glow }: { fill: number; glow: boolean }) {
  return (
    <View {...decorative} style={st.wrap}>
      {glow ? (
        <Exit style={st.haloSlot}>
          <Enter from="none" duration={DUR.slow} style={st.haloSlot}>
            <View style={st.halo} />
          </Enter>
        </Exit>
      ) : null}
      <LivingBar to={fill} color={colour.mint} track={paper.line} height={HEIGHT} radius={HEIGHT / 2} />
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { marginTop: space(2), marginBottom: space(1), justifyContent: 'center' },
  haloSlot: { position: 'absolute', top: -HALO, bottom: -HALO, left: -HALO, right: -HALO },
  halo: { flex: 1, borderRadius: radius.pill, backgroundColor: colour.sun, opacity: HALO_OPACITY },
});
