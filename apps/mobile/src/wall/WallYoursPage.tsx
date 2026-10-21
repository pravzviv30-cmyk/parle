import { StyleSheet, Text, View } from 'react-native';

import { GhostButton } from '../components.tsx';
import { Illustration } from '../art/flat/Illustration.tsx';
import { useMainAppearance } from '../main/MainAppearance.tsx';
import { Icon } from '../icons/Icon.tsx';
import { useCompactPhone } from '../layout.tsx';
import { decorative, radius, space, type } from '../theme.ts';
import {
  ADDS_ROWS, ADDS_TITLE, YOURS_DECLINE, YOURS_FREE_TITLE,
  YOURS_ONLY, YOURS_ROWS, YOURS_TITLE,
} from './wallCopy.ts';

/** Value before prices. Earned learning stays free; a plan adds live conversations. */
export function WallYoursPage({ canBuy, onLeave }: { canBuy: boolean; onLeave: () => void }) {
  const compact = useCompactPhone(); const { colors } = useMainAppearance();
  return (
    <View style={st.content}>
      <Text accessibilityRole="header" style={[st.title, { color: colors.text }]}>{YOURS_TITLE}</Text>
      <View {...decorative} style={st.art}>
        <Illustration name="place-cafe-counter" style={{ width: 260, height: compact ? 76 : 110 }} />
      </View>
      <View style={[st.card, { backgroundColor: colors.teal }]}>
        <Text accessibilityRole="header" style={[st.heading, { color: colors.text }]}>{YOURS_FREE_TITLE}</Text>
        {YOURS_ROWS.map(line => <View key={line} style={st.row}>
          <View {...decorative}><Icon name="check" size={20} color={colors.text} /></View>
          <Text style={[st.line, { color: colors.text }]}>{line}</Text>
        </View>)}
      </View>
      <View style={[st.card, { backgroundColor: colors.surface }]}>
        <Text accessibilityRole="header" style={[st.heading, { color: colors.text }]}>{ADDS_TITLE}</Text>
        {ADDS_ROWS.map(line => <View key={line} style={st.row}>
          <View {...decorative}><Icon name="check" size={20} color={colors.text} /></View>
          <Text style={[st.line, { color: colors.text }]}>{line}</Text>
        </View>)}
      </View>
      {!canBuy && <Text style={[st.only, { color: colors.text }]}>{YOURS_ONLY}</Text>}
      {canBuy && <GhostButton label={YOURS_DECLINE} onPress={onLeave} />}
    </View>
  );
}
const st = StyleSheet.create({
  content: { gap: space(3) },
  title: { ...type.display },
  art: { alignItems: 'center' },
  heading: { ...type.heading },
  card: { padding: space(4), borderRadius: radius.tile, gap: space(2) },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  line: { ...type.body, flex: 1, minWidth: 0 },
  only: { ...type.body, textAlign: 'center' },
});
