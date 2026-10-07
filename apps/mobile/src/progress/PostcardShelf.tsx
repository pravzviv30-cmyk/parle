/**
 * Progress's postcard shelf (F769; README Part 5.F): the place postcards a
 * learner earned by finishing scenes on their own, as a row of drawings under
 * a heading row that opens the Postcards screen.
 *
 * It replaces the "Place postcards" ledger row. The drawings are the
 * catalogue's postcards for each earned scene (`recap/postcardArt.ts`), still
 * and decorative: the heading row is the one target and says what it opens,
 * and the scenes themselves are named on the Postcards screen. The tab gates
 * it on there being at least one earned postcard, so it is never drawn empty
 * and there are no locked slots.
 */

import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { MissionProgress } from '@luvani/core';

import { Illustration } from '../art/flat/Illustration.tsx';
import { ChevronRight, Card, Press } from '../components.tsx';
import { postcardIllustration } from '../recap/postcardArt.ts';
import { HIT, decorative, paper, space, type } from '../theme.ts';

export const POSTCARDS_TITLE = 'Place postcards';
export const POSTCARDS_GLOSS = 'Scenes you can handle on your own';

export function PostcardShelf({ postcards, onOpen }: { postcards: readonly MissionProgress[]; onOpen: () => void }) {
  return (
    <Card style={st.card}>
      <Press haptic="light" accessibilityRole="button" accessibilityLabel={`${POSTCARDS_TITLE}, ${POSTCARDS_GLOSS}`} onPress={onOpen} style={st.head}>
        <View style={st.words}>
          <Text style={[type.label, { color: paper.ink }]}>{POSTCARDS_TITLE}</Text>
          <Text style={[type.small, { color: paper.inkSoft }]}>{POSTCARDS_GLOSS}</Text>
        </View>
        <ChevronRight size={20} color={paper.inkSoft} />
      </Press>
      <View {...decorative}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.row}>
          {postcards.map((card) => (
            <Illustration key={card.mission.id} name={postcardIllustration(card.mission.id)} fit="small" />
          ))}
        </ScrollView>
      </View>
    </Card>
  );
}

const st = StyleSheet.create({
  card: { gap: space(3) },
  head: { minHeight: HIT, flexDirection: 'row', alignItems: 'center', gap: space(3) },
  words: { flex: 1, minWidth: 0 },
  row: { gap: space(3) },
});
