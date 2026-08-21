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

import { useCallback, useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation, type RouteProp, useRoute } from '@react-navigation/native';
import { CAFE_LESSON, lessonXp, type ProgressReport, type Rung, type SessionSummary } from '@parle/core';
import { paper, space, type } from '../theme.ts';
import { GhostButton, Label, PillButton } from '../components.tsx';
import { useAuth } from '../auth/useAuth.tsx';
import { useProfile } from '../app/ProfileContext.tsx';
import { useLive } from '../app/LiveContext.tsx';
import { lastSummaryFor, recordSession } from '../progress/store.ts';
import { recordActivity } from '../progress/activity.ts';
import { addFromSummary } from '../review/store.ts';
import { LiveSessionScreen } from '../LiveSessionScreen.tsx';
import { SessionScreen } from '../SessionScreen.tsx';
import { SummaryScreen } from '../SummaryScreen.tsx';
import { ConvoScreen } from '../ConvoScreen.tsx';
import { DrillScreen } from '../DrillScreen.tsx';
import { ReviewScreen } from '../ReviewScreen.tsx';
import { AddFriendsScreen } from '../friends/AddFriendsScreen.tsx';
import { HomeTab } from '../tabs/HomeTab.tsx';
import { TutorTab } from '../tabs/TutorTab.tsx';
import { TUTOR_OFFLINE } from '../tutor/gate.ts';
import { PracticeTab } from '../tabs/PracticeTab.tsx';
import { LeaderboardTab } from '../tabs/LeaderboardTab.tsx';
import { ProfileTab } from '../tabs/ProfileTab.tsx';
import { ParleTabBar } from './ParleTabBar.tsx';
import type { RootStackParamList, TabParamList } from './types.ts';

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

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
    // The session's words become review cards, same fire-and-forget contract.
    void addFromSummary(s);
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
      />
    );
  }
  return live && user ? (
    <LiveSessionScreen
      key={textMode ? 'live-text' : 'live'}
      lesson={CAFE_LESSON}
      userId={user.id}
      startRung={startRung}
      textMode={textMode}
      onRetryAsText={() => nav.setParams({ textMode: true })}
      onFinish={finish}
      onExit={() => nav.goBack()}
    />
  ) : (
    <SessionScreen key="mock" lesson={CAFE_LESSON} startRung={startRung} onFinish={finish} />
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
  if (!user) return <Loading />;
  if (!live) {
    return (
      <View style={st.gate}>
        <Label color={paper.inkFaint}>{TUTOR_OFFLINE.label}</Label>
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
  return (
    <ConvoScreen
      userId={user.id}
      snapshot={profile.brain}
      onRecap={(_recap, blob) => {
        // The agent owns the learner model's shape; the app is its storage.
        if (typeof blob === 'object' && blob !== null) updateBrain(blob as never);
      }}
      onExit={() => nav.goBack()}
      startInTextMode={route.params?.textMode ?? false}
      seedTopic={route.params?.seedTopic}
    />
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

function Tabs({ onSignOut, onResetProgress }: { onSignOut: () => void; onResetProgress: () => void }) {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: paper.ground } }}
      tabBar={(props) => <ParleTabBar {...props} />}
    >
      <Tab.Screen name="Home" component={HomeTab} />
      <Tab.Screen name="Tutor" component={TutorTab} />
      <Tab.Screen name="Practice" component={PracticeTab} />
      <Tab.Screen name="Leaderboard" component={LeaderboardTab} />
      <Tab.Screen name="Profile">
        {() => <ProfileTab onSignOut={onSignOut} onResetProgress={onResetProgress} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

export function RootNavigator({ onSignOut, onResetProgress }: { onSignOut: () => void; onResetProgress: () => void }) {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: paper.ground },
        // The app has one authored motion vocabulary and a native slide is not
        // in it. Screens replace; the orb and the splash carry the movement.
        animation: 'fade',
      }}
    >
      <Stack.Screen name="Tabs">{() => <Tabs onSignOut={onSignOut} onResetProgress={onResetProgress} />}</Stack.Screen>
      <Stack.Screen name="Lesson" component={LessonRoute} />
      <Stack.Screen name="Convo" component={ConvoRoute} />
      <Stack.Screen name="Drill" component={DrillRoute} />
      <Stack.Screen name="Review" component={ReviewRoute} />
      <Stack.Screen name="AddFriends" component={AddFriendsScreen} />
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
