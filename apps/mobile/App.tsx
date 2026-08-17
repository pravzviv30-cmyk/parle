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

import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { CAFE_LESSON, type ProgressReport, type RecapPayload, type Rung, type SessionSummary } from '@parle/core';
import type { LearnerProfile } from '@parle/brain';
import { lastSummaryFor, loadHistory, recordSession } from './src/progress/store.ts';
import { addFromSummary, dueCount } from './src/review/store.ts';
import { createStoredProfile, loadProfile, saveProfile, type StoredProfile } from './src/profile/store.ts';

import { paper, space, type, radius, HAIRLINE } from './src/theme.ts';
import { Card, Label, PillButton, OutlineButton, GhostButton } from './src/components.tsx';
import { auth } from './src/auth/adapter.ts';
import { AuthProvider, useAuth } from './src/auth/useAuth.tsx';
import { AuthFlow } from './src/auth/AuthFlow.tsx';
import { SetNewPasswordScreen } from './src/auth/SetNewPasswordScreen.tsx';
import type { AuthUser } from './src/auth/types.ts';
import { migrateLegacyStores, setActiveUser } from './src/storage/scope.ts';
import { SessionScreen } from './src/SessionScreen.tsx';
import { LiveSessionScreen } from './src/LiveSessionScreen.tsx';
import { SummaryScreen } from './src/SummaryScreen.tsx';
import { ReviewScreen } from './src/ReviewScreen.tsx';
import { DrillScreen } from './src/DrillScreen.tsx';
import { ConvoScreen } from './src/ConvoScreen.tsx';
import { OnboardingScreen } from './src/onboarding/OnboardingScreen.tsx';

type Screen =
  | { name: 'start' }
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

