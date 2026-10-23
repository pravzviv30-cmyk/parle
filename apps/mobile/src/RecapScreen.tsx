import { KeptPhraseCard } from './recap/KeptPhraseCard.tsx';
import { PrivatePractice } from './recap/PrivatePractice.tsx';
import { PostcardStamp } from './celebrate/PostcardStamp.tsx';
import { Illustration } from './art/flat/Illustration.tsx';
import { sceneIllustration } from './art/flat/scenes.ts';
import { postcardLine, postcardStamp, recapCanDo } from './recap/evidence.ts';
import { postcardIllustration } from './recap/postcardArt.ts';
import { ResultArt } from './recap/ResultArt.tsx';
import { progressStripView } from './recap/progressStrip.ts';
import { recapMoment } from './recap/moment.ts';
import { useRecapMoment } from './recap/useRecapMoment.ts';
import type { GameDelta } from './game/delta.ts';
import { SaveTextChoice } from './conversationPacks/SaveTextChoice.tsx';
import { FixLineSheet } from './drill/FixLineSheet.tsx';
import type { ConversationText } from '@luvani/core';
/**
 * The conversation's end card, as a keepsake (F552, F584; notebook Phase 4, B1).
 *
 * The end of a conversation is where a learner decides whether to come back,
 * so since 2026-09-27 it is something kept rather than something scored. It
 * leads with one kept phrase and translation on the screen's one highlighter.
 * It confirms a local save before calling it saved. Then come the learner's lines and one
 * sound (a word first, the notation on request), and "Next time: <the spine's
 * next scene>". Only after all of that does it offer a daily reminder, through
 * the one shared ask (`reminders/ReminderAsk.tsx`, Come alive Phase 4): at the
 * learner's chosen time or their own rhythm, naming their tutor, and the
 * phone's notification dialog is raised only when they tap Remind me: never
 * before the first win, and never by the card opening. Whether to offer it at
 * all is `live/keepsake.ts`'s `reminderOffer`.
 *
 * Everything else the closure chose (what went well, the other phrases, the
 * small fix, a focus that is not a sound) is one tap away under a closed More,
 * drawn after Done so opening it never pushes the way out down the screen.
 *
 * The postcard, the feature-paper header and the tinted panels left with the
 * notebook redesign, and the card sits on the shared frame rather than
 * measuring the safe area itself.
 *
 * Come alive (core loop 2.9): this is the conversation's end card, so it is
 * where the fanfare the room held back plays. Once the room has given the
 * learner's ears back (F763), the result page plays its moment
 * (`recap/moment.ts`): a sun glow behind the scene, the `complete` sound, and
 * confetti when the scene was finished on the learner's own; then the progress
 * strip from the settled GameDelta (XP, the day streak, the goal ring). The
 * lines count up to the number said. On the can-do page every independent
 * finish this session gets its postcard stamped (`celebrate/PostcardStamp`),
 * and a finish with help gets the postcard still. Each plays once per recap.
 */

import { useEffect, useRef, useState } from 'react';
import { useAuth } from './auth/useAuth.tsx';
import { scopeGeneration } from './storage/scope.ts';
import { recapPages, adjacentRecapPage, type RecapPage } from './recap/pages.ts';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { getMission, missionStates, type RecapPayload } from '@luvani/core';

