/**
 * The review sitting.
 *
 * One card at a time, and nothing else on screen. This is the deliberate
 * opposite of the SRS backlog wall: no progress bar, no score, no clock. The
 * scheduler already capped the sitting; this screen just deals the cards.
 *
 * A card is a flat white card on the paper ground: the front struck large in
 * the serif, tap to turn it over, then say how it went. "Again" is not a
 * failure state — the card simply rejoins the end of the sitting, the way a
 * tutor would circle back.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { dueCards, reviewXp, type ReviewCard, type ReviewCardKind, type ReviewGrade } from '@parle/core';
import { paper, space, type, radius, HAIRLINE, HIT } from './theme.ts';
import { Card, Label, PillButton, EarGlyph, fitDisplay } from './components.tsx';
import { NothingDue } from './illustrations.tsx';
import { loadDeck, gradeCard } from './review/store.ts';
import { recordActivity } from './progress/activity.ts';
import * as tutorVoice from './speech/tutorVoice.ts';

/** What kind of card this is, said plainly. */
const KIND_TAG: Record<ReviewCardKind, string> = {
  vocab: 'Word',
  phoneme: 'Sound',
  turn: 'Say it in French',
};

/**
 * The French to speak aloud for a card, and which face it lives on.
 *
 * Vocab fronts are French; phoneme cards carry their example word in context;
 * turn cards ask for French, so the French is the answer — hearing it before
 * the flip would give the card away.
 */
function frenchSide(card: ReviewCard): { text: string; frontToo: boolean } | null {
  switch (card.kind) {
    case 'vocab':
      return { text: card.front, frontToo: true };
    case 'phoneme':
      return card.context ? { text: card.context, frontToo: true } : null;
    case 'turn':
      return { text: card.back, frontToo: false };
  }
}

