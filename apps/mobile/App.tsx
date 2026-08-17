/*
 * ── DIRECTION CONTRACT ───────────────────────────────────────────────────────
 * THESIS: Learning to speak is wayfinding, not scoring. This app orients a lost
 *   beginner the way a sign does; it refuses the gamified-card-and-confetti
 *   arrangement the category always ships.
 * OWN-WORLD: Paris street-plaque enamel. Deep bottle-green field, struck white
 *   rim with a real bevel, thin inner keyline, white caps on wide tracking,
 *   Archivo throughout. Rungs are RATP line bullets (L1 yellow → L5 orange →
 *   L13 sky → plain enamel), cooling as support is withdrawn.
 * STORY: The learner sees where they are on the line, says the thing on the
 *   plaque, and is stepped in for — never scolded — the moment they stall.
 * FIRST VIEWPORT: Line header and station strip up top; the line to say struck
 *   large on a raised plaque at centre; rung bullets and one red speak control
 *   at the bottom, thumb-height.
 * FORM: Métro enamel wayfinding — candidate 3 of 7, seed key 160dc64e.
 * FINISH: unreviewed and undocumented is unfinished; this build ends with the
 *   finish review, the verdict, and DESIGN.md
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { CAFE_LESSON, type ProgressReport, type RecapPayload, type Rung, type SessionSummary } from '@parle/core';
import type { LearnerProfile } from '@parle/brain';
import { lastSummaryFor, loadHistory, recordSession } from './src/progress/store.ts';
import { addFromSummary, dueCount } from './src/review/store.ts';
import { createStoredProfile, loadProfile, saveProfile, type StoredProfile } from './src/profile/store.ts';

import { enamel, space, type, radius, HIT } from './src/theme.ts';
import { Plaque, Tag, LabeledTag, ArrowRight } from './src/components.tsx';
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
 * Identity, pre-auth. Random per install and kept in memory for now; replaced by
 * real accounts when persistence lands. Good enough to exercise per-user metering.
 */
