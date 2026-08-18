/**
 * The conversation as a thread.
 *
 * Chat conventions, translated into this world rather than imported from it:
 * no timestamps, no avatars, no tails, no read receipts. What a learner needs
 * is which of us said it and what it meant, so a bubble carries the French in
 * the serif with its gloss underneath, and nothing else.
 *
 * Three kinds, not two. The narrator sets the scene and is not a character in
 * it, so narration gets no side and no bubble — giving it one would make the
 * scene-setting sound like a third speaker.
 *
 * A recast renders under the learner line it corrects. A correction that
 * floats free at the bottom of a screen is one the learner has to match back up
 * themselves, which is most of the reason recasts fail to land.
 */

import { useRef } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { paper, signal, space, type, radius, HAIRLINE } from '../theme.ts';
import type { TurnLine } from '../live/turns.ts';

function Recast({ quote, better, betterEn, why }: { quote: string; better: string; betterEn: string; why: string }) {
  return (
    <View style={st.recast}>
      <Text style={[type.small, { color: paper.inkFaint, textDecorationLine: 'line-through' }]}>{quote}</Text>
      <Text style={[type.french, { color: paper.ink, marginTop: space(0.5) }]}>{better}</Text>
      <Text style={[type.small, { color: paper.inkSoft }]}>{betterEn}</Text>
      <Text style={[type.small, { color: paper.inkFaint, marginTop: space(1) }]}>{why}</Text>
    </View>
  );
}

function Line({ turn }: { turn: TurnLine }) {
  if (turn.who === 'narration') {
    return (
      <View style={st.narration}>
        <Text style={[type.small, { color: paper.inkSoft, textAlign: 'center' }]}>{turn.en ?? turn.fr}</Text>
      </View>
    );
  }

  const learner = turn.who === 'learner';
  return (
    <View style={learner ? st.rowRight : st.rowLeft}>
      <View style={{ maxWidth: '82%' }}>
        <View style={learner ? st.learnerBubble : st.tutorBubble}>
          <Text style={[type.french, { color: paper.ink }]}>{turn.fr}</Text>
          {turn.frWritten && turn.frWritten !== turn.fr ? (
            <Text style={[type.small, { color: paper.inkFaint, marginTop: space(0.5) }]}>{turn.frWritten}</Text>
          ) : null}
          {turn.en ? <Text style={[type.small, { color: paper.inkSoft, marginTop: space(0.5) }]}>{turn.en}</Text> : null}
        </View>
        {turn.recasts?.map((r) => (
          <Recast key={r.better} {...r} />
        ))}
      </View>
    </View>
  );
}

export function Transcript({ turns }: { turns: readonly TurnLine[] }) {
  const ref = useRef<ScrollView>(null);

  return (
    <ScrollView
      ref={ref}
      style={st.scroll}
      contentContainerStyle={st.content}
      showsVerticalScrollIndicator={false}
      // A plain ScrollView rather than a FlatList: the list is capped at forty
      // and windowing would fight the stick-to-bottom below.
      onContentSizeChange={() => ref.current?.scrollToEnd({ animated: true })}
      accessibilityLabel="Your conversation so far"
    >
      {turns.map((t) => (
        <Line key={t.id} turn={t} />
      ))}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  // minHeight 0 is what stops a flex child from refusing to shrink and pushing
  // the controls off the bottom of the screen.
  scroll: { flex: 1, minHeight: 0 },
  // Short conversations sit against the controls instead of stranded at the top.
  content: { flexGrow: 1, justifyContent: 'flex-end', gap: space(3), paddingVertical: space(3) },
  rowLeft: { alignItems: 'flex-start' },
  rowRight: { alignItems: 'flex-end' },
  tutorBubble: {
    backgroundColor: paper.card,
    borderWidth: HAIRLINE,
    borderColor: paper.lineOnCard,
    borderRadius: radius.card,
    borderBottomLeftRadius: 4,
    paddingHorizontal: space(3.5),
    paddingVertical: space(2.5),
  },
  learnerBubble: {
    backgroundColor: paper.groundDeep,
    borderRadius: radius.card,
    borderBottomRightRadius: 4,
    paddingHorizontal: space(3.5),
    paddingVertical: space(2.5),
  },
  narration: { paddingHorizontal: space(4), paddingVertical: space(1) },
  recast: {
    marginTop: space(1.5),
    paddingLeft: space(3),
    borderLeftWidth: 2,
    borderLeftColor: signal.correspondance,
  },
});
