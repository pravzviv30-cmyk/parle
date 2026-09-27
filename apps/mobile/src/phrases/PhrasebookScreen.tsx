/**
 * Your phrases — every line that has become the learner's, as a route (F575).
 *
 * It was an early return inside My French: rendered in place, reachable from
 * one screen, with a back arrow that was really a piece of component state.
 * That was fine while nothing else had to link to it, which stopped being true
 * the moment My French folded down to a shelf row and Settings grew a door of
 * its own. It is a stack route now, above the tabs like every other pushed
 * screen, so the bar goes with the push and an address can carry it.
 *
 * ## Three things, in the order a learner wants them
 *
 * One line to say right now, which is the only place in this part of the app
 * where a learner produces French and is deliberately the smallest possible
 * version of that (`myfrench/OneLineCard.tsx` explains why it is one card and
 * never a queue). Then the lines that came out in real conversations, grouped
 * by the conversation they came out of, each with a way to hear it said. Then
 * the words that buy a moment, which are authored, so the page has a section on
 * a first morning rather than an apology.
 *
 * Every section is absent until it is real. There is no empty state and no
 * count: the learner is looking at the list, so a total over it would be a
 * number asking to be compared with last month's, and this screen refuses
 * numbers for the reason `phrases/phrasebook.ts` already gives.
 *
 * ## What is drawn here and what is not
 *
 * `phrases/phrasebook.ts` decides which lines exist and how they are grouped,
 * `myfrench/oneLine.ts` deals the card, `myfrench/cadence.ts` owns the
 * connectors, and `phrases/phrasebookView.ts` holds the two words this screen
 * says for itself. This file reads, gates on null, and lays out.
 *
 * The voice stops when the screen goes. One that follows a learner onto
 * another tab is F304.
 */

import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { Card, Label } from '../components.tsx';
import { SpeakerGlyph } from '../glyphs.tsx';
import { ScrollScreen, ScreenHeader } from '../layout.tsx';
import * as tutorVoice from '../speech/tutorVoice.ts';
import { accent, paper, radius, space, type, HAIRLINE, HIT } from '../theme.ts';
import { loadDeck } from '../review/store.ts';
import { loadTopics } from '../topics/store.ts';
import { CadenceCard } from '../myfrench/CadenceCard.tsx';
import { OneLineCard } from '../myfrench/OneLineCard.tsx';
import { cadenceFrom, type Cadence } from '../myfrench/cadence.ts';
import { LEDGER } from '../myfrench/ledger.ts';
import { oneLineFrom, type OneLine } from '../myfrench/oneLine.ts';
import { buildPhrasebook, hasPhrases, hasSaved, SAVED_NOTE, SAVED_TITLE, type Phrasebook, type SavedPhrase } from './phrasebook.ts';
import { loadConversationPacks } from '../conversationPacks/store.ts';
import { CADENCE_NOTE, PHRASEBOOK_TITLE, cadenceToggleLabel, hasCadence, speakerLabel } from './phrasebookView.ts';

export function PhrasebookScreen({ onBack }: { onBack: () => void }) {
  const [book, setBook] = useState<Phrasebook | null>(null);
  const [oneLine, setOneLine] = useState<OneLine | null>(null);
  const [cadence, setCadence] = useState<Cadence | null>(null);
  // Which line is sounding, so its own button offers to stop it and no other
  // button claims to. Null is silence.
  const [playing, setPlaying] = useState<string | null>(null);
  // Bumped after a grade, so the page re-reads the deck it has just written to.
  const [graded, setGraded] = useState(0);
  // The authored connectors are an optional collection, closed on every visit.
  const [cadenceOpen, setCadenceOpen] = useState(false);

  useEffect(() => () => tutorVoice.stop(), []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void Promise.all([loadDeck(), loadTopics(), loadConversationPacks().catch(() => [])])
        .then(([deck, topics, packs]) => {
          if (cancelled) return;
          const now = Date.now();
          setBook(buildPhrasebook(deck, topics, now, packs));
          setOneLine(oneLineFrom({ deck, now }));
          setCadence(cadenceFrom({ deck }));
        })
        .catch(() => {
          // Nothing to draw and nothing to say about a disk. The learner's
          // lines are on their account and the screen simply waits.
        });
      return () => {
        cancelled = true;
      };
    }, [graded]),
  );

  const say = (french: string) => {
    if (playing === french) {
      tutorVoice.stop();
      setPlaying(null);
      return;
    }
    setPlaying(french);
    tutorVoice.speak(french, { onDone: () => setPlaying(null) });
  };

  return (
    <ScrollScreen bottom="inset" header={<ScreenHeader back={{ onPress: onBack }} />}>
      <View style={st.head}>
        <Text accessibilityRole="header" style={st.title}>
          {PHRASEBOOK_TITLE}
        </Text>
      </View>

      {/* The one card this visit deals, at the top, so the thing worth doing is
          never below a list of things already done. */}
      {oneLine !== null && <OneLineCard line={oneLine} onGraded={() => setGraded((n) => n + 1)} />}

      {book !== null && hasPhrases(book) && (
        <View style={st.block}>
          <Label>{LEDGER.rowsLabel}</Label>
          <View style={st.groups}>
            {book.groups.map((group) => (
              <Card key={group.id}>
                <Label color={paper.inkSoft}>{group.title}</Label>
                <View style={st.rows}>
                  {group.phrases.map((phrase, index) => (
                    <PhraseRow
                      key={phrase.id}
                      phrase={phrase}
                      first={index === 0}
                      playing={playing === phrase.front}
                      onHear={() => say(phrase.front)}
                    />
                  ))}
                </View>
              </Card>
            ))}
          </View>
        </View>
      )}

      {/* Saved but not yet recalled, apart from the lines above and under a
          name that claims nothing about holding them. A saved phrase used to
          vanish here, because the list above is recalled lines only. */}
      {book !== null && hasSaved(book) && (
        <View style={st.block}>
          <Label>{SAVED_TITLE}</Label>
          <Text style={st.savedNote}>{SAVED_NOTE}</Text>
          <Card style={st.savedCard}>
            {book.saved.map((phrase, index) => (
              <PhraseRow
                key={phrase.id}
                phrase={phrase}
                first={index === 0}
                playing={playing === phrase.front}
                onHear={() => say(phrase.front)}
              />
            ))}
          </Card>
        </View>
      )}

      {/* Authored, so it is here on a first morning too, but it is an optional
          collection now (Stage 3): one quiet row, closed until asked for, so
          the learner's own lines lead and the glossary never outweighs them. */}
      {hasCadence(cadence) && (
        <View style={st.block}>
          <Pressable
            onPress={() => setCadenceOpen((open) => !open)}
            accessibilityRole="button"
            accessibilityState={{ expanded: cadenceOpen }}
            style={({ pressed }) => [st.disclosure, pressed && st.speakerPressed]}
          >
            <Text style={[type.bodyStrong, { color: paper.ink }]}>{cadenceToggleLabel(cadenceOpen)}</Text>
            {!cadenceOpen && <Text style={st.savedNote}>{CADENCE_NOTE}</Text>}
          </Pressable>
          {cadenceOpen && <CadenceCard cadence={cadence} />}
        </View>
      )}
    </ScrollScreen>
  );
}

