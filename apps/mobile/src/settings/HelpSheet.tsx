/**
 * Help and feedback (F922): the five answers, then the address as text.
 *
 * Layout only. The words and the trouble rule are `helpSheet.ts`. The parent
 * owns the trouble line and the mail call, so Settings keeps its one
 * `contactTrouble` and Profile holds its own.
 */

import { Platform, Text, View } from 'react-native';
import { space, type } from '../theme.ts';
import { PillButton, Sheet as BottomSheet } from '../components.tsx';
import { useB } from '../main/bTheme.tsx';
import { TroubleLine } from './TroubleLine.tsx';
import { helpSheet } from './helpSheet.ts';

export function HelpSheet({ visible, onClose, address, trouble, onWrite }: { visible: boolean; onClose: () => void; address: string; trouble: string | null; onWrite: () => void }) {
  const t = useB();
  const view = helpSheet(Platform.OS === 'web', address);
  return (
    <BottomSheet visible={visible} title={view.title} onClose={onClose} surface={t.card} ink={t.text}>
      {view.answers.map((answer) => (
        <View key={answer.heading} style={{ gap: space(1) }}>
          <Text accessibilityRole="header" style={[type.label, { color: t.text }]}>{answer.heading}</Text>
          {answer.lines.map((line) => (
            <Text key={line} style={[type.body, { color: t.muted }]}>{line}</Text>
          ))}
        </View>
      ))}
      <View style={{ gap: space(2), marginTop: space(2) }}>
        <Text accessibilityRole="header" style={[type.label, { color: t.text }]}>{view.write.heading}</Text>
        <Text style={[type.body, { color: t.muted }]}>{view.write.line}</Text>
        <Text selectable style={[type.body, { color: t.text }]}>{view.write.address}</Text>
        {trouble !== null && <TroubleLine message={trouble} />}
        <PillButton label={view.write.action} tone="brand" onPress={onWrite} />
      </View>
    </BottomSheet>
  );
}