import { HAIRLINE, HIT, space, type, frenchText } from './theme.ts';
import { IconAction, Card, Label, LockBadge, OutlineButton, Press } from './components.tsx';
import { ScrollScreen, TopInset } from './layout.tsx';
import { BArt } from './art/BArt.tsx';
import { useB, useThemedStyles, type B } from './main/bTheme.tsx';
import { BButton } from './today/TodayParts.tsx';
import { bType } from './theme.ts';
import * as tutorVoice from './speech/tutorVoice.ts';
import { useFeatureAccess } from './access/useFeatureAccess.ts';
import { fixesLocked } from './practice/fixesView.ts';
import { loadActivity } from './progress/activity.ts';
import { calendarWeekFrom, type WeekDay } from './progress/momentum.ts';
import { afterSessionStats, celebrateView, recapEyebrow, smallFixes, streakLine, weekBars } from './recap/afterSessionView.ts';
import { BandGoal, CelebrateConfetti, CloseDisc, FixCard, LineRow, NextPill, PostcardCard, PostcardTile, SaidWellCard, StatTiles, StreakRow } from './recap/RecapParts.tsx';
import type { ClosureRepair } from './conversationPacks/closure.ts';
import { arrived } from './motion/haptics.ts';
import { holdCelebrations } from './celebrate/queue.ts';
import { FeedbackLedger } from './motion/feedbackPolicy.ts';
import { SOUND_DETAIL, SOUND_FOCUS_LABEL, exampleFirstHeading } from './tutor/soundExample.ts';
import { MouthGuide } from './practice/MouthGuide.tsx';
import { MAX_CLOSURE_PHRASES, closureFromRecap, type ClosureContext } from './conversationPacks/closure.ts';
import { missionCompletionsFrom } from './missions/chooserView.ts';
import { loadMissionCompletions } from './missions/store.ts';
import { loadDeck } from './review/store.ts';
import { loadSoundChecks } from './soundcheck/store.ts';
import { recapLine } from './tutor/recapLine.ts';
import { loadReminder } from './reminders/store.ts';
import { REMINDERS_AVAILABLE, reminderPermission } from './reminders/schedule.ts';
import { reminderTime, type ReminderMode, type ReminderPermission, type StoredReminder } from './reminders/reminder.ts';
import { ReminderAsk } from './reminders/ReminderAsk.tsx';
import { useProfile } from './app/ProfileContext.tsx';
import { goalOf } from './onboarding/goalLine.ts';
import { tutorNameOf } from './tutor/tutorName.ts';
import { ReportSheet } from './live/ReportSheet.tsx';
import { REPORT_COPY, reportAddress } from './settings/reportMail.ts';
import {
  KEEPSAKE_COPY,
  nextCanDo,
  nextTimeLine,
  reminderAnswerLine,
  reminderOffer,
} from './live/keepsake.ts';

const savedHaptics = new FeedbackLedger();

export interface RecapPracticePhrase {
  fr: string;
  en: string;
  situation: string;
}

