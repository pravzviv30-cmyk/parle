import { Text, View } from 'react-native';
import { ScrollScreen } from '../layout.tsx';
import { IconAction, PillButton } from '../components.tsx';
import { paper, space, type } from '../theme.ts';
import { OWN_LEASE_CLOSING } from './ownLease.ts';

/** The switch to voice outwaited its own typed session's close (F903): again, or out. */
export function OwnLeaseClosing({ onRetry, onLeave }: { onRetry: () => void; onLeave: () => void }) {
  return <ScrollScreen ground={paper.ink} bottom="inset">
    <View style={{ gap: space(5) }}>
      <Text accessibilityRole="header" style={[type.title, { color: paper.onInk }]}>{OWN_LEASE_CLOSING.title}</Text>
      <Text style={[type.body, { color: paper.onInk }]}>{OWN_LEASE_CLOSING.body}</Text>
      <PillButton tone="white" label={OWN_LEASE_CLOSING.retry} onPress={onRetry} />
      <IconAction layout="inline" icon="back" ground="blue" label={OWN_LEASE_CLOSING.leave} onPress={onLeave} />
    </View>
  </ScrollScreen>;
}
