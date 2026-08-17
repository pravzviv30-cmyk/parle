/*
 * ── DIRECTION CONTRACT ───────────────────────────────────────────────────────
 * THESIS: Learning to speak should feel like a warm, unhurried picture book —
 *   calm, friendly, professional. Easy to look at twice a day.
 * OWN-WORLD: Paper & ink. Pale lilac paper, warm black ink, hand-drawn line
 *   art, Fraunces for anything with a voice (headlines and every French line),
 *   DM Sans for the furniture. Flat white cards on a hairline rule; one solid
 *   ink pill per screen. Chrome is plain English; French appears only as the
 *   thing being learned.
 * KEPT FROM THE ENAMEL WORLD (behaviour, not surface): one primary action per
 *   screen; the four support colours cooling as help is withdrawn; the red
 *   live microphone; no scores and no scolding mid-session; 44pt floors.
 * STORY: Sign in once, answer four gentle questions, then two doors — Speak
 *   with the tutor, or Learn from what you said. Stalling is stepped in for,
 *   never commented on.
 * FINISH: unreviewed and undocumented is unfinished; the restyle ends with the
 *   finish review and a rewritten DESIGN.md. The enamel design survives at the
 *   repo's baseline commit.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { CAFE_LESSON, type ProgressReport, type RecapPayload, type Rung, type SessionSummary } from '@parle/core';
import type { LearnerProfile } from '@parle/brain';
import { lastSummaryFor, recordSession } from './src/progress/store.ts';
import { addFromSummary } from './src/review/store.ts';
import { completeProfile, createStoredProfile, loadProfile, saveProfile, type StoredProfile } from './src/profile/store.ts';

import { paper } from './src/theme.ts';
import { auth } from './src/auth/adapter.ts';
import { AuthProvider, useAuth } from './src/auth/useAuth.tsx';
import { AuthFlow } from './src/auth/AuthFlow.tsx';
import { SetNewPasswordScreen } from './src/auth/SetNewPasswordScreen.tsx';
import type { AuthUser } from './src/auth/types.ts';
import { clearActiveUserData, migrateLegacyStores, setActiveUser } from './src/storage/scope.ts';
import { HomeScreen, type HomeTab } from './src/home/HomeScreen.tsx';
import { SessionScreen } from './src/SessionScreen.tsx';
import { LiveSessionScreen } from './src/LiveSessionScreen.tsx';
import { SummaryScreen } from './src/SummaryScreen.tsx';
import { ReviewScreen } from './src/ReviewScreen.tsx';
import { DrillScreen } from './src/DrillScreen.tsx';
import { ConvoScreen } from './src/ConvoScreen.tsx';
import { OnboardingFlow } from './src/onboarding/OnboardingFlow.tsx';

type Screen =
  | { name: 'home'; tab: HomeTab }
  | { name: 'session' }
  | { name: 'review' }
  | { name: 'drill' }
  | { name: 'summary'; summary: SessionSummary; report: ProgressReport | null }
  | { name: 'convo'; textMode?: boolean };

const TOKEN_SERVER = process.env.EXPO_PUBLIC_TOKEN_SERVER_URL ?? 'http://localhost:8787';

/**
 * Live when the token server answers, demo otherwise. The app must never be a
 * blank screen just because a backend is not running — the demo path is the same
 * UI over the same engine, and says so honestly in the corner.
 *
 * `recheck` probes again at the moment the learner starts, so a server that came
 * up after launch is used and one that just died is not — nobody lands silently
 * in DÉMO because a backend was slow for a second and a half.
 */
function useLiveAvailable(): { live: boolean; recheck: () => Promise<boolean> } {
  const [available, setAvailable] = useState(false);

  const recheck = useCallback(async (): Promise<boolean> => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1500);
    try {
      const r = await fetch(`${TOKEN_SERVER}/health`, { signal: ctrl.signal });
      setAvailable(r.ok);
      return r.ok;
    } catch {
      setAvailable(false);
      return false;
    } finally {
      clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | null = null;
    void recheck().then((ok) => {
      // The token server may still be booting when the app opens; one quiet
      // retry covers the common race without polling forever.
      if (!ok && !cancelled) retry = setTimeout(() => void recheck(), 2000);
    });
    return () => {
      cancelled = true;
      if (retry) clearTimeout(retry);
    };
  }, [recheck]);

  return { live: available, recheck };
}

