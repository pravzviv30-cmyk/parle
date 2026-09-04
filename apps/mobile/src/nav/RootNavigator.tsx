/**
 * The navigator.
 *
 * A root stack whose first screen is the tab navigator, with the metered and
 * focused screens as siblings ABOVE it. That shape does three things for free:
 * the tab bar disappears during a lesson, a drill or a conversation; leaving a
 * live session is an explicit act rather than a tab switch, so a metered room
 * cannot survive in the background; and Android's hardware back — which this
 * app simply did not have before — works everywhere.
 *
 * The lesson and the conversation both render their end card IN PLACE rather
 * than navigating to it. For the conversation that is load-bearing: the
 * enriched profile and the generated drills arrive seconds AFTER the recap, and
 * a torn-down room loses both. The lesson follows the same shape so the two
 * paths do not diverge, and so no route ever has to carry a summary object.
 */

import { withLearnerName } from '@luvani/brain/profile';
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation, type RouteProp, useRoute } from '@react-navigation/native';
import { CAFE_LESSON, lessonXp, type ProgressReport, type Rung, type SessionSummary } from '@luvani/core';
import { paper, space, type } from '../theme.ts';
import { GhostButton, Label, PillButton } from '../components.tsx';
import { useAuth } from '../auth/useAuth.tsx';
import { useProfile } from '../app/ProfileContext.tsx';
import { useLive } from '../app/LiveContext.tsx';
import { lastSummaryFor, recordSession } from '../progress/store.ts';
import { recordActivity } from '../progress/activity.ts';
import { bankLesson } from '../live/journal.ts';
import { SessionScreen } from '../SessionScreen.tsx';
import { SummaryScreen } from '../SummaryScreen.tsx';
import { DrillScreen } from '../DrillScreen.tsx';
import { ReviewScreen } from '../ReviewScreen.tsx';
import { MissionsScreen } from '../missions/MissionsScreen.tsx';
import { missionReplay, type MissionReplay } from '../missions/chooserView.ts';
import { loadMissionCompletions } from '../missions/store.ts';
import { HomeTab } from '../tabs/HomeTab.tsx';
import { TutorTab } from '../tabs/TutorTab.tsx';
import { TUTOR_OFFLINE } from '../tutor/gate.ts';
import { PracticeTab } from '../tabs/PracticeTab.tsx';
import { MyFrenchTab } from '../tabs/MyFrenchTab.tsx';
import { ProfileTab } from '../tabs/ProfileTab.tsx';
import { SoundCheckScreen } from '../soundcheck/SoundCheckScreen.tsx';
import { LuvaniTabBar } from './LuvaniTabBar.tsx';
import type { RootStackParamList, TabParamList } from './types.ts';
import type { AuthResult } from '../auth/types.ts';

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

// The WebRTC stack is by far the largest optional dependency in the app. Keep
// it out of the home/practice/profile startup path and load it only when the
// learner actually opens a live lesson or conversation.
const LazyLiveSessionScreen = lazy(async () => {
  const module = await import('../live/LiveScreenModule.ts');
  return { default: module.LiveSessionScreen };
});
const LazyConvoScreen = lazy(async () => {
  const module = await import('../live/LiveScreenModule.ts');
  return { default: module.ConvoScreen };
});

/** A stored rung, trusted only after proving it really is one. Older stored
 * sessions predate `nextStartRung`, so the field can be missing entirely. */
function asRung(value: unknown): Rung | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 4 ? (value as Rung) : null;
}

function Loading() {
  return (
    <View style={st.center}>
      <ActivityIndicator color={paper.inkFaint} />
    </View>
  );
}

