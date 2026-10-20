/**
 * Speak, direction B (B2, 2026-10-20, artboard B-Speak).
 *
 * In the artboard's order: the header, the yellow Recommended card (the next
 * scene, its minutes, Speak or Type, the two tutor preferences, Prepare first
 * and the one Start), the starter scenes, "Same scene, a bit less help" when a
 * finished scene can really be replayed with less help, "Talk about anything",
 * the tutor card, three tiles, the way back to past conversations, and the
 * speaking time as a band in words.
 *
 * Every decision lives in `tutor/speakTabView.ts`, `tutor/speakView.ts` and
 * `tutor/nextConversation.ts`; this file is layout and the live probe.
 * Connection checks preserve the exact requested start, spoken or typed, so a
 * retry never silently changes the conversation. Lock badges come only from
 * `access/featureAccess.ts`, through the view model.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
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

import { Card, Chip, Choice, ColourCard, IconAction, Label, Ledger, LedgerRow, LOCK_BADGE_LABEL, LockBadge, OutlineButton, PillButton, Press, SceneMark, TutorCard } from '../components.tsx';
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
import { MICROPHONE_NOTICE, missionCompletionsFrom } from '../missions/chooserView.ts';
import { loadScenarioProgress } from '../missions/progressStore.ts';
import { loadDeck } from '../review/store.ts';
import { practicePreferencesOf } from '../profile/practicePreferences.ts';
import { learningSuggestions } from '../main/learningSuggestions.ts';
import { colour, frenchText, onColour, paper, space, textOn, type, HIT } from '../theme.ts';

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
  CHANGE_VOICE_ROUTE, EVERY_SCENE, LESS_HELP_TITLE, MODE_CHOICES, NEXT_CHIP, PREFERENCES_ROUTE, PREPARE_FIRST, RECOMMENDED, REVISIT,
  SEE_MINUTES, SPEAK_TITLE, START, TALK_SUB, TALK_TITLE, USES_SPEAKING_TIME, correctionsChip, lessHelp, minutesBand, paceChip,
  recommended, speakSubtitle, speakTiles, starterScenes, talkChips, tileColumns,
} from '../tutor/speakTabView.ts';

type Completion = { id: string; at: number; rung: number };

export function TutorTab() {
  const focused = useIsFocused();
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const { live, recheck } = useLive();
  const { profile } = useProfile();
  const tutorName = tutorNameOf(profile);
  const voiceKey = tutorVoiceOf(profile);
  const card = tutorCardFacts(voiceKey);
  // Profile's standing "Prefer typing" is the default; the radios on the card
  // change only this start.
  const modes = startModes(prefersTyping(profile));
  const [chosenText, setChosenText] = useState<boolean | null>(null);
  const textMode = chosenText ?? modes.textMode;
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
  const talk = talkChips(learningSuggestions(practicePreferencesOf(profile)));
  const tiles = speakTiles(tutorName, locks.access);
  // 2026-10-20, sim nits: never break inside a word; three, two or one per row.
  const columns = tileColumns({ contentWidth: width - space(10), fontScale, titleSize: type.label.fontSize, gap: space(2), padding: space(3), titles: tiles.map((tile) => tile.title) });
  const currentScope = scopeGeneration();
  const renderHistoryStatus = ownedReadStatus(historyStatus, historyReadOwner, historyReadyOwner, currentScope);

  const primary = <IconAction layout="inline" icon="refresh" busy={checking}
    label={checking ? TUTOR_OFFLINE.checking : TUTOR_OFFLINE.retry}
    disabled={checking} onPress={() => open(heldBack?.textMode ?? textMode, heldBack ? pendingStart.current : next.params)} />;

  if (renderHistoryStatus !== 'ready') return <ScrollScreen bottom="tab">
    <TabHeader title={SPEAK_TITLE} purpose={speakSubtitle(tutorName)} trailing={<ProfileButton />} />
    <Card style={st.offline}>
      <Text style={[type.body, { color: paper.ink }]}>{renderHistoryStatus === 'loading' ? 'Finding your next conversation.' : 'Your conversation history could not be read just now.'}</Text>
      {renderHistoryStatus === 'unread' && <IconAction layout="inline" icon="refresh" label="Try loading conversations again" onPress={() => setHistoryAttempt((n) => n + 1)} />}
      <LocalPracticeCard />
    </Card>
  </ScrollScreen>;

  return (
    <ScrollScreen bottom="tab">
      <TabHeader title={SPEAK_TITLE} purpose={speakSubtitle(tutorName)} trailing={<ProfileButton />} />

      <View style={st.page}>
        {offlineShown && (
          <Card style={st.stack}>
            <Label>{TUTOR_OFFLINE.label}</Label>
            <Text style={[type.bodyStrong, { color: paper.ink }]}>{TUTOR_OFFLINE.headline}</Text>
            <Text style={[type.body, { color: paper.inkSoft }]}>{TUTOR_OFFLINE.body}</Text>
            {primary}
            <LocalPracticeCard />
          </Card>
        )}

        {/* The one recommendation: the next scene, or the thread to pick up. */}
        <ColourCard ground="sun">
          <View style={st.small}>
            <Text style={[type.label, { color: onColour.sun }]}>{RECOMMENDED}</Text>
            <Text accessibilityRole="header" style={[type.heading, { color: textOn.sun }]}>{rec.title}</Text>
            <Text style={[type.body, { color: textOn.sun }]}>{rec.sentence}</Text>
          </View>
          <View style={st.chips}>
            {rec.minutes !== null && <Chip variant="meta" label={rec.minutes} />}
            <Chip variant="meta" label={USES_SPEAKING_TIME} />
          </View>
          <View accessibilityRole="radiogroup" accessibilityLabel="Speak or type" style={[st.modes, stacked && st.column]}>
            {MODE_CHOICES.map((choice) => (
              <View key={choice.key} style={st.grow}>
                <Choice compact ground="card" role="radio" title={choice.label} selected={textMode === choice.textMode} onPress={() => setChosenText(choice.textMode)} />
              </View>
            ))}
          </View>
          <View style={st.chips}>
            <PillButton variant="secondary" compact label={correctionsChip(strictnessLabel(profile))} onPress={() => nav.navigate(PREFERENCES_ROUTE.screen)} />
            <PillButton variant="secondary" compact label={paceChip(tutorName, paceOf(profile))} onPress={() => nav.navigate(PREFERENCES_ROUTE.screen)} />
          </View>
          {rec.prepare !== null && <PillButton variant="secondary" label={PREPARE_FIRST} onPress={() => nav.navigate(rec.prepare!.screen, rec.prepare!.params)} />}
          <PillButton label={START} disabled={checking} accessibilityLabel={`${START}, ${rec.title}`} onPress={() => open(textMode, next.params)} />
          {checking && <Text accessibilityLiveRegion="polite" style={[type.small, { color: onColour.sun }]}>{TUTOR_OFFLINE.checking}</Text>}
          {note !== null && <Text style={[type.small, { color: onColour.sun }]}>{note}</Text>}
        </ColourCard>

        {WALK_AVAILABLE && <IconAction layout="inline" icon="headphones" label="Try Walk mode" disabled={checking} onPress={() => open(false, { ...nextConversation(progress, null, false).params, walkMode: true })} />}

        <View style={st.stack}>
          <View style={st.titleRow}>
            <Text accessibilityRole="header" style={[type.heading, st.grow, { color: paper.ink }]}>{scenes.heading}</Text>
            <OutlineButton label={EVERY_SCENE.label} onPress={() => nav.navigate(EVERY_SCENE.route.screen)} />
          </View>
          <Ledger>{scenes.rows.map((row) => (
            <LedgerRow key={row.missionId} lang="fr" title={row.french} gloss={row.line} accessibilityLabel={row.accessibilityLabel}
              glyph={<SceneMark state={row.state} />}
              trailing={row.next ? <Chip variant="meta" tone="lavender" label={NEXT_CHIP} /> : undefined}
              onPress={() => nav.navigate(row.route.screen, row.route.params)} />
          ))}</Ledger>
        </View>

        {replay !== null && (
          <Press haptic="light" disabled={checking} onPress={() => tapThrough(locks.access, replay.feature, locks.open, () => open(textMode, replay.params))} accessibilityRole="button" accessibilityLabel={`${LESS_HELP_TITLE}, ${replay.title}, ${replay.line}${replay.locked ? `, ${LOCK_BADGE_LABEL}` : ''}`}>
            <Card style={st.stack}>
              <View style={st.titleRow}>
                <Text style={[type.label, st.grow, { color: colour.blue }]}>{LESS_HELP_TITLE}</Text>
                {replay.locked && <LockBadge said />}
              </View>
              <Text {...frenchText} style={[type.french, { color: paper.ink }]}>{replay.french}</Text>
              <Text style={[type.small, { color: paper.inkSoft }]}>{replay.line}</Text>
            </Card>
          </Press>
        )}

        <ColourCard ground="blue">
          <View style={st.small}>
            <Text accessibilityRole="header" style={[type.heading, { color: textOn.blue }]}>{TALK_TITLE}</Text>
            <Text style={[type.body, { color: onColour.blue }]}>{TALK_SUB}</Text>
          </View>
          <View style={st.chips}>
            {talk.map((chip) => (
              <Chip key={chip.label} variant="filter" role="button" selected={false} ground={chip.own ? 'violet2' : 'card'} label={chip.label}
                onPress={() => open(textMode, chip.params)} />
            ))}
          </View>
        </ColourCard>

        <TutorCard
          name={card.name} signature={card.signature} onHear={hear}
          playing={playing} onChange={() => nav.navigate(CHANGE_VOICE_ROUTE.screen, CHANGE_VOICE_ROUTE.params)}
          changeLabel={CHANGE_VOICE}
        />

        <View style={[st.tiles, columns === 1 && st.column]}>
          {tiles.map((tile) => (
            <View key={tile.key} style={columns === 2 ? st.half : st.grow}>
              <ColourCard ground={tile.ground} onPress={() => nav.navigate(tile.route.screen)} accessibilityLabel={tile.locked ? `${tile.title}, ${LOCK_BADGE_LABEL}` : tile.title} style={st.tile}>
                <Text style={[type.label, { color: paper.ink }]}>{tile.title}</Text>
                {tile.locked && <LockBadge form="round" said />}
              </ColourCard>
            </View>
          ))}
        </View>

        <Ledger><LedgerRow title={REVISIT.title} gloss={REVISIT.gloss} onPress={() => nav.navigate(REVISIT.route.screen)} /></Ledger>

        <View style={st.footer}>
          <Text style={[type.body, st.centred, { color: paper.inkSoft }]}>{minutesBand(planView)}</Text>
          <OutlineButton label={SEE_MINUTES.label} onPress={() => nav.navigate(SEE_MINUTES.route.screen)} />
          <Text style={[type.small, st.centred, { color: paper.inkSoft }]}>{MICROPHONE_NOTICE}</Text>
        </View>
      </View>
    </ScrollScreen>
  );
}

const st = StyleSheet.create({
  page: { gap: space(6) },
  stack: { gap: space(3) },
  small: { gap: space(1) },
  offline: { marginTop: space(4), gap: space(3) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  modes: { flexDirection: 'row', gap: space(2) },
  column: { flexDirection: 'column' },
  titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space(2) },
  grow: { flex: 1, minWidth: 0 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  // Two to a row; the third grows to span the next.
  half: { flexBasis: '40%', flexGrow: 1, minWidth: 0 },
  tile: { flex: 1, minWidth: 0, minHeight: HIT, padding: space(3), gap: space(2) },
  footer: { alignItems: 'center', gap: space(2) },
  centred: { textAlign: 'center' },
});
