import { Text } from 'react-native';
import { Press } from '../components.tsx';
import { type } from '../theme.ts';
import { C2 } from './c2Presentation.ts';

export function C2Action({ label, onPress, disabled = false, secondary = false, gold = false, inverse = false }: {
  label: string; onPress: () => void; disabled?: boolean; secondary?: boolean; gold?: boolean; inverse?: boolean;
}) {
  const fill = secondary ? 'transparent' : disabled ? C2.line : gold ? C2.gold : C2.violet;
  const ink = secondary ? inverse ? C2.white : C2.violet : disabled ? C2.muted : gold ? C2.ink : C2.white;
  return <Press haptic="light" accessibilityLabel={label} disabled={disabled} onPress={onPress}
    style={{ minHeight: secondary ? 44 : 52, paddingHorizontal: 16, paddingVertical: 12,
      borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: fill }}>
    <Text style={[type.label, { color: ink, textAlign: 'center' }]}>{label}</Text>
  </Press>;
}