/** The guided lesson, and the end card it finishes on. */
function LessonRoute() {
  const nav = useNavigation<{
    goBack: () => void;
    navigate: (screen: keyof RootStackParamList) => void;
    setParams: (p: { textMode?: boolean }) => void;
  }>();
  const route = useRoute<RouteProp<RootStackParamList, 'Lesson'>>();
  const textMode = route.params?.textMode ?? false;
  const { user } = useAuth();
  const { live } = useLive();
  const [startRung, setStartRung] = useState<Rung | null>(null);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [report, setReport] = useState<ProgressReport | null>(null);

  // Continuity: the next session opens one rung below where the last one ended.
  useEffect(() => {
    let cancelled = false;
    void lastSummaryFor(CAFE_LESSON.id).then((s) => {
      if (!cancelled) setStartRung(asRung(s?.nextStartRung) ?? 1);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const finish = useCallback((s: SessionSummary) => {
    // Show the card immediately; the history write catches up and fills the
    // since-you-started block when it lands. A slow disk must not delay it.
    setSummary(s);
    void recordSession(s).then(setReport);
    void recordActivity('lesson', lessonXp({ wordsProduced: s.wordsProduced, unassistedRate: s.unassistedRate }));
    // The session's words become review cards, through the outbox the
    // conversation has used since Phase 4. `addFromSummary` still compiles and
    // still writes, and that is exactly the trap: it awaited the disk's answer
    // and dropped it, so a learner who finished a lesson with a full phone lost
    // the whole deck without a word. Only `bankLesson` keeps the summary for
    // the next launch to try again.
    void bankLesson(s);
  }, []);

  /**
   * Go again means go again. Both of these buttons used to call goBack(), which
   * matched neither label: "Go again" retreated to the tab that launched the
   * lesson, and "Review" did the same rather than opening the review deck that
   * has been sitting in this very stack the whole time.
   *
   * The rung is re-read rather than reused, because the session that just ended
   * has already been recorded and openingRung has moved. Restarting on the
   * stale value would open the next attempt where the last one began instead of
   * one below where it finished.
   */
  const again = useCallback(() => {
    setStartRung(null);
    void lastSummaryFor(CAFE_LESSON.id).then((s) => {
      setStartRung(asRung(s?.nextStartRung) ?? 1);
      setSummary(null);
      setReport(null);
    });
  }, []);

  if (startRung === null) return <Loading />;
  if (summary) {
    return (
      <SummaryScreen
        lesson={CAFE_LESSON}
        summary={summary}
        report={report}
        onAgain={again}
        onReview={() => nav.navigate('Review')}
        onDone={() => nav.goBack()}
      />
    );
  }
  return live && user ? (
    <Suspense fallback={<Loading />}>
      <LazyLiveSessionScreen
        key={textMode ? 'live-text' : 'live'}
        lesson={CAFE_LESSON}
        userId={user.id}
        startRung={startRung}
        textMode={textMode}
        onRetryAsText={() => nav.setParams({ textMode: true })}
        onFinish={finish}
        onExit={() => nav.goBack()}
      />
    </Suspense>
  ) : (
    <SessionScreen key="mock" lesson={CAFE_LESSON} startRung={startRung} onFinish={finish} onExit={() => nav.goBack()} />
  );
}

/**
 * The conversation, and the honest screen when there is no server to have one
 * on.
 *
 * The gate is the same one LessonRoute has had at `:131`, minus the mock: there
 * is no offline conversation to fall back to, so this says so and offers the
 * two doors that matter. Belt and braces over TutorTab's check, because the
 * server can die in the gap between that probe and this mount, and because
 * Practice can reach this route too.
 */
function ConvoRoute() {
  const nav = useNavigation<{ goBack: () => void }>();
  const route = useRoute<RouteProp<RootStackParamList, 'Convo'>>();
  const { user } = useAuth();
  const { profile, updateBrain } = useProfile();
  const { live, recheck } = useLive();
  const [checking, setChecking] = useState(false);
  const missionId = route.params?.missionId;

  /**
   * Whether this route is a replay, and where the replay opens.
   *
   * Loaded here rather than in the screen for the same reason LessonRoute loads
   * its rung at :94: the value has to be known BEFORE the room is asked for,
   * because it is signed into the join token and a session cannot change the
   * rung it opened on afterwards. The wrapper object is the difference between
   * "read, and there is no replay" and "not read yet", which a bare null
   * cannot tell apart. An ordinary conversation has nothing to read and starts
   * settled, so nothing waits on a disk it was never going to touch.
   */
  const [replayRead, setReplayRead] = useState<{ replay: MissionReplay | null } | null>(
    missionId === undefined ? { replay: null } : null,
  );
  useEffect(() => {
    let cancelled = false;
    const settle = (replay: MissionReplay | null) => {
      if (!cancelled) setReplayRead({ replay });
    };
    if (missionId === undefined) {
      settle(null);
      return;
    }
    void loadMissionCompletions().then(
      (stored) => settle(missionReplay(missionId, stored)),
      // A disk that will not answer is not a reason to keep somebody out of a
      // conversation. No replay, no note, and the scene opens exactly as it
      // does for a mission nobody has finished.
      () => settle(null),
    );
    return () => {
      cancelled = true;
    };
  }, [missionId]);

  // Above the guards below, and deliberately: every hook in this component has
  // to run on every render. ConvoScreen's recap effect keeps this callback in
  // its dependencies and calls it as soon as a recap exists, so an inline arrow
  // is a new identity each render and the write re-renders this screen, which
  // is the loop F386 filed. Memoising it fixes that; memoising it BELOW
  // `if (!replayRead)` swaps the loop for a crash, because a mission route
  // renders Loading first and would then add a hook on the second render.
  // `updateBrain` is a useCallback with no dependencies, so this holds.
  const onRecap = useCallback(
    (_recap: unknown, blob: unknown) => {
      // The agent owns the learner model's shape; the app is its storage.
      if (typeof blob === 'object' && blob !== null) updateBrain(blob as never);
    },
    [updateBrain],
  );

  if (!user) return <Loading />;
  if (!live) {
    return (
      <View style={st.gate}>
        <Label color={paper.inkSoft}>{TUTOR_OFFLINE.label}</Label>
        <Text style={[type.bodyStrong, { color: paper.ink, marginTop: space(3), textAlign: 'center' }]}>
          {TUTOR_OFFLINE.headline}
        </Text>
        <Text style={[type.body, { color: paper.inkSoft, marginTop: space(2), textAlign: 'center' }]}>
          {TUTOR_OFFLINE.body}
        </Text>
        <View style={st.gateAction}>
          <PillButton
            label={checking ? TUTOR_OFFLINE.checking : TUTOR_OFFLINE.retry}
            disabled={checking}
            onPress={() => {
              if (checking) return;
              setChecking(true);
              // A server that came up while this screen was open flips `live`,
              // and the conversation mounts underneath the learner's finger.
              void recheck().finally(() => setChecking(false));
            }}
          />
        </View>
        <View style={st.gateSecondary}>
          <GhostButton label={TUTOR_OFFLINE.back} onPress={() => nav.goBack()} />
        </View>
      </View>
    );
  }
  // After the offline gate on purpose: a learner with no server to talk to gets
  // the honest screen at once rather than a spinner over a disk read that
  // cannot help them.
  if (!replayRead) return <Loading />;
  return (
    <Suspense fallback={<Loading />}>
      <LazyConvoScreen
        userId={user.id}
        // The name is stored beside the brain profile, not inside it, so this is
        // where the two are joined. Without it the tutor has no name to use: the
        // snapshot is the only thing that reaches the agent.
        snapshot={withLearnerName(profile.brain, profile.name)}
        onRecap={onRecap}
        onExit={() => nav.goBack()}
        startInTextMode={route.params?.textMode ?? false}
        seedTopic={route.params?.seedTopic}
        // The mission the learner chose, carried through to the join token so
        // the agent can open its authored scene without a model call. This line
        // is the whole difference between a mission and an ordinary
        // conversation: without it the id dies here, every card opens the
        // model-written path, and nothing downstream can tell.
        missionId={route.params?.missionId}
        // Finished before, so this attempt opens a rung higher than the last
        // one ended. Null for a first attempt and for every conversation that
        // is not a mission, which is the whole of today's behaviour.
        replay={replayRead.replay}
      />
    </Suspense>
  );
}

function DrillRoute() {
  const nav = useNavigation<{ goBack: () => void }>();
  const route = useRoute<RouteProp<RootStackParamList, 'Drill'>>();
  const { user } = useAuth();
  if (!user) return <Loading />;
  return (
    <DrillScreen
      userId={user.id}
      node={route.params?.node}
      mix={route.params?.mix ?? false}
      onDone={() => nav.goBack()}
    />
  );
}

function ReviewRoute() {
  const nav = useNavigation<{ goBack: () => void }>();
  return <ReviewScreen onDone={() => nav.goBack()} />;
}

function SoundCheckRoute() {
  const nav = useNavigation<{ goBack: () => void }>();
  const route = useRoute<RouteProp<RootStackParamList, 'SoundCheck'>>();
  const { user } = useAuth();
  if (!user) return <Loading />;
  return <SoundCheckScreen userId={user.id} missionId={route.params.missionId} onDone={() => nav.goBack()} />;
}

function Tabs({
  onSignOut,
  onDeleteAccount,
}: {
  onSignOut: () => void;
  onDeleteAccount: (reauthentication?: string) => Promise<AuthResult>;
}) {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: paper.ground } }}
      tabBar={(props) => <LuvaniTabBar {...props} />}
    >
      <Tab.Screen name="Home" component={HomeTab} />
      <Tab.Screen name="Tutor" component={TutorTab} />
      <Tab.Screen name="Practice" component={PracticeTab} />
      <Tab.Screen name="MyFrench" component={MyFrenchTab} />
      <Tab.Screen name="Profile">
        {() => <ProfileTab onSignOut={onSignOut} onDeleteAccount={onDeleteAccount} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

export function RootNavigator({
  onSignOut,
  onDeleteAccount,
  startOnMissions = false,
}: {
  onSignOut: () => void;
  onDeleteAccount: (reauthentication?: string) => Promise<AuthResult>;
  /**
   * A learner who finished onboarding a second ago opens on the chooser rather
   * than on Home, so the first thing after signing up is picking something to
   * say. The flag is held in memory by App.tsx and never written down: an app
   * killed between the two lands on Home, whose mission card leads here anyway,
   * and a persisted flag would be one more thing that can get stuck.
   */
  startOnMissions?: boolean;
}) {
  return (
    <Stack.Navigator
      initialRouteName={startOnMissions ? 'Missions' : 'Tabs'}
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: paper.ground },
        // The app has one authored motion vocabulary and a native slide is not
        // in it. Screens replace; the orb and the splash carry the movement.
        animation: 'fade',
      }}
    >
      <Stack.Screen name="Tabs">
        {() => <Tabs onSignOut={onSignOut} onDeleteAccount={onDeleteAccount} />}
      </Stack.Screen>
      {/* No native header on any pushed screen: the back is the in-screen
          ScreenHeader now (a chevron on a reversible push, the Leave word on a
          metered room), so a native title bar would be a second, duplicate way
          back. Each screen inherits headerShown:false from screenOptions. */}
      <Stack.Screen name="Lesson" component={LessonRoute} />
      <Stack.Screen name="Convo" component={ConvoRoute} />
      <Stack.Screen name="Drill" component={DrillRoute} />
      <Stack.Screen name="Review" component={ReviewRoute} />
      <Stack.Screen name="SoundCheck" component={SoundCheckRoute} />
      <Stack.Screen name="Missions" component={MissionsScreen} />
    </Stack.Navigator>
  );
}

const st = StyleSheet.create({
  center: { flex: 1, backgroundColor: paper.ground, alignItems: 'center', justifyContent: 'center' },
  gate: {
    flex: 1,
    backgroundColor: paper.ground,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space(8),
  },
  gateAction: { marginTop: space(6), alignSelf: 'stretch' },
  gateSecondary: { marginTop: space(2), alignSelf: 'stretch' },
});
