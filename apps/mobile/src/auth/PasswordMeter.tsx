import { useCallback, useEffect } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Reanimated, { interpolateColor, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useReduceMotion } from '../motion.ts';
import { cancel, timing } from '../motion/drive.ts';
import { useLandOnLeave } from '../motion/landing.ts';
import { DUR, EASE } from '../motion/tokens.ts';
import { decorative, paper, passwordMeter, space, type } from '../theme.ts';
import { passwordStrength } from './passwordStrength.ts';
import { PASSWORD_MIN } from './validate.ts';

/** Strength advice stays separate from the sole local acceptance rule. */
export function PasswordMeter({ value }: { value: string }) {
  const { fontScale } = useWindowDimensions();
  // Changing this native text prop refreshes cached heights after a live
  // reading-size change. Its value stays above the current system scale.
  const liveFontMultiplier = fontScale + 1;
  const strength = passwordStrength(value);
  const reduced = useReduceMotion();
  const colourPosition = strength.level === 'good' ? 2 : strength.level === 'medium' ? 1 : 0;
  const fill = useSharedValue(strength.progress);
  const tone = useSharedValue(colourPosition);
  const land = useCallback(() => {
    cancel(fill);
    cancel(tone);
    fill.value = strength.progress;
    tone.value = colourPosition;
  }, [fill, tone, strength.progress, colourPosition]);

  useEffect(() => {
    if (reduced) {
      land();
      return;
    }
    // Replacing a timing retains its displayed value, including mid-flight.
    // Typing, deleting, paste and autofill all take this same path.
    fill.value = timing(strength.progress, DUR.base, EASE.out, reduced);
    tone.value = timing(colourPosition, DUR.base, EASE.out, reduced);
  }, [reduced, strength.progress, colourPosition, fill, tone, land]);
  useLandOnLeave(land);

  const animatedFill = useAnimatedStyle(() => ({
    transform: [{ scaleX: fill.value }],
    backgroundColor: interpolateColor(tone.value, [0, 1, 2], [passwordMeter.low, passwordMeter.medium, passwordMeter.good]),
  }));
  const requirement = `${PASSWORD_MIN} characters minimum`;
  const policyStatus = strength.met ? 'Minimum length met.' : 'Minimum length not yet met.';
  return <View style={st.row}>
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Password strength: ${strength.text}. ${requirement}. ${policyStatus} Strength advice is optional.`}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(strength.progress * 100), text: strength.text }}
      style={st.track}
    >
      <Reanimated.View pointerEvents="none" style={[StyleSheet.absoluteFill, st.fill, animatedFill]} />
    </View>
    <View style={st.meta}>
      <View style={st.strength}>
        <Text {...decorative} maxFontSizeMultiplier={liveFontMultiplier} style={[type.small, st.words, st.reserve]}>Not entered</Text>
        <Text maxFontSizeMultiplier={liveFontMultiplier} style={[type.small, st.words, st.shown]}>{strength.text}</Text>
      </View>
      <Text maxFontSizeMultiplier={liveFontMultiplier} accessibilityLabel={`${requirement}. ${policyStatus}`} style={[type.small, st.words, strength.met && st.met]}>{requirement}</Text>
    </View>
    <Text maxFontSizeMultiplier={liveFontMultiplier} style={[type.small, st.words]}>Optional: use a longer, unique password.</Text>
  </View>;
}

const st = StyleSheet.create({
  row: { gap: space(1.5) },
  track: { width: '100%', height: 6, borderRadius: 3, backgroundColor: paper.line, overflow: 'hidden' },
  fill: { borderRadius: 3, transformOrigin: 'left' },
  meta: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: space(1) },
  strength: { position: 'relative' },
  reserve: { opacity: 0 },
  shown: { position: 'absolute', top: 0, left: 0, right: 0 },
  words: { color: paper.inkSoft },
  met: { color: paper.ink },
});
