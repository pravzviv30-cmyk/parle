import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { ScrollScreen } from '../layout.tsx';
import { IconActionRow, IconAction, GhostButton, PillButton } from '../components.tsx';
import { VoiceOrb } from '../tutor/VoiceOrb.tsx';
import { paper, type, space } from '../theme.ts';
export function WalkRoom({ tutor, speaking, micOpen, finishing, safety, onExit, onMic, onHear, onSlower, onFinish }: {
  tutor: string; speaking: boolean; micOpen: boolean; finishing: boolean;
  safety: ReactNode; onExit: () => void;
  onMic: () => void; onHear: () => void; onSlower: () => void; onFinish: () => void;
}) {
  return <ScrollScreen ground={paper.ink} bottom="inset" footer={<View style={{ gap: space(3) }}><PillButton tone="white" label={finishing ? 'Preparing your recap…' : 'Finish conversation'} disabled={finishing} onPress={onFinish} /><GhostButton color={paper.onInk} label="End now" onPress={onExit} /></View>}>
    <View style={{ gap: space(5), alignItems: 'center', paddingTop: space(8) }}>
      <Text accessibilityRole="header" style={[type.title, { color: paper.onInk }]}>Walk mode</Text>
      {safety}
      <VoiceOrb size={170} state={speaking ? 'speaking' : micOpen ? 'listening' : 'idle'} />
      <Text accessibilityLiveRegion="polite" style={[type.body, { color: paper.onInk }]}>{finishing ? `${tutor} is preparing your recap.` : speaking ? `${tutor} is speaking.` : micOpen ? 'Ready to hear you.' : 'The microphone is quiet.'}</Text>
      {!finishing && <IconActionRow>
        {!micOpen && <IconAction layout="tile" icon="microphone" label="Open microphone" ground="blue" onPress={onMic} />}
        <IconAction layout="tile" icon="replay" label="Say it again" ground="blue" onPress={onHear} />
        <IconAction layout="tile" icon="speaker-slow" label="A little slower" ground="blue" onPress={onSlower} />
      </IconActionRow>}
      <Text style={[type.small, { color: paper.onInk }]}>Listening continues while locked, within your minutes and the 15-minute limit. A call or audio interruption ends this room.</Text>
    </View>
  </ScrollScreen>;
}
