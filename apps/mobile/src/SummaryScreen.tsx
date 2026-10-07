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
 *
 * Whole-app Stage 3A (2026-09-25) set the reading order: what went well, the
 * one sound, practise it, Done. The long-run headlines, the notebook with
 * Review and the Anki export, and another go at the conversation are behind one
 * closed More. The sound is met as a word; its symbol and the scorer's reason
 * are a detail the learner opens.
 */

import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { buildEntries, focusDrillSteps, toAnkiTsv, LESSONS, type ProgressReport, type SessionSummary, type Lesson } from '@luvani/core';
import { HAIRLINE, HIT, paper, signal, space, type } from './theme.ts';
import { SOUND_DETAIL, heldSoundsLine, soundExampleWord, soundInWord } from './tutor/soundExample.ts';
import { Card, Label, PillButton, OutlineButton, GhostButton, ArrowRight, Stat } from './components.tsx';
import { ScrollScreen, ScreenHeader } from './layout.tsx';
import { useHardwareBack } from './nav/useHardwareBack.ts';
import { FocusDrillPlayer } from './drill/FocusDrillPlayer.tsx';
import { saveTextFile } from './progress/saveFile.ts';
import { EndCard } from './celebrate/EndCard.tsx';
import type { GameDelta } from './game/delta.ts';

