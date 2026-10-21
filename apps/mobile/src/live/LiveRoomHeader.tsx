import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RoundButton } from '../components.tsx';
import { frenchText, HIT, space, type } from '../theme.ts';
import { useB } from '../main/bTheme.tsx';

export function LiveRoomHeader({ onEnd, accessibilityLabel, status, title = 'Conversation', french }: {
  onEnd: () => void; accessibilityLabel: string; status?: ReactNode; title?: string; french?: string;
}) {
  const t = useB();
  return (
    <View style={st.row}>
      <RoundButton kind="close" onPress={onEnd} accessibilityLabel={accessibilityLabel} accessibilityHint="Opens a confirmation before ending the session" />
      <View style={st.status}>
        <Text {...(french ? frenchText : {})} accessibilityRole="header" style={[french ? type.french : type.heading, { color: t.text }]}>{french ?? title}</Text>
        {french ? <Text style={[type.small, { color: t.muted }]}>{title}</Text> : null}
        {status}
      </View>
    </View>
  );
}
const st = StyleSheet.create({
  row: { minHeight: HIT, flexDirection: 'row', alignItems: 'center', gap: space(3), marginBottom: space(3) },
  status: { flex: 1, minHeight: HIT, justifyContent: 'center' },
});
