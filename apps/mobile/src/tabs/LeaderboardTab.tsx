/**
 * Leaderboard — Global and Friends.
 *
 * Honest empty state, and it will stay honest until there is a backend to be
 * honest about. Everything the app knows about a learner today is unsigned JSON
 * in on-device storage, and there is no database anywhere in the repo — no
 * tables, no usernames, no friend graph. A board rendered from seeded local
 * numbers would be a lie told in the product's own voice, so this screen says
 * what is true instead: it is coming, and it needs a server.
 *
 * The toggle is real, because it costs nothing and it is the screen's actual
 * shape. TabBar is reused unchanged — it is exactly the right primitive.
 */

import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { paper, space, type } from '../theme.ts';
import { Card, Label, TabBar } from '../components.tsx';

type Board = 'global' | 'friends';

export function LeaderboardTab() {
  const insets = useSafeAreaInsets();
  const [board, setBoard] = useState<Board>('global');

  return (
    <View style={[st.root, { paddingTop: insets.top + space(4) }]}>
      <Text style={[type.title, { color: paper.ink }]}>Leaderboard</Text>

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
        <Card>
          <Label>Not ready yet</Label>
          <Text style={[type.bodyStrong, { color: paper.ink, marginTop: space(2) }]}>
            {board === 'global'
              ? 'A shared board needs a server to keep it, and Parle does not have one yet.'
              : 'Adding friends needs usernames, and usernames need a server to keep them unique.'}
          </Text>
          <Text style={[type.small, { color: paper.inkSoft, marginTop: space(2) }]}>
            Everything you learn is saved on this device in the meantime. Nothing is lost by waiting.
          </Text>
        </Card>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: paper.ground, paddingHorizontal: space(5) },
  scroll: { flexGrow: 1, paddingTop: space(6), paddingBottom: space(3) },
});
