/**
 * Practice — made from the learner's own conversations.
 *
 * The tab is one question and three rows. The question is at the top: one
 * French line the learner has already met, with a way to hear it and one way
 * forward, decided whole in `practice/nextStep.ts`. Under it are the three
 * shapes the newest conversation left to practise (F554): the moment worth
 * replaying, said as what they said and a better way, never audio; the phrase
 * worth making theirs; and the sound to tune, from the newest sound check.
 * Every one of those decisions is in `practice/madeFrom.ts` and none of them is
 * here. A learner with no conversation behind them meets the same three shapes
 * from the café lesson (`practice/starter.ts`) and one sentence saying the page
 * becomes personal after the first conversation.
 *
 * F574 took the archive, the filters, the feed and the suggestion card off this
 * page. None of them was wrong; all of them together were a tab that answered
 * six questions at once, and a learner on a train has one. The conversations
 * themselves are a screen of their own now, and `practice/archive.ts` still
 * owns every count in them, so nothing moved into this file except layout.
 *
 * Whole-app phase 2 compacted the page into one order: the tab's own name and
 * one short line; the recommended card, which says where its sitting comes
 * from once and what it costs beside its one action; "More ways to practise",
 * the made-from rows as quiet alternatives that name their conversation only
 * when the card named another, drawn only when they can start; and the quiet
 * doors at the foot, with one door into the conversation library rather than
 * two. The line on the card is never one the sitting then asks for, which is
 * `practiceCard.ts`'s rule and not this file's.
 *
 * This file is null gates and a stylesheet, the same shape `home/MomentumCards.tsx`
 * settled on, because a screen that can count is a screen that can draw a nought.
 */

import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { type ConversationPack, type DrillExercise, type ReviewCard } from '@luvani/core';
import { accent, paper, space, type } from '../theme.ts';
import { Card, GhostButton, Label, OutlineButton, PillButton, TintRow } from '../components.tsx';
import { ReplayGlyph } from '../glyphs.tsx';
import { ScrollScreen, TabHeader } from '../layout.tsx';
import { ProfileButton } from '../profile/ProfileButton.tsx';
import { PhraseCard } from '../surface/PhraseCard.tsx';
import { UNREAD } from '../practice/archive.ts';
import { ALTERNATIVES, PRACTICE_PURPOSE, PRACTICE_TITLE } from '../practice/copy.ts';
import { NEXT_STEP } from '../practice/nextStep.ts';
import { recommendation } from '../practice/recommendation.ts';
import { practiceCard, practiceDoors, type PracticeCard, type PracticeDoors } from '../practice/practiceCard.ts';
import { loadDrillBank } from '../drill/store.ts';
import { latestReadyPack } from '../conversationPacks/model.ts';
import { useContinueArc } from '../purchases/useContinueArc.ts';
import { recoverPracticeCompletion } from '../practice/completion.ts';
import { loadPracticeSession, type PracticeSessionRecord } from '../practice/sessionStore.ts';
import { resumableOf } from '../practice/opening.ts';
import { practiceRouteParams } from '../practice/practiceRoute.ts';
import { scopeGeneration } from '../storage/scope.ts';
import { MADE_FROM, alternativesSource, madeFromConversations, type MadeFrom } from '../practice/madeFrom.ts';
import { STARTER, starterFrom } from '../practice/starter.ts';
import { STARTER_DESTINATION, starterMomentRow, starterPhraseRow } from '../practice/starterRows.ts';
import { ReplayMomentCard } from '../practice/ReplayMomentCard.tsx';
import { MakePhraseCard } from '../practice/MakePhraseCard.tsx';
import { TuneSoundCard } from '../practice/TuneSoundCard.tsx';
import { loadDeck } from '../review/store.ts';
import { loadSoundChecks } from '../soundcheck/store.ts';
import { useLive } from '../app/LiveContext.tsx';
import { useAuth } from '../auth/useAuth.tsx';
import { loadConversationPacks, refreshConversationPacks } from '../conversationPacks/store.ts';
import { loadPackMarks, withMarks, type PackMark } from '../conversationPacks/marks.ts';
import { TUTOR_OFFLINE, tutorGate } from '../tutor/gate.ts';
import * as tutorVoice from '../speech/tutorVoice.ts';
import type { SoundCheckEvidence } from '../soundcheck/model.ts';

