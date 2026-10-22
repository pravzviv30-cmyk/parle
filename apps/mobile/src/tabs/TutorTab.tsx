/**
 * Speak, direction B (B2, 2026-10-20; rebuilt to the artboard in light and
 * dark, 2026-10-20 UI-008, artboard B-Speak).
 *
 * In the artboard's order: the header, the yellow Recommended card (the next
 * scene, its minutes, the Speak/Type control, the two tutor preferences,
 * Prepare first and the one Start), the starter scenes, "Same scene, a bit
 * less help" when a finished scene can really be replayed with less help,
 * "Talk about anything" with the learner's remembered topics, the tutor row,
 * three tiles, and the speaking time as a band in words. Every colour is a
 * `useB()` token, so the same parts draw the M3 mapping in dark.
 *
 * Every decision lives in `tutor/speakTabView.ts`, `tutor/speakView.ts` and
 * `tutor/nextConversation.ts`; this file is layout and the live probe.
 * Connection checks preserve the exact requested start, spoken or typed, so a
 * retry never silently changes the conversation. Lock badges come only from
 * `access/featureAccess.ts`, through the view model. "Revisit a conversation"
 * left with UI-008 (the artboard draws none): Conversations stays reachable
 * from Journey and Settings.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions, type StyleProp, type TextStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { memoryPaused } from '@luvani/brain/profile';
import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { enterVoicePlayback } from '../sound/audioSession.ts';
import { useVoiceHold } from '../sound/useVoiceHold.ts';
import { startVoiceLine } from '../sound/voiceLine.ts';
import { missionStates, type MissionProgress } from '@luvani/core';
import { LocalPracticeCard } from '../practice/LocalPracticeCard.tsx';
import { WALK_AVAILABLE } from '../walk/observer.ts';
import { scopeGeneration } from '../storage/scope.ts';
import { ownedReadStatus } from './ownedRead.ts';

import { Card, IconAction, Label, LOCK_BADGE_LABEL, LockBadge, Press } from '../components.tsx';
import { BArt } from '../art/BArt.tsx';
import { EmptyStateCard } from '../empty/EmptyStateCard.tsx';
import { AWAY_ART, OUT_OF_TIME_ART, outOfTimeCard } from '../empty/emptyStates.ts';
import { useB, useThemedStyles, type B } from '../main/bTheme.tsx';
import { BButton, BMic, BSpeaker, CheckDisc } from '../today/TodayParts.tsx';
import { visibleFacts } from '../profile/memory.ts';
import { useLive } from '../app/LiveContext.tsx';
import { useAuth } from '../auth/useAuth.tsx';
import { useFeatureAccess } from '../access/useFeatureAccess.ts';
import { tapThrough } from '../access/featureAccess.ts';
import { fetchBillingStatus } from '../purchases/client.ts';
import { planStatusFor, type PlanStatusView } from '../purchases/planStatus.ts';
import { useProfile } from '../app/ProfileContext.tsx';
import { ScrollScreen, TabHeader } from '../layout.tsx';
import { ProfileButton } from '../profile/ProfileButton.tsx';
import { loadConversationPacks } from '../conversationPacks/store.ts';
import { loadPackMarks } from '../conversationPacks/marks.ts';
import { loadTopics } from '../topics/store.ts';
import { capabilitiesFor, type PlanTier } from '../purchases/capabilities.ts';
import { threadFrom, type Thread } from '../tutor/threads.ts';
import { loadMissionCompletions } from '../missions/store.ts';
import { missionCompletionsFrom } from '../missions/chooserView.ts';
import { loadScenarioProgress } from '../missions/progressStore.ts';
import { loadDeck } from '../review/store.ts';
import { practicePreferencesOf } from '../profile/practicePreferences.ts';
import { learningSuggestions } from '../main/learningSuggestions.ts';
import { bType, decorative, frenchText, space, type, HIT } from '../theme.ts';

import { tutorOrbState } from '../tutor/orbState.ts';
import { TUTOR_OFFLINE, tutorGate } from '../tutor/gate.ts';
import { tutorNameOf } from '../tutor/tutorName.ts';
import { tutorVoiceOf } from '../tutor/tutorVoice.ts';
import { voiceSample } from '../tutor/voiceSamples.ts';
import { nextConversation } from '../tutor/nextConversation.ts';
import { prefersTyping } from '../profile/typing.ts';
import { strictnessLabel } from '../tutor/strictness.ts';
import { paceOf } from '../tutor/pace.ts';
import { CHANGE_VOICE, startModes, startNote, tutorCardFacts } from '../tutor/speakView.ts';
import {
  CHANGE_VOICE_ROUTE, EVERY_SCENE, LESS_HELP_TITLE, MODE_CHOICES, modeChoice, withAnswerMode, type AnswerMode, NEXT_CHIP, PREFERENCES_ROUTE, PREPARE_FIRST, RECOMMENDED,
  SEE_MINUTES, SPEAK_TITLE, START, TALK_SUB, TALK_TITLE, USES_SPEAKING_TIME, correctionsChip, lessHelp, minutesBand, paceChip,
  recommended, sampleCaption, speakSubtitle, speakTiles, starterScenes, talkChips, tileLayout,
} from '../tutor/speakTabView.ts';

type Completion = { id: string; at: number; rung: number };

export function TutorTab() {
  const focused = useIsFocused();
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const { live, recheck } = useLive();
  const { profile } = useProfile();
  const t = useB();
  const st = useThemedStyles(makeStyles);
  const tutorName = tutorNameOf(profile);
  const voiceKey = tutorVoiceOf(profile);
  const card = tutorCardFacts(voiceKey);
  // Profile's standing "Prefer typing" is the default; the radios on the card
  // change only this start.
  const modes = startModes(prefersTyping(profile));
  // Speak or Type by default, never Listen: Listen is chosen per start.
  const [chosenMode, setChosenMode] = useState<AnswerMode | null>(null);
  const answer = modeChoice(chosenMode ?? modes.mode);
  const textMode = answer.textMode;
  /** A start's params, carrying Listen only when that is the choice. */
  const answered = (params: object): object => withAnswerMode(answer.key, params);
  const { width, fontScale } = useWindowDimensions();
  const stacked = width < 350 || fontScale >= 1.5;

  const [heldBack, setHeldBack] = useState<{ textMode: boolean } | null>(null);
  // Another screen's recheck can bring the tutor back; a refusal from here is then stale.
  useEffect(() => { if (live) setHeldBack(null); }, [live]);
  const [checking, setChecking] = useState(false);
  const [progress, setProgress] = useState<readonly MissionProgress[]>(() => missionStates([], [], Date.now()));
  const [completions, setCompletions] = useState<readonly Completion[]>([]);
  const [historyStatus, setHistoryStatus] = useState<'loading' | 'ready' | 'unread'>('loading');
  const [historyReadOwner, setHistoryReadOwner] = useState(() => scopeGeneration());
  const [historyReadyOwner, setHistoryReadyOwner] = useState<number | null>(null);
  const [historyAttempt, setHistoryAttempt] = useState(0);
  const pendingStart = useRef<object>({});
  const starting = useRef(false);
  /** The one thread to pick up, or null. */
  const [thread, setThread] = useState<Thread | null>(null);
  /** The plan the server answered, for the continuation rule. */
  const [plan, setPlan] = useState<{ tier: PlanTier; lapsed: boolean }>({ tier: 'unknown', lapsed: false });
  /** The plan in words, for the footer's band. Null until the read answers. */
  const [planView, setPlanView] = useState<PlanStatusView | null>(null);
  // Core's answer to "may a session start", or null when nobody could ask; a
  // null reads as ready, because the server refuses a start it cannot afford.
  const [canStart, setCanStart] = useState<boolean | null>(null);
  const { user } = useAuth();
  // The lock seam: re-renders on a standing change, opens the Wall on a locked tap.
  const locks = useFeatureAccess(user?.id);

  // The voice sample: one player, the bundled clip for the chosen voice. The
  // same control stops it, a clip that ends lets go of "Stop", and leaving the
  // tab takes the sound with it, because a bottom tab is never unmounted.
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);
  useVoiceHold(status.playing);
  const [playing, setPlaying] = useState(false);
  // Every tap spends the ticket, so a stop or a blur during the mode change wins.
  const hearTicket = useRef(0);
  const focusedNow = useRef(focused);
  focusedNow.current = focused;
  useEffect(() => { if (status.didJustFinish) setPlaying(false); }, [status.didJustFinish]);
  useEffect(() => { if (!focused) { player.pause(); setPlaying(false); } }, [focused, player]);
  const hear = () => {
    const ticket = ++hearTicket.current;
    if (playing) {
      player.pause();
      setPlaying(false);
      return;
    }
    setPlaying(true);
    // A full voice mode first, so the sample is heard with the silent switch on (F723). The web has
    // no modes and plays only inside the tap, so there it starts at once (sound/voiceLine.ts).
    startVoiceLine(enterVoicePlayback().catch(() => undefined), () => {
      if (ticket !== hearTicket.current || !focusedNow.current) return;
      player.replace(voiceSample(voiceKey));
      player.play();
    }, Platform.OS === 'web');
  };

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const scope = scopeGeneration();
      setHistoryReadOwner(scope);
      setHistoryReadyOwner(null);
      setHistoryStatus('loading');
      void Promise.all([loadMissionCompletions(), loadDeck(), loadScenarioProgress(), loadConversationPacks(), loadPackMarks(), loadTopics()])
        .then(([stored, deck, scenes, packs, marks, topics]) => {
          if (cancelled || scopeGeneration() !== scope) return;
          // One projection of where every scene stands, handed to the path and
          // the thread, so they cannot disagree.
          const progress = missionStates(missionCompletionsFrom(stored), deck, Date.now());
          setProgress(progress);
          setCompletions(stored);
          setThread(threadFrom({ records: scenes, progress, packs, marks, topics }));
          setHistoryReadyOwner(scope);
          setHistoryStatus('ready');
        })
        // A disk that will not answer takes nothing away: the path keeps what
        // it last read, and a re-read that failed is not evidence that a
        // thread is gone. `.catch` at the end of the chain, so a throw inside
        // the handler above is caught too.
        .catch(() => { if (!cancelled && scopeGeneration() === scope) setHistoryStatus('unread'); });
      return () => {
        cancelled = true;
      };
    }, [profile, historyAttempt]),
  );

  /**
   * The conversation, probed before it opens. `checking` disables every
   * control that starts something, so the rejection path lets go of it too.
   */
  const open = (textMode: boolean, params: object = {}) => {
    // A second tap while the connection check runs cannot open a second room.
    if (checking) return;
    if (starting.current) return;
    starting.current = true;
    pendingStart.current = params;
    setChecking(true);
    void recheck()
      .then((answered) => {
        setChecking(false);
        starting.current = false;
        const decision = tutorGate(answered, textMode);
        if (!decision.go) {
          setHeldBack(decision.heldBack);
          return;
        }
        setHeldBack(null);
        nav.navigate(decision.screen, { ...params, ...decision.params });
      })
      .catch(() => {
        // A probe that threw did not answer, so the start is held back rather
        // than lost, and the retry is the same start.
        setChecking(false);
        starting.current = false;
        setHeldBack({ textMode });
      });
  };

  // The plan, on its own read, so a status the server would not give never
  // looks like a thread the learner lost. The footer reads the same answer as
  // a band in words; no count of time leaves `planStatusFor`.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const scope = scopeGeneration();
      setCanStart(null);
      setPlan({ tier: 'unknown', lapsed: false });
      setPlanView(null);
      if (!live || user === null) { setPlanView(planStatusFor(null, Date.now())); return; }
      void fetchBillingStatus(user.id)
        .then((status) => {
          if (cancelled || scopeGeneration() !== scope) return;
          setCanStart(status === null ? null : status.canStart);
          setPlan(status === null ? { tier: 'unknown', lapsed: false } : { tier: status.plan, lapsed: status.lapsed });
          setPlanView(planStatusFor(status, Date.now()));
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, [live, user]),
  );

  const orb = tutorOrbState({ live, checking, canStart });
  const offlineShown = !live || heldBack !== null;
  const note = startNote(orb, offlineShown);
  const next = nextConversation(progress, thread, capabilitiesFor(plan.tier, plan.lapsed).continueArc);
  const rec = recommended(next);
  const scenes = starterScenes(progress);
  const replay = lessHelp(completions, locks.access);
  // Founder, 2026-10-20 UI-008: the chips are the learner's remembered interests
  // and life events (forgotten ones gone, none while memory is paused), else
  // their own suggestions, and always their own topic last.
  const talk = talkChips(learningSuggestions(practicePreferencesOf(profile)), { facts: visibleFacts(profile), paused: memoryPaused(profile.brain) });
  const caption = sampleCaption(playing, card.signature);
  const tiles = speakTiles(tutorName, locks.access);
  // 2026-10-20, sim nits: never break inside a word; three, two or one per row.
  // 2026-10-20 UI-008, sim check: three to a row on a phone, labels wrapping between words.
  const { columns, padding: tilePad } = tileLayout({ contentWidth: width - space(10), fontScale, titleSize: bType.bold14.fontSize, gap: space(2), titles: tiles.map((tile) => tile.title) });
  const currentScope = scopeGeneration();
  const renderHistoryStatus = ownedReadStatus(historyStatus, historyReadOwner, historyReadyOwner, currentScope);

  // 2026-10-21 UI-008, B-Empty-States "Tutor away or offline": the retry is
  // the away card's 46 ink button, hugging its words.
  const primary = <BButton hug label={checking ? TUTOR_OFFLINE.checking : TUTOR_OFFLINE.retry} height={46} ground={t.primary} ink={t.onPrimary} text={bType.bold15}
    disabled={checking} onPress={() => open(heldBack?.textMode ?? textMode, heldBack ? pendingStart.current : answered(next.params))} />;
  // B-Empty-States "Out of speaking time": only on the free plan with nothing
  // left this week, and never on top of the away card.
  const outOfTime = offlineShown ? null : outOfTimeCard(planView);

  if (renderHistoryStatus !== 'ready') return <ScrollScreen bottom="tab">
    <TabHeader title={SPEAK_TITLE} purpose={speakSubtitle(tutorName)} trailing={<ProfileButton />} />
    <Card style={st.offline}>
      <Text style={[type.body, { color: t.text }]}>{renderHistoryStatus === 'loading' ? 'Finding your next conversation.' : 'Your conversation history could not be read just now.'}</Text>
      {renderHistoryStatus === 'unread' && <IconAction layout="inline" icon="refresh" label="Try loading conversations again" onPress={() => setHistoryAttempt((n) => n + 1)} />}
      <LocalPracticeCard />
    </Card>
  </ScrollScreen>;

  return (
    <ScrollScreen bottom="tab" topGap={8}>
      <View style={st.page}>
        <View style={st.head}>
          <TabHeader title={SPEAK_TITLE} purpose={speakSubtitle(tutorName)} trailing={<ProfileButton />} />
        </View>

        {offlineShown && (
          <EmptyStateCard ground="lavender" art={AWAY_ART} title={TUTOR_OFFLINE.headline} body={TUTOR_OFFLINE.body} action={null} live>
            {primary}
            <View style={st.offlineLine}><LocalPracticeCard /></View>
          </EmptyStateCard>
        )}

        {outOfTime !== null && (
          <EmptyStateCard art={OUT_OF_TIME_ART} title={outOfTime.title} body={outOfTime.body}
            action={{ label: outOfTime.action, onPress: () => nav.navigate('Wall', { entry: 'refused' }) }} />
        )}

        {/* The one recommendation: the next scene, or the thread to pick up. */}
        <View style={st.hero}>
          <BArt name="cafe-table" width={150} height={137} style={st.heroArt} />
          <Text style={[bType.eyebrow, { color: t.heroText }]}>{RECOMMENDED}</Text>
          <Text accessibilityRole="header" style={[bType.leadTitle, st.heroTitle, { color: t.heroText }]}>{rec.title}</Text>
          <Text style={[bType.line16, st.heroLine, { color: t.heroText }]}>{rec.sentence}</Text>
          <View style={[st.chips, st.after4]}>
            {rec.minutes !== null && <HeroPill label={rec.minutes} />}
            <HeroPill label={USES_SPEAKING_TIME} />
          </View>
          <View accessibilityRole="radiogroup" accessibilityLabel="How you answer" style={[st.segment, stacked && st.column]}>
            {MODE_CHOICES.map((choice) => (
              <Segment key={choice.key} label={choice.label} selected={answer.key === choice.key} onPress={() => setChosenMode(choice.key)} />
            ))}
          </View>
          <Text style={[bType.meta, st.after4, { color: t.heroText }]}>{answer.helper(tutorName)}</Text>
          <View style={[st.chips, st.after4]}>
            <OutlineChip label={correctionsChip(strictnessLabel(profile))} onPress={() => nav.navigate(PREFERENCES_ROUTE.screen)} />
            <OutlineChip label={paceChip(tutorName, paceOf(profile))} onPress={() => nav.navigate(PREFERENCES_ROUTE.screen)} />
          </View>
          {rec.prepare !== null && (
            <View style={st.after8}>
              <BButton label={PREPARE_FIRST} height={48} ground={t.heroChip} ink={t.heroText} text={bType.bold16} onPress={() => nav.navigate(rec.prepare!.screen, rec.prepare!.params)} />
            </View>
          )}
          <View style={st.after2}>
            <BButton label={START} accessibilityLabel={`${START}, ${rec.title}`} height={54} ground={t.heroCta} ink={t.heroCtaText} text={bType.bold18}
              icon={<BMic size={20} color={t.heroCtaText} />} disabled={checking} onPress={() => open(textMode, answered(next.params))} />
          </View>
          {checking && <Text accessibilityLiveRegion="polite" style={[bType.meta, st.centred, { color: t.heroText }]}>{TUTOR_OFFLINE.checking}</Text>}
          {note !== null && <Text style={[bType.meta, st.centred, { color: t.heroText }]}>{note}</Text>}
        </View>

        {WALK_AVAILABLE && <IconAction layout="inline" icon="headphones" label="Try Walk mode" disabled={checking} onPress={() => open(false, { ...nextConversation(progress, null, false).params, walkMode: true })} />}

        <View style={st.scenes}>
          <View style={st.titleRow}>
            <Text accessibilityRole="header" style={[type.heading, st.grow, { color: t.text }]}>{scenes.heading}</Text>
            <TextLink label={EVERY_SCENE.label} text={bType.bold15} onPress={() => nav.navigate(EVERY_SCENE.route.screen)} />
          </View>
          <View style={st.list}>{scenes.rows.map((row, i) => (
            <Press key={row.missionId} haptic="light" accessibilityLabel={row.accessibilityLabel} onPress={() => nav.navigate(row.route.screen, row.route.params)}
              style={[st.sceneRow, i < scenes.rows.length - 1 && st.rule]}>
              <View {...decorative} style={[st.sceneTile, { backgroundColor: t[row.tile.ground] }]}>
                <BArt name={row.icon.name} width={row.icon.width} height={row.icon.height} />
              </View>
              <View style={st.words}>
                <Text {...frenchText} style={[bType.bold16, { color: t.text }]}>{row.french}</Text>
                <Text style={[bType.note, { color: t.muted }]}>{row.line}</Text>
              </View>
              {row.tile.trailing === 'check' ? <CheckDisc size={24} fill={t.mint} tick={t.onMint} />
                : row.tile.trailing === 'next' ? <View style={st.nextPill}><Text style={[type.badge, { color: t.onBrand }]}>{NEXT_CHIP}</Text></View>
                : <Chevron size={18} color={t.muted} width={2.2} />}
            </Press>
          ))}</View>
        </View>

        {replay !== null && (
          <Press haptic="light" disabled={checking} onPress={() => tapThrough(locks.access, replay.feature, locks.open, () => open(textMode, answered(replay.params)))} accessibilityRole="button" accessibilityLabel={`${LESS_HELP_TITLE}, ${replay.title}, ${replay.line}, ${replay.help}${replay.locked ? `, ${LOCK_BADGE_LABEL}` : ''}`}
            style={st.twist}>
            <View {...decorative} style={st.twistTile}>
              <BArt name="cafe-table" width={70} height={64} style={st.twistArt} />
            </View>
            <View style={st.words}>
              <View style={st.twistHead}>
                <Text style={[type.badge, { color: t.link }]}>{LESS_HELP_TITLE}</Text>
                {replay.locked && <LockBadge said />}
              </View>
              <Text {...frenchText} style={[bType.bold16, { color: t.text }]}>{replay.french}</Text>
              <Text style={[bType.note, { color: t.muted }]}>{replay.line}</Text>
            </View>
            <View {...decorative} style={st.twistGo}><Chevron size={18} color={t.onBrand} width={2.4} /></View>
          </Press>
        )}

        <View style={st.talk}>
          <View style={st.tight}>
            <Text accessibilityRole="header" style={[bType.bold19, { color: t.sun }]}>{TALK_TITLE}</Text>
            <Text style={[bType.line15, { color: t.onBrandSoft }]}>{TALK_SUB}</Text>
          </View>
          <View style={st.chips8}>
            {talk.map((chip) => (
              <Press key={chip.label} haptic="light" disabled={checking} accessibilityLabel={chip.label} hitSlop={CHIP_SLOP} onPress={() => open(textMode, answered(chip.params))}
                style={[st.talkChip, { backgroundColor: chip.own ? t.violet2 : t.card }]}>
                <Text style={[bType.semi15, { color: chip.own ? t.onBrand : t.text }]}>{chip.label}</Text>
              </Press>
            ))}
          </View>
        </View>

        <View style={st.tutor}>
          <View {...decorative} style={st.orb}><BArt name="tutor-orb" width={56} height={56} /></View>
          <View style={st.words}>
            <Text style={[bType.bold17, { color: t.text }]}>{card.name}</Text>
            <TextLink label={CHANGE_VOICE} text={bType.bold14} onPress={() => nav.navigate(CHANGE_VOICE_ROUTE.screen, CHANGE_VOICE_ROUTE.params)} />
            {caption !== null && <Text {...frenchText} accessibilityLiveRegion="polite" style={[bType.line15, { color: t.text }]}>{caption}</Text>}
          </View>
          <Press haptic="light" onPress={hear} accessibilityRole="button" accessibilityLabel={playing ? `Stop ${card.name}` : `Hear ${card.name}`} accessibilityState={{ busy: playing }} style={st.hear}>
            <BSpeaker size={22} color={t.text} />
          </Press>
        </View>

        <View style={[st.tiles, columns === 1 && st.column]}>
          {tiles.map((tile) => (
            <Press key={tile.key} haptic="light" onPress={() => nav.navigate(tile.route.screen)} accessibilityLabel={tile.locked ? `${tile.title}, ${LOCK_BADGE_LABEL}` : tile.title}
              frame={columns === 2 ? st.half : columns === 3 ? st.third : undefined} style={[st.tile, { backgroundColor: t[tile.ground], padding: tilePad }]}>
              <BArt name={tile.art.name} width={tile.art.width} height={tile.art.height} />
              <Text style={[bType.bold14, { color: t.text }]}>{tile.title}</Text>
              {tile.locked && <LockBadge form="round" said />}
            </Press>
          ))}
        </View>

        <View style={st.footer}>
          <Text style={[bType.meta, st.centred, { color: t.muted }]}>{minutesBand(planView)}</Text>
          <TextLink centred label={SEE_MINUTES.label} text={bType.bold14} onPress={() => nav.navigate(SEE_MINUTES.route.screen)} />
        </View>
      </View>
    </ScrollScreen>
  );
}

