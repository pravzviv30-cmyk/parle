import { useState } from 'react';
import { Text, View, Share } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ScrollScreen, TabHeader, ScreenHeader } from '../layout.tsx';
import { IconAction, Card, GhostButton, Label, Ledger, LedgerRow, PillButton, OutlineButton, Field } from '../components.tsx';
import { paper, space, type } from '../theme.ts';
import { ProfileButton } from '../profile/ProfileButton.tsx';
import { useSocial } from '../friends/useSocial.ts';
import { friendsByName, REACTIONS } from '../friends/socialModel.ts';
import {
  FRIENDS_PRIVACY_LINK,
  FRIENDS_PURPOSE,
  FRIENDS_START,
  FRIENDS_START_BODY,
  FRIENDS_START_TITLE,
  FRIENDS_FRENCH_IDEA,
  friendsEntry,
} from '../friends/friendsView.ts';

export function FriendsTab({ pushed = false }: { pushed?: boolean } = {}) {
  const nav = useNavigation<{ navigate: (screen: string) => void; canGoBack(): boolean; goBack(): void }>();
  const { snapshot: s, error, busy, act, refresh } = useSocial();
  const [manage, setManage] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [shareNote, setShareNote] = useState('');
  const rows = s ? friendsByName(s.friends) : [];
  const entry = friendsEntry(s);
  const sharePostcard = async (partner: string) => {
    try { await Share.share({ message: `Un peu de français, ensemble. ${s?.self.name} and ${partner} made room for four French conversations together this week on Luvani.` }); }
    catch { setShareNote('The postcard could not be shared just now. Try again.'); }
  };
  return <ScrollScreen bottom={pushed ? "inset" : "tab"} header={pushed ? <ScreenHeader title={false} back={{ onPress: () => { if (nav.canGoBack()) nav.goBack(); else nav.navigate('Tabs'); } }} /> : undefined}>
    <TabHeader title="Friends" purpose={FRIENDS_PURPOSE} trailing={<ProfileButton />} />
    {error !== '' && <Card><Text accessibilityLiveRegion="polite" style={[type.body, { color: paper.ink }]}>{error}</Text><IconAction layout="inline" icon="refresh" label="Try again" onPress={refresh} /></Card>}
    {entry === 'loading' && !error && <Text style={[type.body, { color: paper.inkSoft }]}>Opening your circle…</Text>}
    {/* Before joining: one opt-in start, with privacy a quiet link beneath it
        rather than a second door beside it (Stage 3). */}
    {entry === 'start' && <Card>
      <Text style={[type.title, { color: paper.ink }]}>{FRIENDS_START_TITLE}</Text>
      <Text style={[type.body, { color: paper.inkSoft, marginVertical: space(3) }]}>{FRIENDS_START_BODY}</Text>
      <Text style={[type.small, { color: paper.inkSoft }]}>Your recordings and text stay private.</Text>
      <PillButton label={FRIENDS_START} onPress={() => nav.navigate('AddFriends')} />
      <GhostButton label={FRIENDS_PRIVACY_LINK} onPress={() => nav.navigate('SocialSettings')} />
    </Card>}
    {entry === 'circle' && s && <>
      {/* Notebook Phase 3 (2026-09-27): the two doors are ledger rows. */}
      <Ledger>
        <LedgerRow title={s.requests.some(r => r.direction === 'incoming') ? 'Add friends, requests waiting' : 'Add friends'} onPress={() => nav.navigate('AddFriends')} />
        <LedgerRow title="Privacy & notifications" onPress={() => nav.navigate('SocialSettings')} />
      </Ledger>
      <View style={{ marginTop: space(5), gap: space(3) }}>
        <Text accessibilityRole="header" style={[type.heading, { color: paper.ink }]}>Learning alongside you</Text>
        {!rows.length ? <Card><Text style={[type.body, { color: paper.ink }]}>Invite someone you know to practise French together.</Text><IconAction layout="inline" icon="user-add" label="Invite a friend" onPress={() => nav.navigate('AddFriends')} /></Card> : <Ledger>{rows.map(person => <View key={person.id} style={{ paddingVertical: space(3) }}>
          <Text style={[type.bodyStrong, { color: paper.ink }]}>{person.name}</Text>
          <Text style={[type.small, { color: paper.inkSoft }]}>@{person.username}</Text>
        </View>)}</Ledger>}
      </View>
      <View style={{ marginTop: space(5), gap: space(3) }}><Label>Together this week</Label>
        <Text style={[type.body, { color: paper.inkSoft }]}>Four conversations between two friends, counting up to one per person each day after you both join. Any unfinished challenge simply ends with the week.</Text>
        <Text style={[type.body, { color: paper.ink }]}>{FRIENDS_FRENCH_IDEA}</Text>
        {s.challenges.map(c => <Card key={c.id}>
          <Text style={[type.heading, { color: paper.ink }]}>You and {c.partner}</Text>
          {c.status === 'pending' ? <><Text style={[type.body, { color: paper.inkSoft }]}>{c.incoming ? 'An invitation to learn together.' : 'Invitation sent. Your partner chooses whether to join.'}</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {c.incoming && <IconAction layout="inline" icon="tick-circle" label="Join challenge" onPress={() => void act('acceptChallenge', { id: c.id })} />}
            <GhostButton label={c.incoming ? 'Decline' : 'Cancel invitation'} onPress={() => void act(c.incoming ? 'declineChallenge' : 'leaveChallenge', { id: c.id })} />
          </View></> : <>{c.count >= c.target ? <Text style={[type.french, { color: paper.ink }]}>{'Un peu de français, ensemble.'}</Text> : <Text style={[type.heading, { color: paper.ink }]}>{`${c.count} of ${c.target} conversations`}</Text>}
            {c.count >= c.target ? <><Text style={[type.body, { color: paper.inkSoft }]}>Your shared postcard. Four conversations together, now part of your story.</Text><IconAction layout="inline" icon="share" label="Share our postcard" onPress={() => void sharePostcard(c.partner)} /></> : <><IconAction layout="inline" icon="map" label="Choose a French scene" onPress={() => nav.navigate('Missions')} /><GhostButton label="Leave challenge" onPress={() => void act('leaveChallenge', { id: c.id })} /></>}
          </>}
        </Card>)}
        {s.friends.map(f => <Card key={f.id}>
          <Text style={[type.bodyStrong, { color: paper.ink }]}>{f.name}</Text>
          {!s.challenges.some(c => c.partnerId === f.id) && <IconAction layout="inline" icon="users" label="Invite to a shared challenge" onPress={() => void act('inviteChallenge', { id: f.id })} />}
          <IconAction layout="inline" icon="more" label={manage === f.id ? 'Close friend options' : 'Friend options'} onPress={() => { setManage(manage === f.id ? null : f.id); setReason(''); }} />
          {manage === f.id && <View style={{ gap: space(2) }}>
            <Text style={[type.small, { color: paper.inkSoft }]}>Removing or blocking also ends shared challenges. They will not be notified.</Text>
            <GhostButton label="Remove friend" onPress={() => void act('remove', { id: f.id })} />
            <GhostButton label="Block this person" onPress={() => void act('block', { id: f.id })} />
            <Field label="Reason for reporting (private)" value={reason} onChangeText={setReason} placeholder="e.g. Unwanted messages" maxLength={500} />
            <OutlineButton label="Report and block" disabled={!reason.trim() || busy} onPress={() => void act('report', { id: f.id, reason: reason.trim() })} />
          </View>}
        </Card>)}
      </View>
      <View style={{ marginTop: space(5), gap: space(3) }}><Label>Small moments worth noticing</Label>
        {s.notices.some(n => !n.read) && <IconAction layout="inline" icon="tick-circle" label="Mark updates as read" onPress={() => void act('read')} />}
        {!s.notices.length && <Text style={[type.body, { color: paper.inkSoft }]}>Shared milestones and encouragement will appear here. Everyone controls what they share.</Text>}
        {s.notices.filter(n => n.kind !== 'result').map(n => <Card key={n.id}><Text style={[type.body, { color: paper.ink }]}>{n.body}</Text><Text style={[type.small, { color: paper.inkSoft }]}>Week of {n.week}</Text>
          {n.actorId !== s.self.id && n.kind !== 'reaction' && <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{REACTIONS.map(reaction => <IconAction layout="inline" icon="family" key={reaction} label={n.reactions.includes(reaction) ? `${reaction} ✓` : reaction} onPress={() => void act('react', { id: n.id, reaction })} />)}</View>}
        </Card>)}
      </View>
    </>}
    {busy && <Text accessibilityLiveRegion="polite" style={[type.small, { color: paper.inkSoft }]}>Updating your circle…</Text>}
    {shareNote !== '' && <Text style={[type.small, { color: paper.inkSoft }]}>{shareNote}</Text>}
  </ScrollScreen>;
}