export function SummaryScreen({
  lesson,
  summary,
  delta = null,
  release,
  report,
  historySaveFailed = false,
  onAgain,
  onReview,
  onDone,
}: {
  lesson: Lesson;
  summary: SessionSummary;
  /**
   * What finishing this lesson changed, as the settle pipeline read it back
   * (`game/settle.ts`), for the end card. Null until it has, and for good when
   * it settled nothing: then no end card is drawn and no number is guessed.
   */
  delta?: GameDelta | null;
  /**
   * The celebration hold the lesson took before it settled (F766), handed to
   * the end card, which lets it go when the card goes.
   */
  release?: () => void;
  /** Progress across all stored sessions. Null until there is enough history. */
  report?: ProgressReport | null;
  /** Native storage did not confirm the history write; never present a saved total. */
  historySaveFailed?: boolean;
  onAgain: () => void;
  /** Opens the review deck, while today's words are still warm. Optional: no prop, no button. */
  onReview?: () => void;
  /** The chevron out of the end card. The navigator hands back whichever tab launched the lesson. */
  onDone: () => void;
}) {
  const focus = summary.pronunciation.focus;
  const [drilling, setDrilling] = useState(false);
  const [more, setMore] = useState(false);
  const [soundDetail, setSoundDetail] = useState(false);
  // A word first: the one this learner said worst in this lesson, else the
  // inventory's own beginner example. The symbol is behind the toggle.
  const focusWord = focus ? soundExampleWord(focus.phoneme.ipa, focus.stat.worstWord) ?? focus.phoneme.ipa : '';
  const heldWords = summary.pronunciation.wins
    .map((w) => soundExampleWord(w.ipa))
    .filter((word): word is string => word !== null);
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
          {/* The end card leads with the scene's own name, set at display size
              on the paper itself (notebook Phase 4: the postcard and the
              feature panel retired). Digits are welcome from here down: the
              no-numbers rule holds mid-session, and a card that cannot say how
              long it took would be coy. */}
          <Text accessibilityRole="header" style={[type.display, { color: paper.ink }]}>
            {lesson.title}
          </Text>
          <Text style={[type.small, { color: paper.inkSoft, marginTop: space(2) }]}>
            {summary.turnsCompleted} turns practised · {mins > 0 ? `${mins} min ` : ''}
            {secs}s
          </Text>
        </View>

        {/* The end card in place: XP, time, the goal ring and quests, every
            number the settle's read-back of this lesson. Its words count is
            the Stat below, so it passes no count of its own. */}
        {delta !== null && <EndCard delta={delta} release={release} />}

        {historySaveFailed && <Text accessibilityRole="alert" style={[type.body, { color: paper.inkSoft }]}>Your lesson history could not be confirmed as saved. This practice card is available until you leave; totals from your saved history are not shown.</Text>}

        {/* ── what went well ────────────────────────────────────────── */}
        <View>
          <Label>Your practice today</Label>
          <View style={st.stats}>
            <Stat value={String(summary.wordsProduced.length)} label="Words used" />
            <Stat value={`${summary.longestTurnSec.toFixed(1)}s`} label="Longest turn" />
          </View>
        </View>

        {heldWords.length > 0 && (
          <View style={st.wins}>
            <Label color={signal.good}>What held up</Label>
            <Text style={[type.body, { color: paper.inkSoft, marginTop: space(1.5) }]}>{heldSoundsLine(heldWords)}</Text>
          </View>
        )}

        {/* ── the one thing to work on ───────────────────────────────── */}
        {focus ? (
          <View style={{ gap: space(3) }}>
            <Card>
              <Label>One sound to practise next</Label>
              {/* A word first, because a beginner can hear a word in their
                  head and cannot hear a symbol. The notation and the scorer's
                  reason are there for anyone who opens them. */}
              <Text style={[type.frenchLg, { color: paper.ink, marginTop: space(2.5) }]}>{soundInWord(focusWord)}</Text>
              <Text style={[type.bodyStrong, { color: paper.ink, marginTop: space(2) }]}>{focus.phoneme.cue}</Text>
              {focus.phoneme.trick && (
                <Text style={[type.small, { color: paper.inkSoft, marginTop: space(2) }]}>{focus.phoneme.trick}</Text>
              )}
              <View style={st.divider} />
              <Pressable
                onPress={() => setSoundDetail((open) => !open)}
                accessibilityRole="button"
                accessibilityState={{ expanded: soundDetail }}
                style={({ pressed }) => [st.disclosure, pressed && st.pressed]}
              >
                <Text style={[type.small, { color: paper.ink }]}>{soundDetail ? SOUND_DETAIL.hide : SOUND_DETAIL.show}</Text>
              </Pressable>
              {soundDetail && <Text style={[type.notation, { color: paper.inkSoft }]}>/{focus.phoneme.ipa}/</Text>}
              {soundDetail && <Text style={[type.body, { color: paper.inkSoft, marginTop: space(2) }]}>{focus.reason}</Text>}
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
                    {soundDetail && <Text style={[type.notation, { color: paper.inkSoft }]}>/{i.ipa}/</Text>}
                  </View>
                ))}
              </View>

              {/* The screen's one solid action, so the drill reads as the
                  recommended next step. It opens in place rather than on a
                  route: a drill is a state this card is in, not somewhere else
                  the learner has gone. */}
              <View style={{ marginTop: space(4) }}>
                <PillButton
                  label="Practise this sound"
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
            <Text style={[type.title, { color: paper.ink }]}>Your pronunciation was not assessed.</Text>
            <Text style={[type.body, { color: paper.inkSoft, marginTop: space(2) }]}>
              There was no pronunciation result for this lesson. The French you practised is under More.
            </Text>
          </Card>
        ) : (
          <Card>
            <Text style={[type.title, { color: paper.ink }]}>Keep building on this.</Text>
            <Text style={[type.body, { color: paper.inkSoft, marginTop: space(2) }]}>
              No focus sound was selected this time. Your words and another go at the conversation are under More.
            </Text>
          </Card>
        )}

        <GhostButton label="Finish lesson" onPress={onDone} />

        {/* ── More: everything else, one tap away and closed by default ──
            Drawn after Done so opening it never pushes the way out down. */}
        <View>
          <Pressable
            onPress={() => setMore((open) => !open)}
            accessibilityRole="button"
            accessibilityLabel={more ? 'Hide more from this lesson' : 'More from this lesson'}
            accessibilityState={{ expanded: more }}
            style={({ pressed }) => [st.disclosure, pressed && st.pressed]}
          >
            <Text style={[type.small, { color: paper.ink }]}>{more ? 'Show less' : 'More'}</Text>
          </Pressable>
          {more && (
            <View style={st.more}>
              {/* The since-you-started block. Only appears once there is real
                  history, and never more than three sentences. */}
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
                  {/* One white card of lines rather than a scatter of chips
                      (F584). */}
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

              <OutlineButton label="Practise the conversation again" onPress={onAgain} />
            </View>
          )}
        </View>
      </View>
    </ScrollScreen>
  );
}

const st = StyleSheet.create({
  scroll: { paddingTop: space(3), paddingBottom: space(8), gap: space(7) },
  head: { alignItems: 'stretch' },
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
  disclosure: { minHeight: HIT, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  more: { gap: space(7), marginTop: space(3) },
  words: { marginTop: space(3) },
  word: { paddingVertical: space(2) },
  worded: { borderTopWidth: HAIRLINE, borderTopColor: paper.lineOnCard },
});