/** A stored rung, trusted only after proving it really is one. Older stored
 * sessions predate `nextStartRung`, so the field can be missing entirely. */
function asRung(value: unknown): Rung | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 4 ? (value as Rung) : null;
}

/**
 * Everything behind the sign-in door. Mounted with `key={user.id}` so an
 * account switch remounts the whole tree with fresh state; the storage scope
 * is set (and legacy data migrated, first account only) before anything that
 * reads a store renders.
 */
function SignedInRoot({ user }: { user: AuthUser }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setActiveUser(user.id);
    void migrateLegacyStores(user.id).then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
      setActiveUser(null);
    };
  }, [user.id]);

  if (!ready) {
    return (
      <View style={st.loading}>
        <ActivityIndicator color={paper.inkFaint} />
      </View>
    );
  }
  return <HomeRoot user={user} />;
}

function HomeRoot({ user }: { user: AuthUser }) {
  const [screen, setScreen] = useState<Screen>({ name: 'home', tab: 'speak' });
  const { live: liveAvailable, recheck } = useLiveAvailable();
  // Which tab a finished sitting returns to: drills and review belong to
  // Learn, sessions and conversations to Speak.
  const lastTab = useRef<HomeTab>('speak');

  // Who is holding the phone. 'loading' for the moment the disk takes to answer;
  // null means nobody yet — onboarding runs before anything else renders.
  const [profile, setProfile] = useState<StoredProfile | null | 'loading'>('loading');
  useEffect(() => {
    let cancelled = false;
    void loadProfile().then((p) => {
      if (!cancelled) setProfile(p);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Continuity: the next session opens one rung below where the last one ended
  // (the summary already computed that as `nextStartRung`). Re-read on every
  // return home, so finishing a session moves the next one's opening.
  const [startRung, setStartRung] = useState<Rung>(1);
  useEffect(() => {
    if (screen.name !== 'home') return;
    let cancelled = false;
    void lastSummaryFor(CAFE_LESSON.id).then((summary) => {
      if (!cancelled) setStartRung(asRung(summary?.nextStartRung) ?? 1);
    });
    return () => {
      cancelled = true;
    };
  }, [screen.name]);

  const handleFinish = useCallback((summary: SessionSummary) => {
    // Show the card immediately; the history write catches up and fills the
    // since-you-started block when it lands. A slow disk must not delay the card.
    setScreen({ name: 'summary', summary, report: null });
    void recordSession(summary).then((report) => {
      setScreen((s) => (s.name === 'summary' && s.summary === summary ? { ...s, report } : s));
    });
    // The session's words become review cards, same fire-and-forget contract.
    void addFromSummary(summary);
  }, []);
  const restart = useCallback(() => setScreen({ name: 'home', tab: lastTab.current }), []);
  const review = useCallback(() => {
    lastTab.current = 'learn';
    setScreen({ name: 'review' });
  }, []);
  const drill = useCallback(() => {
    lastTab.current = 'learn';
    setScreen({ name: 'drill' });
  }, []);
  const convo = useCallback((textMode: boolean) => {
    lastTab.current = 'speak';
    setScreen({ name: 'convo', textMode });
  }, []);

  const begin = useCallback(async () => {
    // Both state updates land in one batch, so the session screen renders with
    // the freshly probed mode rather than the one from app launch.
    lastTab.current = 'speak';
    await recheck();
    setScreen({ name: 'session' });
  }, [recheck]);

  const resetProgress = useCallback(async () => {
    await clearActiveUserData();
    setScreen({ name: 'home', tab: 'speak' });
    // Profile null sends the learner back through onboarding, fresh.
    setProfile(null);
  }, []);

  if (profile === 'loading') {
    return (
      <View style={st.loading}>
        <ActivityIndicator color={paper.inkFaint} />
      </View>
    );
  }
  // Nobody yet, or a pre-account profile missing the new answers: onboarding
  // runs, asking only what has never been answered (motivation pre-selects).
  if (profile === null || profile.name === null) {
    return (
      <OnboardingFlow
        existing={profile}
        onDone={(answers) => {
          const next = profile === null ? createStoredProfile(answers) : completeProfile(profile, answers);
          // Fire and forget: the write catches up while the home screen shows.
          void saveProfile(next);
          setProfile(next);
        }}
      />
    );
  }

  if (screen.name === 'home') {
    return (
      <HomeScreen
        user={user}
        profile={profile}
        live={liveAvailable}
        tab={screen.tab}
        onTab={(tab) => {
          lastTab.current = tab;
          setScreen({ name: 'home', tab });
        }}
        onBegin={() => void begin()}
        onConvo={convo}
        onReview={review}
        onDrill={drill}
        onSignOut={() => void auth.signOut()}
        onResetProgress={() => void resetProgress()}
      />
    );
  }
  if (screen.name === 'session') {
    return liveAvailable ? (
      <LiveSessionScreen
        key="live"
        lesson={CAFE_LESSON}
        userId={user.id}
        startRung={startRung}
        onFinish={handleFinish}
        onExit={restart}
      />
    ) : (
      <SessionScreen key="mock" lesson={CAFE_LESSON} startRung={startRung} onFinish={handleFinish} />
    );
  }
  if (screen.name === 'review') {
    return <ReviewScreen onDone={restart} />;
  }
  if (screen.name === 'drill') {
    return <DrillScreen userId={user.id} onDone={restart} />;
  }
  if (screen.name === 'convo') {
    return (
      <ConvoScreen
        userId={user.id}
        snapshot={profile.brain}
        onRecap={(_recap, profileBlob) => {
          // The agent owns the learner model's shape; the app is its storage.
          // Persist whatever came back, as long as it looks like an object at
          // all. Fires twice per session — the recap, then the memory-enriched
          // profile a few seconds later — and persisting the newest blob is
          // the whole contract. ConvoScreen renders the end card itself so the
          // room outlives it; no navigation happens here.
          if (typeof profileBlob === 'object' && profileBlob !== null) {
            const updated: StoredProfile = { ...profile, brain: profileBlob as LearnerProfile };
            void saveProfile(updated);
            setProfile(updated);
          }
        }}
        onExit={restart}
        startInTextMode={screen.textMode ?? false}
      />
    );
  }
  return <SummaryScreen lesson={CAFE_LESSON} summary={screen.summary} report={screen.report} onAgain={restart} onReview={review} />;
}

export default function App() {
  const [loaded] = useFonts({
    'Fraunces-SemiBold': require('./assets/fonts/Fraunces-SemiBold.ttf'),
    'Fraunces-Bold': require('./assets/fonts/Fraunces-Bold.ttf'),
    'DMSans-Regular': require('./assets/fonts/DMSans-Regular.ttf'),
    'DMSans-Medium': require('./assets/fonts/DMSans-Medium.ttf'),
    'DMSans-Bold': require('./assets/fonts/DMSans-Bold.ttf'),
  });

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider adapter={auth}>
        <View style={st.app}>
          {loaded ? (
            // A phone app that also runs in a browser. Constrained to a phone column
            // rather than stretched — the composition is designed for a thumb.
            <View style={st.shell}>
              <Gate />
            </View>
          ) : (
            <View style={st.loading}>
              <ActivityIndicator color={paper.inkFaint} />
            </View>
          )}
        </View>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

/**
 * The door. Loading holds a spinner, signed out shows the welcome flow, a
 * password-recovery landing interposes its one screen, and a signed-in user
 * gets the app keyed to their account.
 */
function Gate() {
  const { status, user, recovering, clearRecovery } = useAuth();
  if (status === 'loading') {
    return (
      <View style={st.loading}>
        <ActivityIndicator color={paper.inkFaint} />
      </View>
    );
  }
  if (status === 'signedIn' && user !== null) {
    if (recovering) return <SetNewPasswordScreen onDone={clearRecovery} />;
    return <SignedInRoot key={user.id} user={user} />;
  }
  return <AuthFlow />;
}

const st = StyleSheet.create({
  app: { flex: 1, backgroundColor: paper.ground },
  shell: { flex: 1, width: '100%', maxWidth: 460, alignSelf: 'center' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
