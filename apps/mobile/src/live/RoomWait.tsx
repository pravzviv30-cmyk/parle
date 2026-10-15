import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { GhostButton } from '../components.tsx';
import { ScrollScreen } from '../layout.tsx';
import { paper, space, boldType as type } from '../theme.ts';
import { BoldVoiceOrb } from '../onboarding/BoldVoiceOrb.tsx';
import type { OrbState } from '../tutor/VoiceOrb.tsx';

/** The client reports the wait it actually observes, with a safe way out. */
export function RoomWait({ title, body, stage, leaveLabel, onLeave, banner, state = 'thinking' }: {
  title: string; body?: string; stage?: string; leaveLabel: string;
  onLeave: () => void; banner?: ReactNode;
  state?: OrbState;
}) {
  return (
    <ScrollScreen bottom="inset" footer={<GhostButton label={leaveLabel} onPress={onLeave} />}>
      {banner}
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: space(6), paddingVertical: space(10) }}>
        <BoldVoiceOrb state={state} size={112} />
        <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={[type.title, { color: paper.ink, textAlign: 'center' }]}>{title}</Text>
        {body ? <Text style={[type.body, { color: paper.inkSoft, textAlign: 'center' }]}>{body}</Text> : null}
        {stage ? <Text accessibilityLiveRegion="polite" style={[type.small, { color: paper.inkSoft, textAlign: 'center' }]}>{stage}</Text> : null}
      </View>
    </ScrollScreen>
  );
}
