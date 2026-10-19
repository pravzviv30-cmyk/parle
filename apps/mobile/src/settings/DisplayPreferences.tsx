import { Text, View } from 'react-native';
import { Press } from '../components.tsx';
import { Icon } from '../icons/Icon.tsx';
import { useMainAppearance } from '../main/MainAppearance.tsx';
import { space, type } from '../theme.ts';
import { DISPLAY_OPTIONS } from './displayModel.ts';

/** The avatar shortcut and Settings edit the same account-scoped preference. */
export function DisplayPreferences() {
  const { colors, preference, setPreference, error } = useMainAppearance();
  return <View style={{ gap: space(2) }} accessibilityRole="radiogroup" accessibilityLabel="Display">
    {DISPLAY_OPTIONS.map(option => <Press key={option.value} onPress={() => setPreference(option.value)} accessibilityRole="radio" accessibilityLabel={option.label} accessibilityState={{ checked: preference === option.value }} style={{ minHeight: 56, paddingHorizontal: space(4), paddingVertical: space(3), borderRadius: 20, backgroundColor: colors.inset, flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
      <Text style={[type.label, { flex: 1, color: colors.text }]}>{option.label}</Text>
      {preference === option.value ? <Icon name="check" size={22} color={colors.text} /> : null}
    </Press>)}
    {error ? <Text accessibilityRole="alert" style={[type.small, { color: colors.text }]}>{error}</Text> : null}
  </View>;
}
