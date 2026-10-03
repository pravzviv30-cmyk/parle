import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { GhostButton } from '../components.tsx';
import { ScrollScreen } from '../layout.tsx';
import { paper, space, type } from '../theme.ts';
import { VoiceOrb } from '../tutor/VoiceOrb.tsx';

/** The client reports the wait it actually observes, with a safe way out. */
export function RoomWait({ title, body, stage, leaveLabel, onLeave, banner }: {
  title: string; body?: string; stage?: string; leaveLabel: string;
  onLeave: () => void; banner?: ReactNode;
}) {
  return (
    <ScrollScreen bottom="inset" footer={<GhostButton label={leaveLabel} onPress={onLeave} />}>
      {banner}
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: space(6), paddingVertical: space(10) }}>
        <VoiceOrb state="thinking" size={120} withCaption={false} announce={false} />
        <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={[type.title, { color: paper.ink, textAlign: 'center' }]}>{title}</Text>
        {body ? <Text style={[type.body, { color: paper.inkSoft, textAlign: 'center' }]}>{body}</Text> : null}
        {stage ? <Text accessibilityLiveRegion="polite" style={[type.small, { color: paper.inkSoft, textAlign: 'center' }]}>{stage}</Text> : null}
      </View>
    </ScrollScreen>
  );
}