export function PracticeTab() {
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const { recheck } = useLive();
  const { user, adapter } = useAuth();

  // The one recommended action and the quiet doors under it, answered whole by
  // practice/practiceCard.ts over core's balanced selector. Null while storage
  // has not answered, which is not the same as a learner with nothing to do.
  const [step, setStep] = useState<{ card: PracticeCard; doors: PracticeDoors } | null>(null);
  // Whether this plan opens the tutor revisit: the Tutor tab's continueArc
  // rule, through the one shared helper. Null while it is read, false when the
  // plan does not open it or nobody could check; either way the door is not
  // drawn, never drawn and then refused.
  const revisitAllowed = useContinueArc() === true;
  // The three cards made from the newest conversation, or the starter set when
  // there is none. Null while storage has not answered; `{ value: null }` is a
  // learner with no conversation yet, which is a fact rather than a wait.
  const [made, setMade] = useState<{ value: MadeFrom | null } | null>(null);
  // A probe is in flight. The one door here that touches the network runs one
  // before it navigates, and without the flag the tap does nothing visible for
  // up to a second and a half and a second tap queues a second navigation.
  const [checking, setChecking] = useState(false);
  // The start that did not happen, so the retry is the same start.
  const [heldBack, setHeldBack] = useState<{ textMode: boolean } | null>(null);
  // The line at the top is being said aloud. The card offers Stop while it is,
  // so a screen reader never offers to play something already playing.
  const [playing, setPlaying] = useState(false);
  // The read did not finish, and the learner is told so.
  //
  // Without this there is no third state: the models below were null both while
  // storage was answering and after something threw, and every gate here is
  // `x !== null && draw`, so a failure was invisible by construction. That is
  // exactly how F449 reached a real phone as a screen that sat there loading
  // and never said a word.
  const [failed, setFailed] = useState(false);

  // A voice started here stops when the tab goes.
  useEffect(() => () => tutorVoice.stop(), []);

  /**
   * Read everything the tab draws, and say so if it cannot.
   *
   * A `useCallback` rather than an inline effect body because the failure card
   * offers Try again, and the retry has to be the same work rather than a
   * second copy of it that could drift.
   *
   * `.catch` and not a second argument to `.then`: a throw inside the
   * fulfilment handler rejects the promise `.then` returns, and an `onRejected`
   * passed alongside it does not see that. The whole point here is the throw
   * inside the handler, so it has to be a `.catch` at the end of the chain, and
   * the inner refresh is returned rather than floated so its failures land in
   * the same place.
   */
  const load = useCallback(
    (cancelled: () => boolean) => {
      const now = Date.now();
      setFailed(false);
      // Bound to the account before any read. A sign-out, a switch or a
      // deletion while a read is in flight moves the scope generation, and a
      // result from the old account is dropped rather than drawn.
      const scope = scopeGeneration();
      const stale = (): boolean => cancelled() || scopeGeneration() !== scope;

      const draw = (
        fetched: readonly ConversationPack[],
        deck: readonly ReviewCard[],
        bank: readonly DrillExercise[],
        marks: readonly PackMark[],
        checks: readonly SoundCheckEvidence[],
        saved: PracticeSessionRecord | null,
      ) => {
        // This phone's marks folded in first, so the card and the rows read one
        // set of packs and cannot disagree about a practised one.
        const packs = withMarks(fetched, marks);
        // A sitting waiting on this phone is resumed before anything new is
        // offered. The record is the practice store's own; nothing is guessed.
        const rec = recommendation({ resumable: resumableOf(saved, packs, bank), deck, bank, packs, now });
        // The saved sitting's own phrases, so the card never previews a line a
        // resume is about to ask for.
        const card = practiceCard({ rec, deck, packs, now, resuming: saved?.targets.map((t) => t.phraseKey) ?? [] });
        const revisitPackId = (rec.kind !== 'none' ? rec.source?.id : undefined) ?? latestReadyPack(packs)?.id ?? null;
        setStep({ card, doors: practiceDoors({ deck, packs, now, revisitAllowed, revisitPackId }) });
        setMade({ value: madeFromConversations({ packs, marks, deck, checks, bank, now }) });
      };

      // Draw the cache at once, then quietly replace it with the server-owned
      // truth. A closed app can miss the original live delivery, so this pull
      // is the recovery path rather than a decorative refresh.
      //
      // A completion a previous launch left half-done lands first, so the card
      // never offers to resume a sitting whose grades are still in flight, and
      // the deck it reads already holds them. Recovery replays a frozen plan;
      // it awards nothing twice.
      void recoverPracticeCompletion()
        .catch(() => null)
        .then(() =>
          Promise.all([loadConversationPacks(), loadDeck(), loadDrillBank(), loadPackMarks(), loadSoundChecks(), loadPracticeSession()]),
        )
        .then(([packs, deck, bank, marks, checks, saved]) => {
          if (stale()) return undefined;
          draw(packs, deck, bank, marks, checks, saved);

          if (user === null) return undefined;
          return refreshConversationPacks(user, adapter).then((result) => {
            if (stale() || !result.ok) return undefined;
            // The refresh banks the packs' exercises, so the bank is read again
            // rather than drawn from the copy taken before it.
            return loadDrillBank().then((fresh) => {
              if (!stale()) draw(result.packs, deck, fresh, marks, checks, saved);
            });
          });
        })
        .catch(() => {
          if (!cancelled()) setFailed(true);
        });
    },
    [user, adapter, revisitAllowed],
  );

  // Rebuilt on every return: a conversation that just finished must be on this
  // page the moment the learner lands back here.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      load(() => cancelled);
      return () => {
        cancelled = true;
      };
    }, [load]),
  );

  /**
   * The first conversation, probed the way the hero's start is (F555).
   *
   * Refused rather than opened blind, because the whole point of this branch
   * is a learner with nothing behind them, and the first thing they meet must
   * not be a dead press. A refusal is answered on the tab with the same start.
   */
  const startFirst = () => {
    if (checking) return;
    setChecking(true);
    void recheck().then((answered) => {
      setChecking(false);
      const decision = tutorGate(answered, false);
      if (!decision.go) {
        setHeldBack(decision.heldBack);
        return;
      }
      setHeldBack(null);
      nav.navigate(decision.screen, decision.params);
    }).catch(() => {
      setChecking(false);
      setHeldBack({ textMode: false });
    });
  };

  /**
   * The one recommended action. A module sitting is local, so nothing is
   * probed and nothing waits; only the first conversation is live, and it goes
   * through the same probe it always has.
   */
  const startRecommended = () => {
    if (step === null) return;
    const action = step.card.action;
    if (action.kind === 'first') return startFirst();
    // Another conversation for a learner who has had one: the same live start.
    if (action.kind === 'talk') return startFirst();
    if (action.kind === 'practice') return nav.navigate('Drill', action.params);
    // The one saved sitting, whatever it was: the Drill screen reads its queue,
    // answers and warm-up flag from the practice store, never from the link.
    return nav.navigate('Drill', practiceRouteParams({ origin: 'resume', packId: null, exposed: false }));
  };

  /**
   * The tutor revisit. Offered only when the plan opens it, and routed the way
   * every continuation is, so the room checks ownership server-side and the
   * revisit is recorded only once it has actually opened.
   */
  const revisitWithTutor = (packId: string) => {
    nav.navigate('Convo', { continuationPackId: packId });
  };

  /** A drill is local. Nothing to probe, so nothing to wait for. */
  const revisit = (node: { id: string; title: string; phraseKeys: readonly string[] }) => {
    nav.navigate('Drill', { node: { id: node.id, title: node.title, phraseKeys: node.phraseKeys } });
  };

  /**
   * Say the line at the top, or stop saying it.
   *
   * One flag rather than a per-card one because there is one line: the card is
   * the top of the page and nothing else here speaks. A second tap stops it,
   * which is the same gesture `OptionCard`'s replay ear offers.
   */
  const hearNext = (french: string) => {
    if (playing) {
      tutorVoice.stop();
      setPlaying(false);
      return;
    }
    setPlaying(true);
    tutorVoice.speak(french, { onDone: () => setPlaying(false) });
  };

  const starter = starterFrom();
  const starterMoment = starterMomentRow();
  const starterPhrase = starterPhraseRow(starter);
  // Source once per cluster: the rows name their conversation only when the
  // card above has not named the same one.
  const alsoFrom = alternativesSource(made?.value ?? null, step?.card.sourcePackId ?? null);

  return (
    <ScrollScreen
      bottom="tab"
      // The frame header keeps only the F154 checking receipt, so a tap that
      // has to wait on the network stays acknowledged when the title scrolls
      // away. The gate's own word, so the tab and the tutor card do not grow
      // two vocabularies for the same second and a half.
      header={checking && (
        <Text
          accessibilityLiveRegion="polite"
          style={[type.small, { color: paper.inkSoft, marginTop: space(1) }]}
        >
          {TUTOR_OFFLINE.checking}
        </Text>
      )}
    >
      <View>
        {/* The art sits behind the words and bleeds off the corner, so the two
            share one relative box. It is decorative and takes no tap. */}
        <View style={st.head}>
          <TabHeader title={PRACTICE_TITLE} purpose={PRACTICE_PURPOSE} trailing={<ProfileButton />} />
        </View>

        {/* The read did not finish. Said plainly, with the same work offered
            again rather than an instruction to leave and come back. */}
        {failed && (
          <View style={st.block}>
            <Card>
              <Text style={st.openingTitle}>{UNREAD.title}</Text>
              <Text style={st.openingBody}>{UNREAD.body}</Text>
              <View style={st.blockBody}>
                <OutlineButton label={UNREAD.retry} onPress={() => load(() => false)} />
              </View>
            </Card>
          </View>
        )}

        {/* The one thing to do now: one French line, a way to hear it, and one
            control. Which line and which control is decided in
            practice/nextStep.ts and nothing about it is spelled here. When the
            deck is quiet and every conversation has been revisited there is no
            step, and this draws nothing rather than a cheerful message for a
            learner who is done. */}
        {step !== null && (
          <View style={st.block}>
            <PhraseCard
              label={NEXT_STEP.label}
              french={step.card.phrase.fr}
              gloss={step.card.phrase.en}
              playing={playing}
              onHear={() => hearNext(step.card.phrase.fr)}
              control={
                <View style={st.firstStart}>
                  {/* Where the sitting comes from, said once, then the one
                      action with what it costs directly under it. */}
                  {step.card.source !== null && <Text style={st.sourceLine}>{step.card.source}</Text>}
                  <View style={st.action}>
                    <PillButton label={step.card.action.label} disabled={checking} onPress={startRecommended} />
                    {step.card.noMinutes !== null && <Text style={st.costLine}>{step.card.noMinutes}</Text>}
                  </View>
                  {heldBack !== null && (
                    <View style={st.offline}>
                      <Text style={st.openingBody}>{TUTOR_OFFLINE.body}</Text>
                      <OutlineButton label={checking ? TUTOR_OFFLINE.checking : TUTOR_OFFLINE.retry} disabled={checking} onPress={startFirst} />
                    </View>
                  )}
                </View>
              }
            />
          </View>
        )}

        {/* Made from the newest conversation, or the starter set for a learner
            with none. Gated on the model: null is a read that has not answered. */}
        {made !== null && (
          <View style={st.block}>
            {made.value === null ? (
              /* The same three shapes, from the café lesson. This branch used to
                 draw three tall white cards of French with an outline under each
                 one, so a learner's first sight of Practice and their second
                 were two different pages; the words are the same words and the
                 rows are now the same rows. What each one offers, and where it
                 goes with nothing behind it, is `practice/starterRows.ts`. */
              <View style={st.rows}>
                <Label>{ALTERNATIVES.label}</Label>
                <TintRow
                  tint={starterMoment.tint}
                  glyph={<ReplayGlyph color={accent.primary} />}
                  title={starterMoment.title}
                  gloss={starterMoment.gloss}
                  onPress={() => nav.navigate(starterMoment.screen)}
                />
                <MakePhraseCard phrase={starterPhrase} onSay={(node) => nav.navigate('Drill', { node })} />
                <TuneSoundCard sound={null} onCheck={() => {}} onChoose={() => nav.navigate(STARTER_DESTINATION.sound)} />
                {/* One sentence, under the three shapes it is about: what this
                    page becomes once there is a conversation behind it. */}
                <Text style={st.starterLine}>{STARTER.line}</Text>
              </View>
            ) : (
              <View style={st.rows}>
                {/* Alternatives to the card above, not three more steps. The
                    conversation is named here only when the card named a
                    different one, as a quiet line and never a second heading. */}
                <View style={st.provenance}>
                  <Label>{ALTERNATIVES.label}</Label>
                  {alsoFrom !== null && <Text style={st.fromLine}>{alsoFrom}</Text>}
                </View>
                {/* Offered only when its sitting would hold something: a held
                    better line queues nothing and used to open "Nothing to
                    review" (whole-app phase 2 review). */}
                {made.value.replay !== null && made.value.replay.sayable && (
                  <ReplayMomentCard
                    replay={made.value.replay}
                    onTry={() =>
                      nav.navigate('Drill', {
                        node: {
                          id: `replay:${made.value!.replay!.packId}`,
                          title: MADE_FROM.replay.label,
                          phraseKeys: [made.value!.replay!.key],
                          moment: { quote: made.value!.replay!.quote, better: made.value!.replay!.better, why: made.value!.replay!.why },
                        },
                      })
                    }
                  />
                )}
                {made.value.phrase !== null && (
                  /* The node the row builds, passed straight on. It carries
                     `ownWords`, which is what makes this the own-words sitting
                     rather than a recall drill on a phrase the learner has just
                     been shown (F581); discarding it and dealing a scoped
                     sitting instead was asking them to copy. */
                  <MakePhraseCard phrase={made.value.phrase} onSay={(node) => nav.navigate('Drill', { node })} />
                )}
                {/* Only a row that can start is drawn: with nothing measured
                    there is no sound to tune yet. */}
                {made.value.sound !== null && (
                  <TuneSoundCard
                    sound={made.value.sound}
                    onCheck={(missionId) => nav.navigate('SoundCheck', { missionId })}
                    onChoose={() => nav.navigate('Missions')}
                  />
                )}
              </View>
            )}
          </View>
        )}

        {/* The quieter doors, at the foot of the page. Each is drawn only when
            it has something behind it: scheduled review, the one door into
            the whole conversation library, and the tutor revisit, which says
            it uses live minutes. */}
        {step !== null && (
          <View style={st.doors}>
            {step.doors.review !== null && <GhostButton label={step.doors.review} color={paper.ink} onPress={() => nav.navigate('Review')} />}
            {step.doors.choose !== null && <GhostButton label={step.doors.choose} color={paper.ink} onPress={() => nav.navigate('Conversations')} />}
            {step.doors.revisit !== null && (
              <View>
                <GhostButton
                  label={step.doors.revisit.label}
                  color={paper.ink}
                  accessibilityLabel={`${step.doors.revisit.label}. ${step.doors.revisit.uses}`}
                  onPress={() => revisitWithTutor(step.doors.revisit!.packId)}
                />
                <Text style={st.doorNote}>{step.doors.revisit.uses}</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </ScrollScreen>
  );
}

const st = StyleSheet.create({
  head: { position: 'relative' },
  block: { marginTop: space(3) },
  blockBody: { marginTop: space(3) },
  firstStart: { gap: space(3) },
  offline: { gap: space(3) },
  openingTitle: { ...type.bodyStrong, color: paper.ink },
  openingBody: { ...type.small, color: paper.inkSoft, marginTop: space(2) },
  // Both made-from branches are a list of rows one gap apart, which is the
  // same list the other tabs draw.
  rows: { gap: space(4) },
  starterLine: { ...type.small, color: paper.inkSoft },
  provenance: { gap: space(1) },
  // The card's one source line, and the cost said directly under its action.
  sourceLine: { ...type.small, color: paper.ink },
  action: { gap: space(1.5) },
  costLine: { ...type.small, color: paper.inkSoft },
  // The rows' own provenance, only when it differs from the card's.
  fromLine: { ...type.small, color: paper.inkSoft },
  // The quiet doors at the foot: left-aligned ghost links, one gap apart.
  doors: { marginTop: space(4), alignItems: 'flex-start', gap: space(1) },
  doorNote: { ...type.small, color: paper.inkSoft, marginTop: -space(1) },
});
