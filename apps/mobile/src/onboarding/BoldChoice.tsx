import { Glint } from '../motion/Glint.tsx';
import { space } from '../theme.ts';
import { Text, View } from 'react-native';
import { Press } from '../components.tsx';
import { c, boldType as type } from './boldRhythm.ts';
export function BoldChoice({ title, detail, selected, onPress, multiple = false }: {
  title: string; detail?: string; selected: boolean; onPress: () => void; multiple?: boolean;
}) {
  return <Press haptic="selection" depth="raised" selected={selected} glowRadius={12} accessibilityRole={multiple ? 'checkbox' : 'radio'}
    accessibilityState={{ checked: selected }} aria-checked={selected}
    accessibilityLabel={detail ? `${title}. ${detail}` : title} onPress={onPress}
    style={{ minHeight: 64, borderRadius: 12, borderWidth: 2, borderColor: selected ? c.violet : c.white,
      backgroundColor: selected ? c.lavender : c.white, paddingHorizontal: 18, paddingVertical: 12 }}>
    <View style={{ gap: 4 }}><Text style={[type.label, { color: c.ink }]}>{title}</Text>
      {!!detail && <Text style={[type.small, { color: c.muted }]}>{detail}</Text>}
    </View>
    {selected && <Glint when wait={0} radius={12} />}
  </Press>;
}
