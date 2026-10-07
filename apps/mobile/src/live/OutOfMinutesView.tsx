import { Text } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { GhostButton, PillButton, Sheet } from '../components.tsx';
import { ScrollScreen } from '../layout.tsx';
import { paper, type } from '../theme.ts';

/** A refusal ends the room. The shared wall owns buying and restoring. */
export function OutOfMinutesView({ label, message, userId, onExit }: { label: string; message: string; userId: string; onExit: () => void }) {
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const route = useRoute();
  return (
    <ScrollScreen bottom="inset">
      <Sheet visible title={label} onClose={onExit}>
        <Text style={[type.body, { color: paper.ink }]}>{message}</Text>
        <PillButton label="See the plans" onPress={() => nav.navigate('Wall', { entry: 'refused', resumeRouteKey: route.key })} />
        <GhostButton label="Back to practice" onPress={onExit} />
      </Sheet>
    </ScrollScreen>
  );
}
