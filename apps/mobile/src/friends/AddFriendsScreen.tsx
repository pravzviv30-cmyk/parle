/**
 * Add friends — search, ask, and watch the answer arrive.
 *
 * A root-stack sibling, so the tab bar steps aside like it does for a drill.
 * Everything on this screen goes through the friends adapter seam: today that
 * is six clearly-marked sample profiles and an on-device list, and when friend
 * servers arrive the same screen drives the real thing unchanged.
 *
 * The screen also claims the learner's username on first open (their name as
 * a slug plus four digits) — search needs the learner to BE someone before
 * they can ask anyone else. The claim is shown quietly, never as a form.
 */

import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { paper, signal, space, type, HAIRLINE, HIT } from '../theme.ts';
import { Card, ChevronLeft, Field, GhostButton, Label } from '../components.tsx';
import { useAuth } from '../auth/useAuth.tsx';
import { useProfile } from '../app/ProfileContext.tsx';
import { withUsername } from '../profile/store.ts';
import { friends } from './adapter.ts';
import { asUsername, defaultUsername } from './logic.ts';
import { SampleChip } from './ui.tsx';
import type { FriendEntry, FriendRequest } from './types.ts';

interface Hit {
  username: string;
  displayName: string | null;
  preview: boolean;
}

type RowStatus = 'add' | 'sending' | 'waiting' | 'friends';

