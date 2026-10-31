/**
 * The right tile's one sparkle (drill B v2, UI-016; drill-b.md "Tile"): a
 * small four-point star in the sun, near the tile's top-right, shown once.
 * Drawn from the V2-Choose board's path. Decorative, so a screen reader
 * never meets it, and absent under reduced motion (or before the OS has
 * answered), so the right tile simply arrives in its final state.
 */
import Svg, { Path } from 'react-native-svg';
import { StyleSheet, View } from 'react-native';
import { useReduceMotion } from '../motion.ts';
import { decorative } from '../theme.ts';
import { useB } from '../main/bTheme.tsx';

/** The board's sparkle: 36pt, 10 from the right edge, 4 from the top. */
export const SPARKLE = { size: 36, right: 10, top: 4 } as const;

export function Sparkle() {
  const t = useB();
  const reduced = useReduceMotion(true);
  if (reduced !== false) return null;
  return (
    <View {...decorative} pointerEvents="none" style={st.at}>
      <Svg {...decorative} width={SPARKLE.size} height={SPARKLE.size} viewBox="0 0 40 40">
        <Path d="M20 2L23 16L37 20L23 24L20 38L17 24L3 20L17 16Z" fill={t.sun} />
      </Svg>
    </View>
  );
}

const st = StyleSheet.create({
  at: { position: 'absolute', right: SPARKLE.right, top: SPARKLE.top },
});