export function ReviewScreen({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  // The sitting: dealt once on mount. Null while the deck is still loading.
  const [queue, setQueue] = useState<ReviewCard[] | null>(null);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  // Cards recalled without help, counted locally: the deck stores when a
  // card is next due, not how a sitting went, and there is no sitting-end
  // hook to read one from.
  const recalled = useRef(0);
  const banked = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void loadDeck().then((deck) => {
      if (!cancelled) setQueue(dueCards(deck, Date.now()));
    });
    return () => {
      cancelled = true;
      tutorVoice.stop();
      // Banked here rather than on the Done button: leaving by the back
      // gesture, a tab switch or an unmount is still a sitting that happened.
      if (!banked.current && recalled.current > 0) {
        banked.current = true;
        void recordActivity('review', reviewXp({ recalled: recalled.current }));
      }
    };
  }, []);

  const card = queue && index < queue.length ? queue[index]! : null;

  const handleGrade = useCallback(
    (grade: ReviewGrade) => {
      if (!card) return;
      tutorVoice.stop();
      // Persist in the background; the sitting itself never waits on a disk.
      void gradeCard(card.id, grade);
      if (grade === 'good' || grade === 'easy') recalled.current += 1;
      // A missed card rejoins the end of this sitting rather than hiding until
      // its ten-minute retry — the learner meets it again while it is warm.
      if (grade === 'again') setQueue((q) => (q ? [...q, card] : q));
      setFlipped(false);
      setIndex((i) => i + 1);
    },
    [card],
  );

  if (queue === null) {
    return (
      <View style={st.center}>
        <ActivityIndicator color={paper.inkSoft} />
      </View>
    );
  }

  const remaining = queue.length - index;

  // Nothing due, or the sitting is done. Same calm card either way — the
  // deck never announces a backlog and never asks for more than it dealt.
  if (!card) {
    return (
      <View style={[st.root, { paddingTop: insets.top + space(6), paddingBottom: insets.bottom + space(6) }]}>
        <View style={st.centerFill}>
          {/* An empty deck is the good outcome, not a dead end, so it gets the
              cleared table rather than a sentence sitting on its own. */}
          <View style={{ alignItems: 'center', marginBottom: space(5) }}>
            <NothingDue width={190} />
          </View>
          <Card>
            <Text style={[type.title, { color: paper.ink }]}>Nothing waiting.</Text>
            <Text style={[type.body, { color: paper.inkSoft, marginTop: space(2) }]}>Your next session adds more.</Text>
          </Card>
        </View>
        <PillButton label="Done" onPress={onDone} />
      </View>
    );
  }

  const french = frenchSide(card);
  const showHear = french !== null && (flipped || french.frontToo);

  return (
    <View style={[st.root, { paddingTop: insets.top + space(6), paddingBottom: insets.bottom + space(6) }]}>
      <View style={st.headerRow}>
        <View style={st.headerRight}>
          <Label color={paper.inkFaint}>{remaining === 1 ? '1 card' : `${remaining} cards`}</Label>
          {/* A sitting is an offer, not an obligation — the learner can put the
              deck down mid-card and nothing is lost or counted against them. */}
          <Pressable
            onPress={onDone}
            accessibilityRole="button"
            accessibilityLabel="Leave the review"
            style={({ pressed }) => [st.leave, pressed && { opacity: 0.6 }]}
          >
            <Text style={[type.bodyStrong, { color: paper.inkSoft }]}>Leave</Text>
          </Pressable>
        </View>
      </View>

      <View style={st.centerFill}>
        <Pressable
          onPress={() => setFlipped((f) => !f)}
          accessibilityRole="button"
          accessibilityLabel={flipped ? 'Show the front of the card' : 'Turn the card over'}
        >
          <Card style={st.card}>
            <Label color={paper.inkFaint}>{KIND_TAG[card.kind]}</Label>

            {!flipped ? (
              <Text style={[fitDisplay(card.front), { color: paper.ink, textAlign: 'center', marginTop: space(4) }]}>
                {card.front}
              </Text>
            ) : (
              <View style={{ alignSelf: 'stretch', marginTop: space(4) }}>
                <Text style={[fitDisplay(card.back), { color: paper.ink, textAlign: 'center' }]}>{card.back}</Text>
                {card.context !== '' && card.context !== card.back && (
                  <Text style={[type.body, { color: paper.inkSoft, textAlign: 'center', marginTop: space(2.5) }]}>
                    {card.context}
                  </Text>
                )}
                {card.ipa !== '' && (
                  <Text style={[type.notation, { color: paper.inkFaint, textAlign: 'center', marginTop: space(2) }]}>
                    /{card.ipa}/
                  </Text>
                )}
              </View>
            )}

            {showHear && (
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  tutorVoice.speak(french.text);
                }}
                accessibilityRole="button"
                accessibilityLabel="Hear it in French"
                style={({ pressed }) => [st.hear, pressed && { opacity: 0.6 }]}
              >
                <EarGlyph size={15} color={paper.inkSoft} />
                <Text style={[type.small, { color: paper.inkSoft }]}>Hear it</Text>
              </Pressable>
            )}
          </Card>
        </Pressable>
      </View>

      {flipped ? (
        <View style={st.grades}>
          {(
            [
              { grade: 'again', label: 'Again' },
              { grade: 'good', label: 'Got it' },
              { grade: 'easy', label: 'Easy' },
            ] as const
          ).map(({ grade, label }) => (
            <Pressable
              key={grade}
              onPress={() => handleGrade(grade)}
              accessibilityRole="button"
              accessibilityLabel={label}
              style={({ pressed }) => [st.grade, pressed && st.gradePressed]}
            >
              <Text style={[type.button, { color: paper.ink }]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={st.flipHint}>
          <Text style={[type.small, { color: paper.inkFaint, textAlign: 'center' }]}>Tap to turn it over</Text>
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: paper.ground, paddingHorizontal: space(5) },
  center: { flex: 1, backgroundColor: paper.ground, alignItems: 'center', justifyContent: 'center' },
  centerFill: { flex: 1, justifyContent: 'center' },
  // flex-end: the caps screen title that used to hold the left of this row is
  // gone, and without this the count and the way out slide across to fill it.
  headerRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'flex-start' },
  headerRight: { alignItems: 'flex-end', gap: space(1) },
  leave: { minHeight: HIT, justifyContent: 'center', paddingLeft: space(3) },
  // The card itself: the SessionView main-card anatomy, content centred.
  card: { alignItems: 'center' },
  hear: {
    marginTop: space(3),
    minHeight: HIT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space(2),
  },
  grades: { flexDirection: 'row', gap: space(2.5) },
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
  // Same height as the grade row, so the card does not jump on the flip.
  flipHint: { minHeight: HIT + 8, justifyContent: 'center' },
});
