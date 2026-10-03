/**
 * Practice leads with one recommended action. Its preview stays outside the
 * sitting's target set. A free local hear/say/compare door follows when the
 * selected tutor has an exact bundled line. The authored or checked sound is a
 * compact example below those actions; its full mouth guide is optional.
 * Conversation-made rows and due review still appear only when usable.
 */

import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { type ConversationPack, type DrillExercise, type ReviewCard } from '@luvani/core';
import { paper, space, type } from '../theme.ts';
import { Card, FrenchBlock, GhostButton, Label, Ledger, LedgerRow, OutlineButton, PillButton } from '../components.tsx';
import { DocumentGlyph } from '../glyphs.tsx';
import { ScrollScreen, TabHeader } from '../layout.tsx';
import { ProfileButton } from '../profile/ProfileButton.tsx';
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
import { activeUserId, scopeGeneration } from '../storage/scope.ts';
import { MADE_FROM, madeFromConversations, type MadeFrom } from '../practice/madeFrom.ts';
import { STARTER } from '../practice/starter.ts';
import { soundLead, type SoundLead } from '../practice/soundLead.ts';
import { ownsPracticeRead, type PracticeReadOwner } from '../practice/readOwner.ts';
import { useRecordedLine } from '../practice/recordedPlayer.ts';
import { ReplayMomentCard } from '../practice/ReplayMomentCard.tsx';
import { MakePhraseCard } from '../practice/MakePhraseCard.tsx';
import { TuneSoundCard } from '../practice/TuneSoundCard.tsx';
import { loadDeck } from '../review/store.ts';
import { loadSoundChecks } from '../soundcheck/store.ts';
import { useLive } from '../app/LiveContext.tsx';
import { useAuth } from '../auth/useAuth.tsx';
import { useProfile } from '../app/ProfileContext.tsx';
import { loadConversationPacks, refreshConversationPacks } from '../conversationPacks/store.ts';
import { loadPackMarks, withMarks, type PackMark } from '../conversationPacks/marks.ts';
import { TUTOR_OFFLINE, lessonStart, tutorGate } from '../tutor/gate.ts';
import { DAILY_ITEMS } from '../daily/catalogue.ts';
import { TUTOR_DAILY_AUDIO } from '../daily/tutorAudioManifest.ts';
import { shadowingPhrase } from '../daily/shadowing.ts';
import { dailyTutorVoice } from '../daily/tutorAudio.ts';
import * as tutorVoice from '../speech/tutorVoice.ts';
import type { SoundCheckEvidence } from '../soundcheck/model.ts';