export function RecapScreen({
  recap,
  completedMissionId,
  firstEarned = false,
  lines,
  onDone,
  onPractice,
  onSave,
  conversationText,
  settlementMessage,
  evidenceQuote,
  independentFinish = false,
  delta = null,
  momentKey = null,
  openReport = false,
  onResultShown,
  activeSec = null,
  goals = [],
  onSeeJourney,
}: {
  recap: RecapPayload;
  settlementMessage?: string | null;
  /** Already checked against this session’s independent finish and learner source. */
  evidenceQuote?: string | null;
  completedMissionId?: string;
  /** A first earn, an earn again, or null when the learner's finish history could not be read (`recap/evidence.ts`, F777). */
  firstEarned?: boolean | null;
  /** This session's finish of the scene was on the learner's own (`recap/evidence.ts` `earnedFinish`). */
  independentFinish?: boolean;
  /** What the conversation changed, read back by the settle; null until it lands, or if it never does. */
  delta?: GameDelta | null;
  /** The session this recap closes, so its moments play once. */
  momentKey?: string | null;
  /** A report the learner saved in the live room: the sheet opens by itself, once, on arrival. */
  openReport?: boolean;
  /** Said once the result page is up: the conversation's settle hold can go (F766). */
  onResultShown?: () => void;
  /** Leaves for the Journey tab, from the Celebration's "See your journey". */
  onSeeJourney?: () => void;
  /** The room's own active clock for this sitting, in seconds, or null when unmeasured. */
  activeSec?: number | null;
  /** The scene's goals, passed through from the live room's `visibleMissionTasks` (no new storage). */
  goals?: readonly { id: string; goalEn: string; achieved: boolean }[];
  /** The learner's own lines from this conversation, from `keepsakeLines`. */
  lines: readonly string[];
  onDone: () => void;
  /** Opens the existing own-words drill with a phrase this conversation earned. */
  onPractice?: (phrase: RecapPracticePhrase) => void;
  /** Persists the exact keepsake phrase and answers only when the write is durable. */
  onSave: (phrase: RecapPracticePhrase) => Promise<boolean>;
  conversationText?: { ownerId: string; conversation: ConversationText | null };
}) {
  const { user, adapter } = useAuth();
  const { profile } = useProfile();
  const ownerScope = useRef(scopeGeneration()).current;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  // This is the conversation's end card, and the queue waits while the learner
  // reads it, as it does for every end card: what the conversation earned plays
  // after they leave the room. The room's own hold on the audio focus used to do
  // this by accident and now goes before the recap's moment (F763).
  useEffect(() => holdCelebrations(), []);
  // The result page is up and holding the queue itself, so the hold the
  // conversation took before it settled can go (F766). Declared after the hold
  // above, so the queue is never left unheld between the two.
  const resultShown = useRef(onResultShown);
  useEffect(() => {
    resultShown.current?.();
  }, []);
  // Null until the reads answer: the keepsake draws at once from the recap,
  // and the sound and "Next time" arrive a beat later.
  const [page, setPage] = useState<RecapPage>('result');
  const [fixing, setFixing] = useState<ClosureRepair | null>(null);
  // Closed beta: "Something felt off? Tell us" opens the report sheet for this session.
  const [reporting, setReporting] = useState(openReport);
  const t = useB();
  const s = useThemedStyles(makeStyles);
  const locks = useFeatureAccess(user?.id);
  // This week, Monday to Sunday, for the seven bars (progress/momentum.ts). A failed read draws no bars.
  const [week, setWeek] = useState<readonly WeekDay[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    void loadActivity().then((activity) => { if (!cancelled) setWeek(calendarWeekFrom(activity, Date.now())); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  // The tutor's voice saying a line: the device voice, never the learner's recording.
  const hear = (line: string) => { tutorVoice.speak(line); };
  useEffect(() => () => tutorVoice.stop(), []);
  const [context, setContext] = useState<ClosureContext | null>(null);
  const [contextRead, setContextRead] = useState(0);
  const [contextFailed, setContextFailed] = useState(false);
  // What the reminder offer is decided from. Both are reads: nothing on the
  // way in raises a dialog, and no offer is drawn until both have answered.
  const [stored, setStored] = useState<StoredReminder | null>(null);
  const [permission, setPermission] = useState<ReminderPermission | null>(null);
  // What the ask answered: still open, put aside, or on at the time it names.
  const [reminder, setReminder] = useState<'offered' | 'declined' | { on: ReminderMode }>('offered');


  useEffect(() => {
    let cancelled = false;
    setContext(null);
    setContextFailed(false);
    void Promise.all([loadMissionCompletions(), loadDeck(), loadSoundChecks({ strict: true })])
      .then(([completions, deck, checks]) => {
        if (cancelled) return;
        setContext({ progress: missionStates(missionCompletionsFrom(completions), deck, Date.now()), deck, checks });
      })
      .catch(() => {
        if (!cancelled) setContextFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [contextRead]);

  useEffect(() => {
    if (!REMINDERS_AVAILABLE) return;
    let cancelled = false;
    void Promise.all([loadReminder({ strict: true }), reminderPermission()])
      .then(([saved, allowed]) => {
        if (cancelled) return;
        setStored(saved);
        setPermission(allowed);
      })
      // An unreadable reminder offers nothing rather than guessing.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const closure = closureFromRecap(recap, context);
  // Pick the keepsake from the recap alone, so a later deck read cannot swap the
  // phrase after the save has started. The enriched closure may reorder phrases
  // to prefer something new; remove this exact key wherever it lands and keep
  // the original three-phrase ceiling across the keepsake and the rows below.
  const keptPhrase = closureFromRecap(recap, null).phrases[0] ?? null;
  const otherPhrases = closure.phrases.filter((phrase) => phrase.key !== keptPhrase?.key).slice(0, MAX_CLOSURE_PHRASES - 1);
  // The one sound, when the learner's checks name one. A focus that is not a
  // sound (the tutor's own line, a cadence) waits under More.
  const sound = closure.focus !== null && closure.focus.kind === 'sound' ? closure.focus : null;
  const otherFocus = closure.focus !== null && closure.focus.kind !== 'sound' ? closure.focus : null;
  const nextTime = context === null ? null : nextTimeLine(context.progress, goalOf(profile));
  // The first-win gate: a recap with nothing in it offers nothing.
  const won = lines.length > 0 || keptPhrase !== null;
  const offer = reminderOffer({ available: REMINDERS_AVAILABLE, won, stored, permission });
  const hasMore = closure.didWell.length > 0 || otherPhrases.length > 0 || otherFocus !== null;
  const [more, setMore] = useState(false);
  const [soundDetail, setSoundDetail] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const situation = closure.title;
  const savedHaptic = useRef(false);
  useEffect(() => { if (saveState === 'saved' && !savedHaptic.current && ownerScope === scopeGeneration() && keptPhrase !== null) { savedHaptic.current = true; if (savedHaptics.claim(`${ownerScope}:${keptPhrase.key}`)) arrived(); } }, [saveState, ownerScope, keptPhrase?.key]);
  const retrySave = () => {
    if (keptPhrase === null || saveState === 'saving' || ownerScope !== scopeGeneration()) return;
    setSaveState('saving');
    void onSave({ fr: keptPhrase.fr, en: keptPhrase.en, situation })
      .then((saved) => { if (mounted.current && ownerScope === scopeGeneration()) setSaveState(saved ? 'saved' : 'failed'); })
      .catch(() => { if (mounted.current && ownerScope === scopeGeneration()) setSaveState('failed'); });
  };

  useEffect(() => {
    if (keptPhrase === null) {
      setSaveState('idle');
      return;
    }
    let cancelled = false;
    setSaveState('saving');
    void onSave({ fr: keptPhrase.fr, en: keptPhrase.en, situation })
      .then((saved) => {
        if (!cancelled) setSaveState(saved ? 'saved' : 'failed');
      })
      .catch(() => {
        if (!cancelled) setSaveState('failed');
      });
    return () => {
      cancelled = true;
    };
  }, [keptPhrase?.en, keptPhrase?.fr, keptPhrase?.key, onSave, situation]);

  const saveLine =
    saveState === 'saved'
      ? 'Saved to Progress on this phone'
      : saveState === 'failed'
        ? 'Not saved yet'
        : 'Saving to Progress';

  const mission = completedMissionId ? getMission(completedMissionId) : undefined;
  const canDo = context === null ? null : recapCanDo(context.progress, completedMissionId);
  // The moment the room held back (recap/moment.ts), on its clock, once.
  const scene = recapMoment({ won, sceneFinished: mission !== undefined, independentFinish });
  const moment = useRecapMoment({ key: momentKey, plays: scene.plays });
  const strip = progressStripView(delta);
  // Every independent finish this session is stamped; a finish with help is not.
  const stamp = postcardStamp({ independent: independentFinish, firstEarned });
  const savableText = ownerScope === scopeGeneration() && adapter.kind === 'supabase'
    && conversationText?.ownerId === user?.id && (conversationText?.conversation?.lines.length ?? 0) > 0;
  const pages = recapPages({
    lines: lines.length > 0, phrase: keptPhrase !== null, repair: closure.repair !== null,
    sound: sound !== null, ability: canDo !== null,
    next: keptPhrase !== null || nextTime !== null || savableText || offer !== null || hasMore,
  });
  const pageIndex = Math.max(0, pages.indexOf(page));
  const currentPage = pages[pageIndex]!;
  const nextPage = adjacentRecapPage(pages, currentPage, 1);
  const previousPage = adjacentRecapPage(pages, currentPage, -1);
  const canPractise = keptPhrase !== null && saveState === 'saved' && onPractice !== undefined;
  const ground = currentPage === 'result' ? 'coral' : currentPage === 'sound' ? 'sun' : currentPage === 'ability' ? 'mint' : undefined;
  const stats = afterSessionStats({ activeSec, phrases: recap.phrases.length, xp: strip?.xp?.value ?? null });
  const streakWords = streakLine(strip?.streak?.value ?? null, week);
  const fixes = smallFixes(recap.fixes);
  const celebrate = canDo !== null && mission ? celebrateView({ mission, independent: independentFinish, stamp, next: context === null ? null : nextCanDo(context.progress, goalOf(profile)) }) : null;
  const blue = currentPage === 'result' || currentPage === 'ability';
  const finishLabel = nextPage === null ? 'Finish' : blue ? 'Continue' : 'Next';
  return (<>
    <ScrollScreen bottom="inset" padded={false} bleedTop ground={blue ? t.brand : t.ground}
      footer={<View style={s.footer}>
        {nextPage === null && canPractise
          ? <BButton label="Practise this phrase" height={56} ground={t.primary} ink={t.onPrimary} text={bType.bold18} onPress={() => onPractice({ fr: keptPhrase.fr, en: keptPhrase.en, situation })} />
          : <BButton label={finishLabel} accessibilityLabel={nextPage === null ? 'Finish conversation' : finishLabel} height={56}
              ground={blue ? t.onBrand : t.primary} ink={blue ? t.onMint : t.onPrimary} text={bType.bold18}
              onPress={() => nextPage === null ? onDone() : setPage(nextPage)} />}
        {currentPage === 'ability' && onSeeJourney ? <Press haptic="light" accessibilityLabel="See your journey" onPress={onSeeJourney} style={s.link}>
          <Text style={[bType.bold16, { color: t.onBrand }]}>See your journey</Text>
        </Press> : null}
        {currentPage === 'lines' && canPractise ? <Press haptic="light" accessibilityLabel="Practise these lines, free" onPress={() => onPractice({ fr: keptPhrase.fr, en: keptPhrase.en, situation })} style={s.link}>
          <Text style={[bType.semi15, { color: t.link }]}>Practise these lines, free</Text>
        </Press> : null}
        {reportAddress() !== null ? <Press haptic="none" accessibilityLabel={REPORT_COPY.endLink} onPress={() => setReporting(true)} style={s.link}>
          <Text style={[bType.semi13, { color: blue ? t.onBrand : t.link }]}>{REPORT_COPY.endLink}</Text>
        </Press> : null}
      </View>}>
      {contextFailed && <View style={s.pad}><Card>
        <Text accessibilityLiveRegion="polite" style={[type.body, { color: t.text }]}>Saved progress could not be read. You can still read this conversation's recap and keep its phrase.</Text>
        <IconAction layout="inline" icon="refresh" label="Try reading progress again" onPress={() => setContextRead(value => value + 1)} />
      </Card></View>}

      {/* After a session (B-AfterSession): the cheer, Bien joué, the stats, the line said well, the week. */}
      {currentPage === 'result' && <View style={s.blueBody}>
        <TopInset />
        <View style={s.closeRow}><CloseDisc on="blue" label="Finish conversation" onPress={onDone} /></View>
        <View style={s.art}>
          <ResultArt moment={moment} burst={scene.burst} seed={`recap:${momentKey ?? recap.headline}`}>
            {mission ? <BArt name="cloud-cheer" width={250} height={190} /> : lines.length > 0 ? <Illustration name="celebrate-first-line" fit="small" /> : <Illustration name="state-waiting" fit="small" />}
          </ResultArt>
        </View>
        <View style={s.words}>
          <Text accessibilityRole="header" style={[bType.display40, s.center, { color: t.sun }]}>Bien joué.</Text>
          <Text style={[bType.para17, s.center, { color: t.onBrandSoft }]}>{recap.headline}</Text>
          {settlementMessage !== '' && settlementMessage != null && <Text accessibilityLiveRegion="polite" style={[bType.meta, s.center, { color: t.onBrandSoft }]}>{settlementMessage}</Text>}
        </View>
        {/* What the conversation changed, from the settle, on its beat. */}
        {strip !== null && moment.reached('strip') ? <StatTiles tiles={stats} /> : strip === null ? <StatTiles tiles={stats} /> : null}
        {evidenceQuote ? <SaidWellCard line={evidenceQuote} onHear={() => hear(evidenceQuote)} /> : null}
        {streakWords !== null ? <StreakRow line={streakWords} bars={weekBars(week)} /> : null}
      </View>}

      {/* The Celebration (B-Celebrate): you can now, the ability, the postcard, what is next. */}
      {currentPage === 'ability' && celebrate !== null && mission && <View style={s.blueBody}>
        <CelebrateConfetti />
        <TopInset />
        <View style={s.closeRow}><CloseDisc on="blue" label="Finish conversation" onPress={onDone} /></View>
        <View style={s.art}><BArt name="cloud-cheer" width={260} height={198} /></View>
        <View style={s.words}>
          <Text style={[bType.bold15, s.center, { color: t.sun }]}>{celebrate.eyebrow}</Text>
          <Text accessibilityRole="header" style={[bType.ability34, s.center, { color: t.onBrand }]}>{celebrate.ability}</Text>
          {celebrate.line !== null ? <Text style={[bType.para17, s.center, { color: t.onBrandSoft }]}>{celebrate.line}</Text> : null}
        </View>
        <PostcardCard eyebrow={celebrate.postcardEyebrow} title={mission.title} line={postcardLine(stamp)}
          tile={stamp !== null
            ? <PostcardStamp art={postcardIllustration(mission.id)} kind={stamp} momentKey={momentKey}><PostcardTile /></PostcardStamp>
            : <PostcardTile />} />
        {celebrate.next !== null ? <NextPill line={celebrate.next} /> : null}
      </View>}

      {/* The Recap (B-Recap): the band with its goals, your lines, one phrase kept, small fixes. */}
      {currentPage === 'lines' && <View>
        <View style={s.band}>
          <TopInset />
          <BArt name="cloud-heart" width={160} height={122} style={s.bandArt} />
          <View style={s.bandClose}><CloseDisc on="band" label="Finish conversation" onPress={onDone} /></View>
          <Text style={[bType.chip, { color: t.link }]}>{recapEyebrow(situation, activeSec)}</Text>
          <Text accessibilityRole="header" style={[bType.title30, s.bandWords, { color: t.text }]}>{recap.headline}</Text>
          {/* How it went, in a sentence. See tutor/recapLine.ts. */}
          <Text style={[bType.line16, s.bandWords, { color: t.secondary }]}>{recapLine(recap.stats)}</Text>
          {goals.length > 0 ? <View style={s.goalCard}>{goals.map((goal) => <BandGoal key={goal.id} label={goal.goalEn} achieved={goal.achieved} />)}</View> : null}
        </View>
        <View style={s.recapBody}>
        {/* Your lines: what the learner actually said, in their own French. */}
        {lines.length > 0 && (
          <View style={s.section}>
            <View>
              <Text accessibilityRole="header" style={[bType.section20, { color: t.text }]}>{KEEPSAKE_COPY.lines}</Text>
              <Text style={[bType.meta, { color: t.muted }]}>French you said yourself</Text>
            </View>
            <View style={s.listCard}>
              {lines.map((line, index) => <LineRow key={line} line={line} last={index === lines.length - 1} onHear={() => hear(line)} />)}
            </View>
          </View>
        )}

        {/* One phrase kept. */}
        {keptPhrase !== null ? (
          <KeptPhraseCard fr={keptPhrase.fr} en={keptPhrase.en} saveLine={saveLine} saved={saveState === 'saved'} eventKey={keptPhrase.key} onHear={() => hear(keptPhrase.fr)}>
            {saveState === 'failed' && <OutlineButton label="Try saving again" onPress={retrySave} />}
            {onPractice !== undefined ? (
              <BButton label="Practise this phrase" accessibilityLabel={`Practise ${keptPhrase.fr}`} height={46} ground={t.card} ink={t.text} text={bType.bold16}
                disabled={saveState !== 'saved'} onPress={() => onPractice({ fr: keptPhrase.fr, en: keptPhrase.en, situation })} />
            ) : null}
          </KeptPhraseCard>
        ) : null}

        {fixes.length > 0 && <View style={s.section}>
          <View>
            <View style={s.fixHead}>
              <Text accessibilityRole="header" style={[bType.section20, { color: t.text }]}>Small fixes</Text>
              {fixesLocked(locks.access) ? <LockBadge /> : null}
            </View>
            <Text style={[bType.meta, { color: t.muted }]}>A more natural way to say it</Text>
          </View>
          {fixes.map((fix) => <FixCard key={`${fix.quote}:${fix.better}`} quote={fix.quote} better={fix.better} betterEn={fix.betterEn} why={fix.why}
            onPress={() => setFixing({ quote: fix.quote, better: fix.better, betterEn: fix.betterEn, why: fix.why })} />)}
        </View>}
        </View>
      </View>}

        {currentPage === 'sound' && <View style={s.pad}>
        <TopInset />
        {sound?.source === 'live' ? <>
          <Text accessibilityRole="header" style={[type.title, { color: t.text }]}>From this conversation</Text>
          <Text style={[type.small, { color: t.text }]}>Heard when you said the line you were given.</Text>
        </> : <>
          <Text accessibilityRole="header" style={[type.title, { color: t.text }]}>From a saved sound check</Text>
          {sound && <Text style={[type.small, { color: t.text }]}>This check concerns its recorded reference line, not your pronunciation overall. {getMission(sound.missionId)?.titleEn ?? 'A previous scene'}.</Text>}
        </>}

        {/* One sound, met as a word; the notation is a detail the learner opens. */}
        {sound !== null && (
          <View>
            <Label>{sound.source === 'live' ? SOUND_FOCUS_LABEL : KEEPSAKE_COPY.sound}</Label>
            <MouthGuide ipa={sound.ipa} />
            <Text style={[type.bodyStrong, { color: t.text, marginTop: space(2) }]}>{exampleFirstHeading(sound.acoustic, sound.example)}</Text>
            <Text style={[type.body, { color: t.muted, marginTop: space(1) }]}>{sound.acoustic.cue}</Text>
            <Pressable
              onPress={() => setSoundDetail((open) => !open)}
              accessibilityRole="button"
              accessibilityState={{ expanded: soundDetail }}
              style={({ pressed }) => [st.disclosure, pressed && st.pressed]}
            >
              <Text style={[type.small, { color: t.text }]}>{soundDetail ? SOUND_DETAIL.hide : SOUND_DETAIL.show}</Text>
            </Pressable>
            {soundDetail && <Text style={[type.notation, { color: t.muted }]}>{sound.acoustic.heading}</Text>}
            {sound.example !== null && <PrivatePractice key={sound.example} french={sound.example} />}
          </View>
        )}

        </View>}

        {currentPage === 'next' && <View style={[s.pad, { gap: space(4) }]}>
        <TopInset />
        {keptPhrase !== null && <View style={{ gap: space(2) }}>
          <Text style={[type.heading, { color: t.text }]}>Your next practice</Text>
          <Text style={[type.body, { color: t.text }]}>Try the line you kept from {situation}. You can also finish and return later.</Text>
          <Text {...frenchText} style={[type.french, { color: t.text }]}>{keptPhrase.fr}</Text>
          <Text style={[type.small, { color: t.muted }]}>{saveLine}</Text>
          {saveState === 'failed' && <OutlineButton label="Try saving again" onPress={retrySave} />}
        </View>}
        {conversationText && <SaveTextChoice {...conversationText} />}
        {/* Next time: the spine's next scene, the reason to come back. */}
        {nextTime !== null && <Text style={[type.heading, { color: t.text }]}>{nextTime}</Text>}
        {/* Only now, the one reminder ask. Its Remind me is the one thing on
            this card that may raise the phone's dialog. */}
        {offer !== null && reminder !== 'declined' && (
          <View style={[st.offer, { borderTopColor: t.line }]}>
            {reminder === 'offered' ? (
              <ReminderAsk
                time={offer.choice}
                tutor={tutorNameOf(profile)}
                asks={offer.asks}
                onDone={(answer) => {
                  if (!mounted.current || scopeGeneration() !== ownerScope) return;
                  setReminder(answer.enabled ? { on: answer.time } : 'declined');
                }}
              />
            ) : (
              <Text accessibilityLiveRegion="polite" style={[type.body, { color: t.text }]}>
                {reminderAnswerLine('on', { choice: reminder.on, time: reminderTime(reminder.on) })}
              </Text>
            )}
          </View>
        )}



        {/* Everything else the closure chose, one tap away and closed by
            default. Drawn after Done so opening it never pushes the way out
            down the screen. */}
        {hasMore && (
          <View>
            <Pressable
              onPress={() => setMore((open) => !open)}
              accessibilityRole="button"
              accessibilityLabel={more ? 'Hide more from this conversation' : 'More from this conversation'}
              accessibilityState={{ expanded: more }}
              style={({ pressed }) => [st.disclosure, pressed && st.pressed]}
            >
              <Text style={[type.small, { color: t.text }]}>{more ? 'Show less' : 'More'}</Text>
            </Pressable>
            {more && (
              <View style={st.more}>
                {closure.didWell.length > 0 && (
                  <View>
                    <Label>Your wins</Label>
                    <Card style={st.section}>
                      <View style={{ gap: space(2.5) }}>
                        {closure.didWell.map((win) => (
                          <Text key={win} style={[type.french, { color: t.text }]}>« {win} »</Text>
                        ))}
                      </View>
                    </Card>
                  </View>
                )}
                {otherPhrases.length > 0 && (
                  <View>
                    <Label>New phrases</Label>
                    <Card style={st.section}>
                      <View style={{ gap: space(3) }}>
                        {otherPhrases.map((phrase, index) => (
                          <View key={phrase.key} style={index > 0 ? [st.divider, { borderTopColor: t.line }] : undefined}>
                            <Text style={[type.french, { color: t.text }]}>{phrase.fr}</Text>
                            <Text style={[type.small, { color: t.muted, marginTop: space(0.5) }]}>{phrase.en}</Text>
                          </View>
                        ))}
                      </View>
                    </Card>
                  </View>
                )}
                {otherFocus !== null && (
                  <View>
                    <Label>One thing to tune</Label>
                    <Card style={st.section}>
                      {otherFocus.kind === 'clarity' ? (
                        <Text style={[type.bodyStrong, { color: t.text }]}>{otherFocus.line}</Text>
                      ) : (
                        <>
                          <Text style={[type.french, { color: t.text }]}>{otherFocus.fr}</Text>
                          <Text style={[type.small, { color: t.muted, marginTop: space(0.5) }]}>{otherFocus.en}</Text>
                          <Text style={[type.small, { color: t.muted, marginTop: space(1) }]}>{otherFocus.note}</Text>
                        </>
                      )}
                    </Card>
                  </View>
                )}
              </View>
            )}
          </View>
        )}
        </View>}
    </ScrollScreen>
    {fixing !== null && <FixLineSheet repair={fixing} onClose={() => setFixing(null)} />}
    {reporting && <ReportSheet tutorName={tutorNameOf(profile)} sessionId={momentKey} onClose={() => setReporting(false)} />}
    </>
  );
}

function makeStyles(t: B) {
  return StyleSheet.create({
    footer: { gap: 4, paddingHorizontal: 22, paddingTop: 8 },
    link: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
    pad: { paddingHorizontal: 22, gap: space(4), paddingBottom: space(8) },
    blueBody: { paddingHorizontal: 22, paddingBottom: 26, gap: 16 },
    closeRow: { flexDirection: 'row', justifyContent: 'flex-end' },
    art: { alignItems: 'center', marginTop: -10 },
    words: { gap: 14, alignItems: 'center' },
    center: { textAlign: 'center' },
    band: { backgroundColor: t.lavender, borderBottomLeftRadius: 40, borderBottomRightRadius: 40, paddingHorizontal: 22, paddingBottom: 22, gap: 6, overflow: 'hidden' },
    bandArt: { position: 'absolute', right: -10, top: 92 },
    bandClose: { flexDirection: 'row', justifyContent: 'flex-end' },
    bandWords: { maxWidth: 210 },
    goalCard: { backgroundColor: t.card, borderRadius: 20, paddingVertical: 12, paddingHorizontal: 14, gap: 8, marginTop: 10 },
    recapBody: { paddingTop: 22, paddingHorizontal: 22, paddingBottom: 40, gap: 24 },
    section: { gap: 10 },
    listCard: { backgroundColor: t.card, borderRadius: 22, paddingVertical: 4, paddingHorizontal: 16 },
    fixHead: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  });
}

const st = StyleSheet.create({
  stack: { paddingTop: space(3), paddingBottom: space(8), gap: space(6) },
  head: { gap: space(2) },
  // The number said and its words, set on one baseline as the hero number is.
  count: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: space(2) },
  keptStack: { gap: space(3) },
  kept: { gap: space(2) },
  savedLine: { minHeight: HIT, flexDirection: 'row', alignItems: 'center', gap: space(2) },
  offer: { gap: space(2), paddingTop: space(4), borderTopWidth: HAIRLINE },
  disclosure: { minHeight: HIT, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  more: { gap: space(7), marginTop: space(3) },
  section: { marginTop: space(2) },
  divider: { borderTopWidth: HAIRLINE, paddingTop: space(3) },
});
