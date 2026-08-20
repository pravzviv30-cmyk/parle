/**
 * Leaderboard — Global and Friends.
 *
 * The global board stays an honest empty state, and stays one until there is
 * a backend to be honest about: a shared board needs a server, and there is
 * no database anywhere in the repo. The friends board, though, now works end
 * to end — against the friends adapter seam, which today serves clearly
 * marked sample profiles from on-device storage. Nothing on this screen is a
 * lie: every sample row wears a Sample chip, and the only real numbers here
 * are the learner's own.
 *
 * The toggle is real, because it costs nothing and it is the screen's actual
 * shape. TabBar is reused unchanged — it is exactly the right primitive.
 */

import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { paper, space, type, HAIRLINE, HIT } from '../theme.ts';
import { Card, Label, TabBar } from '../components.tsx';
import { NobodyYet } from '../illustrations.tsx';
import { useAuth } from '../auth/useAuth.tsx';
import { useProfile } from '../app/ProfileContext.tsx';
import { withUsername } from '../profile/store.ts';
import { earnedXp } from '../progress/activity.ts';
import { friends } from '../friends/adapter.ts';
import { defaultUsername } from '../friends/logic.ts';
import { Monogram, PersonPlusGlyph, SampleChip } from '../friends/ui.tsx';
import type { FriendEntry } from '../friends/types.ts';

type Board = 'global' | 'friends';

interface Row {
  key: string;
  name: string;
  username: string | null;
  xp: number | null;
  preview: boolean;
  you: boolean;
}

export function LeaderboardTab() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<{ navigate: (screen: string) => void }>();
  const { user } = useAuth();
  const { profile, update } = useProfile();
  const [board, setBoard] = useState<Board>('global');
  const [friendRows, setFriendRows] = useState<FriendEntry[]>([]);
  const [myXp, setMyXp] = useState(0);

  // Opening the friends surface is the moment the learner needs to BE someone:
  // claim their username once, deterministically, and keep it forever.
  useEffect(() => {
    if (board === 'friends' && profile.username === null && user) {
      update(withUsername(profile, defaultUsername(profile.name, user.id)));
    }
  }, [board, profile, user, update]);

  const reload = useCallback(() => {
    void friends.getFriends().then(setFriendRows);
    void earnedXp().then(setMyXp);
  }, []);

  // Re-read on every return, like Home: a sitting finished elsewhere should be
  // on the board the moment the learner comes back to look.
  useFocusEffect(reload);
  useEffect(() => friends.onChange(reload), [reload]);

  const you: Row = {
    key: 'you',
    name: profile.name ?? 'You',
    username: profile.username,
    xp: myXp,
    preview: false,
    you: true,
  };
  const rows: Row[] = [
    you,
    ...friendRows.map((f) => ({
      key: f.id,
      name: f.displayName ?? f.username,
      username: f.username,
      xp: f.xp,
      preview: f.preview,
      you: false,
    })),
  ].sort((a, b) => (b.xp ?? 0) - (a.xp ?? 0));

  return (
    <View style={[st.root, { paddingTop: insets.top + space(4) }]}>
      <View style={st.headerRow}>
        <Text style={[type.title, { color: paper.ink, flex: 1 }]}>Leaderboard</Text>
        <Pressable
          onPress={() => nav.navigate('AddFriends')}
          accessibilityRole="button"
          accessibilityLabel="Add friends"
          style={({ pressed }) => [st.addButton, pressed && { opacity: 0.6 }]}
        >
          <PersonPlusGlyph />
        </Pressable>
      </View>

      <View style={{ marginTop: space(4) }}>
        <TabBar
          tabs={[
            { key: 'global', label: 'Global' },
            { key: 'friends', label: 'Friends' },
          ]}
          active={board}
          onChange={setBoard}
        />
      </View>

      <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>
        {board === 'global' ? (
          <>
            {/* The global board is empty until there is a server, so this one
                has to be charming rather than sorry. */}
            <View style={st.emptyArt}>
              <NobodyYet width={180} />
            </View>
            <Card>
            <Text style={[type.bodyStrong, { color: paper.ink }]}>
              A board the whole world shares needs a server to keep score, and Parle does not have one yet. It is
              coming.
            </Text>
            <Text style={[type.small, { color: paper.inkSoft, marginTop: space(2) }]}>
              Everything you learn is saved on this device in the meantime. Nothing is lost by waiting.
            </Text>
            </Card>
          </>
        ) : friendRows.length === 0 ? (
          <>
            <View style={st.emptyArt}>
              <NobodyYet width={180} />
            </View>
            <Card>
            <Text style={[type.bodyStrong, { color: paper.ink }]}>
              Your board is waiting on its first friend. Tap the little person up top to add one.
            </Text>
            <Text style={[type.small, { color: paper.inkSoft, marginTop: space(2) }]}>
              Until friend servers arrive, the people you can add are sample profiles. They are marked, and the flow
              works end to end.
            </Text>
            </Card>
          </>
        ) : (
          <Card padded={false}>
            {rows.map((row, i) => (
              <View key={row.key} style={[st.row, i > 0 && st.rowRule]}>
                <Text style={[type.small, { color: paper.inkFaint, width: space(5) }]}>{i + 1}</Text>
                <Monogram letter={row.name} />
                <View style={{ flex: 1 }}>
                  <View style={st.nameRow}>
                    <Text style={[type.bodyStrong, { color: paper.ink }]} numberOfLines={1}>
                      {row.name}
                    </Text>
                    {row.you && <Label color={paper.inkFaint}>You</Label>}
                    {row.preview && <SampleChip />}
                  </View>
                  {row.username !== null && (
                    <Text style={[type.small, { color: paper.inkFaint, marginTop: 2 }]}>{row.username}</Text>
                  )}
                </View>
                {row.xp !== null ? (
                  <Text style={[type.bodyStrong, { color: paper.ink }]}>{row.xp} XP</Text>
                ) : (
                  <Text style={[type.small, { color: paper.inkFaint }]}>new</Text>
                )}
              </View>
            ))}
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  emptyArt: { alignItems: 'center', marginBottom: space(4) },
  root: { flex: 1, backgroundColor: paper.ground, paddingHorizontal: space(5) },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  addButton: {
    width: HIT,
    height: HIT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { flexGrow: 1, paddingTop: space(6), paddingBottom: space(3) },
  row: {
    minHeight: HIT + 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    paddingVertical: space(2.5),
    paddingHorizontal: space(4),
  },
  rowRule: { borderTopWidth: HAIRLINE, borderTopColor: paper.lineOnCard },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: space(2), flexWrap: 'wrap' },
});
