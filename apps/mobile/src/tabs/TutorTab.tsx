/**
 * Speak: who is teaching, the next conversation, and the path from A0 to A1.
 *
 * Rebuilt 2026-09-27 (notebook Phase 3, B1). The tab leads with the tutor card
 * (the name and sound line from the voice catalogue, the voice sample's French
 * line as the signature, a play control, and a link to change the voice), then
 * the one Start for the next conversation with a quiet "Type instead" under
 * it, then the path from the CEFR spine: every scene as a ledger row grouped by
 * level, with its minutes, opening its brief in the chooser, and the "here" row
 * carrying the highlighter. Phase 4 (B1) drew the path once, where it had been
 * a level path and then the same can-do lines again as rows, and left offline
 * Speak saying "unavailable" once rather than twice.
 * "More ways to practise" (the open conversation, a real moment, and memory)
 * appears only after a first finished scene.
 *
 * Every decision lives in `tutor/speakView.ts` and `tutor/nextConversation.ts`.
 * Connection checks preserve the exact requested start, spoken or typed, so a
 * retry never silently changes the conversation. Nothing on this tab moves.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { missionStates, type MissionProgress } from '@luvani/core';

import { Card, GhostButton, Highlight, Label, Ledger, LedgerRow, OutlineButton, PillButton, TutorCard } from '../components.tsx';
import { useLive } from '../app/LiveContext.tsx';
import { useAuth } from '../auth/useAuth.tsx';
import { fetchBillingStatus } from '../purchases/client.ts';
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
import { HIT, paper, space, type } from '../theme.ts';
import { TUTOR_PURPOSE, tutorHeading } from '../tutor/dashboard.ts';
import { launchAccessibilityLabel, launchLabel, launchNotice, tutorOrbState } from '../tutor/orbState.ts';
import { TUTOR_OFFLINE, tutorGate } from '../tutor/gate.ts';
import { ContinuityCard } from '../tutor/ContinuityCard.tsx';
import { continuityFrom, continuityHeadline, type Continuity } from '../tutor/continuity.ts';
import { tutorNameOf } from '../tutor/tutorName.ts';
import { tutorVoiceOf } from '../tutor/tutorVoice.ts';
import { voiceSample } from '../tutor/voiceSamples.ts';
import { nextConversation } from '../tutor/nextConversation.ts';
import { prefersTyping } from '../profile/typing.ts';
import {
  CHANGE_VOICE,
  HERE_MARK,
  MORE_WAYS,
  MORE_WAYS_LABEL,
  PATH_LABEL,
  moreWaysOpen,
  speakPath,
  startModes,
  startNote,
  tutorCardFacts,
  type MoreWay,
} from '../tutor/speakView.ts';

export function TutorTab() {
  const focused = useIsFocused();
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const { live, recheck } = useLive();
  const { profile } = useProfile();
  const tutorName = tutorNameOf(profile);
  const voiceKey = tutorVoiceOf(profile);
  const card = tutorCardFacts(voiceKey);
  // Profile's standing "Prefer typing" decides which way the Start opens.
  const modes = startModes(prefersTyping(profile));

  const [heldBack, setHeldBack] = useState<{ textMode: boolean } | null>(null);
  // Another screen's recheck can bring the tutor back; a refusal from here is then stale.
  useEffect(() => { if (live) setHeldBack(null); }, [live]);
  const [checking, setChecking] = useState(false);
  const [progress, setProgress] = useState<readonly MissionProgress[]>(() => missionStates([], [], Date.now()));
  const pendingStart = useRef<object>({});
  const starting = useRef(false);
  /** What the tutor remembers, from a real record only, or null. */
  const [continuity, setContinuity] = useState<Continuity | null>(null);
  /** The one thread to pick up, or null. */
  const [thread, setThread] = useState<Thread | null>(null);
  /** The plan the server answered, for the continuation rule. */
  const [plan, setPlan] = useState<{ tier: PlanTier; lapsed: boolean }>({ tier: 'unknown', lapsed: false });
  // Core's answer to "may a session start", or null when nobody could ask; a
  // null reads as ready, because the server refuses a start it cannot afford.
  const [canStart, setCanStart] = useState<boolean | null>(null);
  const { user } = useAuth();

  // The voice sample: one player, the bundled clip for the chosen voice. The
  // same control stops it, a clip that ends lets go of "Stop", and leaving the
  // tab takes the sound with it, because a bottom tab is never unmounted.
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);
  const [playing, setPlaying] = useState(false);
  useEffect(() => { if (status.didJustFinish) setPlaying(false); }, [status.didJustFinish]);
  useEffect(() => { if (!focused) { player.pause(); setPlaying(false); } }, [focused, player]);
  const hear = () => {
    if (playing) {
      player.pause();
      setPlaying(false);
      return;
    }
    player.replace(voiceSample(voiceKey));
    player.play();
    setPlaying(true);
  };

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void Promise.all([loadMissionCompletions(), loadDeck(), loadScenarioProgress(), loadConversationPacks(), loadPackMarks(), loadTopics()])
        .then(([completions, deck, scenes, packs, marks, topics]) => {
          if (cancelled) return;
          // One projection of where every scene stands, handed to the path,
          // the memory line and the thread, so they cannot disagree.
          const progress = missionStates(missionCompletionsFrom(completions), deck, Date.now());
          setProgress(progress);
          setContinuity(continuityFrom({ brain: profile.brain, packs, records: scenes, progress }));
          setThread(threadFrom({ records: scenes, progress, packs, marks, topics }));
        })
        // A disk that will not answer takes nothing away: the path keeps what
        // it last read, and a re-read that failed is not evidence that a
        // thread is gone. `.catch` at the end of the chain, so a throw inside
        // the handler above is caught too.
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, [profile]),
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
  // looks like a thread the learner lost.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      if (!live || user === null) return;
      void fetchBillingStatus(user.id)
        .then((status) => {
          if (cancelled) return;
          setCanStart(status === null ? null : status.canStart);
          setPlan(status === null ? { tier: 'unknown', lapsed: false } : { tier: status.plan, lapsed: status.lapsed });
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
  const path = speakPath(progress);

  // The open conversation probes like the Start; the other two push a screen.
  const more = (way: MoreWay) => {
    if (way.screen === null) { open(modes.textMode); return; }
    nav.navigate(way.screen);
  };

  return (
    <ScrollScreen bottom="tab">
      <TabHeader title={tutorHeading(tutorName)} purpose={TUTOR_PURPOSE} trailing={<ProfileButton />} />

      <TutorCard
        name={card.name}
        voice={card.voice}
        signature={card.signature}
        onHear={hear}
        playing={playing}
        onChange={() => nav.navigate('Profile', { sheet: 'tutorVoice' })}
        changeLabel={CHANGE_VOICE}
      />

      {/* The one Start, in the learner's standing mode; the other is a quiet link. */}
      <View style={st.start}>
        <Label>{next.label}</Label>
        <Text style={[type.cardTitle, { color: paper.ink }]}>{next.title}</Text>
        <Text style={[type.small, { color: paper.inkSoft }]}>{next.detail}</Text>
        {next.lines.map((line) => <Text key={line} style={[type.french, { color: paper.ink }]}>{line}</Text>)}
        {note !== null && <Text style={st.notice}>{note}</Text>}
        <PillButton label={launchLabel({ checking, live, mode: modes.mode })} accessibilityLabel={launchAccessibilityLabel({ checking, live, mode: modes.mode, tutorName })} disabled={checking} onPress={() => open(modes.textMode, next.params)} />
        <GhostButton label={modes.other.label} color={paper.ink} disabled={checking} onPress={() => open(modes.other.textMode, next.params)} />
        <Text style={st.notice}>{launchNotice(modes.mode)}</Text>
      </View>

      {checking && <Text accessibilityLiveRegion="polite" style={st.checking}>{TUTOR_OFFLINE.checking}</Text>}

      {offlineShown && (
        <Card style={st.offline}>
          <Label>{TUTOR_OFFLINE.label}</Label>
          <Text style={[type.bodyStrong, { color: paper.ink, marginTop: space(2) }]}>{TUTOR_OFFLINE.headline}</Text>
          {heldBack !== null && (
            <>
              <Text style={[type.body, { color: paper.inkSoft, marginTop: space(2) }]}>{TUTOR_OFFLINE.body}</Text>
              <View style={{ marginTop: space(3) }}>
                <OutlineButton label={checking ? TUTOR_OFFLINE.checking : TUTOR_OFFLINE.retry} disabled={checking} onPress={() => open(heldBack.textMode, pendingStart.current)} />
              </View>
            </>
          )}
          <GhostButton label="Try guided practice" onPress={() => nav.navigate('Lesson', { textMode: false })} />
        </Card>
      )}

      {/* The path, drawn once: A0 then A1 from the spine, every scene a row
          with its can-do and minutes that opens its brief in the chooser, and
          the "here" row carrying the screen's one highlighter mark. */}
      <View style={st.path}>
        <Text accessibilityRole="header" style={[type.heading, { color: paper.ink }]}>{PATH_LABEL}</Text>
        {path.groups.map((group) => (
          <View key={group.level} style={st.group}>
            <Label>{group.level}</Label>
            <Ledger accessibilityLabel={`${group.level} scenes`}>
              {group.rows.map((row) => (
                <LedgerRow key={row.missionId} label={row.label} title={row.title} gloss={row.gloss} meta={row.meta} trailing={row.state === 'here' ? <Highlight text={HERE_MARK} style={type.frenchSm} /> : undefined} accessibilityLabel={row.accessibilityLabel} disabled={checking} onPress={() => nav.navigate(row.route.screen, row.route.params)} />
              ))}
            </Ledger>
          </View>
        ))}
      </View>

      {/* What the tutor remembers, from a real record only. */}
      {continuity !== null && (
        <View style={st.remembers}>
          <ContinuityCard
            headline={continuityHeadline(tutorName)}
            line={continuity.line}
            thread={thread}
            continueAllowed={capabilitiesFor(plan.tier, plan.lapsed).continueArc}
            disabled={checking}
            onPress={(route) => {
              // Carry the pack's identity into the room; ConvoScreen marks it
              // only after the first live view arrives.
              if (route.screen === 'Convo' && route.markPack !== null) {
                nav.navigate(route.screen, { ...route.params, continuationPackId: route.markPack, textMode: false });
                return;
              }
              nav.navigate(route.screen, route.screen === 'Convo' ? { ...route.params, textMode: false } : route.params);
            }}
          />
        </View>
      )}

      {moreWaysOpen(progress) && (
        <View style={st.path}>
          <Text accessibilityRole="header" style={[type.heading, { color: paper.ink }]}>{MORE_WAYS_LABEL}</Text>
          <Ledger>
            {MORE_WAYS.map((way) => (
              <LedgerRow key={way.key} title={way.title} gloss={way.gloss} disabled={checking} onPress={() => more(way)} />
            ))}
          </Ledger>
        </View>
      )}

      <View style={st.quiet}>
        <GhostButton label="How your AI tutor works" onPress={() => nav.navigate('TutorIntro')} />
        <Text style={st.notice}>{MICROPHONE_NOTICE}</Text>
      </View>
    </ScrollScreen>
  );
}

const st = StyleSheet.create({
  start: { marginTop: space(5), gap: space(2) },
  checking: { ...type.small, color: paper.inkSoft, textAlign: 'center', marginTop: space(2) },
  offline: { marginTop: space(4) },
  path: { marginTop: space(6), gap: space(3) },
  group: { gap: space(1) },
  // The remembers row stands on its own, at the touch floor.
  remembers: { marginTop: space(5), minHeight: HIT },
  quiet: { marginTop: space(6), gap: space(1) },
  notice: { ...type.small, color: paper.inkSoft, textAlign: 'center', marginTop: space(2) },
});
