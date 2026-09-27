import { useState } from 'react';
import { Text, View, Share } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ScrollScreen, TabHeader } from '../layout.tsx';
import { Card, GhostButton, Label, OutlineButton, Field } from '../components.tsx';
import { paper, space, type, accent } from '../theme.ts';
import { ProfileButton } from '../profile/ProfileButton.tsx';
import { useSocial } from '../friends/useSocial.ts';
import { rankedFriends, POINTS_EXPLANATION, REACTIONS } from '../friends/socialModel.ts';
import { FRIENDS_PRIVACY_LINK, FRIENDS_START, FRIENDS_START_BODY, FRIENDS_START_TITLE, friendsEntry } from '../friends/friendsView.ts';

export function FriendsTab() {
  const nav = useNavigation<{ navigate: (screen: string) => void }>();
  const { snapshot: s, error, busy, act, refresh } = useSocial();
  const [points, setPoints] = useState(false);
  const [manage, setManage] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [shareNote, setShareNote] = useState('');
  const rows = s ? rankedFriends([s.self, ...s.friends]) : [];
  const entry = friendsEntry(s);
  const sharePostcard = async (partner: string) => {
    try { await Share.share({ message: `Un peu de français, ensemble. ${s?.self.name} and ${partner} made room for four French conversations together this week on Luvani.` }); }
    catch { setShareNote('The postcard could not be shared just now. Try again.'); }
  };
  return <ScrollScreen bottom="tab">
    <TabHeader title="Friends" purpose="A little French, together." trailing={<ProfileButton />} />
    {error !== '' && <Card><Text accessibilityLiveRegion="polite" style={[type.body, { color: paper.ink }]}>{error}</Text><GhostButton label="Try again" onPress={refresh} /></Card>}
    {entry === 'loading' && !error && <Text style={[type.body, { color: paper.inkSoft }]}>Opening your circle…</Text>}
    {/* Before joining: one opt-in start, with privacy a quiet link beneath it
        rather than a second door beside it (Stage 3). */}
    {entry === 'start' && <Card tone="feature">
      <Text style={[type.title, { color: paper.ink }]}>{FRIENDS_START_TITLE}</Text>
      <Text style={[type.body, { color: paper.inkSoft, marginVertical: space(3) }]}>{FRIENDS_START_BODY}</Text>
      <OutlineButton label={FRIENDS_START} onPress={() => nav.navigate('AddFriends')} />
      <GhostButton label={FRIENDS_PRIVACY_LINK} onPress={() => nav.navigate('SocialSettings')} />
    </Card>}
    {entry === 'circle' && s && <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <GhostButton label={s.requests.some(r => r.direction === 'incoming') ? 'Add friends · Requests waiting' : 'Add friends'} onPress={() => nav.navigate('AddFriends')} />
        <GhostButton label="Privacy & notifications" onPress={() => nav.navigate('SocialSettings')} />
      </View>
      <Card style={{ marginTop: space(4), gap: space(2) }}>
        <Label>This week</Label><Text style={[type.title, { color: paper.ink }]}>Your friends in French</Text>
        <Text style={[type.small, { color: paper.inkSoft }]}>Fresh week Monday · 00:00 UTC</Text>
        <GhostButton label="How learning points work" onPress={() => setPoints(v => !v)} />
        {points && <Text style={[type.small, { color: paper.inkSoft }]}>{POINTS_EXPLANATION}</Text>}
        {!s.friends.length ? <><Text style={[type.body, { color: paper.ink }]}>Invite someone you know to start your weekly board.</Text><GhostButton label="Invite a friend" onPress={() => nav.navigate('AddFriends')} /></> : rows.map(person => <View key={person.id} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space(2), padding: space(3), borderRadius: 8, backgroundColor: person.id === s.self.id ? accent.feature : paper.card }}>
          <Text style={[type.heading, { color: paper.ink }]}>{person.points === 0 ? '·' : person.rank}</Text>
          <View style={{ flex: 1, minWidth: 90 }}><Text style={[type.bodyStrong, { color: paper.ink }]}>{person.id === s.self.id ? 'You' : person.name}</Text><Text style={[type.small, { color: paper.inkSoft }]}>@{person.username}</Text></View>
          <Text style={[type.bodyStrong, { color: paper.ink }]}>{person.points ? `${person.points} points` : 'Ready when you are'}</Text>
        </View>)}
        {!s.settings.showScore && <Text style={[type.small, { color: paper.inkSoft }]}>Your score is private. You can still encourage friends and join challenges.</Text>}
      </Card>
      <View style={{ marginTop: space(5), gap: space(3) }}><Label>Together this week</Label>
        <Text style={[type.body, { color: paper.inkSoft }]}>Four conversations between two friends, counting up to one per person each day after you both join. Any unfinished challenge simply ends with the week.</Text>
        {s.challenges.map(c => <Card key={c.id} tone={c.count >= c.target ? 'feature' : 'journal'}>
          <Text style={[type.heading, { color: paper.ink }]}>You and {c.partner}</Text>
          {c.status === 'pending' ? <><Text style={[type.body, { color: paper.inkSoft }]}>{c.incoming ? 'An invitation to learn together.' : 'Invitation sent. Your partner chooses whether to join.'}</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {c.incoming && <GhostButton label="Join challenge" onPress={() => void act('acceptChallenge', { id: c.id })} />}
            <GhostButton label={c.incoming ? 'Decline' : 'Cancel invitation'} onPress={() => void act(c.incoming ? 'declineChallenge' : 'leaveChallenge', { id: c.id })} />
          </View></> : <><Text style={[type.french, { color: paper.ink }]}>{c.count >= c.target ? 'Un peu de français, ensemble.' : `${c.count} of ${c.target} conversations`}</Text>
            {c.count >= c.target ? <><Text style={[type.body, { color: paper.inkSoft }]}>Your shared postcard. A week of showing up together, now part of your story.</Text><GhostButton label="Share our postcard" onPress={() => void sharePostcard(c.partner)} /></> : <><GhostButton label="Start speaking" onPress={() => nav.navigate('Tutor')} /><GhostButton label="Leave challenge" onPress={() => void act('leaveChallenge', { id: c.id })} /></>}
          </>}
        </Card>)}
        {s.friends.map(f => <Card key={f.id}>
          <Text style={[type.bodyStrong, { color: paper.ink }]}>{f.name}</Text>
          {!s.challenges.some(c => c.partnerId === f.id) && <GhostButton label="Invite to a shared challenge" onPress={() => void act('inviteChallenge', { id: f.id })} />}
          <GhostButton label={manage === f.id ? 'Close friend options' : 'Friend options'} onPress={() => { setManage(manage === f.id ? null : f.id); setReason(''); }} />
          {manage === f.id && <View style={{ gap: space(2) }}>
            <Text style={[type.small, { color: paper.inkSoft }]}>Removing or blocking also ends shared challenges. They will not be notified.</Text>
            <GhostButton label="Remove friend" onPress={() => void act('remove', { id: f.id })} />
            <GhostButton label="Block this person" onPress={() => void act('block', { id: f.id })} />
            <Field value={reason} onChangeText={setReason} placeholder="Reason for reporting (private)" maxLength={500} />
            <OutlineButton label="Report and block" disabled={!reason.trim() || busy} onPress={() => void act('report', { id: f.id, reason: reason.trim() })} />
          </View>}
        </Card>)}
      </View>
      <View style={{ marginTop: space(5), gap: space(3) }}><Label>Small moments worth noticing</Label>
        {s.notices.some(n => !n.read) && <GhostButton label="Mark updates as read" onPress={() => void act('read')} />}
        {!s.notices.length && <Text style={[type.body, { color: paper.inkSoft }]}>Shared milestones and encouragement will appear here. Everyone controls what they share.</Text>}
        {s.notices.map(n => <Card key={n.id}><Text style={[type.body, { color: paper.ink }]}>{n.body}</Text><Text style={[type.small, { color: paper.inkSoft }]}>Week of {n.week}</Text>
          {n.actorId !== s.self.id && n.kind !== 'reaction' && <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{REACTIONS.map(reaction => <GhostButton key={reaction} label={n.reactions.includes(reaction) ? `${reaction} ✓` : reaction} onPress={() => void act('react', { id: n.id, reaction })} />)}</View>}
        </Card>)}
      </View>
    </>}
    {busy && <Text accessibilityLiveRegion="polite" style={[type.small, { color: paper.inkSoft }]}>Updating your circle…</Text>}
    {shareNote !== '' && <Text style={[type.small, { color: paper.inkSoft }]}>{shareNote}</Text>}
  </ScrollScreen>;
}
