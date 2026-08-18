/**
 * The end-of-session card.
 *
 * There is deliberately one focus point and one drill, however many sounds went
 * badly. A beginner shown eleven red bars concludes they are bad at French and
 * closes the app; the scorer already threw the rest away, and this screen respects
 * that decision rather than quietly reintroducing a dashboard.
 *
 * Digits are welcome here — the no-numbers rule holds only mid-session, and an
 * end card that cannot say "9 words" would be coy rather than calm.
 */

import { useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { buildEntries, toAnkiTsv, LESSONS, type ProgressReport, type SessionSummary, type Lesson } from '@parle/core';
import { paper, signal, space, type, radius, HAIRLINE } from './theme.ts';
import { Card, Label, PillButton, OutlineButton, GhostButton, ArrowRight, Stat } from './components.tsx';
import { RecapPostcard } from './illustrations.tsx';
import { saveTextFile } from './progress/saveFile.ts';

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
          <View style={st.postcard}>
            <RecapPostcard width={190} />
          </View>
          <Label>End of session</Label>
          <Text style={[type.title, { color: paper.ink, marginTop: space(2) }]}>{lesson.title}</Text>
          <Text style={[type.small, { color: paper.inkSoft, marginTop: space(1) }]}>
            {summary.turnsCompleted} stops · {mins > 0 ? `${mins} min ` : ''}
            {secs}s
          </Text>
        </View>

        {/* ── the one thing to work on ───────────────────────────────── */}
        {focus ? (
          <View style={{ gap: space(3) }}>
            <Card>
              <Label color={signal.correspondance}>The sound to work on</Label>
              <Text style={[type.frenchLg, { color: paper.ink, marginTop: space(2.5) }]}>/{focus.phoneme.ipa}/</Text>
              <Text style={[type.body, { color: paper.inkSoft, marginTop: space(2) }]}>{focus.reason}</Text>
              <View style={st.divider} />
              <Text style={[type.bodyStrong, { color: paper.ink }]}>{focus.phoneme.cue}</Text>
              {focus.phoneme.trick && (
                <Text style={[type.small, { color: paper.inkSoft, marginTop: space(2) }]}>{focus.phoneme.trick}</Text>
              )}
            </Card>

            {/* the drill */}
            <Card>
              <View style={st.drillHead}>
                <Text style={[type.heading, { color: paper.ink, flex: 1 }]}>{focus.drill.title}</Text>
                <Text style={[type.label, { color: paper.inkFaint }]}>{focus.drill.durationSec}s</Text>
              </View>
              <Text style={[type.small, { color: paper.inkSoft, marginTop: space(1.5) }]}>{focus.drill.why}</Text>

              <View style={{ marginTop: space(3.5), gap: space(2) }}>
                {focus.drill.pairs?.map((p) => (
                  <View key={p.a.word + p.b.word} style={st.pair}>
                    <View style={st.pairSide}>
                      <Text style={[type.french, { color: paper.ink }]}>{p.a.word}</Text>
                      <Text style={[type.small, { color: paper.inkSoft }]}>{p.a.gloss}</Text>
                    </View>
                    <Text style={[type.notation, { color: signal.correspondance }]}>≠</Text>
                    <View style={[st.pairSide, { alignItems: 'flex-end' }]}>
                      <Text style={[type.french, { color: paper.ink }]}>{p.b.word}</Text>
                      <Text style={[type.small, { color: paper.inkSoft }]}>{p.b.gloss}</Text>
                    </View>
                  </View>
                ))}
                {focus.drill.items?.map((i) => (
                  <View key={i.word} style={st.pair}>
                    <View style={st.pairSide}>
                      <Text style={[type.french, { color: paper.ink }]}>{i.word}</Text>
                      <Text style={[type.small, { color: paper.inkSoft }]}>{i.gloss}</Text>
                    </View>
                    <Text style={[type.notation, { color: paper.inkFaint }]}>/{i.ipa}/</Text>
                  </View>
                ))}
              </View>

              {/* Not wired yet, exactly as before — the pill is the screen's one
                  solid action so the drill reads as the recommended next step. */}
              <View style={{ marginTop: space(4) }}>
                <PillButton label="Start" onPress={() => {}} icon={<ArrowRight size={16} color={paper.onInk} />} />
              </View>
            </Card>
          </View>
        ) : (
          <Card>
            <Label color={signal.good}>Nothing to work on</Label>
            <Text style={[type.title, { color: paper.ink, marginTop: space(2.5) }]}>Nothing to fix today.</Text>
            <Text style={[type.body, { color: paper.inkSoft, marginTop: space(2) }]}>
              Every sound you used held up. Next session moves you further along the line.
            </Text>
          </Card>
        )}

        {/* ── what actually moved ───────────────────────────────────── */}
        <View>
          <Label color={paper.inkFaint}>What moved today</Label>
          <View style={st.stats}>
            <Stat value={String(summary.wordsProduced.length)} label="Words said" />
            <Stat value={`${summary.longestTurnSec.toFixed(1)}s`} label="Longest turn" />
            <Stat value={`${Math.round(summary.unassistedRate * 100)}%`} label="Unaided" />
            <Stat value={`${Math.round(summary.speakingShare * 100)}%`} label="You spoke" />
          </View>
        </View>

        {summary.pronunciation.wins.length > 0 && (
          <View style={st.wins}>
            <Label color={signal.good}>What held up</Label>
            <Text style={[type.body, { color: paper.inkSoft, marginTop: space(1.5) }]}>
              You held {summary.pronunciation.wins.map((w) => `/${w.ipa}/`).join(', ')} steady. English never taught you these
              sounds. You learned them yourself.
            </Text>
          </View>
        )}

        {/* The since-you-started block. Only appears once there is real history,
            and never more than three sentences. Proof of progress, not a dashboard. */}
        {report && report.sessionCount >= 2 && report.headlines.length > 0 && (
          <Card>
            <Label color={signal.good}>Since you started</Label>
            <View style={{ marginTop: space(2.5), gap: space(2) }}>
              {report.headlines.map((h) => (
                <Text key={h} style={[type.bodyStrong, { color: paper.ink }]}>
                  {h}
                </Text>
              ))}
            </View>
            <Text style={[type.small, { color: paper.inkFaint, marginTop: space(2.5) }]}>
              {report.sessionCount} sessions so far
            </Text>
          </Card>
        )}

        {summary.wordsProduced.length > 0 && (
          <View>
            <Label color={paper.inkFaint}>Your notebook</Label>
            <View style={st.words}>
              {summary.wordsProduced.map((w) => (
                <View key={w} style={st.word}>
                  <Text style={[type.french, { color: paper.ink }]}>{w}</Text>
                </View>
              ))}
            </View>
            {onReview && (
              <View style={{ marginTop: space(3.5) }}>
                <OutlineButton label="Review" onPress={onReview} />
              </View>
            )}
            <View style={{ marginTop: space(1.5) }}>
              <GhostButton label="Export to Anki" onPress={exportCards} />
            </View>
            <Text style={[type.small, { color: paper.inkFaint, marginTop: space(1.5), textAlign: 'center' }]}>
              Downloads your words as flashcards you can import into Anki or any deck app.
            </Text>
          </View>
        )}

        <OutlineButton label="Go again" onPress={onAgain} />
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: paper.ground },
  scroll: { paddingHorizontal: space(5), paddingTop: space(3), gap: space(7) },
  postcard: { alignItems: 'center', marginBottom: space(4) },
  divider: {
    height: HAIRLINE,
    backgroundColor: paper.lineOnCard,
    marginVertical: space(3),
  },
  drillHead: { flexDirection: 'row', alignItems: 'baseline', gap: space(2) },
  pair: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    paddingVertical: space(2),
    borderBottomWidth: HAIRLINE,
    borderBottomColor: paper.lineOnCard,
  },
  pairSide: { flex: 1, gap: 2 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', marginTop: space(3) },
  stat: { width: '50%', paddingVertical: space(2.5) },
  wins: {
    borderLeftWidth: HAIRLINE + 1,
    borderLeftColor: signal.good,
    paddingLeft: space(3.5),
  },
  words: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2), marginTop: space(3) },
  word: {
    backgroundColor: paper.card,
    borderWidth: HAIRLINE,
    borderColor: paper.line,
    borderRadius: radius.chip,
    paddingVertical: space(1.5),
    paddingHorizontal: space(3),
  },
});
