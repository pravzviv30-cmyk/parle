/**
 * Profile's two tiles and a subscriber's freezes (F769; README Part 5.F).
 *
 * The streak tile opens the Streak screen and the level tile opens Progress;
 * the freezes line is drawn for a subscriber alone, once the plan is known
 * (D4), and a free learner is sold nothing here. Every word is
 * `profileStatsView.ts`'s, from the game layer's hooks, and the level is a
 * number, never a rank name. Its own file with its own reads, because Profile
 * reads nothing itself. Still: no count-ups on Profile. Unread, nothing.
 */

import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Press } from '../components.tsx';
import { Icon } from '../icons/Icon.tsx';
import { HIT, accent, paper, radius, space, type } from '../theme.ts';
import { Flame } from './art/Flame.tsx';
import { FreezeMark } from './art/FreezeMark.tsx';
import { useGame, useLevel, useStreak } from './GameProvider.tsx';
import { profileStatsView } from './profileStatsView.ts';

const MARK = space(8);

export function ProfileStats() {
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const view = useGame().view;
  const run = useStreak();
  const stats = profileStatsView({ streak: run, level: useLevel(), freezes: view === null ? null : view.freezes, protection: view === null ? null : view.protection });
  if (stats === null) return null;
  return (
    <View style={st.block}>
      <View style={st.tiles}>
        {stats.tiles.map((tile) => (
          <Press
            key={tile.id}
            haptic="light"
            depth="tile"
            accessibilityRole="button"
            accessibilityLabel={tile.label}
            onPress={() => nav.navigate(tile.opens)}
            frame={st.frame}
            style={st.tile}
          >
            {tile.id === 'streak' ? (
              <Flame size={MARK} state={run !== null && run.today === 'practised' ? 'lit' : 'unlit'} />
            ) : (
              <Icon name="star" variant="bulk" size={MARK} color={accent.brand} />
            )}
            <View style={st.words}>
              <Text style={[type.heading, { color: paper.ink }]}>{tile.value}</Text>
              <Text style={[type.small, { color: paper.inkSoft }]}>{tile.words}</Text>
            </View>
          </Press>
        ))}
      </View>
      {stats.freezes !== null ? (
        <View style={st.freezes} accessible accessibilityLabel={`${stats.freezes.title}: ${stats.freezes.ready}`}>
          <FreezeMark size={space(6)} state={stats.freezes.held > 0 ? 'ready' : 'used'} />
          <Text style={[type.small, { color: paper.ink }]}>{`${stats.freezes.title}: ${stats.freezes.ready}`}</Text>
        </View>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  block: { marginTop: space(4), gap: space(3) },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space(3) },
  frame: { flexBasis: '40%', flexGrow: 1, minWidth: 0 },
  tile: { minHeight: HIT + space(6), flexDirection: 'row', alignItems: 'center', gap: space(3), padding: space(4), borderRadius: radius.tile, backgroundColor: paper.card },
  words: { flexShrink: 1, minWidth: 0 },
  freezes: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
});