const DEV_USER_ID = `dev-${Math.random().toString(36).slice(2, 10)}`;

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
            <Tag>LIGNE {lesson.cefr}</Tag>
            <Tag color={live ? enamel.white : enamel.whiteFaint}>{live ? 'EN DIRECT' : 'DÉMO'}</Tag>
          </View>
          <Text style={[type.plaque, { color: enamel.white, marginTop: space(3) }]}>{lesson.title.toUpperCase()}</Text>
          <Text style={[type.body, { color: enamel.whiteMuted, marginTop: space(3) }]}>{lesson.premise}</Text>
        </View>

        <Plaque tone="white">
          <LabeledTag fr="AVANT DE PARTIR" en="Before you go" color="rgba(15,59,44,0.6)" />
          <Text style={[type.bodyStrong, { color: enamel.field, marginTop: space(2.5) }]}>{lesson.culturalNotes[0]}</Text>
        </Plaque>
      </View>

      <View style={{ gap: space(3) }}>
        {/* The sounds this line will put in front of them. Sets the expectation
            that pronunciation is the point, before a word has been spoken. */}
        <View style={st.sounds}>
          <LabeledTag fr="SONS TRAVAILLÉS" en="Sounds you will practice" color={enamel.whiteFaint} />
          <View style={st.soundRow}>
            {lesson.targetPhonemes.map((p) => (
              <View key={p} style={st.sound}>
                <Text style={[type.notation, { color: enamel.white }]}>/{p}/</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={[type.small, { color: enamel.whiteFaint }]}>
          {lesson.turns.length} stops · about five minutes · you will speak on every one
        </Text>
        <Pressable onPress={onBegin} accessibilityRole="button" style={({ pressed }) => [st.begin, pressed && { opacity: 0.85 }]}>
          <Text style={[type.tag, { color: enamel.field }]}>MONTER · START THE LESSON</Text>
          <ArrowRight size={16} color={enamel.field} />
        </Pressable>
        {/* Free conversation needs the live brain, so DÉMO never shows it.
            Before the first finished lesson it waits, forward-framed and
            unpressable — a locked door with the key described, not a scold. */}
        {live &&
          sessions !== null &&
          (sessions >= 1 ? (
            <>
              <Pressable
                onPress={() => onConvo(false)}
                accessibilityRole="button"
                style={({ pressed }) => [st.review, pressed && { opacity: 0.8 }]}
              >
                <Text style={[type.tag, { color: enamel.white }]}>CONVERSATION · FREE TALK</Text>
              </Pressable>
              {/* The quiet-carriage door: the same tutor, typed. A situation,
                  not a setting, so it sits beside the spoken door rather than
                  behind a menu. */}
              <Pressable
                onPress={() => onConvo(true)}
                accessibilityRole="button"
                accessibilityLabel="Free talk by typing, without the microphone"
                style={({ pressed }) => [st.helpLink, pressed && { opacity: 0.6 }]}
              >
                <Text style={[type.small, { color: enamel.whiteMuted }]}>sans micro · can't speak right now</Text>
              </Pressable>
            </>
          ) : (
            <View style={st.convoLocked} accessibilityLabel="Your first lesson opens free talk">
              <Text style={[type.tag, { color: enamel.whiteFaint }]}>CONVERSATION · FREE TALK</Text>
              <Text style={[type.small, { color: enamel.whiteFaint, marginTop: 2, textAlign: 'center' }]}>
                Votre première leçon ouvre ceci. · Your first lesson opens this.
              </Text>
            </View>
          ))}
        {due > 0 && (
          <Pressable onPress={onReview} accessibilityRole="button" style={({ pressed }) => [st.review, pressed && { opacity: 0.8 }]}>
            <Text style={[type.tag, { color: enamel.white }]}>RÉVISION · REVIEW</Text>
            <Text style={[type.small, { color: enamel.whiteMuted, marginTop: 2 }]}>
              {due === 1 ? '1 carte · 1 card' : `${due} cartes · ${due} cards`}
            </Text>
          </Pressable>
        )}
        {/* Always open: the fixture bank guarantees content, and the screen
            itself says so calmly when nothing is due. */}
        <Pressable onPress={onDrill} accessibilityRole="button" style={({ pressed }) => [st.review, pressed && { opacity: 0.8 }]}>
          <Text style={[type.tag, { color: enamel.white }]}>ENTRAÎNEMENT · DRILLS</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** A stored rung, trusted only after proving it really is one. Older stored
 * sessions predate `nextStartRung`, so the field can be missing entirely. */
function asRung(value: unknown): Rung | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 4 ? (value as Rung) : null;
}

function Root() {
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
        <ActivityIndicator color={enamel.whiteMuted} />
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
        userId={DEV_USER_ID}
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
    return <DrillScreen onDone={restart} />;
  }
  if (screen.name === 'convo') {
    return (
      <ConvoScreen
        userId={DEV_USER_ID}
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
      <View style={st.app}>
        {loaded ? (
          // A phone app that also runs in a browser. Constrained to a phone column
          // rather than stretched — the composition is designed for a thumb.
          <View style={st.shell}>
            <Root />
          </View>
        ) : (
          <View style={st.loading}>
            <ActivityIndicator color={enamel.whiteMuted} />
          </View>
        )}
      </View>
    </SafeAreaProvider>
  );
}

const st = StyleSheet.create({
  app: { flex: 1, backgroundColor: enamel.ground },
  shell: { flex: 1, width: '100%', maxWidth: 460, alignSelf: 'center' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  lineRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sounds: { gap: space(2.5) },
  soundRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  sound: {
    borderWidth: 1,
    borderColor: 'rgba(242,239,228,0.3)',
    borderRadius: 3,
    paddingVertical: space(1.5),
    paddingHorizontal: space(2.5),
  },
  // Content sits high, the action is anchored at thumb height. Not spread evenly:
  // even spread is what leaves a phone screen looking half-empty.
  start: { flex: 1, paddingHorizontal: space(5), justifyContent: 'space-between', gap: space(8) },
  begin: {
    minHeight: HIT + 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space(2),
    backgroundColor: enamel.white,
    borderRadius: radius.plaque,
  },
  // Secondary to MONTER: an outline where the begin button is a filled plaque.
  review: {
    minHeight: HIT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space(2),
    borderWidth: 2,
    borderColor: enamel.white,
    borderRadius: radius.plaque,
  },
  // The same outline, muted: visible as a destination, unmistakably not yet a door.
  helpLink: {
    minHeight: HIT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space(3),
  },
  convoLocked: {
    minHeight: HIT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space(2),
    paddingHorizontal: space(3),
    borderWidth: 2,
    borderColor: 'rgba(242,239,228,0.22)',
    borderRadius: radius.plaque,
  },
});
