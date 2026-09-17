/**
 * The review sitting.
 *
 * One card at a time, and nothing else on screen. This is the deliberate
 * opposite of the SRS backlog wall: no progress bar, no score, no clock. The
 * scheduler already capped the sitting; this screen just deals the cards.
 *
 * A card is a flat white card on the paper ground: the front struck large in
 * the serif, then say how it went. "Again" is not a failure state — the card
 * simply rejoins the end of the sitting, the way a tutor would circle back.
 *
 * A card meets the learner in one of two ways, and `review/cardView.ts` decides
 * which from core's own verdict. A genuinely new card, and every sound card, is
 * an **introduction**: tap to turn it over, hear it whenever hearing it helps.
 * A card the scheduler has asked back is a **retrieval**: the English is the
 * prompt, and the French plus everything that would give it away stay off the
 * screen until the learner says they have had a go. Nothing here decides that
 * for itself; this file renders a view and holds the keyboard.
 *
 * There is no microphone on this screen and there is not going to be one. The
 * deck works on a plane, costs nothing, and never scores a learner's mouth.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  AccessibilityInfo,
  TextInput,
} from 'react-native';
import { dueCards, reviewXp, type ReviewCard, type ReviewGrade } from '@luvani/core';
import { HAIRLINE, HIT, accent, font, paper, radius, shadow, space, type } from './theme.ts';
import { Card, Label, OutlineButton, PillButton, fitDisplay } from './components.tsx';
import { SpeakerGlyph } from './glyphs.tsx';
import { Screen, ScrollScreen, ScreenHeader } from './layout.tsx';
import { Art } from './art/Art.tsx';
import { SCREEN_ART } from './art/maps.ts';
import { loadDeck, gradeCard } from './review/store.ts';
import {
  CARD_START,
  SAID_IT,
  TYPE_IT,
  cardView,
  sittingView,
  typedAttemptReady,
  type ReviewTurn,
} from './review/cardView.ts';
import { recordActivity } from './progress/activity.ts';
import * as tutorVoice from './speech/tutorVoice.ts';

/** The speaker disc on the card. Wider than a hit target because it is the one control on it. */
const SPEAKER = 64;