export function PracticeTab() {
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const { recheck } = useLive();
  const { user, adapter } = useAuth();
  const { profile } = useProfile();
  // The learner's chosen tutor, whose bundled recordings are the only native
  // audio this page plays. Never another voice filling a gap.
  const voice = dailyTutorVoice(profile.tutorVoice);
  const recorded = useRecordedLine();
  const shadowPhrase = shadowingPhrase(DAILY_ITEMS,TUTOR_DAILY_AUDIO,voice);

  // The one recommended action and the quiet doors under it, answered whole by
  // practice/practiceCard.ts over core's balanced selector. Null while storage
  // has not answered, which is not the same as a learner with nothing to do.
  const [step, setStep] = useState<{ card: PracticeCard; doors: PracticeDoors } | null>(null);
  // Whether this plan opens the tutor revisit, through the one shared helper.
  const revisitAllowed = useContinueArc() === true;
  // The rows made from the newest conversation. Null while storage has not
  // answered; `{ value: null }` is a learner with no conversation yet.
  const [made, setMade] = useState<{ value: MadeFrom | null } | null>(null);
  // The sound the page leads with. Null while the checks are read.
  const [lead, setLead] = useState<SoundLead | null>(null);
  // A probe is in flight, so a second tap cannot queue a second navigation.
  const [checking, setChecking] = useState(false);
  // The start that did not happen, so the retry is the same start.
  const [heldBack, setHeldBack] = useState<{ textMode: boolean } | null>(null);
  // The preview line is being said aloud, so the card offers Stop.
  const [playing, setPlaying] = useState(false);
  // The read did not finish, and the learner is told so (F449).
  const [failed, setFailed] = useState(false);
  const [readOwner, setReadOwner] = useState<PracticeReadOwner | null>(null);
  const [failureOwner, setFailureOwner] = useState<PracticeReadOwner | null>(null);
  const currentScope = scopeGeneration();
  const ownerMatches = ownsPracticeRead(readOwner, currentScope, user?.id ?? null, activeUserId());
  const showFailed = failed && ownsPracticeRead(failureOwner, currentScope, user?.id ?? null, activeUserId());
  const ownsReadNow = () => ownerMatches && ownsPracticeRead(readOwner, scopeGeneration(), user?.id ?? null, activeUserId());

  // A voice started here stops when the tab goes.
  useEffect(() => () => tutorVoice.stop(), []);

  /**
   * Read everything the tab draws, and say so if it cannot. `.catch` at the end
   * of the chain, so a throw inside a fulfilment handler lands there too.
   */
  const load = useCallback(
    (cancelled: () => boolean) => {
      const now = Date.now();
      setFailed(false);
      setChecking(false);
      setHeldBack(null);
      setPlaying(false);
      tutorVoice.stop();
      recorded.stop();
      // Bound to the account before any read.
      const scope = scopeGeneration();
      const userId = user?.id ?? null;
      const capturedOwner = { scope, userId };
      const stale = (): boolean => cancelled() || !ownsPracticeRead(capturedOwner, scopeGeneration(), userId, activeUserId());

      const draw = (
        fetched: readonly ConversationPack[],
        deck: readonly ReviewCard[],
        bank: readonly DrillExercise[],
        marks: readonly PackMark[],
        checks: readonly SoundCheckEvidence[],
        saved: PracticeSessionRecord | null,
      ) => {
        const packs = withMarks(fetched, marks);
        const rec = recommendation({ resumable: resumableOf(saved, packs, bank), deck, bank, packs, now });
        // The saved sitting's own phrases, so the card never previews a line a
        // resume is about to ask for.
        const card = practiceCard({ rec, deck, packs, now, resuming: saved?.targets.map((t) => t.phraseKey) ?? [] });
        const revisitPackId = (rec.kind !== 'none' ? rec.source?.id : undefined) ?? latestReadyPack(packs)?.id ?? null;
        setStep({ card, doors: practiceDoors({ deck, packs, now, revisitAllowed, revisitPackId }) });
        setMade({ value: madeFromConversations({ packs, marks, deck, checks, bank, now }) });
        setLead(soundLead({ checks, now, voice, recordings: TUTOR_DAILY_AUDIO, items: DAILY_ITEMS }));
        setReadOwner({ scope, userId });
      };

      // A completion a previous launch left half-done lands first, then the
      // cache is drawn, then the server-owned truth quietly replaces it.
      void recoverPracticeCompletion()
        .catch(() => null)
        .then(() =>
          Promise.all([loadConversationPacks(), loadDeck(), loadDrillBank(), loadPackMarks(), loadSoundChecks({ strict: true }), loadPracticeSession()]),
        )
        .then(([packs, deck, bank, marks, checks, saved]) => {
          if (stale()) return undefined;
          draw(packs, deck, bank, marks, checks, saved);

          if (user === null) return undefined;
          return refreshConversationPacks(user, adapter).then((result) => {
            if (stale() || !result.ok) return undefined;
            // The refresh banks the packs' exercises, so the bank is read again.
            return loadDrillBank().then((fresh) => {
              if (!stale()) draw(result.packs, deck, fresh, marks, checks, saved);
            });
          });
        })
        .catch(() => {
          if (!stale()) { setFailureOwner({ scope, userId }); setFailed(true); }
        });
    },
    [user, adapter, revisitAllowed, voice, recorded.stop],
  );

  // Rebuilt on every return, so a conversation that just finished is here.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      load(() => cancelled);
      return () => {
        cancelled = true;
        recorded.stop();
      };
    }, [load, recorded.stop]),
  );

  /**
   * A live conversation, probed the way the hero's start is (F555). A refusal
   * is answered on the tab with the same start.
   */
  const startFirst = () => {
    if (checking || !ownsReadNow()) return;
    setChecking(true);
    void recheck().then((answered) => {
      if (!ownsReadNow()) return;
      setChecking(false);
      const decision = tutorGate(answered, false);
      if (!decision.go) {
        setHeldBack(decision.heldBack);
        return;
      }
      setHeldBack(null);
      nav.navigate(decision.screen, decision.params);
    }).catch(() => {
      if (!ownsReadNow()) return;
      setChecking(false);
      setHeldBack({ textMode: false });
    });
  };

  /**
   * The guided sound lesson, opened the way the chooser opens it. The probe
   * only refreshes whether a tutor is reachable: the lesson runs live when one
   * is and on this phone when not, so it opens either way.
   */
  const openLesson = () => {
    if (checking || !ownsReadNow()) return;
    setChecking(true);
    const go = () => {
      if (!ownsReadNow()) return;
      setChecking(false);
      const start = lessonStart(false);
      nav.navigate(start.screen, start.params);
    };
    void recheck().then(go, go);
  };

  /** The one recommended action. A module sitting is local, so nothing is probed. */
  const startRecommended = () => {
    if (step === null || !ownsReadNow()) return;
    recorded.stop();
    const action = step.card.action;
    if (action.kind === 'lesson') return openLesson();
    if (action.kind === 'talk') return startFirst();
    if (action.kind === 'practice') return nav.navigate('Drill', action.params);
    // The one saved sitting: the Drill screen reads its queue from the store.
    return nav.navigate('Drill', practiceRouteParams({ origin: 'resume', packId: null, exposed: false }));
  };

  /** The tutor revisit, routed the way every continuation is. */
  const revisitWithTutor = (packId: string) => {
    if (!ownsReadNow()) return;
    nav.navigate('Convo', { continuationPackId: packId });
  };

  /** Say the preview line, or stop saying it. */
  const hearNext = (french: string) => {
    if (!ownsReadNow()) return;
    if (playing) {
      tutorVoice.stop();
      setPlaying(false);
      return;
    }
    recorded.stop();
    setPlaying(true);
    tutorVoice.speak(french, { onDone: () => setPlaying(false) });
  };

  /** Play the sound's recording, or stop it. Never the synthesiser. */
  const hearRecording = (asset: number) => {
    if (!ownsReadNow()) return;
    tutorVoice.stop();
    setPlaying(false);
    recorded.toggle(asset);
  };

  // Day one is the model's answer: the card's action is the sound lesson.
  const dayOne = ownerMatches && step !== null && step.card.action.kind === 'lesson';
  // The ledger is drawn only when one of its rows can start.
  const rowsCanStart =
    ownerMatches && ((made?.value?.replay != null && made.value.replay.sayable) ||
    made?.value?.phrase != null ||
    (step !== null && step.doors.review !== null));

  // The page's one primary action, built once. It sits in the sound block on
  // day one and in the recommended card on every other day, never both.
  const primary = !ownerMatches || step === null ? null : (
    <View style={st.firstStart}>
      {step.card.source !== null && <Text style={st.sourceLine}>{step.card.source}</Text>}
      <View style={st.action}>
        <PillButton label={step.card.action.label} disabled={checking} onPress={startRecommended} />
        {step.card.liveMinutes !== null && <Text style={st.costLine}>{step.card.liveMinutes}</Text>}
        {step.card.noMinutes !== null && <Text style={st.costLine}>{step.card.noMinutes}</Text>}
      </View>
      {heldBack !== null && (
        <View style={st.offline}>
          <Text style={st.openingBody}>{TUTOR_OFFLINE.body}</Text>
          <OutlineButton label={checking ? TUTOR_OFFLINE.checking : TUTOR_OFFLINE.retry} disabled={checking} onPress={startFirst} />
        </View>
      )}
    </View>
  );

  return (
    <ScrollScreen
      bottom="tab"
      // The F154 checking receipt, kept in the frame header so a tap that waits
      // on the network stays acknowledged when the title scrolls away.
      header={ownerMatches && checking && (
        <Text
          accessibilityLiveRegion="polite"
          style={[type.small, { color: paper.inkSoft, marginTop: space(1) }]}
        >
          {TUTOR_OFFLINE.checking}
        </Text>
      )}
    >
      <View>
        <TabHeader title={PRACTICE_TITLE} purpose={PRACTICE_PURPOSE} trailing={<ProfileButton />} />

        {/* The read did not finish. Said plainly, with the same work offered again. */}
        {showFailed && (
          <View style={st.block}>
            <Card>
              <Text style={st.openingTitle}>{UNREAD.title}</Text>
              <Text style={st.openingBody}>{UNREAD.body}</Text>
              <View style={st.blockBody}>
                <OutlineButton label={UNREAD.retry} onPress={() => { if (ownsPracticeRead(failureOwner, scopeGeneration(), user?.id ?? null, activeUserId())) load(() => false); }} />
              </View>
            </Card>
          </View>
        )}

        {/* The exact next action stays in the first viewport, including on day one. */}
        {ownerMatches && step !== null && (
          <View style={st.block}>
            <Card style={{ gap: space(4) }}>
              <Label>{NEXT_STEP.label}</Label>
              <FrenchBlock french={step.card.phrase.fr} english={step.card.phrase.en} playing={playing} onHear={() => hearNext(step.card.phrase.fr)} />
              {primary}
            </Card>
          </View>
        )}

        {/* One sentence, on day one only: what this page becomes. */}
        {dayOne && <Text style={st.starterLine}>{STARTER.line}</Text>}

        {shadowPhrase && <View style={st.block}><Ledger><LedgerRow glyph={<DocumentGlyph color={paper.ink} />} title="Hear, say and compare" gloss="Free offline practice with your chosen tutor’s recording. Your take is temporary and is not graded." onPress={()=>nav.navigate('DailyPractice',{id:shadowPhrase.id,mode:'shadowing'})} /></Ledger></View>}

        {/* The sound example follows the short action; its full guide is optional. */}
        {ownerMatches && lead !== null && (
          <View style={st.block}>
            <TuneSoundCard lead={lead} playing={recorded.playing} onHear={hearRecording} onCheck={(missionId) => { if (ownsReadNow()) nav.navigate('SoundCheck', { missionId }); }} />
          </View>
        )}

        {/* The ways to practise, each drawn only when it can start. */}
        {rowsCanStart && (
          <View style={st.block}>
            <View style={st.rowsHead}>
              <Label>{ALTERNATIVES.label}</Label>
            </View>
            <Ledger>
              {made?.value?.replay != null && made.value.replay.sayable && (
                <ReplayMomentCard
                  replay={made.value.replay}
                  onTry={() => {
                    if (!ownsReadNow()) return;
                    nav.navigate('Drill', {
                      node: {
                        id: `replay:${made.value!.replay!.packId}`,
                        title: MADE_FROM.replay.label,
                        phraseKeys: [made.value!.replay!.key],
                        moment: { quote: made.value!.replay!.quote, better: made.value!.replay!.better, why: made.value!.replay!.why },
                      },
                    });
                  }}
                />
              )}
              {made?.value?.phrase != null && (
                /* The own-words node the row builds, passed straight on (F581). */
                <MakePhraseCard phrase={made.value.phrase} onSay={(node) => { if (ownsReadNow()) nav.navigate('Drill', { node }); }} />
              )}
              {step !== null && step.doors.review !== null && (
                <LedgerRow glyph={<DocumentGlyph color={paper.ink} />} title={step.doors.review} onPress={() => { if (ownsReadNow()) nav.navigate('Review'); }} />
              )}
            </Ledger>
          </View>
        )}

        {/* The quieter doors at the foot, each only when it has something behind it. */}
        {ownerMatches && step !== null && (
          <View style={st.doors}>
            {step.doors.choose !== null && <GhostButton label={step.doors.choose} color={paper.ink} onPress={() => { if (ownsReadNow()) nav.navigate('Conversations'); }} />}
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
  block: { marginTop: space(3) },
  blockBody: { marginTop: space(3) },
  firstStart: { gap: space(3) },
  offline: { gap: space(3) },
  openingTitle: { ...type.bodyStrong, color: paper.ink },
  openingBody: { ...type.small, color: paper.inkSoft, marginTop: space(2) },
  starterLine: { ...type.small, color: paper.inkSoft, marginTop: space(3) },
  rowsHead: { marginBottom: space(2) },
  sourceLine: { ...type.small, color: paper.ink },
  action: { gap: space(1.5) },
  costLine: { ...type.small, color: paper.inkSoft },
  doors: { marginTop: space(4), alignItems: 'flex-start', gap: space(1) },
  doorNote: { ...type.small, color: paper.inkSoft, marginTop: -space(1) },
});