export function AddFriendsScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<{ goBack: () => void }>();
  const { user } = useAuth();
  const { profile, update } = useProfile();

  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [friendRows, setFriendRows] = useState<FriendEntry[]>([]);
  const [requestRows, setRequestRows] = useState<FriendRequest[]>([]);
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const [note, setNote] = useState<{ text: string; ok: boolean } | null>(null);

  // Being someone comes first: claim a username the moment this surface needs
  // one. Deterministic from the account id, so it never changes on them.
  useEffect(() => {
    if (profile.username === null && user) {
      update(withUsername(profile, defaultUsername(profile.name, user.id)));
    }
  }, [profile, user, update]);

  const reload = useCallback(() => {
    void friends.getFriends().then(setFriendRows);
    void friends.getRequests().then(setRequestRows);
  }, []);

  // The sample friend says yes moments after being asked; onChange is how the
  // Waiting row turns into a friend while the learner watches.
  useEffect(() => {
    reload();
    return friends.onChange(reload);
  }, [reload]);

  useEffect(() => {
    let cancelled = false;
    void friends.search(q).then((r) => {
      if (!cancelled) setHits(r);
    });
    return () => {
      cancelled = true;
    };
  }, [q]);

  const statusFor = (username: string): RowStatus => {
    if (friendRows.some((f) => f.username === username)) return 'friends';
    if (requestRows.some((r) => r.username === username)) return 'waiting';
    if (busy.has(username)) return 'sending';
    return 'add';
  };

  const add = async (username: string) => {
    setNote(null);
    setBusy((prev) => new Set(prev).add(username));
    const result = await friends.sendRequest(username);
    setBusy((prev) => {
      const next = new Set(prev);
      next.delete(username);
      return next;
    });
    if (result.message) setNote({ text: result.message, ok: result.ok });
  };

  const typed = asUsername(q);
  const showInvite = typed !== '' && !hits.some((h) => h.username === typed);
  const outgoing = requestRows.filter((r) => r.direction === 'outgoing');
  const incoming = requestRows.filter((r) => r.direction === 'incoming');

  return (
    <View style={[st.root, { paddingTop: insets.top + space(2) }]}>
      <View style={st.headerRow}>
        <Pressable
          onPress={() => nav.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={({ pressed }) => [st.back, pressed && { opacity: 0.6 }]}
        >
          <ChevronLeft />
        </Pressable>
        <Text style={[type.title, { color: paper.ink, flex: 1 }]}>Add friends</Text>
      </View>
      {profile.username !== null && (
        <Text style={[type.small, { color: paper.inkSoft, marginTop: space(1) }]}>
          You are {profile.username}
        </Text>
      )}

      <View style={{ marginTop: space(4) }}>
        <Field value={q} onChangeText={setQ} placeholder="Search by name or username" autoCapitalize="none" />
      </View>
      {note !== null && (
        <Text style={[type.small, { color: note.ok ? paper.inkSoft : signal.correspondance, marginTop: space(2) }]}>
          {note.text}
        </Text>
      )}

      <ScrollView
        contentContainerStyle={st.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {q.trim() === '' ? (
          <Card>
            <Text style={[type.bodyStrong, { color: paper.ink }]}>Friends find each other by username.</Text>
            <Text style={[type.small, { color: paper.inkSoft, marginTop: space(2) }]}>
              Real usernames need friend servers, and those are still being built. Until then you can try the whole
              flow with sample profiles. They are marked, so nothing here pretends to be real.
            </Text>
          </Card>
        ) : (
          <>
            {hits.length > 0 && (
              <Card padded={false}>
                {hits.map((hit, i) => {
                  const status = statusFor(hit.username);
                  return (
                    <View key={hit.username} style={[st.row, i > 0 && st.rowRule]}>
                      <View style={{ flex: 1 }}>
                        <View style={st.nameRow}>
                          <Text style={[type.bodyStrong, { color: paper.ink }]}>
                            {hit.displayName ?? hit.username}
                          </Text>
                          {hit.preview && <SampleChip />}
                        </View>
                        <Text style={[type.small, { color: paper.inkFaint, marginTop: 2 }]}>{hit.username}</Text>
                      </View>
                      {status === 'add' ? (
                        <GhostButton label="Add" color={paper.ink} onPress={() => void add(hit.username)} />
                      ) : (
                        <Text style={[type.small, { color: paper.inkFaint }]}>
                          {status === 'friends' ? 'Friends' : status === 'waiting' ? 'Waiting' : 'Sending'}
                        </Text>
                      )}
                    </View>
                  );
                })}
              </Card>
            )}

            {showInvite && (
              <Card style={hits.length > 0 ? { marginTop: space(4) } : undefined}>
                <Text style={[type.bodyStrong, { color: paper.ink }]}>
                  Nobody here is called {typed} yet.
                </Text>
                <Text style={[type.small, { color: paper.inkSoft, marginTop: space(2) }]}>
                  You can leave them a request anyway. It will wait here and go out when friend servers arrive.
                </Text>
                {statusFor(typed) === 'add' ? (
                  <View style={{ alignSelf: 'flex-start', marginTop: space(1) }}>
                    <GhostButton label="Save the request" color={paper.ink} onPress={() => void add(typed)} />
                  </View>
                ) : (
                  <Text style={[type.small, { color: paper.inkFaint, marginTop: space(2) }]}>Saved and waiting.</Text>
                )}
              </Card>
            )}
          </>
        )}

        {outgoing.length > 0 && (
          <View style={{ marginTop: space(6) }}>
            <Label>Waiting</Label>
            <Card padded={false} style={{ marginTop: space(2) }}>
              {outgoing.map((r, i) => (
                <View key={r.id} style={[st.row, i > 0 && st.rowRule]}>
                  <View style={{ flex: 1 }}>
                    <View style={st.nameRow}>
                      <Text style={[type.bodyStrong, { color: paper.ink }]}>{r.displayName ?? r.username}</Text>
                      {r.preview && <SampleChip />}
                    </View>
                    <Text style={[type.small, { color: paper.inkSoft, marginTop: 2 }]}>
                      {r.preview
                        ? 'Asked. Sample friends always say yes in a moment.'
                        : 'Saved. It will be sent when friend servers arrive.'}
                    </Text>
                  </View>
                </View>
              ))}
            </Card>
          </View>
        )}

        {incoming.length > 0 && (
          <View style={{ marginTop: space(6) }}>
            <Label>Asked you</Label>
            <Card padded={false} style={{ marginTop: space(2) }}>
              {incoming.map((r, i) => (
                <View key={r.id} style={[st.row, i > 0 && st.rowRule]}>
                  <View style={{ flex: 1 }}>
                    <View style={st.nameRow}>
                      <Text style={[type.bodyStrong, { color: paper.ink }]}>{r.displayName ?? r.username}</Text>
                      {r.preview && <SampleChip />}
                    </View>
                    <Text style={[type.small, { color: paper.inkFaint, marginTop: 2 }]}>{r.username}</Text>
                  </View>
                  <GhostButton label="Accept" color={paper.ink} onPress={() => void friends.acceptRequest(r.id)} />
                  <GhostButton label="Decline" onPress={() => void friends.declineRequest(r.id)} />
                </View>
              ))}
            </Card>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: paper.ground, paddingHorizontal: space(5) },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  back: {
    width: HIT,
    height: HIT,
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginLeft: -space(1),
  },
  scroll: { flexGrow: 1, paddingTop: space(5), paddingBottom: space(3) },
  row: {
    minHeight: HIT + 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    paddingVertical: space(2.5),
    paddingHorizontal: space(4),
  },
  rowRule: { borderTopWidth: HAIRLINE, borderTopColor: paper.lineOnCard },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: space(2), flexWrap: 'wrap' },
});
