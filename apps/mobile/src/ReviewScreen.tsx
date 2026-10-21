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
 *
 * 2026-10-21 UI-008, artboards B-Review, B-ReviewReveal and the Review block of
 * B-Empty-States: the sitting is drawn on the butter ground (M3 ochre in dark)
 * with the close disc, the card at radius 28 with the cafe-table drawing, the
 * mint answer panel and three filled grade tiles. The artboard's "3 of 5" bar
 * and the grade intervals are held back by the founder: the header's centre
 * stays empty and the tiles carry no interval line.
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
import { reviewXp, type DrillExercise, type ReviewCard, type ReviewGrade } from '@luvani/core';
import { HIT, bType, font, frenchText, space } from './theme.ts';
import { GhostButton, PillButton } from './components.tsx';
import { Screen, ScrollScreen, ScreenHeader } from './layout.tsx';
import { useB, useThemedStyles, type B } from './main/bTheme.tsx';
import { BArt } from './art/BArt.tsx';
import { BMic, BSpeaker } from './today/TodayParts.tsx';
import { KeyboardGlyph } from './review/ReviewParts.tsx';
import { EmptyStateCard } from './empty/EmptyStateCard.tsx';
import { conversationContext, fromLine } from './review/context.ts';
import { alsoFine } from './review/alsoFine.ts';
import { loadDrillBank } from './drill/store.ts';
import { loadConversationPacks } from './conversationPacks/store.ts';
import { loadDeck, gradeCard } from './review/store.ts';
import { HELD_BACK_ACTION, dealForTier, heldBackLine } from './review/freeTier.ts';
import { useAuth } from './auth/useAuth.tsx';
import { useFeatureLocks } from './purchases/useFeatureLocks.ts';
import {
  CARD_START,
  REVIEW_COPY,
  SAID_IT,
  TYPE_IT,
  cardView,
  sittingView,
  typedAttemptReady,
  type ReviewTurn,
} from './review/cardView.ts';
import { recordActivity } from './progress/activity.ts';
import { settleSitting } from './game/settle.ts';
import { useActiveClock } from './progress/useActiveClock.ts';
import { useSittingEnd } from './practice/useSittingEnd.ts';
import { EndCard } from './celebrate/EndCard.tsx';
import { REVIEW_END, reviewPage } from './review/sittingEnd.ts';
import * as tutorVoice from './speech/tutorVoice.ts';

/** The speaker disc in the answer panel (B-ReviewReveal): 48, above the touch floor. */
const SPEAKER = 48;

