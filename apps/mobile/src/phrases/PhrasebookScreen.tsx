/**
 * Everything the learner can say, grouped by the conversation it came from.
 *
 * Rendered in place from Home rather than pushed as a route, because the six
 * files that own the navigator are being edited elsewhere right now and a
 * screen that needs no route is not worth a merge. It behaves as a screen:
 * its own paper, its own header, one way back.
 *
 * The marks are `PathNodeRow`'s vocabulary, deliberately: a learner who has
 * seen the practice path already knows that a filled green dot means learned
 * and a ring means come back to it. A second grammar for the same three states
 * would be two things to learn instead of one.
 */

import { useMemo } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { paper, papers, signal, space, type, radius, HAIRLINE } from '../theme.ts';
import { Label, Stat } from '../components.tsx';
import { Screen, ScreenHeader } from '../layout.tsx';
import { useHardwareBack } from '../nav/useHardwareBack.ts';
import { Phrasebook as PhrasebookScene } from '../illustrations.tsx';
import { LESSONS_GROUP, type Hold, type Phrase, type Phrasebook } from './phrasebook.ts';

/** Practice and its deck have their own light, and this is part of that room. */
const PAPER = papers.sky;

const HOLD_LABEL: Record<Hold, string> = {
  steady: 'Steady',
  'coming-back': 'Coming back',
  new: 'New',
};

function Mark({ hold }: { hold: Hold }) {
  if (hold === 'steady') return <View style={[st.mark, st.steady]} />;
  if (hold === 'coming-back') return <View style={[st.mark, st.comingBack]} />;
  return <View style={[st.mark, st.new]} />;
}

export function PhrasebookScreen({ book, onDone }: { book: Phrasebook; onDone: () => void }) {
  // Opened in place from Home and My French, so Android's hardware back closes
  // it rather than popping the tab underneath.
  useHardwareBack(true, onDone);
  const rows = useMemo(
    () =>
      book.groups.flatMap((group) => [
        { kind: 'group' as const, id: `group:${group.id}`, groupId: group.id, title: group.title },
        ...group.phrases.map((phrase) => ({ kind: 'phrase' as const, id: phrase.id, phrase })),
      ]),
    [book.groups],
  );

  const subtitle = useMemo(() => {
    if (book.topics === 0) return 'Lines you have said and kept.';
    if (book.topics === 1) return 'Lines you have said, from the conversation you had.';
    return 'Lines you have said, grouped by the conversation they came out of.';
  }, [book.topics]);

  return (
    <Screen ground={PAPER.ground} bottom="inset" header={<ScreenHeader back={{ onPress: onDone }} />}>
      <FlatList
        data={rows}
        style={{ flex: 1 }}
        keyExtractor={(row) => row.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={st.scroll}
        initialNumToRender={14}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews
        ListHeaderComponent={
          <>
            <View style={st.hero}>
              <PhrasebookScene width={190} />
            </View>
            <Text style={st.headline} accessibilityRole="header">
              What you can say now
            </Text>
            <Text style={st.subline}>{subtitle}</Text>
            <View style={st.stats}>
              <Stat value={String(book.count)} label="Phrases" />
              {book.topics > 0 && <Stat value={String(book.topics)} label="Conversations" />}
            </View>
          </>
        }
        renderItem={({ item }) =>
          item.kind === 'group' ? (
            <View style={st.group}>
              <Label color={item.groupId === LESSONS_GROUP ? paper.inkFaint : PAPER.accent}>{item.title}</Label>
            </View>
          ) : (
            <PhraseRow phrase={item.phrase} />
          )
        }
      />
    </Screen>
  );
}

function PhraseRow({ phrase }: { phrase: Phrase }) {
  return (
    <View style={st.card}>
      <Mark hold={phrase.hold} />
      <View style={st.words}>
        <Text style={[type.french, { color: paper.ink }]}>{phrase.front}</Text>
        <Text style={[type.small, { color: paper.inkSoft }]}>{phrase.back}</Text>
      </View>
      <Text style={[type.small, { color: paper.inkFaint }]}>{HOLD_LABEL[phrase.hold]}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  scroll: { paddingBottom: space(8) },
  hero: { alignItems: 'center', marginBottom: space(3) },
  headline: { ...type.display, color: paper.ink, textAlign: 'center' },
  subline: { ...type.body, color: paper.inkSoft, textAlign: 'center', marginTop: space(2) },
  stats: { flexDirection: 'row', gap: space(8), marginTop: space(5), justifyContent: 'center' },
  group: { marginTop: space(7), marginBottom: space(2) },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    backgroundColor: paper.card,
    borderRadius: radius.card,
    borderWidth: HAIRLINE,
    borderColor: PAPER.line,
    padding: space(3.5),
    marginBottom: space(2),
  },
  words: { flex: 1, gap: space(0.5) },
  mark: { width: 12, height: 12, borderRadius: 6 },
  steady: { backgroundColor: signal.good },
  comingBack: { borderWidth: 2, borderColor: signal.correspondance },
  new: { borderWidth: HAIRLINE, borderColor: PAPER.line },
});
