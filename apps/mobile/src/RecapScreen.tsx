import { KeptPhraseCard } from './recap/KeptPhraseCard.tsx';
import { FocusSheet } from './recap/FocusSheet.tsx';
import { PostcardStamp } from './celebrate/PostcardStamp.tsx';
import { Confetti } from './celebrate/Confetti.tsx';
import { SceneBand, SceneTiles } from './celebrate/EndScene.tsx';
import { statRowTileWidth, statTileLayout } from './game/todayHeroView.ts';
import { postcardLine, postcardStamp, recapCanDo } from './recap/evidence.ts';
import { postcardIllustration } from './recap/postcardArt.ts';
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
 * Since UI-020 (docs/changes/recap.md, direction A) it is one scroll in the
 * end scene's frame: EndScene's band with Cloud and Toast, the title and the
 * scene's goals, EndScene's tile row, the line said well, your lines, the kept
 * phrase once, small fixes, one focus row that opens one sheet, then Next
 * time, the reminder ask, saving the text and the report link. The footer is
 * pinned: "Practise this phrase" once the phrase is saved, and Done. The
 * paragraphs below are its history, kept for the rules they name.
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
 * Before UI-020, everything else the closure chose (what went well, the other
 * phrases, the small fix, a focus that is not a sound) sat under a closed More,
 * drawn after Done so opening it never pushed the way out down the screen.
 * Today the small fixes and one focus row are in the scroll.
 *
 * The postcard, the feature-paper header and the tinted panels left with the
 * notebook redesign, and the card sits on the shared frame rather than
 * measuring the safe area itself.
 *
 * Come alive (core loop 2.9): this is the conversation's end card, so it is
 * where the fanfare the room held back plays. The recap holds other
 * celebrations while it is up (`holdCelebrations`). Once the room has given the
 * learner's ears back (F763, or the audio wait runs out), the moment plays
 * (`recap/moment.ts`): the `complete` sound, and the band's confetti only when
 * the scene was finished on the learner's own. The postcard is then stamped,
 * silently, in the band after the strip, only for a finish on the learner's
 * own (`celebrate/PostcardStamp` with `sounds` and `confetti` off, so the
 * band's moment is the only sound and the only confetti); a finish with help
 * gets the postcard still. The progress tiles count up on the strip beat from
 * the settled GameDelta (XP, the day streak, the goal ring), and sit at rest
 * under Reduce Motion or when there is no moment to play. Each plays once per
 * recap.
 */

import { useEffect, useRef, useState } from 'react';
import { useAuth } from './auth/useAuth.tsx';
import { scopeGeneration } from './storage/scope.ts';
import { View, Text, StyleSheet, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { getMission, missionStates, type RecapPayload } from '@luvani/core';

import { HAIRLINE, decorative, space, type } from './theme.ts';
import { IconAction, Card, LipTile, LockBadge, OutlineButton, PillButton, Press } from './components.tsx';
import { ScrollScreen } from './layout.tsx';
import { Icon } from './icons/Icon.tsx';
import { useB, useThemedStyles, type B } from './main/bTheme.tsx';
import { bType, frenchText } from './theme.ts';
import * as tutorVoice from './speech/tutorVoice.ts';
import { useFeatureAccess } from './access/useFeatureAccess.ts';
import { fixesLocked } from './practice/fixesView.ts';
import { afterSessionStats, celebrateView, measuredSec, recapEyebrow, recapFocusRow, recapFooter, recapTiles, recapTitle, smallFixes } from './recap/afterSessionView.ts';
import { BandGoal, FixCard, LineRow, NextPill, PostcardTile, SaidWellCard } from './recap/RecapParts.tsx';
import type { ClosureFocus, ClosureRepair } from './conversationPacks/closure.ts';
import { arrived } from './motion/haptics.ts';
import { holdCelebrations } from './celebrate/queue.ts';
import { FeedbackLedger } from './motion/feedbackPolicy.ts';
import { closureFromRecap, type ClosureContext } from './conversationPacks/closure.ts';
import { missionCompletionsFrom } from './missions/chooserView.ts';
import { loadMissionCompletions } from './missions/store.ts';
import { loadDeck } from './review/store.ts';
import { loadSoundChecks } from './soundcheck/store.ts';
import { sessionCredit } from './recap/sessionCredit.ts';
import { loadReminder } from './reminders/store.ts';
import { REMINDERS_AVAILABLE, reminderPermission } from './reminders/schedule.ts';
import { reminderTime, type ReminderMode, type ReminderPermission, type StoredReminder } from './reminders/reminder.ts';
import { ReminderAsk } from './reminders/ReminderAsk.tsx';
import { useProfile } from './app/ProfileContext.tsx';
import { goalOf } from './onboarding/goalLine.ts';
import { startAtOf } from './profile/practicePreferences.ts';
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
/** The page margins the tile row sits in, for the first frame before it measures itself (as EndScene's). */
const ROW_MARGINS = space(8);

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
  carriedReplies = 0,
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
  /** Replies from the typed part of a scene switched to voice (F903), counted with the recap's own. */
  carriedReplies?: number;
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
  const [fixing, setFixing] = useState<ClosureRepair | null>(null);
  // Closed beta: "Something felt off? Tell us" opens the report sheet for this session.
  const [reporting, setReporting] = useState(openReport);
  const t = useB();
  const s = useThemedStyles(makeStyles);
  const locks = useFeatureAccess(user?.id);
  // The one focus sheet; mounted only while open, so its practice clip goes with it.
  const [focusing, setFocusing] = useState<ClosureFocus | null>(null);
  const { width: windowWidth, fontScale } = useWindowDimensions();
  const [rowWidth, setRowWidth] = useState(0);
  const [band, setBand] = useState({ width: 0, height: 0 });
  const measureBand = (event: LayoutChangeEvent) => setBand({ width: Math.round(event.nativeEvent.layout.width), height: Math.round(event.nativeEvent.layout.height) });
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
  // phrase after the save has started.
  const keptPhrase = closureFromRecap(recap, null).phrases[0] ?? null;
  // The one focus row: a sound when the learner's checks name one, else one
  // thing to tune (the tutor's own line, a cadence), else none (UI-020, Q4).
  const focusRow = recapFocusRow(closure.focus);
  const nextTime = context === null ? null : nextTimeLine(context.progress, goalOf(profile), startAtOf(profile));
  // The first-win gate: a recap with nothing in it offers nothing.
  const won = lines.length > 0 || keptPhrase !== null;
  const offer = reminderOffer({ available: REMINDERS_AVAILABLE, won, stored, permission });
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
  // One credit rule for the line, the phrases and the settle (F904, F903).
  const credit = sessionCredit(recap.stats, carriedReplies);
  const measured = measuredSec(credit.settles, activeSec);
  const stats = afterSessionStats({ activeSec: measured, phrases: credit.showPhrases ? recap.phrases.length : 0, xp: strip?.xp?.value ?? null });
  const tiles = recapTiles(stats);
  // The figures and their words both have to fit beside the coin whole, or the tiles stack, as on the drill end.
  const tileLayout = statTileLayout(statRowTileWidth(rowWidth > 0 ? rowWidth : windowWidth - ROW_MARGINS), fontScale, tiles.flatMap((tile) => [tile.format(tile.to), tile.word]));
  const fixes = smallFixes(recap.fixes);
  const celebrate = canDo !== null && mission ? celebrateView({ mission, independent: independentFinish, stamp, next: context === null ? null : nextCanDo(context.progress, goalOf(profile), startAtOf(profile)) }) : null;
  const shown = recapTitle(credit.settles);
  const foot = recapFooter({ kept: keptPhrase !== null, practice: onPractice !== undefined, saved: saveState === 'saved', earned: celebrate !== null, journey: onSeeJourney !== undefined });
  const practise = () => { if (keptPhrase !== null && onPractice !== undefined && saveState === 'saved') onPractice({ fr: keptPhrase.fr, en: keptPhrase.en, situation }); };
  const journey = () => onSeeJourney?.();
  const settlement = settlementMessage !== '' && settlementMessage != null && <Text accessibilityLiveRegion="polite" style={[bType.meta, { color: t.muted }]}>{settlementMessage}</Text>;
  return (<>
    <ScrollScreen
      footer={<View style={s.footer}>
        {foot.primary === 'practise'
          ? <>
            <PillButton label="Practise this phrase" onPress={practise} disabled={foot.practiseDisabled} disabledReason={foot.practiseDisabled ? saveLine : undefined} lip />
            <View style={s.footRow}>
              <OutlineButton label="Done" onPress={onDone} />
              {foot.journey === 'beside' && <OutlineButton label="See your journey" onPress={journey} />}
            </View>
          </>
          : <>
            <PillButton label="Done" onPress={onDone} lip />
            {foot.journey === 'under' && <View style={s.link}><OutlineButton label="See your journey" onPress={journey} /></View>}
          </>}
      </View>}>
      <View style={s.body} onLayout={(event) => setRowWidth(Math.round(event.nativeEvent.layout.width))}>
      {contextFailed && <Card>
        <Text accessibilityLiveRegion="polite" style={[type.body, { color: t.text }]}>Saved progress could not be read. You can still read this conversation's recap and keep its phrase.</Text>
        <IconAction layout="inline" icon="refresh" label="Try reading progress again" onPress={() => setContextRead(value => value + 1)} />
      </Card>}

      {/* EndScene's band: Cloud posed after a reply, resting with none; the moment's confetti for a scene finished on the learner's own; the postcard on an earned scene. */}
      <View onLayout={measureBand}>
        <SceneBand mood={credit.settles ? 'cheer' : 'idle'} cloud={credit.settles ? 'posed' : 'resting'}
          confetti={scene.burst && band.width > 0 ? <Confetti seed={`recap:${momentKey ?? recap.headline}`} started={moment.reached('burst')} final={moment.final} reduced={moment.reduced}
            width={band.width} height={band.height} count={36} palette={['blue', 'sun', 'coral', 'paper']} /> : null}
          postcard={celebrate !== null && mission && (moment.reached('strip') || moment.final) ? (stamp !== null
            ? <PostcardStamp art={postcardIllustration(mission.id)} kind={stamp} momentKey={momentKey} confetti={false} sounds={false}><PostcardTile /></PostcardStamp>
            : <PostcardTile />) : null} />
      </View>

      {celebrate !== null ? <View style={s.words}>
        <Text style={[bType.chip, { color: t.link }]}>{celebrate.eyebrow}</Text>
        <Text accessibilityRole="header" style={[bType.title30, { color: t.text }]}>{celebrate.ability}</Text>
        {celebrate.line !== null ? <Text style={[bType.line16, { color: t.secondary }]}>{celebrate.line}</Text> : null}
        {settlement}
      </View> : <View style={s.words}>
        <Text style={[bType.chip, { color: t.link }]}>{recapEyebrow(situation, measured)}</Text>
        <Text accessibilityRole="header" style={[bType.title30, { color: t.text }]}>{shown.title === 'headline' ? recap.headline : credit.line}</Text>
        {/* How it went, in a sentence. See tutor/recapLine.ts. */}
        {shown.lineUnder ? <Text style={[bType.line16, { color: t.secondary }]}>{credit.line}</Text> : null}
        {settlement}
      </View>}
      {credit.settles && goals.length > 0 ? <View style={s.goalCard}>{goals.map((goal) => <BandGoal key={goal.id} label={goal.goalEn} achieved={goal.achieved} />)}</View> : null}

      {/* What the conversation changed, from the settle, on the moment's beat. */}
      {strip !== null && !moment.reached('strip') ? null : <SceneTiles tiles={tiles} layout={tileLayout} counting final={strip === null || moment.final} />}

      {celebrate !== null ? <View style={s.words}>
        <Text style={[bType.chip, { color: t.link }]}>{celebrate.postcardEyebrow}</Text>
        <Text style={[bType.line16, { color: t.text }]}>{postcardLine(stamp)}</Text>
        {celebrate.next !== null ? <NextPill line={celebrate.next} /> : null}
      </View> : null}

      {evidenceQuote ? <SaidWellCard line={evidenceQuote} onHear={() => hear(evidenceQuote)} /> : null}

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

      {/* One phrase kept, once. */}
      {keptPhrase !== null ? (
        <KeptPhraseCard fr={keptPhrase.fr} en={keptPhrase.en} saveLine={saveLine} saved={saveState === 'saved'} eventKey={keptPhrase.key} onHear={() => hear(keptPhrase.fr)}>
          {saveState === 'failed' && <OutlineButton label="Try saving again" onPress={retrySave} />}
        </KeptPhraseCard>
      ) : null}

      {fixes.length > 0 && <View style={s.section}>
        <View>
          <View style={s.fixHead}>
            <Text accessibilityRole="header" style={[bType.section20, { color: t.text }]}>Small fixes</Text>
            {fixesLocked(locks.access) ? <LockBadge feature="fixes" /> : null}
          </View>
          <Text style={[bType.meta, { color: t.muted }]}>A more natural way to say it</Text>
        </View>
        {fixes.map((fix) => <FixCard key={`${fix.quote}:${fix.better}`} quote={fix.quote} better={fix.better} betterEn={fix.betterEn} why={fix.why}
          onPress={() => setFixing({ quote: fix.quote, better: fix.better, betterEn: fix.betterEn, why: fix.why })} />)}
      </View>}

      {/* The one focus: a sound, or one thing to tune, opening one sheet. */}
      {focusRow !== null && closure.focus !== null && (
        <LipTile accessibilityLabel={`${focusRow.label}. ${focusRow.line}`} onPress={() => setFocusing(closure.focus)} style={s.focus}>
          <View {...decorative} style={[s.coin, { backgroundColor: t.lavender }]}><Icon name={focusRow.kind === 'sound' ? 'mouth' : 'hint'} size={18} color={t.text} /></View>
          <View style={s.grow}>
            <Text style={[bType.chip, { color: t.link }]}>{focusRow.label}</Text>
            <Text {...(focusRow.french ? frenchText : {})} style={[focusRow.french ? type.french : bType.bold16, { color: t.text }]}>{focusRow.line}</Text>
          </View>
          <Icon name="chevron-right" size={18} color={t.muted} />
        </LipTile>
      )}

      {/* Next time: the spine's next scene, the reason to come back. */}
      {nextTime !== null && (celebrate === null || celebrate.next === null) && <Text style={[type.heading, { color: t.text }]}>{nextTime}</Text>}
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
      {conversationText && <SaveTextChoice {...conversationText} />}
      {reportAddress() !== null ? <Press haptic="none" accessibilityLabel={REPORT_COPY.endLink} onPress={() => setReporting(true)} style={s.link}>
        <Text style={[bType.semi13, { color: t.link }]}>{REPORT_COPY.endLink}</Text>
      </Press> : null}
      </View>
    </ScrollScreen>
    {focusing !== null && <FocusSheet focus={focusing} onClose={() => setFocusing(null)} />}
    {fixing !== null && <FixLineSheet repair={fixing} onClose={() => setFixing(null)} />}
    {reporting && <ReportSheet tutorName={tutorNameOf(profile)} sessionId={momentKey} onClose={() => setReporting(false)} />}
    </>
  );
}

function makeStyles(t: B) {
  return StyleSheet.create({
    footer: { gap: space(1) },
    footRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: space(4) },
    link: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
    body: { gap: space(5), paddingBottom: space(4) },
    words: { gap: space(1.5) },
    goalCard: { backgroundColor: t.card, borderRadius: 20, paddingVertical: 12, paddingHorizontal: 14, gap: 8 },
    section: { gap: 10 },
    listCard: { backgroundColor: t.card, borderRadius: 22, paddingVertical: 4, paddingHorizontal: 16 },
    fixHead: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
    focus: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(3), paddingHorizontal: space(4) },
    coin: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    grow: { flex: 1, minWidth: 0 },
  });
}

const st = StyleSheet.create({
  offer: { gap: space(2), paddingTop: space(4), borderTopWidth: HAIRLINE },
});