/** A ring of touch around a 40pt chip, so its target reaches the 44pt floor. */
const CHIP_SLOP = { top: 2, bottom: 2, left: 0, right: 0 } as const;

/** The artboard's chevron, `M9 5l7 7-7 7`, at the stroke the place draws. */
function Chevron({ size, color, width }: { size: number; color: string; width: number }) {
  return (
    <Svg {...decorative} width={size} height={size} viewBox="0 0 24 24">
      <Path d="M9 5l7 7-7 7" fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** A small tick beside the chosen segment, so the choice is not carried by fill alone. */
function Tick({ color }: { color: string }) {
  return (
    <Svg {...decorative} width={14} height={14} viewBox="0 0 24 24">
      <Path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** A white pill on the yellow card: 13/700, padding 4 10, radius 12. */
function HeroPill({ label }: { label: string }) {
  const t = useB();
  const st = useThemedStyles(makeStyles);
  return <View style={st.heroPill}><Text style={[bType.chip, { color: t.heroText }]}>{label}</Text></View>;
}

/** One cell of the Speak/Type control: 40 high, radius 20, a radio. */
function Segment({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const t = useB();
  const st = useThemedStyles(makeStyles);
  return (
    <Press haptic="selection" accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ checked: selected, selected }} hitSlop={CHIP_SLOP}
      onPress={onPress} frame={st.grow} style={[st.cell, selected && { backgroundColor: t.heroChip }]}>
      {selected && <Tick color={t.heroText} />}
      <Text style={[selected ? bType.bold15 : bType.semi15, { color: t.heroText }]}>{label}</Text>
    </Press>
  );
}

/** A preference chip: 36 high, a 1.5pt outline in the card's words colour. */
function OutlineChip({ label, onPress }: { label: string; onPress: () => void }) {
  const t = useB();
  const st = useThemedStyles(makeStyles);
  return (
    <Press haptic="light" accessibilityLabel={label} hitSlop={OUTLINE_SLOP} onPress={onPress} frame={st.hug} style={[st.outline, { borderColor: t.heroText }]}>
      <Text style={[bType.semi13, { color: t.heroText }]}>{label}</Text>
    </Press>
  );
}

const OUTLINE_SLOP = { top: 4, bottom: 4, left: 0, right: 0 } as const;

/** A text link in the theme's link colour, its target at the touch floor. */
function TextLink({ label, text, onPress, centred = false }: { label: string; text: StyleProp<TextStyle>; onPress: () => void; centred?: boolean }) {
  const t = useB();
  const st = useThemedStyles(makeStyles);
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={label} onPress={onPress} style={[st.link, centred && st.linkCentred]}>
      <Text style={[text, centred && st.centred, { color: t.link }]}>{label}</Text>
    </Pressable>
  );
}

/** The artboard's fixed marks: the scene tile, the twist tile, the tutor orb and the speaker disc. */
const SCENE_TILE = 52;
const TWIST_TILE = 64;
const ORB = 56;
const HEAR = 48;

const makeStyles = (t: B) =>
  StyleSheet.create({
    // The artboard's 22pt rhythm; the shared header keeps its own 20pt foot,
    // so it is pulled back to the same 22 (as Today does).
    head: { marginBottom: -space(5) },
    page: { gap: 22 },
    tight: { gap: 2 },
    offline: { marginTop: space(4), gap: space(3) },
    offlineLine: { alignSelf: 'stretch', marginTop: space(2) },
    column: { flexDirection: 'column' },
    grow: { flex: 1, minWidth: 0 },
    words: { flex: 1, minWidth: 0, gap: 2 },
    centred: { textAlign: 'center' },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chips8: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
    after2: { marginTop: space(0.5) },
    after4: { marginTop: 4 },
    after8: { marginTop: space(2) },
    hero: { backgroundColor: t.heroGround, borderRadius: 28, padding: 20, gap: 6, overflow: 'hidden' },
    heroArt: { position: 'absolute', right: -10, top: 26 },
    heroTitle: { maxWidth: 200 },
    heroLine: { maxWidth: 196 },
    heroPill: { backgroundColor: t.heroChip, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12, maxWidth: '100%' },
    segment: { marginTop: 10, flexDirection: 'row', gap: 4, padding: 4, borderRadius: 24, backgroundColor: t.butter },
    cell: { minHeight: 40, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space(1), paddingHorizontal: space(2) },
    // Artboard: 36 high, padding 0 12, radius 18, 1.5 outline, 13/600 words.
    outline: { minHeight: 36, borderRadius: 18, borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 0, justifyContent: 'center' },
    hug: { alignSelf: 'flex-start' },
    link: { minHeight: HIT, justifyContent: 'center', alignSelf: 'flex-start' },
    linkCentred: { alignSelf: 'center' },
    titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space(2) },
    scenes: { gap: 10 },
    list: { backgroundColor: t.card, borderRadius: 24, paddingVertical: 4, paddingHorizontal: 14 },
    sceneRow: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(3), minHeight: HIT },
    rule: { borderBottomWidth: 1, borderBottomColor: t.line },
    sceneTile: { width: SCENE_TILE, height: SCENE_TILE, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    nextPill: { backgroundColor: t.brand, paddingVertical: 3, paddingHorizontal: space(2), borderRadius: 10, flexShrink: 0 },
    twist: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: space(4), borderRadius: 24, backgroundColor: t.card, borderWidth: 2, borderStyle: 'dashed', borderColor: t.periwinkle },
    twistTile: { width: TWIST_TILE, height: TWIST_TILE, borderRadius: 18, backgroundColor: t.sage, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 },
    twistArt: { marginTop: space(2) },
    twistHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space(2) },
    twistGo: { width: HIT, height: HIT, borderRadius: HIT / 2, backgroundColor: t.brand, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    talk: { backgroundColor: t.brand, borderRadius: 26, padding: 18, gap: space(3) },
    talkChip: { minHeight: 40, borderRadius: 20, paddingHorizontal: 14, justifyContent: 'center', maxWidth: '100%' },
    tutor: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: t.card, borderRadius: 24, paddingVertical: 14, paddingHorizontal: space(4) },
    orb: { width: ORB, height: ORB, borderRadius: 28, overflow: 'hidden', flexShrink: 0 },
    hear: { width: HEAR, height: HEAR, borderRadius: 24, backgroundColor: t.lavender, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
    // Three to a row at the artboard's width; two (the third spanning the next) or one at large text.
    third: { flex: 1, minWidth: 0 },
    half: { flexBasis: '40%', flexGrow: 1, minWidth: 0 },
    tile: { flex: 1, minWidth: 0, minHeight: 120, borderRadius: 20, gap: 6 },
    footer: { alignItems: 'center', gap: 2 },
  });