export function ReviewScreen({ onDone }: { onDone: () => void }) {
  // The sitting: dealt once on mount. Null while the deck is still loading.
  const [queue, setQueue] = useState<ReviewCard[] | null>(null);
  const [index, setIndex] = useState(0);
  const [turn, setTurn] = useState<ReviewTurn>(CARD_START);
  /**
   * The line that opens the sitting, or null when there is nothing to open it
   * with. Held here rather than recomputed per card because it is a fact about
   * how the sitting was dealt, and a card that rejoins the end after "Again"
   * must not be able to bring it back.
   */
  const [opener, setOpener] = useState<string | null>(null);
  /**
   * The instant the sitting was dealt, and the only clock this screen reads
   * while it runs. `dueCards` picked the cards against it, so presentation is
   * decided against it too: a card that rejoins the end of the sitting after
   * "Again" is asked for in exactly the way it was asked for the first time.
   */
  const dealtAt = useRef(Date.now());
  // Cards recalled without help, counted locally: the deck stores when a
  // card is next due, not how a sitting went, and there is no sitting-end
  // hook to read one from.
  const recalled = useRef(0);
  const banked = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void loadDeck().then((deck) => {
      if (cancelled) return;
      const now = Date.now();
      dealtAt.current = now;
      // Which cards are in the sitting is the deck's decision and stays the
      // deck's: `sittingView` is handed what `dueCards` chose, floats the ones
      // back for their first real test to the front, and returns the same
      // cards in a different order. It has no way to select, so the cap and
      // the longest-overdue-first rule cannot be starved from here.
      const sitting = sittingView(dueCards(deck, now), now);
      setQueue(sitting.cards);
      setOpener(sitting.opener);
    });
    return () => {
      cancelled = true;
      tutorVoice.stop();
      // Banked here rather than on the Done button: leaving by the back
      // gesture, a tab switch or an unmount is still a sitting that happened.
      if (!banked.current && recalled.current > 0) {
        banked.current = true;
        // One clock read, and the sitting's start is the instant it was dealt
        // rather than a second ref saying the same thing. Wall clock on the
        // device, which is what Home's speaking goal measures; it is not the
        // metered seconds and is never shown as those.
        const endedAt = Date.now();
        void recordActivity('review', reviewXp({ recalled: recalled.current }), endedAt, {
          durationMs: endedAt - dealtAt.current,
        });
      }
    };
  }, []);

  const card = queue && index < queue.length ? queue[index]! : null;
  const view = card ? cardView(card, dealtAt.current, turn) : null;

  // The answer appears without focus moving, so a screen reader is told about
  // it. Without this the content under the finger silently becomes something
  // else, which is the reveal not happening at all for anyone not watching.
  const announce = view?.announce ?? null;
  useEffect(() => {
    if (announce !== null) AccessibilityInfo.announceForAccessibility(announce);
  }, [announce]);

  const handleGrade = useCallback(
    (grade: ReviewGrade) => {
      if (!card || !view) return;
      tutorVoice.stop();
      // Persist in the background; the sitting itself never waits on a disk.
      // The context is what the view knows and nothing more: an attempt that
      // came before the answer, or, on an introduction, no claim at all.
      void gradeCard(card.id, grade, view.gradeContext);
      if (grade === 'good' || grade === 'easy') recalled.current += 1;
      // A missed card rejoins the end of this sitting rather than hiding until
      // its ten-minute retry — the learner meets it again while it is warm.
      if (grade === 'again') setQueue((q) => (q ? [...q, card] : q));
      setTurn(CARD_START);
      setIndex((i) => i + 1);
    },
    [card, view],
  );

  if (queue === null) {
    return (
      <Screen>
        <View style={st.loading}>
          <ActivityIndicator color={paper.inkSoft} />
        </View>
      </Screen>
    );
  }

  const remaining = queue.length - index;

  // Nothing due, or the sitting is done. Same calm card either way — the
  // deck never announces a backlog and never asks for more than it dealt. A
  // terminal card, so Done is its one door and it carries no back header.
  if (!card || !view) {
    return (
      <ScrollScreen center footer={<PillButton label="Done" onPress={onDone} />}>
        {/* An empty deck is the good outcome, not a dead end, so it gets the
            cleared table rather than a sentence sitting on its own. The size is
            the art registry's, never a width written here. */}
        <View style={{ alignItems: 'center', marginBottom: space(5) }}>
          <Art name={SCREEN_ART.emptyDeck} />
        </View>
        <Card>
          <Text style={[type.title, { color: paper.ink }]}>Nothing waiting.</Text>
          <Text style={[type.body, { color: paper.inkSoft, marginTop: space(2) }]}>Your next session adds more.</Text>
        </Card>
      </ScrollScreen>
    );
  }

  // Pulled out of the view because a property narrowed at the JSX is not
  // narrowed inside the press handler that reads it a line later.
  const hear = view.hear;

  const face = (
    <Card style={st.card}>
      <Label>{view.tag}</Label>

      {view.answer === null ? (
        <View style={{ alignSelf: 'stretch', marginTop: space(4) }}>
          <Text style={[fitDisplay(view.prompt), { color: paper.ink, textAlign: 'center' }]}>{view.prompt}</Text>
          {view.ask !== null && (
            <Text style={[type.body, { color: paper.inkSoft, textAlign: 'center', marginTop: space(3) }]}>
              {view.ask}
            </Text>
          )}
        </View>
      ) : (
        <View style={{ alignSelf: 'stretch', marginTop: space(4) }}>
          <Text style={[fitDisplay(view.answer.text), { color: paper.ink, textAlign: 'center' }]}>
            {view.answer.text}
          </Text>
          {view.answer.context !== '' && (
            <Text style={[type.body, { color: paper.inkSoft, textAlign: 'center', marginTop: space(2.5) }]}>
              {view.answer.context}
            </Text>
          )}
          {view.answer.ipa !== '' && (
            <Text style={[type.notation, { color: paper.inkSoft, textAlign: 'center', marginTop: space(2) }]}>
              /{view.answer.ipa}/
            </Text>
          )}
          {/* What they typed, given back with nothing attached to it. No tick,
              no cross, no colour: the app does not mark French, and a learner
              comparing two lines themselves is the whole point of typing. */}
          {view.echo !== null && (
            <View style={{ marginTop: space(3.5), alignItems: 'center' }}>
              <Label>You typed</Label>
              <Text style={[type.body, { color: paper.inkSoft, textAlign: 'center', marginTop: space(1) }]}>
                {view.echo}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* One speaker, not a word and an icon. A card with two lines of French
          on it does not need a third line telling the learner what a speaker
          is, and the disc is a 64pt target where the text row was a 44pt one. */}
      {hear !== null && (
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            tutorVoice.speak(hear);
          }}
          accessibilityRole="button"
          accessibilityLabel="Hear it in French"
          style={({ pressed }) => [st.hear, pressed && { opacity: 0.6 }]}
        >
          <SpeakerGlyph size={28} color={accent.primary} />
        </Pressable>
      )}
    </Card>
  );

  const typedReady = typedAttemptReady(turn.typed);
  const attempt = (kind: 'typed' | 'said') => {
    setTurn((t) => ({ ...t, attempt: kind }));
  };

  // The bottom of the sitting: grade this card, take the retrieval attempt, or a
  // hint to turn it over. It rides in the frame's footer so a keyboard opened on
  // the attempt lifts it clear. The taller of the two states sets the height so
  // the card does not jump the moment the learner is reading the answer.
  const foot = (
    <View style={view.mode === 'retrieval' ? st.retrievalFoot : undefined}>
      {view.grades ? (
        // Three outlines, evenly. They were hand-rolled plates with a button
        // face on them, which is the shared OutlineButton with a different
        // pressed state; the app has one outline and these are it now.
        <View style={st.grades}>
          {(
            [
              { grade: 'again', label: 'Again' },
              { grade: 'good', label: 'Got it' },
              { grade: 'easy', label: 'Easy' },
            ] as const
          ).map(({ grade, label }) => (
            <View key={grade} style={st.gradeCell}>
              <OutlineButton label={label} onPress={() => handleGrade(grade)} />
            </View>
          ))}
        </View>
      ) : view.asksForAttempt ? (
        <View style={st.attempt}>
          {/* Both ways are on screen at once, and neither is the right one.
              Typing suits a quiet carriage, saying it suits a kitchen, and
              "said" is taken on trust because the alternative is a
              microphone this screen is never going to grow. */}
          <TextInput
            value={turn.typed}
            onChangeText={(typed) => setTurn((t) => ({ ...t, typed }))}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            returnKeyType="done"
            onSubmitEditing={() => {
              if (typedReady) attempt('typed');
            }}
            placeholder="Your answer"
            placeholderTextColor={paper.inkFaint}
            accessibilityLabel="Your answer in French"
            style={st.input}
          />
          <View style={st.attemptRow}>
            <Pressable
              onPress={() => attempt('typed')}
              disabled={!typedReady}
              accessibilityRole="button"
              accessibilityLabel={TYPE_IT}
              style={({ pressed }) => [
                st.grade,
                !typedReady && st.attemptOff,
                pressed && typedReady && st.gradePressed,
              ]}
            >
              <Text style={[type.button, { color: paper.ink }]}>{TYPE_IT}</Text>
            </Pressable>
            <Pressable
              onPress={() => attempt('said')}
              accessibilityRole="button"
              accessibilityLabel={SAID_IT}
              style={({ pressed }) => [st.grade, pressed && st.gradePressed]}
            >
              <Text style={[type.button, { color: paper.ink }]}>{SAID_IT}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={st.flipHint}>
          <Text style={[type.small, { color: paper.inkSoft, textAlign: 'center' }]}>Tap to turn it over</Text>
        </View>
      )}
    </View>
  );

  return (
    <ScrollScreen
      avoidKeyboard
      center
      bottom="inset"
      // A sitting is an offer, not an obligation — the learner can put the deck
      // down mid-card and nothing is lost or counted against them.
      header={
        <ScreenHeader
          leave={{ onPress: onDone, label: 'Leave', accessibilityLabel: 'Leave the review' }}
          title={<Label color={paper.inkSoft}>{remaining === 1 ? '1 card' : `${remaining} cards`}</Label>}
        />
      }
      footer={foot}
    >
      {/* One quiet line, at the head of the sitting and nowhere else. It names
          why the front of the queue looks repetitive; it is not a verdict on
          anything, because nothing has been answered yet. */}
      {opener !== null && index === 0 && (
        <Text style={[type.small, { color: paper.inkSoft, textAlign: 'center', marginBottom: space(3) }]}>{opener}</Text>
      )}

      {view.flippable ? (
        <Pressable
          onPress={() => setTurn((t) => ({ ...t, flipped: !t.flipped }))}
          accessibilityRole="button"
          accessibilityLabel={view.revealed ? 'Show the front of the card' : 'Turn the card over'}
        >
          {face}
        </Pressable>
      ) : (
        face
      )}
    </ScrollScreen>
  );
}

