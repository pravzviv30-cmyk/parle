/**
 * The review sitting.
 *
 * One card at a time, and nothing else on screen. This is the deliberate
 * opposite of the SRS backlog wall: no progress bar, no score, no clock. The
 * scheduler already capped the sitting; this screen just deals the cards.
 *
 * A card is a small enamel plaque: the front struck large, tap to turn it
 * over, then say how it went. "Again" is not a failure state — the card simply
 * rejoins the end of the sitting, the way a tutor would circle back.
 */

import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { dueCards, type ReviewCard, type ReviewCardKind, type ReviewGrade } from '@parle/core';
import { enamel, space, type, radius, HIT } from './theme.ts';
import { Plaque, Tag, LabeledTag, EarGlyph } from './components.tsx';
import { loadDeck, gradeCard } from './review/store.ts';
import * as tutorVoice from './speech/tutorVoice.ts';

/** Signage lettering has to fit its plaque — a real sign is cut to its longest word. */
function plaqueType(text: string) {
  const n = text.length;
  if (n <= 16) return type.plaque;
  if (n <= 32) return { ...type.plaque, fontSize: 24, lineHeight: 31, letterSpacing: 1.1 };
  return { ...type.plaque, fontSize: 19, lineHeight: 26, letterSpacing: 0.7 };
}

