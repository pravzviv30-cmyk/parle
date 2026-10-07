/**
 * Progress's badge shelf (F769; README Part 5.F, D6): the badges earned, each
 * with what was done and when, and at most three ahead, each with how it is
 * earned.
 *
 * From the awards the game store keeps for good, through `progressView.ts`.
 * There is no catalogue grid and no "locked", "remaining" or "collect" here:
 * an earned medal is in colour, a badge ahead is the same medal in the paper
 * greys with a plain line on how to earn it. The medals are decorative; each
 * tile says its badge in words. Unread, the shelf is not drawn.
 */

import { StyleSheet, Text, View } from 'react-native';

import { Card } from '../components.tsx';
import { HIT, paper, space, type } from '../theme.ts';
import { Medal } from './art/Medal.tsx';
import { useGame } from './GameProvider.tsx';
import { badgeShelfView, type BadgeView } from './progressView.ts';

const MEDAL = space(12);

export function BadgeShelf() {
  const view = useGame().view;
  const shelf = badgeShelfView(view === null ? null : view.badges);
  if (shelf === null) return null;
  return (
    <Card style={st.card}>
      <Text accessibilityRole="header" style={[type.heading, { color: paper.ink }]}>{shelf.heading}</Text>
      {shelf.empty !== null ? <Text style={[type.body, { color: paper.inkSoft }]}>{shelf.empty}</Text> : null}
      {shelf.earned.length > 0 ? <View style={st.shelf}>{shelf.earned.map((badge) => <BadgeTile key={badge.id} badge={badge} />)}</View> : null}
      {shelf.next.length > 0 ? (
        <>
          <Text accessibilityRole="header" style={[type.label, { color: paper.ink }]}>{shelf.nextHeading}</Text>
          <View style={st.shelf}>{shelf.next.map((badge) => <BadgeTile key={badge.id} badge={badge} />)}</View>
        </>
      ) : null}
    </Card>
  );
}

function BadgeTile({ badge }: { badge: BadgeView }) {
  return (
    <View style={st.tile} accessible accessibilityLabel={badge.label}>
      <Medal size={MEDAL} state={badge.medal} />
      <Text style={[type.label, st.centred, { color: paper.ink }]}>{badge.title}</Text>
      <Text style={[type.small, st.centred, { color: paper.inkSoft }]}>{badge.line}</Text>
      {badge.when !== null ? <Text style={[type.small, st.centred, { color: paper.inkSoft }]}>{badge.when}</Text> : null}
    </View>
  );
}

const st = StyleSheet.create({
  card: { gap: space(3) },
  shelf: { flexDirection: 'row', flexWrap: 'wrap', gap: space(3) },
  tile: { flexBasis: '28%', flexGrow: 1, minWidth: HIT * 2, alignItems: 'center', gap: space(1) },
  centred: { textAlign: 'center' },
});