const st = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // The card itself: the SessionView main-card anatomy, content centred.
  card: { alignItems: 'center' },
  // The speaker disc: white, on the card, with the one soft shadow.
  hear: {
    marginTop: space(4),
    width: SPEAKER,
    height: SPEAKER,
    borderRadius: SPEAKER / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: paper.card,
    ...shadow.whisper,
  },
  grades: { flexDirection: 'row', gap: space(2.5) },
  gradeCell: { flex: 1 },
  grade: {
    flex: 1,
    minHeight: HIT + 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: paper.card,
    borderWidth: HAIRLINE,
    borderColor: paper.line,
    borderRadius: radius.card,
    paddingVertical: space(2.5),
  },
  gradePressed: { backgroundColor: paper.groundDeep, borderColor: paper.ink },
  // The attempt row, built out of the same plate as the grade row so the two
  // states of the bottom of this screen are the same object doing two jobs.
  attempt: { gap: space(2.5) },
  // The attempt block and the grade row swap in place on a retrieval, so the
  // taller of the two sets the height and the card does not jump at the exact
  // moment the learner is reading the answer. Same reasoning as flipHint, one
  // state further along, and derived from the two things it holds rather than
  // measured off a screenshot.
  retrievalFoot: { minHeight: (HIT + 8) * 2 + space(2.5), justifyContent: 'flex-end' },
  attemptRow: { flexDirection: 'row', gap: space(2.5) },
  attemptOff: { opacity: 0.45 },
  // The paper text field, in the Field anatomy the drills already use. Type
  // styles from the theme, minus lineHeight, which clips a single-line
  // TextInput on iOS.
  input: {
    minHeight: HIT + 8,
    backgroundColor: paper.card,
    borderWidth: HAIRLINE,
    borderColor: paper.line,
    borderRadius: radius.input,
    paddingHorizontal: space(4),
    paddingVertical: space(3),
    color: paper.ink,
    fontFamily: font.sans,
    fontSize: 16,
    textAlign: 'center',
  },
  // Same height as the grade row, so the card does not jump on the flip.
  flipHint: { minHeight: HIT + 8, justifyContent: 'center' },
});
