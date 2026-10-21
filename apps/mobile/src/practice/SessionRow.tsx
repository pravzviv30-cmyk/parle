/**
 * One recorded conversation, drawn.
 *
 * Six null gates and a stylesheet. Everything it says was decided in
 * `practice/sessionCard.ts`, including whether each line exists at all, so a
 * card for a conversation that was never timed simply has no minutes on it
 * rather than a nought, and a pack that opened no nameable topics has no
 * topics box rather than an empty one carrying its own margin.
 *
 * The standing chip is the one place colour reports anything here, and it is
 * held to the rule in DESIGN.md: a signal is a mark, so the green is a dot and
 * the words beside it are ink. A tint is never used to say a state.
 */

import { Pressable, View, Text, StyleSheet } from 'react-native';
import { ArrowRight, Card } from '../components.tsx';
import { HIT, radius, signal, space, type } from '../theme.ts';
import type { SessionCard } from './sessionCard.ts';
import { useB, useThemedStyles, type B } from '../main/bTheme.tsx';

/** The standing dot. Small, because it marks rather than announces. */
const DOT = 8;

export function SessionRow({ session, onRevisit }: { session: SessionCard; onRevisit: () => void }) {
  const t = useB();
  const st = useThemedStyles(makeSt);
  return (
    <Card style={st.card}>
      <View style={st.meta}>
        <View style={st.when}>
          <Text style={st.whenWord}>{session.when}</Text>
        </View>
        {session.spoken !== null && (
          <View style={st.when}>
            <Text style={st.whenWord}>{session.spoken}</Text>
          </View>
        )}
        {session.standing !== null && (
          <View style={st.standing}>
            {session.standing.key === 'ready' && <View style={st.dot} />}
            <Text style={st.standingWord}>{session.standing.words}</Text>
          </View>
        )}
      </View>

      <View style={st.titles}>
        <Text style={st.titleEn}>{session.titleEn}</Text>
        <Text style={st.titleFr}>{session.titleFr}</Text>
      </View>

      {session.topics !== null && (
        <View style={st.topics}>
          <Text style={st.topicsLabel}>{session.topics.label}</Text>
          <Text style={st.topicsBody}>{session.topics.body}</Text>
        </View>
      )}

      {session.phraseKeys.length > 0 && (
        <View style={st.foot}>
          <View style={st.footWords}>
            {session.phrases !== null && <Text style={st.phrases}>{session.phrases}</Text>}
          </View>
          <Pressable onPress={onRevisit} accessibilityRole="button" style={st.door}>
            <Text style={st.doorWord}>{session.revisit}</Text>
            <ArrowRight size={18} color={t.text} />
          </Pressable>
        </View>
      )}
    </Card>
  );
}

function makeSt(t: B) {
  return StyleSheet.create({
  card: { padding: space(4) },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space(2) },
  when: {
    flexShrink: 1,
    minWidth: 0,
    backgroundColor: t.skeleton,
    borderRadius: radius.pill,
    paddingVertical: space(1),
    paddingHorizontal: space(2.5),
  },
  whenWord: { ...type.small, color: t.muted },
  // The chip's ground is the page rather than the deeper fill: soft ink
  // measures 4.5 on one and under it on the other, and these are words.
  standing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(1.5),
    flexShrink: 1,
    minWidth: 0,
    backgroundColor: t.ground,
    borderRadius: radius.pill,
    paddingVertical: space(1),
    paddingHorizontal: space(2.5),
  },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: t.text },
  standingWord: { ...type.small, color: t.text },
  titles: { marginTop: space(3) },
  titleEn: { ...type.bodyStrong, color: t.text },
  // The French is the serif, because every French line the learner reads is.
  titleFr: { ...type.french, color: t.muted, marginTop: space(1) },
  topics: {
    marginTop: space(3),
    backgroundColor: t.ground,
    borderRadius: radius.input,
    padding: space(3),
  },
  topicsLabel: { ...type.label, color: t.text },
  topicsBody: { ...type.small, color: t.muted, marginTop: space(1.5) },
  foot: { flexDirection: 'row', alignItems: 'center', gap: space(2), marginTop: space(3) },
  footWords: { flex: 1, minWidth: 0 },
  phrases: { ...type.small, color: t.muted },
  // A quiet door, at the touch floor, with its own words rather than a shared
  // control: a card's second action is not the screen's action.
  door: { flexDirection: 'row', alignItems: 'center', gap: space(1.5), minHeight: HIT, paddingHorizontal: space(1) },
  doorWord: { ...type.button, color: t.text },
});
}