/**
 * One kept line, and a way to hear it.
 *
 * No mark, and that is deliberate. The old screen drew a dot per phrase in the
 * practice path's three-state vocabulary, which turned a page of the learner's
 * own French into a rail of how well they are holding it. The scheduler already
 * knows; a learner reading their own sentences does not need to be told which
 * ones are slipping while they read them.
 */
function PhraseRow({
  phrase,
  first,
  playing,
  onHear,
}: {
  /** A recalled phrase or a saved one; the row reads only the words, never a shelf. */
  phrase: SavedPhrase;
  /** The first row in a card carries no rule above it. */
  first: boolean;
  playing: boolean;
  onHear: () => void;
}) {
  return (
    <View style={[st.row, !first && st.ruled]}>
      <View style={st.words}>
        <Text style={[type.french, { color: paper.ink }]}>{phrase.front}</Text>
        <Text style={[type.small, { color: paper.inkSoft, marginTop: space(1) }]}>{phrase.back}</Text>
      </View>
      <Pressable
        onPress={onHear}
        accessibilityRole="button"
        accessibilityLabel={speakerLabel(phrase.front, playing)}
        style={({ pressed }) => [st.speaker, pressed && st.speakerPressed]}
      >
        <SpeakerGlyph color={accent.primary} />
      </Pressable>
    </View>
  );
}

const st = StyleSheet.create({
  // The title and the scene share a row, both sitting on the same baseline, so
  // the drawing reads as part of the heading rather than as a banner over it.
  // On the page itself (notebook Phase 4, 2026-09-27): no feature paper and no
  // ink outline, so the heading is a heading rather than a panel.
  head: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space(3), marginTop: space(2) },
  title: { ...type.display, color: paper.ink, flexGrow: 1, flexBasis: 160, minWidth: 0 },
  // Placement only. The size is the registry's, never a number written here.
  art: { flexShrink: 0 },
  block: { marginTop: space(7) },
  groups: { marginTop: space(3), gap: space(3) },
  rows: { marginTop: space(2) },
  savedNote: { ...type.small, color: paper.inkSoft, marginTop: space(1) },
  savedCard: { marginTop: space(3) },
  // The collection's row: a full-width target at the touch floor, no card of
  // its own, so it reads as a quiet door rather than another block of content.
  disclosure: { minHeight: HIT, justifyContent: 'center', paddingVertical: space(2), borderRadius: radius.row },
  // The words take the room and the button keeps its floor, so a long line
  // wraps rather than squeezing the control under the touch minimum.
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), minHeight: HIT, paddingVertical: space(2) },
  ruled: { borderTopWidth: HAIRLINE, borderTopColor: paper.lineOnCard },
  words: { flex: 1, minWidth: 0 },
  // The ink speaker on a white disc under a paper hairline, which is what makes
  // it read as a button on a white card now the whisper has retired. It is the
  // thing you press, not a state being reported.
  speaker: {
    width: HIT,
    height: HIT,
    borderRadius: HIT / 2,
    backgroundColor: paper.card,
    borderWidth: HAIRLINE,
    borderColor: paper.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speakerPressed: { backgroundColor: paper.groundDeep },
});
