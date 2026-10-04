import { Text } from 'react-native';
import { paper, type } from '../theme.ts';
import { PillButton } from '../components.tsx';
import { ScrollScreen } from '../layout.tsx';
import { TroubleLine } from '../settings/TroubleLine.tsx';

export function DeletionPendingNotice({ onDismiss }: { onDismiss: () => void }) {
  return (
    <ScrollScreen footer={<PillButton label="Continue" onPress={onDismiss} />}>
      <Text accessibilityRole="header" style={[type.title, { color: paper.ink }]}>Deletion requested</Text>
      <TroubleLine message="Your account is locked and deletion is queued. This device has been signed out. Server and purchase records may take longer to finish erasing." strong />
    </ScrollScreen>
  );
}