function StartScreen({
  onBegin,
  onReview,
  onDrill,
  onConvo,
  live,
}: {
  onBegin: () => void;
  onReview: () => void;
  onDrill: () => void;
  onConvo: (textMode: boolean) => void;
  live: boolean;
}) {
  const insets = useSafeAreaInsets();
  const lesson = CAFE_LESSON;

  // Cards waiting in the review deck. Zero until a first session has produced
  // some — a brand-new learner sees exactly one thing to do here. The screen
  // remounts on every return to start, so the count stays honest.
  const [due, setDue] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void dueCount().then((n) => {
      if (!cancelled) setDue(n);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Completed sessions so far. Free conversation opens after the first one —
  // a learner who has climbed a ladder once has enough French to survive a
  // scene. Null while the disk answers, so the affordance never flickers.
  const [sessions, setSessions] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    void loadHistory().then((h) => {
      if (!cancelled) setSessions(h.length);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={[st.start, { paddingTop: insets.top + space(6), paddingBottom: insets.bottom + space(6) }]}>
      <View style={{ gap: space(6) }}>
        <View>
          <View style={st.lineRow}>
            <Label>Level {lesson.cefr}</Label>
            <Label color={live ? paper.inkSoft : paper.inkFaint}>{live ? 'Live' : 'Demo'}</Label>
          </View>
          <Text style={[type.display, { color: paper.ink, marginTop: space(3) }]}>{lesson.title}</Text>
          <Text style={[type.body, { color: paper.inkSoft, marginTop: space(3) }]}>{lesson.premise}</Text>
        </View>

        <Card>
          <Label>Before you go</Label>
          <Text style={[type.bodyStrong, { color: paper.ink, marginTop: space(2.5) }]}>{lesson.culturalNotes[0]}</Text>
        </Card>
      </View>

      <View style={{ gap: space(3) }}>
        {/* The sounds this line will put in front of them. Sets the expectation
            that pronunciation is the point, before a word has been spoken. */}
        <View style={st.sounds}>
          <Label color={paper.inkFaint}>Sounds you will practice</Label>
          <View style={st.soundRow}>
            {lesson.targetPhonemes.map((p) => (
              <View key={p} style={st.sound}>
                <Text style={[type.notation, { color: paper.ink }]}>/{p}/</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={[type.small, { color: paper.inkFaint }]}>
          {lesson.turns.length} stops · about five minutes · you will speak on every one
        </Text>
        <PillButton label="Start the lesson" onPress={onBegin} />
        {/* Free conversation needs the live brain, so Demo never shows it.
            Before the first finished lesson it waits, forward-framed and
            unpressable — a locked door with the key described, not a scold. */}
        {live &&
          sessions !== null &&
          (sessions >= 1 ? (
            <>
              <OutlineButton label="Free talk" onPress={() => onConvo(false)} />
              {/* The quiet-carriage door: the same tutor, typed. A situation,
                  not a setting, so it sits beside the spoken door rather than
                  behind a menu. */}
              <GhostButton label="Unable to speak right now?" onPress={() => onConvo(true)} />
            </>
          ) : (
            <View style={st.convoLocked} accessibilityLabel="Your first lesson opens free talk">
              <Text style={[type.bodyStrong, { color: paper.inkFaint }]}>Free talk</Text>
              <Text style={[type.small, { color: paper.inkFaint, marginTop: 2, textAlign: 'center' }]}>
                Your first lesson opens this.
              </Text>
            </View>
          ))}
        {due > 0 && (
          <OutlineButton
            label="Review"
            sub={due === 1 ? '1 card is ready' : `${due} cards are ready`}
            onPress={onReview}
          />
        )}
        {/* Always open: the fixture bank guarantees content, and the screen
            itself says so calmly when nothing is due. */}
        <OutlineButton label="Practice" onPress={onDrill} />
      </View>
    </View>
  );
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
  const [screen, setScreen] = useState<Screen>({ name: 'start' });
  const { live: liveAvailable, recheck } = useLiveAvailable();

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
  // return to start, so finishing a session moves the next one's opening.
  const [startRung, setStartRung] = useState<Rung>(1);
  useEffect(() => {
    if (screen.name !== 'start') return;
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
  const restart = useCallback(() => setScreen({ name: 'start' }), []);
  const review = useCallback(() => setScreen({ name: 'review' }), []);
  const drill = useCallback(() => setScreen({ name: 'drill' }), []);
  const convo = useCallback((textMode: boolean) => setScreen({ name: 'convo', textMode }), []);

  const begin = useCallback(async () => {
    // Both state updates land in one batch, so the session screen renders with
    // the freshly probed mode rather than the one from app launch.
    await recheck();
    setScreen({ name: 'session' });
  }, [recheck]);

  if (profile === 'loading') {
    return (
      <View style={st.loading}>
        <ActivityIndicator color={paper.inkFaint} />
      </View>
    );
  }
  if (profile === null) {
    return (
      <OnboardingScreen
        onDone={(motivation, goal) => {
          const created = createStoredProfile(motivation, goal);
          // Fire and forget: the write catches up while the start screen shows.
          void saveProfile(created);
          setProfile(created);
        }}
      />
    );
  }

  if (screen.name === 'start') {
    return <StartScreen live={liveAvailable} onBegin={() => void begin()} onReview={review} onDrill={drill} onConvo={convo} />;
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
  lineRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sounds: { gap: space(2.5) },
  soundRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  sound: {
    backgroundColor: paper.card,
    borderWidth: HAIRLINE,
    borderColor: paper.line,
    borderRadius: 8,
    paddingVertical: space(1.5),
    paddingHorizontal: space(2.5),
  },
  // Content sits high, the action is anchored at thumb height. Not spread evenly:
  // even spread is what leaves a phone screen looking half-empty.
  start: { flex: 1, paddingHorizontal: space(5), justifyContent: 'space-between', gap: space(8) },
  // Visible as a destination, unmistakably not yet a door.
  convoLocked: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space(2),
    paddingHorizontal: space(3),
    borderWidth: HAIRLINE,
    borderColor: paper.line,
    borderRadius: radius.card,
  },
});