/** What kind of card this is, in the plaque's own vocabulary. */
const KIND_TAG: Record<ReviewCardKind, string> = {
  vocab: 'VOCABULAIRE · WORD',
  phoneme: 'SON · SOUND',
  turn: 'PHRASE · SAY IT IN FRENCH',
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

  useEffect(() => {
    let cancelled = false;
    void loadDeck().then((deck) => {
      if (!cancelled) setQueue(dueCards(deck, Date.now()));
    });
    return () => {
      cancelled = true;
      tutorVoice.stop();
    };
  }, []);

  const card = queue && index < queue.length ? queue[index]! : null;

  const handleGrade = useCallback(
    (grade: ReviewGrade) => {
      if (!card) return;
      tutorVoice.stop();
      // Persist in the background; the sitting itself never waits on a disk.
      void gradeCard(card.id, grade);
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
        <ActivityIndicator color={enamel.whiteMuted} />
      </View>
    );
  }

  const remaining = queue.length - index;

  // Nothing due, or the sitting is done. Same calm plaque either way — the
  // deck never announces a backlog and never asks for more than it dealt.
  if (!card) {
    return (
      <View style={[st.root, { paddingTop: insets.top + space(6), paddingBottom: insets.bottom + space(6) }]}>
        <LabeledTag fr="RÉVISION" en="Review" />
        <View style={st.centerFill}>
          <Plaque raised>
            <LabeledTag fr="RIEN EN ATTENTE" en="Nothing waiting" color={enamel.whiteMuted} />
            <Text style={[type.plaqueSmall, { color: enamel.white, marginTop: space(2.5) }]}>Nothing waiting.</Text>
            <Text style={[type.body, { color: enamel.whiteMuted, marginTop: space(2) }]}>Your next session adds more.</Text>
          </Plaque>
        </View>
        <Pressable onPress={onDone} accessibilityRole="button" style={({ pressed }) => [st.done, pressed && { opacity: 0.8 }]}>
          <Text style={[type.tag, { color: enamel.white }]}>SORTIE · DONE</Text>
        </Pressable>
      </View>
    );
  }

  const french = frenchSide(card);
  const showHear = french !== null && (flipped || french.frontToo);

  return (
    <View style={[st.root, { paddingTop: insets.top + space(6), paddingBottom: insets.bottom + space(6) }]}>
      <View style={st.headerRow}>
        <LabeledTag fr="RÉVISION" en="Review" />
        <View style={st.headerRight}>
          <Tag color={enamel.whiteFaint}>{remaining === 1 ? '1 CARTE · 1 CARD' : `${remaining} CARTES · ${remaining} CARDS`}</Tag>
          {/* A sitting is an offer, not an obligation — the learner can put the
              deck down mid-card and nothing is lost or counted against them. */}
          <Pressable
            onPress={onDone}
            accessibilityRole="button"
            accessibilityLabel="Leave the review"
            style={({ pressed }) => [st.leave, pressed && { opacity: 0.6 }]}
          >
            <Text style={[type.tag, { color: enamel.whiteMuted }]}>SORTIE · LEAVE</Text>
          </Pressable>
        </View>
      </View>

      <View style={st.centerFill}>
        <Pressable
          onPress={() => setFlipped((f) => !f)}
          accessibilityRole="button"
          accessibilityLabel={flipped ? 'Show the front of the card' : 'Turn the card over'}
        >
          <Plaque raised>
            <Tag color={enamel.whiteFaint}>{KIND_TAG[card.kind]}</Tag>

            {!flipped ? (
              <Text style={[plaqueType(card.front), { color: enamel.white, textAlign: 'center', marginTop: space(4) }]}>
                {/* Only single words take the signage caps: uppercasing IPA or a
                    whole cue sentence would corrupt the one and shout the other. */}
                {card.kind === 'vocab' ? card.front.toUpperCase() : card.front}
              </Text>
            ) : (
              <View style={{ marginTop: space(4) }}>
                <Text style={[plaqueType(card.back), { color: enamel.white, textAlign: 'center' }]}>{card.back}</Text>
                {card.context !== '' && card.context !== card.back && (
                  <Text style={[type.body, { color: enamel.whiteMuted, textAlign: 'center', marginTop: space(2.5) }]}>
                    {card.context}
                  </Text>
                )}
                {card.ipa !== '' && (
                  <Text style={[type.notation, { color: enamel.whiteFaint, textAlign: 'center', marginTop: space(2) }]}>
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
                <EarGlyph size={15} color={enamel.whiteMuted} />
                <Text style={[type.small, { color: enamel.whiteMuted }]}>écouter · hear it</Text>
              </Pressable>
            )}
          </Plaque>
        </Pressable>
      </View>

      {flipped ? (
        <View style={st.grades}>
          {(
            [
              { grade: 'again', fr: 'ENCORE', en: 'again' },
              { grade: 'good', fr: 'BIEN', en: 'got it' },
              { grade: 'easy', fr: 'FACILE', en: 'easy' },
            ] as const
          ).map(({ grade, fr, en }) => (
            <Pressable
              key={grade}
              onPress={() => handleGrade(grade)}
              accessibilityRole="button"
              accessibilityLabel={en}
              style={({ pressed }) => [st.grade, pressed && st.gradePressed]}
            >
              <Text style={[type.tag, { color: enamel.white }]}>{fr}</Text>
              <Text style={[type.small, { color: enamel.whiteMuted, marginTop: 2 }]}>{en}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={st.flipHint}>
          <Text style={[type.small, { color: enamel.whiteFaint, textAlign: 'center' }]}>touchez la plaque · tap to turn it over</Text>
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: enamel.ground, paddingHorizontal: space(5) },
  center: { flex: 1, backgroundColor: enamel.ground, alignItems: 'center', justifyContent: 'center' },
  centerFill: { flex: 1, justifyContent: 'center' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerRight: { alignItems: 'flex-end', gap: space(1) },
  leave: { minHeight: HIT, justifyContent: 'center', paddingLeft: space(3) },
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
    borderWidth: 1,
    borderColor: 'rgba(242,239,228,0.35)',
    borderRadius: radius.plaque,
    paddingVertical: space(2.5),
  },
  gradePressed: { backgroundColor: enamel.fieldRaised, borderColor: enamel.white },
  // Same height as the grade row, so the plaque does not jump on the flip.
  flipHint: { minHeight: HIT + 8, justifyContent: 'center' },
  done: {
    minHeight: HIT + 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: enamel.white,
    borderRadius: radius.plaque,
  },
});