export function ReviewScreen({ onDone }: { onDone: () => void }) {
  // The sitting: dealt once on mount. Null while the deck is still loading.
  const [queue, setQueue] = useState<ReviewCard[] | null>(null);
  const [fragments, setFragments] = useState<Record<string, ReturnType<typeof conversationContext>>>({});
  const [index, setIndex] = useState(0);
  const [turn, setTurn] = useState<ReviewTurn>(CARD_START);
  // The field opens on the first "Type it", so the card stays the artboard's
  // until the learner chooses to type. Presentation only: the attempt itself
  // is still `turn.attempt`, set by the same handler.
  const [typing, setTyping] = useState(false);
  // The drill bank, read once for "Also fine:" (review/alsoFine.ts). Empty
  // until it answers, and empty is simply no line.
  const [bank, setBank] = useState<readonly DrillExercise[]>([]);
  const t = useB();
  const st = useThemedStyles(makeStyles);
  /**
   * The line that opens the sitting, or null when there is nothing to open it
   * with. Held here rather than recomputed per card because it is a fact about
   * how the sitting was dealt, and a card that rejoins the end after "Again"
   * must not be able to bring it back.
   */
  const [opener, setOpener] = useState<string | null>(null);
  // Free tier: due conversation-only cards left out of this sitting, counted
  // once at the deal (review/freeTier.ts). Zero whenever the feature is open.
  const [heldBack, setHeldBack] = useState(0);
  const { user } = useAuth();
  const locks = useFeatureLocks(user?.id ?? null);
  // Read through a ref so the deal, which runs once, sees the lock at mount.
  const lockAtDeal = useRef(locks.access);
  lockAtDeal.current = locks.access;
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
  // Grades given in this sitting. A sitting that emptied its queue with at
  // least one grade is a finished practice, recalled or not (F744).
  const graded = useRef(0);
  const banked = useRef(false);
  // Active learning time for Practice time: only the gaps between the
  // learner's own actions (typing, an attempt, a flip, hearing, a grade) that
  // are short enough to be one stretch of work. Opening the deck adds nothing.
  const clock = useActiveClock('review');
  // A finished sitting's end card waits for the settle pipeline's own read-back
  // of this sitting, and shows only its numbers (F760). While this screen is
  // up the celebration queue is held, and the hold taken before the sitting
  // settles is handed to its end card (F766).
  const { end, expect, release } = useSittingEnd();
  /**
   * Bank the sitting once, whichever way it ends, with one stopwatch for both
   * so the sitting has one end. The queue emptying with at least one grade is
   * a finished practice, and it settles (F744). The screen going away first
   * banks what was recalled and settles nothing. `banked` is set before
   * anything is written, so the two can never record one sitting twice (review
   * finding 18). Refs only, so the unmount below can hold the first copy.
   */
  const bankSitting = useRef((finished: boolean) => {
    if (banked.current || (finished ? graded.current === 0 : recalled.current === 0)) return;
    banked.current = true;
    // One clock read, and the sitting's start is the instant it was dealt
    // rather than a second ref saying the same thing. Wall clock on the
    // device, which is what Home's speaking goal measures; it is not the
    // metered seconds and is never shown as those.
    const endedAt = Date.now();
    const xp = reviewXp({ recalled: recalled.current });
    const activeMs = clock.read();
    const write = () => recordActivity('review', xp, endedAt, {
      durationMs: endedAt - dealtAt.current,
      activeMs: activeMs,
      ...(finished ? { finished: true } : {}),
    });
    // The end card waits for exactly this sitting, and the queue is held from
    // before the settle until that card goes.
    if (finished) expect({ source: 'review', at: endedAt });
    if (finished) void settleSitting({ source: 'review', at: endedAt, xpEarned: xp, activeMs, write });
    else void write();
  }).current;

  useEffect(() => {
    let cancelled = false;
    void loadDrillBank().then((exercises) => { if (!cancelled) setBank(exercises); }, () => {});
    void Promise.all([loadDeck(), loadConversationPacks()]).then(([deck, packs]) => {
      if (cancelled) return;
      const now = Date.now();
      dealtAt.current = now;
      // Which cards are in the sitting is the deck's decision and stays the
      // deck's: `sittingView` is handed what `dueCards` chose, floats the ones
      // back for their first real test to the front, and returns the same
      // cards in a different order. It has no way to select, so the cap and
      // the longest-overdue-first rule cannot be starved from here.
      // When conversation practice is locked, the deck is narrowed to what
      // the free tier reviews before `dueCards` caps it, so a free learner
      // still gets a full sitting of their own free cards.
      const deal = dealForTier(deck, now, lockAtDeal.current('conversationPractice'));
      setHeldBack(deal.heldBack);
      const sitting = sittingView(deal.due, now);
      setFragments(Object.fromEntries(sitting.cards.map(card => [card.id, conversationContext(card, packs)])));
      setQueue(sitting.cards);
      setOpener(sitting.opener);
    });
    return () => {
      cancelled = true;
      tutorVoice.stop();
      // Banked here rather than on the Done button: leaving by the back
      // gesture, a tab switch or an unmount is still a sitting that happened.
      bankSitting(false);
    };
  }, []);

  // The queue emptied: the sitting is finished, and it settles once.
  const finished = queue !== null && index >= queue.length;
  useEffect(() => {
    if (finished) bankSitting(true);
  }, [finished, bankSitting]);

  const card = queue && index < queue.length ? queue[index]! : null;
  const view = card ? cardView(card, dealtAt.current, turn) : null;
  const fragment = card ? fragments[card.id] : null;

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
      clock.touch();
      tutorVoice.stop();
      // Persist in the background; the sitting itself never waits on a disk.
      // The context is what the view knows and nothing more: an attempt that
      // came before the answer, or, on an introduction, no claim at all.
      void gradeCard(card.id, grade, view.gradeContext);
      graded.current += 1;
      if (grade === 'good' || grade === 'easy') recalled.current += 1;
      // A missed card rejoins the end of this sitting rather than hiding until
      // its ten-minute retry — the learner meets it again while it is warm.
      if (grade === 'again') setQueue((q) => (q ? [...q, card] : q));
      setTurn(CARD_START);
      setTyping(false);
      setIndex((i) => i + 1);
    },
    [card, view, clock],
  );

  if (queue === null) {
    return (
      <Screen>
        <View style={st.loading}>
          <ActivityIndicator color={t.muted} />
        </View>
      </Screen>
    );
  }

  // One quiet row, only on the two terminal pages, only when cards were held back.
  const heldLine = heldBackLine(heldBack);
  const heldRow = heldLine === null ? null : (
    <View style={st.held}>
      <Text style={[bType.meta, { color: t.muted }]}>{heldLine}</Text>
      <GhostButton small label={HELD_BACK_ACTION} color={t.muted} onPress={() => locks.open('conversationPractice')} />
    </View>
  );

  const primary = <PillButton label={!card || !view ? 'Done' : 'Show me'} onPress={() => {
    if (!card || !view) return onDone();
    clock.touch();
    setTurn((t) => ({ ...t, flipped: true }));
  }} />;

  // Nothing due, or the sitting is done, and the two are told apart (F761).
  // The deck never announces a backlog and never asks for more than it dealt.
  // A terminal card, so Done is its one door and it carries no back header.
  if (!card || !view) {
    // Every dealt card was graded: the review is complete, and its end card
    // shows only what the settle read back. Until it has, a quiet wait; if it
    // never answers, the finish stands in words.
    if (reviewPage(queue.length, index) === 'finished') {
      return (
        <ScrollScreen footer={primary}>
          <View style={st.ending}>
            <Text accessibilityRole="header" style={[type19, { color: t.text }]}>{REVIEW_END.finished}</Text>
            {end.state === 'settled' ? (
              <EndCard delta={end.delta} count={recalled.current} release={release} />
            ) : end.state === 'unsettled' ? (
              <Text style={[bType.para15, { color: t.secondary }]}>{REVIEW_END.finishedBody}</Text>
            ) : (
              <ActivityIndicator color={t.muted} />
            )}
            {heldRow}
          </View>
        </ScrollScreen>
      );
    }
    // Nothing was dealt: the calm card, and nothing plays, counts or settles.
    // 2026-10-21 UI-008, B-Empty-States "Review, all done": the cloud-cheer
    // card with its one ink button. Phase B's words and its Done stay: the
    // artboard's "Back to Practice" is not where every way in came from.
    return (
      <ScrollScreen>
        <View style={st.ending}>
          <EmptyStateCard
            art={{ name: 'cloud-cheer', width: 150, height: 114 }}
            title="Nothing waiting."
            body="Your next session adds more."
            action={{ label: 'Done', onPress: onDone }}
          />
          {heldRow}
        </View>
      </ScrollScreen>
    );
  }

  // Pulled out of the view because a property narrowed at the JSX is not
  // narrowed inside the press handler that reads it a line later.
  const hear = view.hear;
  const from = fromLine(fragment);
  const other = view.answer === null ? null : alsoFine(card.id, view.answer.text, bank);

  const speaker = hear === null ? null : (
    <Pressable
      onPress={(e) => {
        e.stopPropagation();
        clock.touch();
        tutorVoice.speak(hear);
      }}
      accessibilityRole="button"
      accessibilityLabel="Hear it in French"
      style={({ pressed }) => [st.hear, view.answer === null && st.hearOnCard, pressed && { opacity: 0.6 }]}
    >
      <BSpeaker size={22} color={t.text} />
    </Pressable>
  );

  // The card's top row: what it is, and where it came from when that is known.
  const top = (
    <View style={st.topRow}>
      <View style={st.tag}><Text style={[bType.chip, { color: t.link }]}>{view.tag}</Text></View>
      {from !== null && <Text numberOfLines={1} style={[bType.note, st.from, { color: t.muted }]}>{from}</Text>}
    </View>
  );

  const face = view.answer === null ? (
    // B-Review: the prompt, struck large, and nothing that gives it away.
    <View style={[st.card, st.cardFront]}>
      <BArt name="cafe-table" width={130} height={119} style={st.art} />
      {top}
      {view.question !== null && <Text style={[bType.line15, { color: t.muted }]}>{view.question}</Text>}
      <Text style={[bType.prompt27, { color: t.text }]}>{view.prompt}</Text>
      {speaker}
      {view.ask !== null && <Text style={[bType.meta, st.ask, { color: t.secondary }]}>{view.ask}</Text>}
    </View>
  ) : (
    // B-ReviewReveal: the prompt quiet, the French in the mint panel.
    <View style={st.card}>
      {top}
      <Text style={[bType.line15, { color: t.muted }]}>{view.prompt}</Text>
      <View style={st.panel}>
        <View style={st.panelWords}>
          <Text style={[bType.bold12, { color: t.mintWords }]}>{REVIEW_COPY.inFrench}</Text>
          <Text {...frenchText} style={[bType.answer24, { color: t.text }]}>{view.answer.text}</Text>
          {view.answer.ipa !== '' && <Text style={[bType.note, { color: t.secondary }]}>/{view.answer.ipa}/</Text>}
        </View>
        {speaker}
      </View>
      {other !== null && (
        <View style={st.alsoRow}>
          <Text style={[bType.note, { color: t.muted }]}>{REVIEW_COPY.alsoFine}</Text>
          <Text {...frenchText} style={[bType.semi15, st.grow, { color: t.text }]}>{other}</Text>
        </View>
      )}
      {view.answer.context !== '' && <Text style={[bType.note, { color: t.muted }]}>{view.answer.context}</Text>}
    </View>
  );

  // What the learner did before the answer, given back with nothing attached
  // to it. No tick, no cross, no colour: the app does not mark French, and a
  // learner comparing two lines themselves is the whole point of an attempt.
  const yours = view.echo !== null ? (
    <View style={st.yours}>
      <Text style={[bType.chip, { color: t.muted }]}>{REVIEW_COPY.typedTitle}</Text>
      <Text {...frenchText} style={[bType.line15, { color: t.secondary }]}>{view.echo}</Text>
    </View>
  ) : view.revealed && turn.attempt === 'said' ? (
    <View style={st.yours}>
      <Text style={[bType.chip, { color: t.muted }]}>{REVIEW_COPY.saidTitle}</Text>
      <Text style={[bType.line15, { color: t.secondary }]}>{REVIEW_COPY.saidBody}</Text>
    </View>
  ) : null;

  const typedReady = typedAttemptReady(turn.typed);
  const attempt = (kind: 'typed' | 'said') => {
    clock.touch();
    setTurn((t) => ({ ...t, attempt: kind }));
  };

  // The bottom of the sitting: grade this card, take the retrieval attempt, or a
  // hint to turn it over. It rides in the frame's footer so a keyboard opened on
  // the attempt lifts it clear.
  const foot = (
    <View style={st.foot}>
      {view.grades ? (
        <>
          <Text style={[bType.bold15, st.centred, { color: t.text }]}>{REVIEW_COPY.gradeAsk}</Text>
          {/* Three filled tiles, evenly (B-ReviewReveal). The intervals under
              each word are held back by the founder: no clock on this screen. */}
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
                style={({ pressed }) => [st.grade, st[grade], pressed && { opacity: 0.8 }]}
              >
                <Text style={[bType.bold17, { color: grade === 'again' ? t.text : t.onMint }]}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : view.asksForAttempt ? (
        <>
          {/* Both ways are on screen at once, and neither is the right one.
              Typing suits a quiet carriage, saying it suits a kitchen, and
              "said" is taken on trust because the alternative is a
              microphone this screen is never going to grow. */}
          {typing && (
            <TextInput
              value={turn.typed}
              onChangeText={(typed) => {
                clock.touch();
                setTurn((t) => ({ ...t, typed }));
              }}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              returnKeyType="done"
              onSubmitEditing={() => {
                if (typedReady) attempt('typed');
              }}
              placeholder="Your answer"
              placeholderTextColor={t.muted}
              accessibilityLabel="Your answer in French"
              style={st.input}
            />
          )}
          <Pressable
            onPress={() => attempt('said')}
            accessibilityRole="button"
            accessibilityLabel={SAID_IT}
            style={({ pressed }) => [st.said, pressed && { opacity: 0.85 }]}
          >
            <BMic size={20} color={t.onPrimary} />
            <Text style={[bType.bold18, { color: t.onPrimary }]}>{SAID_IT}</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              if (!typing) {
                clock.touch();
                setTyping(true);
              } else if (typedReady) attempt('typed');
            }}
            disabled={typing && !typedReady}
            accessibilityRole="button"
            accessibilityLabel={TYPE_IT}
            accessibilityState={{ disabled: typing && !typedReady }}
            style={({ pressed }) => [st.typeIt, typing && !typedReady && st.off, pressed && { opacity: 0.85 }]}
          >
            <KeyboardGlyph size={20} color={t.text} />
            <Text style={[bType.bold16, { color: t.text }]}>{TYPE_IT}</Text>
          </Pressable>
          <Text style={[bType.note, st.centred, { color: t.muted }]}>{REVIEW_COPY.attemptFirst}</Text>
        </>
      ) : (
        primary
      )}
    </View>
  );

  return (
    <ScrollScreen
      avoidKeyboard
      bottom="inset"
      ground={t.butter}
      // A sitting is an offer, not an obligation — the learner can put the deck
      // down mid-card and nothing is lost or counted against them. The centre
      // of the header stays empty: no count of the sitting (founder, held).
      header={
        <ScreenHeader
          leave={{ onPress: onDone, label: 'Leave', accessibilityLabel: 'Leave the review', close: true }}
          title="Review"
        />
      }
      footer={foot}
    >
      <View style={st.body}>
        {/* One quiet line, at the head of the sitting and nowhere else. It names
            why the front of the queue looks repetitive; it is not a verdict on
            anything, because nothing has been answered yet. */}
        {opener !== null && index === 0 && (
          <Text style={[bType.meta, st.centred, { color: t.muted }]}>{opener}</Text>
        )}

        {face}
        {yours}
      </View>
    </ScrollScreen>
  );
}

