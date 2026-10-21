import { useEffect, useRef, useState } from 'react';
import { Text, View, Share } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import Svg, { Rect } from 'react-native-svg';
import { toQR } from 'toqr';
import { ScrollScreen, ScreenHeader } from '../layout.tsx';
import { useBackToHome } from '../nav/useBackToHome.ts';
import { IconAction, Card, Field, GhostButton, OutlineButton, Label } from '../components.tsx';
import { paper, space, type, decorative } from '../theme.ts';
import { useProfile } from '../app/ProfileContext.tsx';
import { useAuth } from '../auth/useAuth.tsx';
import { defaultUsername } from './logic.ts';
import { useSocial } from './useSocial.ts';
import { socialRequest } from './social.ts';
import type { RootStackParamList } from '../nav/types.ts';
import { useB } from '../main/bTheme.tsx';

export function InviteFriendsScreen() {
  const t = useB();
  const goBack = useBackToHome();
  const nav = useNavigation<{ goBack: () => void }>();
  const route = useRoute<RouteProp<RootStackParamList, 'AddFriends'>>();
  const { profile } = useProfile(); const { user } = useAuth();
  const { snapshot: s, error, act, busy } = useSocial();
  const [username, setUsername] = useState(defaultUsername(profile.name, user?.id ?? ''));
  const [query, setQuery] = useState(route.params?.username ?? '');
  const [hits, setHits] = useState<{ id: string; username: string; name: string }[]>([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [note, setNote] = useState('');
  const [qr, setQr] = useState(false);
  const searchTicket = useRef(0);
  useEffect(() => { searchTicket.current++; if (route.params?.username) setQuery(route.params.username); setHits([]); setSearched(false); return () => { searchTicket.current++; }; }, [route.params?.username]);
  const search = async () => {
    if (searching) return; setSearching(true); setNote(''); setHits([]);
    const ticket = ++searchTicket.current;
    try { const rows = await socialRequest<typeof hits>('search', { username: query.trim().toLowerCase() }); if (ticket === searchTicket.current) { setHits(rows); setSearched(true); } }
    catch (e) { if (ticket === searchTicket.current) setNote(e instanceof Error ? e.message : 'Search could not finish.'); } finally { setSearching(false); }
  };
  const link = `luvani://invite/${encodeURIComponent(s?.self.username ?? '')}`;
  const share = async () => { try { await Share.share({ message: `Learn French with me on Luvani. Add @${s?.self.username} in Friends, or open ${link}` }); } catch { setNote('The invitation could not be shared. Please try again.'); } };
  const code = qr ? toQR(link) : null;
  const size = code ? Math.sqrt(code.length) : 0;
  return <ScrollScreen bottom="inset" header={<ScreenHeader title="Add friends" back={{ onPress: goBack }} />}>
    {error !== '' && <Text accessibilityLiveRegion="polite" style={[type.body, { color: t.text }]}>{error}</Text>}
    {s && !s.settings.enabled ? <Card><Text style={[type.title, { color: t.text }]}>Choose your username</Text>
      <Text style={[type.body, { color: t.muted }]}>Only accepted friends can see your weekly score. Milestone sharing starts off. You can leave at any time.</Text>
      <Field label="Your username" value={username} onChangeText={setUsername} placeholder="e.g. james_french" autoCapitalize="none" maxLength={24} />
      <OutlineButton label={busy ? 'Setting up…' : 'Join Friends'} disabled={busy} onPress={() => void act('enrol', { username: username.trim().toLowerCase(), name: profile.name ?? 'Learner' })} />
    </Card> : s?.settings.enabled && <>
      <Card><Label>Your invitation</Label><Text style={[type.heading, { color: t.text }]}>@{s.self.username}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}><IconAction layout="inline" icon="share" label="Share invitation" onPress={() => void share()} /><IconAction layout="inline" icon="add" label={qr ? 'Hide QR code' : 'Show QR code'} onPress={() => setQr(v => !v)} /></View>
        {code && <View accessible accessibilityLabel={`Invitation QR code for ${s.self.username}. You can also use Share invitation or the username above.`} style={{ alignItems: 'center' }}><Svg {...decorative} width={220} height={220} viewBox={`0 0 ${size + 8} ${size + 8}`}><Rect width={size + 8} height={size + 8} fill={paper.card} />{Array.from(code).map((cell, i) => cell ? <Rect key={i} x={i % size + 4} y={Math.floor(i / size) + 4} width={1} height={1} fill={paper.ink} /> : null)}</Svg></View>}
      </Card>
      <View style={{ marginTop: space(4), gap: space(2) }}><Field label="Friend's username" value={query} onChangeText={v => { searchTicket.current++; setQuery(v); setSearched(false); setHits([]); }} placeholder="e.g. james_french" autoCapitalize="none" maxLength={24} /><OutlineButton label={searching ? 'Searching…' : 'Find friend'} disabled={searching || query.trim().length < 3} onPress={() => void search()} /></View>
      {searched && !hits.length && <Text style={[type.body, { color: t.muted }]}>Nobody available with that username. Check it with your friend or share your invitation.</Text>}
      {hits.map(p => <Card key={p.id} style={{ marginTop: space(3) }}><Text style={[type.bodyStrong, { color: t.text }]}>{p.name} · @{p.username}</Text>
        {s.friends.some(f => f.id === p.id) ? <Text>Already friends</Text> : s.requests.some(r => r.username === p.username) ? <Text>Request waiting</Text> : <IconAction layout="inline" icon="user-add" label="Send friend request" onPress={() => void act('request', { username: p.username })} />}
      </Card>)}
      <View style={{ marginTop: space(5), gap: space(3) }}><Label>Requests</Label>
        {!s.requests.length && <Text style={[type.body, { color: t.muted }]}>No requests waiting.</Text>}
        {s.requests.map(r => <Card key={r.id}><Text style={[type.bodyStrong, { color: t.text }]}>{r.name} · @{r.username}</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {r.direction === 'incoming' && <IconAction layout="inline" icon="tick-circle" label="Accept" onPress={() => void act('accept', { id: r.id })} />}
          <GhostButton label={r.direction === 'incoming' ? 'Decline' : 'Cancel request'} onPress={() => void act(r.direction === 'incoming' ? 'decline' : 'cancel', { id: r.id })} />
        </View></Card>)}
      </View>
    </>}
    {note !== '' && <Text accessibilityLiveRegion="polite" style={[type.body, { color: t.text }]}>{note}</Text>}
  </ScrollScreen>;
}
