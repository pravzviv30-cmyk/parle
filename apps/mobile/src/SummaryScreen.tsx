/**
 * The end-of-session card.
 *
 * The Métro's own vocabulary does the explaining here. A *correspondance* is where
 * you change lines to get where you are actually going — which is exactly what a
 * drill is: the one change that gets this learner's French moving again.
 *
 * There is deliberately one focus point and one drill, however many sounds went
 * badly. A beginner shown eleven red bars concludes they are bad at French and
 * closes the app; the scorer already threw the rest away, and this screen respects
 * that decision rather than quietly reintroducing a dashboard.
 */

import { useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { buildEntries, toAnkiTsv, LESSONS, type ProgressReport, type SessionSummary, type Lesson } from '@parle/core';
import { enamel, signal, space, type, radius, HIT } from './theme.ts';
import { Plaque, Tag, LabeledTag, ArrowRight } from './components.tsx';
import { saveTextFile } from './progress/saveFile.ts';

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={st.stat}>
      <Text style={[type.plaqueSmall, { color: enamel.white }]}>{value}</Text>
      <Text style={[type.tag, { color: enamel.whiteFaint, marginTop: space(1) }]}>{label}</Text>
    </View>
  );
}

export function SummaryScreen({
  lesson,
  summary,
  report,
  onAgain,
  onReview,
}: {
  lesson: Lesson;
  summary: SessionSummary;
  /** Progress across all stored sessions. Null until there is enough history. */
  report?: ProgressReport | null;
  onAgain: () => void;
  /** Opens the review deck, while today's words are still warm. Optional: no prop, no button. */
  onReview?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const focus = summary.pronunciation.focus;
  const mins = Math.floor(summary.durationSec / 60);
  const secs = Math.round(summary.durationSec % 60);

  // Export everything they have ever said, not only today's words.
  const exportWords = report && report.wordsKnown.length > 0 ? report.wordsKnown : summary.wordsProduced;
  const exportCards = useCallback(() => {
    void saveTextFile('parle-words.txt', toAnkiTsv(buildEntries(exportWords, LESSONS)), 'text/tab-separated-values');
  }, [exportWords]);

  return (
    <View style={[st.root, { paddingTop: insets.top + space(2) }]}>
      <ScrollView contentContainerStyle={[st.scroll, { paddingBottom: insets.bottom + space(8) }]} showsVerticalScrollIndicator={false}>
        <View>
          <LabeledTag fr="SORTIE" en="End of session" />
          <Text style={[type.plaqueSmall, { color: enamel.white, marginTop: space(2) }]}>{lesson.title}</Text>
          <Text style={[type.small, { color: enamel.whiteMuted, marginTop: space(1) }]}>
            {summary.turnsCompleted} stops · {mins > 0 ? `${mins} min ` : ''}
            {secs}s
          </Text>
        </View>

        {/* ── the one thing to work on ───────────────────────────────── */}
        {focus ? (
          <View style={{ gap: space(3) }}>
            <Plaque raised>
              <LabeledTag fr="CORRESPONDANCE" en="The one sound to fix" color={signal.correspondance} />
              <Text style={[type.plaque, { color: enamel.white, marginTop: space(2.5) }]}>/{focus.phoneme.ipa}/</Text>
              <Text style={[type.body, { color: enamel.whiteMuted, marginTop: space(2) }]}>{focus.reason}</Text>
              <View style={st.divider} />
              <Text style={[type.bodyStrong, { color: enamel.white }]}>{focus.phoneme.cue}</Text>
              {focus.phoneme.trick && (
                <Text style={[type.small, { color: enamel.whiteMuted, marginTop: space(2) }]}>{focus.phoneme.trick}</Text>
              )}
            </Plaque>

            {/* the drill */}
            <View style={st.drill}>
              <View style={st.drillHead}>
                <Text style={[type.heading, { color: enamel.white, flex: 1 }]}>{focus.drill.title}</Text>
                <Text style={[type.tag, { color: enamel.whiteFaint }]}>{focus.drill.durationSec}s</Text>
              </View>
              <Text style={[type.small, { color: enamel.whiteMuted, marginTop: space(1.5) }]}>{focus.drill.why}</Text>

              <View style={{ marginTop: space(3.5), gap: space(2) }}>
                {focus.drill.pairs?.map((p) => (
                  <View key={p.a.word + p.b.word} style={st.pair}>
                    <View style={st.pairSide}>
                      <Text style={[type.bodyStrong, { color: enamel.white }]}>{p.a.word}</Text>
                      <Text style={[type.small, { color: enamel.whiteFaint }]}>{p.a.gloss}</Text>
                    </View>
                    <Text style={[type.notation, { color: signal.correspondance }]}>≠</Text>
                    <View style={[st.pairSide, { alignItems: 'flex-end' }]}>
                      <Text style={[type.bodyStrong, { color: enamel.white }]}>{p.b.word}</Text>
                      <Text style={[type.small, { color: enamel.whiteFaint }]}>{p.b.gloss}</Text>
                    </View>
                  </View>
                ))}
                {focus.drill.items?.map((i) => (
                  <View key={i.word} style={st.pair}>
                    <View style={st.pairSide}>
                      <Text style={[type.bodyStrong, { color: enamel.white }]}>{i.word}</Text>
                      <Text style={[type.small, { color: enamel.whiteFaint }]}>{i.gloss}</Text>
                    </View>
                    <Text style={[type.notation, { color: enamel.whiteFaint }]}>/{i.ipa}/</Text>
                  </View>
                ))}
              </View>

              <Pressable accessibilityRole="button" style={({ pressed }) => [st.drillCta, pressed && { opacity: 0.75 }]}>
                <Text style={[type.tag, { color: enamel.field }]}>COMMENCER · START</Text>
                <ArrowRight size={16} color={enamel.field} />
              </Pressable>
            </View>
          </View>
        ) : (
          <Plaque raised>
            <LabeledTag fr="RIEN À SIGNALER" en="Nothing to fix" color={signal.good} />
            <Text style={[type.plaqueSmall, { color: enamel.white, marginTop: space(2.5) }]}>Nothing to fix today.</Text>
            <Text style={[type.body, { color: enamel.whiteMuted, marginTop: space(2) }]}>
              Every sound you used held up. Next session moves you further along the line.
            </Text>
          </Plaque>
        )}

        {/* ── what actually moved ───────────────────────────────────── */}
        <View>
          <LabeledTag fr="CE QUI A BOUGÉ" en="What moved today" color={enamel.whiteFaint} />
          <View style={st.stats}>
            <Stat value={String(summary.wordsProduced.length)} label="WORDS SAID" />
            <Stat value={`${summary.longestTurnSec.toFixed(1)}s`} label="LONGEST TURN" />
            <Stat value={`${Math.round(summary.unassistedRate * 100)}%`} label="UNAIDED" />
            <Stat value={`${Math.round(summary.speakingShare * 100)}%`} label="YOU SPOKE" />
          </View>
        </View>

        {summary.pronunciation.wins.length > 0 && (
          <View style={st.wins}>
            <LabeledTag fr="TENU BON" en="What held up" color={signal.good} />
            <Text style={[type.body, { color: enamel.whiteMuted, marginTop: space(1.5) }]}>
              You held {summary.pronunciation.wins.map((w) => `/${w.ipa}/`).join(', ')} steady. English never taught you these
              sounds. You learned them yourself.
            </Text>
          </View>
        )}

        {/* The since-you-started block. Only appears once there is real history,
            and never more than three sentences. Proof of progress, not a dashboard. */}
        {report && report.sessionCount >= 2 && report.headlines.length > 0 && (
          <Plaque>
            <LabeledTag fr="DEPUIS LE DÉBUT" en="Since you started" color={signal.good} />
            <View style={{ marginTop: space(2.5), gap: space(2) }}>
              {report.headlines.map((h) => (
                <Text key={h} style={[type.bodyStrong, { color: enamel.white }]}>
                  {h}
                </Text>
              ))}
            </View>
            <Text style={[type.small, { color: enamel.whiteFaint, marginTop: space(2.5) }]}>
              {report.sessionCount} sessions so far
            </Text>
          </Plaque>
        )}

        {summary.wordsProduced.length > 0 && (
          <View>
            <LabeledTag fr="VOTRE CARNET" en="Words you said" color={enamel.whiteFaint} />
            <View style={st.words}>
              {summary.wordsProduced.map((w) => (
                <View key={w} style={st.word}>
                  <Text style={[type.small, { color: enamel.white }]}>{w}</Text>
                </View>
              ))}
            </View>
            {onReview && (
              <Pressable onPress={onReview} accessibilityRole="button" style={({ pressed }) => [st.export, pressed && { opacity: 0.7 }]}>
                <Text style={[type.tag, { color: enamel.whiteMuted }]}>RÉVISER · REVIEW THESE NOW</Text>
              </Pressable>
            )}
            <Pressable onPress={exportCards} accessibilityRole="button" style={({ pressed }) => [st.export, pressed && { opacity: 0.7 }]}>
              <Text style={[type.tag, { color: enamel.whiteMuted }]}>EXPORTER · SAVE FOR ANKI</Text>
            </Pressable>
            <Text style={[type.small, { color: enamel.whiteFaint, marginTop: space(1.5) }]}>
              Downloads your words as flashcards you can import into Anki or any deck app.
            </Text>
          </View>
        )}

        <Pressable onPress={onAgain} accessibilityRole="button" style={({ pressed }) => [st.again, pressed && { opacity: 0.8 }]}>
          <Text style={[type.tag, { color: enamel.white }]}>REPRENDRE · GO AGAIN</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: enamel.ground },
  scroll: { paddingHorizontal: space(5), paddingTop: space(3), gap: space(7) },
  divider: {
    height: 1,
    backgroundColor: 'rgba(242,239,228,0.2)',
    marginVertical: space(3),
  },
  drill: {
    backgroundColor: enamel.field,
    borderRadius: radius.plaque,
    borderWidth: 1,
    borderColor: 'rgba(242,239,228,0.24)',
    padding: space(4),
  },
  drillHead: { flexDirection: 'row', alignItems: 'baseline', gap: space(2) },
  pair: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    paddingVertical: space(2),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(242,239,228,0.1)',
  },
  pairSide: { flex: 1, gap: 2 },
  drillCta: {
    marginTop: space(4),
    minHeight: HIT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space(2),
    backgroundColor: enamel.white,
    borderRadius: radius.plaque,
  },
  stats: { flexDirection: 'row', flexWrap: 'wrap', marginTop: space(3) },
  stat: { width: '50%', paddingVertical: space(2.5) },
  wins: {
    borderLeftWidth: 1,
    borderLeftColor: signal.good,
    paddingLeft: space(3.5),
  },
  words: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2), marginTop: space(3) },
  word: {
    borderWidth: 1,
    borderColor: 'rgba(242,239,228,0.28)',
    borderRadius: 3,
    paddingVertical: space(1.5),
    paddingHorizontal: space(2.5),
  },
  export: {
    marginTop: space(3.5),
    minHeight: HIT,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(242,239,228,0.35)',
    borderRadius: radius.plaque,
  },
  again: {
    minHeight: HIT + 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: enamel.white,
    borderRadius: radius.plaque,
  },
});
