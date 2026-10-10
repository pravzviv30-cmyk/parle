import { StyleSheet, Text, View } from 'react-native';
import { paper, passwordMeter, space, type } from '../theme.ts';
import { passwordStrength } from './passwordStrength.ts';
import { PASSWORD_MIN } from './validate.ts';


export function PasswordMeter({ value, matching }: { value: string; matching?: boolean }) {
  const strength = passwordStrength(value);
  const text = matching === true && strength.met ? 'Passwords match' : matching === false && value.length > 0 ? 'Keep typing to match' : strength.text;
  const tone = passwordMeter[strength.level];
  return <View style={st.row}>
    <View accessibilityRole="progressbar" accessibilityLabel={`Password guidance. ${value.length} characters, ${PASSWORD_MIN} minimum. ${text}`} accessibilityValue={{ min: 0, max: 12, now: Math.min(value.length, 12), text }} style={st.track}>
      <View style={[st.fill, { backgroundColor: tone, width: `${strength.progress * 100}%` }]} />
    </View>
    <Text style={[type.small, st.words]}>{text}</Text>
  </View>;
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', gap: space(2), alignItems: 'center', minHeight: 20 },
  track: { flex: 1, minWidth: 44, height: 5, borderRadius: 3, backgroundColor: paper.line, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  words: { color: paper.inkSoft, flexShrink: 1 },
});