/** The finished sitting's heading: the artboards' 19 bold card title. */
const type19 = bType.bold19;

function makeStyles(t: B) {
  return StyleSheet.create({
    loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    // A finished sitting: its heading, then its end card.
    ending: { gap: space(4) },
    // The free tier's held-back row: small, soft, under the card, never a banner.
    held: { marginTop: space(4), gap: space(1), alignItems: 'flex-start' },
    body: { gap: 18 },
    centred: { textAlign: 'center' },
    grow: { flex: 1, minWidth: 0 },
    // The card (B-Review): white, radius 28, padding 22/20, the drawing tucked
    // into its lower right corner.
    card: { backgroundColor: t.card, borderRadius: 28, paddingVertical: 22, paddingHorizontal: 20, gap: 12, overflow: 'hidden' },
    cardFront: { gap: 14, minHeight: 300 },
    art: { position: 'absolute', right: -14, bottom: -12, opacity: 0.9 },
    topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space(2) },
    tag: { backgroundColor: t.lavender, borderRadius: 12, paddingVertical: 4, paddingHorizontal: 10 },
    from: { flexShrink: 1, textAlign: 'right' },
    ask: { marginTop: 'auto', width: 190 },
    // The answer panel (B-ReviewReveal): mint, radius 20, padding 14.
    panel: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 20, backgroundColor: t.mintWash },
    panelWords: { flex: 1, minWidth: 0, gap: space(0.5) },
    // The speaker: a 48 disc, white on the mint panel, lavender on the white card.
    hear: { width: SPEAKER, height: SPEAKER, borderRadius: SPEAKER / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: t.card },
    hearOnCard: { backgroundColor: t.lavender },
    alsoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: space(0.5) },
    // "You said it": the white note under the card, radius 20, padding 12/16.
    yours: { backgroundColor: t.card, borderRadius: 20, paddingVertical: 12, paddingHorizontal: 16, gap: space(0.5) },
    foot: { gap: 8 },
    grades: { flexDirection: 'row', gap: 8, marginTop: space(0.5) },
    grade: { flex: 1, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    again: { backgroundColor: t.quiet },
    good: { backgroundColor: t.sun },
    easy: { backgroundColor: t.mint },
    // "I said it": the 56 primary with the mic; "Type it": the 50 white button.
    said: { height: 56, borderRadius: 28, backgroundColor: t.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
    typeIt: { height: 50, borderRadius: 25, backgroundColor: t.card, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    off: { opacity: 0.45 },
    // The text field, opened by the first "Type it". Type styles minus
    // lineHeight, which clips a single-line TextInput on iOS.
    input: {
      minHeight: HIT + 8,
      backgroundColor: t.card,
      borderRadius: 16,
      paddingHorizontal: space(4),
      paddingVertical: space(3),
      color: t.text,
      fontFamily: font.regular,
      fontSize: 16,
      textAlign: 'center',
    },
  });
}
