import { Text, View } from 'react-native';
import { ArrowRight, Press } from '../components.tsx';
import { paper, type } from '../theme.ts';

/** The whole row opens one edit; the current answer remains easy to scan. */
export function PlanEditRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      onPress={onPress}
      style={{
        minHeight: 66,
        backgroundColor: paper.ground,
        borderRadius: 16,
        padding: 14,
        gap: 14,
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={[type.small, { color: paper.inkSoft }]}>{label}</Text>
        <Text style={[type.label, { color: paper.ink }]}>{value}</Text>
      </View>
      <ArrowRight color={paper.ink} />
    </Press>
  );
}
