import { Text, View } from 'react-native';
import { ScrollScreen } from '../layout.tsx';
import { IconAction, PillButton } from '../components.tsx';
import { paper, space, type } from '../theme.ts';
import { RELOAD_INTRO } from './reloadGate.ts';

/** A reloaded conversation address (F923): nothing starts until the learner asks. */
export function ReloadIntro({ onStart, onBack }: { onStart: () => void; onBack: () => void }) {
  return <ScrollScreen ground={paper.ink} bottom="inset">
    <View style={{ gap: space(5) }}>
      <Text accessibilityRole="header" style={[type.title, { color: paper.onInk }]}>{RELOAD_INTRO.title}</Text>
      <PillButton tone="white" label={RELOAD_INTRO.start} onPress={onStart} />
      <IconAction layout="inline" icon="back" ground="blue" label={RELOAD_INTRO.back} onPress={onBack} />
    </View>
  </ScrollScreen>;
}
