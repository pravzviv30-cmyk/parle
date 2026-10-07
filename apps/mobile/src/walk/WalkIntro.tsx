import { Text, View } from 'react-native';
import { ScrollScreen } from '../layout.tsx';
import { IconAction, GhostButton, PillButton, RoundButton } from '../components.tsx';
import { paper, space, type } from '../theme.ts';
import { WALK_AVAILABLE } from './observer.ts';
export function WalkIntro({ onStart, onBack }: { onStart: () => void; onBack: () => void }) {
  return <ScrollScreen ground={paper.ink} bottom="inset" header={<View style={{ flexDirection: 'row', gap: space(3), alignItems: 'center' }}><RoundButton kind="back" tone="white" accessibilityLabel="Back to Tutor" onPress={onBack} /><Text style={[type.heading, { color: paper.onInk }]}>Walk mode</Text></View>}>
    <View style={{ gap: space(5) }}>
      <Text style={[type.title, { color: paper.onInk }]}>French, out loud</Text>
      <Text style={[type.body, { color: paper.onInk }]}>Use your usual tutor for your next scene. Find a quiet, safe place where you can pay attention to your surroundings.</Text>
      <Text style={[type.body, { color: paper.onInk }]}>Your microphone stays on while the screen is locked. Your usual minutes apply, with a limit of 15 minutes. A phone call or audio interruption ends the conversation.</Text>
      {WALK_AVAILABLE ? <PillButton tone="white" label="Start Walk mode" onPress={onStart} /> : <Text style={[type.body, { color: paper.onInk }]}>Walk mode is waiting for its device checks. You can use an ordinary spoken scene for now.</Text>}
      <IconAction layout="inline" icon="back" ground="blue" label="Back to Tutor" onPress={onBack} />
    </View>
  </ScrollScreen>;
}
