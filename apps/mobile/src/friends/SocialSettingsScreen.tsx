import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { ScrollScreen, ScreenHeader } from '../layout.tsx';
import { useBackToHome } from '../nav/useBackToHome.ts';
import { IconAction, Card, GhostButton, Label } from '../components.tsx';
import { SwitchRow } from '../settings/SwitchRow.tsx';
import { useSocial } from './useSocial.ts';
import { space, type } from '../theme.ts';
import type { SocialSettings } from './socialModel.ts';
import { FRIENDS_START } from './friendsView.ts';
import { useB } from '../main/bTheme.tsx';

const SETTINGS: { key: keyof SocialSettings; title: string; sub: string }[] = [
  { key: 'shareMilestones', title: 'Share learning milestones', sub: 'Share weekly practice milestones with accepted friends. Off by default.' },
  { key: 'requests', title: 'Friend requests', sub: 'Show a badge when someone asks to join your circle.' },
  { key: 'invitations', title: 'Challenge invitations', sub: 'Include invitations in the Friends update badge.' },
  { key: 'completions', title: 'Completed challenges', sub: 'Include completed challenges in the Friends update badge.' },
  { key: 'milestones', title: 'Friends’ milestones', sub: 'Include shared milestones in the Friends update badge.' },
];
export function SocialSettingsScreen() {
  const t = useB();
  const goBack = useBackToHome();
  const nav = useNavigation<{ goBack: () => void; navigate: (screen: string) => void }>();
  const { snapshot: s, error, act, busy, refresh } = useSocial();
  const [confirmLeave, setConfirmLeave] = useState(false);
  return <ScrollScreen bottom="inset" header={<ScreenHeader title="Friends privacy" back={{ onPress: goBack }} />}>
    <Text style={[type.body, { color: t.muted }]}>Friends are private. People find you by your exact username or an invitation you share. Your recordings and corrections stay private.</Text>
    {error !== '' && <><Text accessibilityLiveRegion="polite" style={[type.body, { color: t.text }]}>{error}</Text><IconAction layout="inline" icon="refresh" label="Try again" onPress={refresh} /></>}
    {s?.settings.enabled ? <>
      <Card style={{ marginTop: space(4) }}>{SETTINGS.map(setting => <SwitchRow key={setting.key} title={setting.title} accessibilityLabel={setting.title} sub={setting.sub} value={s.settings[setting.key]} onChange={value => { if (!busy) void act('settings', { [setting.key]: value }); }} />)}</Card>
      <Text style={[type.small, { color: t.muted, marginTop: space(3) }]}>These choices control in-app badges when Friends refreshes. They do not send push notifications. The activity feed remains available with badges off.</Text>
      <View style={{ marginTop: space(5), gap: space(2) }}><Label>Blocked people</Label>
        {!s.blocked.length && <Text style={[type.small, { color: t.muted }]}>No blocked people.</Text>}
        {s.blocked.map(p => <Card key={p.id}><Text style={[type.body, { color: t.text }]}>{p.name}</Text><GhostButton label="Unblock" onPress={() => void act('unblock', { id: p.id })} /></Card>)}
      </View>
      <Card style={{ marginTop: space(5) }}><Text style={[type.body, { color: t.text }]}>Leave Friends</Text><Text style={[type.small, { color: t.muted }]}>Remove your connections, end your shared challenges and hide your username. Your French and personal progress stay with you.</Text>{confirmLeave ? <><GhostButton label="Confirm: remove my connections" onPress={() => void act('settings', { enabled: false })} /><GhostButton label="Stay in Friends" onPress={() => setConfirmLeave(false)} /></> : <GhostButton label="Leave Friends" onPress={() => setConfirmLeave(true)} />}</Card>
    </> : s && <IconAction layout="inline" icon="user-add" label={FRIENDS_START} onPress={() => nav.navigate('AddFriends')} />}
  </ScrollScreen>;
}
