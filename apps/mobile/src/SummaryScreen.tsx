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

import { useCallback, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { buildEntries, focusDrillSteps, toAnkiTsv, LESSONS, type ProgressReport, type SessionSummary, type Lesson } from '@luvani/core';
import { accent, HAIRLINE, paper, radius, signal, space, type } from './theme.ts';
import { Card, Label, PillButton, OutlineButton, GhostButton, ArrowRight, Stat } from './components.tsx';
import { ScrollScreen, ScreenHeader } from './layout.tsx';
import { useHardwareBack } from './nav/useHardwareBack.ts';
import { FocusDrillPlayer } from './drill/FocusDrillPlayer.tsx';
import { Art } from './art/Art.tsx';
import { SCREEN_ART } from './art/maps.ts';
import { saveTextFile } from './progress/saveFile.ts';

export function SummaryScreen({
  lesson,
  summary,
  report,
  onAgain,
  onReview,
  onDone,
}: {
  lesson: Lesson;
  summary: SessionSummary;
  /** Progress across all stored sessions. Null until there is enough history. */
  report?: ProgressReport | null;
  onAgain: () => void;
  /** Opens the review deck, while today's words are still warm. Optional: no prop, no button. */
  onReview?: () => void;
  /** The chevron out of the end card. The navigator hands back whichever tab launched the lesson. */
  onDone: () => void;
}) {
  const focus = summary.pronunciation.focus;
  const [drilling, setDrilling] = useState(false);
  // The focus drill opens in place, so Android's hardware back closes it back to
  // the card rather than popping the whole end card off the stack.
  useHardwareBack(drilling, () => setDrilling(false));
  const mins = Math.floor(summary.durationSec / 60);
  const secs = Math.round(summary.durationSec % 60);

  // Export everything they have ever said, not only today's words.
  const exportWords = report && report.wordsKnown.length > 0 ? report.wordsKnown : summary.wordsProduced;
  const exportCards = useCallback(() => {
    void saveTextFile('luvani-words.txt', toAnkiTsv(buildEntries(exportWords, LESSONS)), 'text/tab-separated-values');
  }, [exportWords]);

  if (drilling && focus) {
    return <FocusDrillPlayer drill={focus.drill} onDone={() => setDrilling(false)} />;
  }

  return (
    <ScrollScreen header={<ScreenHeader back={{ onPress: onDone }} />}>
      <View style={st.scroll}>
        <View style={st.head}>
          <View style={st.postcard}>
            <Art name={SCREEN_ART.recap} />
          </View>
          {/* The end card leads with the scene's own name, set at display size
              and centred over the postcard the way the mockup draws it. Digits
              are welcome from here down: the no-numbers rule holds mid-session,
              and a card that cannot say how long it took would be coy. */}
          <Text accessibilityRole="header" style={[type.display, { color: paper.ink, textAlign: 'center' }]}>
            {lesson.title}
          </Text>
          <Text style={[type.small, { color: paper.inkSoft, marginTop: space(2), textAlign: 'center' }]}>
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
                <Text style={[type.label, { color: paper.inkSoft }]}>{focus.drill.durationSec}s</Text>
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
                    <Text style={[type.notation, { color: paper.inkSoft }]}>/{i.ipa}/</Text>
                  </View>
                ))}
              </View>

              {/* The screen's one solid action, so the drill reads as the
                  recommended next step. It opens in place rather than on a
                  route: a drill is a state this card is in, not somewhere else
                  the learner has gone. */}
              <View style={{ marginTop: space(4) }}>
                <PillButton
                  label="Start"
                  onPress={() => setDrilling(true)}
                  disabled={focusDrillSteps(focus.drill).length === 0}
                  icon={<ArrowRight size={16} color={paper.onInk} />}
                />
              </View>
            </Card>
          </View>
        ) : summary.pronunciationStatus === 'unavailable' ? (
          /* Said plainly, because the alternative is worse. A session nobody
             listened to used to render the card below — "every sound you used
             held up" — to a learner whose audio never reached the scorer at all.
             Quiet, unalarming, and true: no red, no apology, no fault. */
          <Card>
            <Text style={[type.title, { color: paper.ink }]}>We did not listen this time.</Text>
            <Text style={[type.body, { color: paper.inkSoft, marginTop: space(2) }]}>
              Your pronunciation was not scored in this session, so there is nothing to report on it. Everything else
              below still counts.
            </Text>
          </Card>
        ) : (
          <Card>
            <Text style={[type.title, { color: paper.ink }]}>Nothing to fix today.</Text>
            <Text style={[type.body, { color: paper.inkSoft, marginTop: space(2) }]}>
              Every sound you used held up. Next session moves you further along the line.
            </Text>
          </Card>
        )}

        {/* ── what actually moved ───────────────────────────────────── */}
        <View>
          <Label>What moved today</Label>
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
            <Text style={[type.small, { color: paper.inkSoft, marginTop: space(2.5) }]}>
              {report.sessionCount} sessions so far
            </Text>
          </Card>
        )}

        {summary.wordsProduced.length > 0 && (
          <View>
            <Label>Your notebook</Label>
            {/* One white card of lines rather than a scatter of chips: the
                mockup sets what the learner said as a list you read down, and
                a chip that wraps mid-phrase stops being a chip (F584). */}
            <Card style={st.words}>
              {summary.wordsProduced.map((w, index) => (
                <View key={w} style={[st.word, index > 0 && st.worded]}>
                  <Text style={[type.frenchSm, { color: paper.ink }]}>{w}</Text>
                </View>
              ))}
            </Card>
            {onReview && (
              <View style={{ marginTop: space(3.5) }}>
                <OutlineButton label="Review" onPress={onReview} />
              </View>
            )}
            <View style={{ marginTop: space(1.5) }}>
              <GhostButton label="Export to Anki" onPress={exportCards} />
            </View>
            <Text style={[type.small, { color: paper.inkSoft, marginTop: space(1.5), textAlign: 'center' }]}>
              Downloads your words as flashcards you can import into Anki or any deck app.
            </Text>
          </View>
        )}

        <OutlineButton label="Go again" onPress={onAgain} />
      </View>
    </ScrollScreen>
  );
}

const st = StyleSheet.create({
  scroll: { paddingTop: space(3), paddingBottom: space(8), gap: space(7) },
  head: { alignItems: 'stretch', padding: space(5), backgroundColor: accent.feature, borderWidth: HAIRLINE, borderColor: paper.ink, borderRadius: radius.card },
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
  wins: {
    borderLeftWidth: HAIRLINE + 1,
    borderLeftColor: signal.good,
    paddingLeft: space(3.5),
  },
  words: { marginTop: space(3) },
  word: { paddingVertical: space(2) },
  worded: { borderTopWidth: HAIRLINE, borderTopColor: paper.lineOnCard },
});
