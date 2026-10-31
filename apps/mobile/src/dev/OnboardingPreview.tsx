import { BoldVoiceOrb } from '../onboarding/BoldVoiceOrb.tsx';
import type { OrbState } from '../tutor/VoiceOrb.tsx';
import { C2LiveRoom } from '../live/C2LiveRoom.tsx';
import { useQuietVoice } from '../live/useQuietVoice.ts';
import type { TurnLine } from '../live/turns.ts';
import type { HeldTurnState } from '@luvani/core';
import { PreAccountOnboarding } from '../onboarding/PreAccountOnboarding.tsx';
import { FirstSessionSummary, FirstSessionCelebration } from '../onboarding/FirstSessionResult.tsx';
import type { FirstLiveRecord } from '../onboarding/firstLiveModel.ts';
/** Real presentation components with synthetic data. No accounts, guest sessions or paid generation. */
import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { buildConversationPack, addDays, type DayKey } from '@luvani/core';
import { AuthProvider } from '../auth/useAuth.tsx';
import type { AuthAdapter, AuthResult } from '../auth/types.ts';
import { SignUpScreen } from '../auth/SignUpScreen.tsx';
import { AuthFlow } from '../auth/AuthFlow.tsx';
import { SignInScreen } from '../auth/SignInScreen.tsx';
import { emptySignUpFormDraft, type SignUpFormDraft } from '../auth/signUpFormDraft.ts';
import { PillButton, Press } from '../components.tsx';
import { ScrollScreen, readingColumn } from '../layout.tsx';
import { AccountWelcome } from '../onboarding/AccountWelcome.tsx';
import { OnboardingFrame, useOnboardingTransition, useOnboardingFramePresentation } from '../onboarding/OnboardingLayout.tsx';
import { onboardingProgress } from '../onboarding/onboardingProgress.ts';
import { StreakCelebrationScreen } from '../onboarding/firstRun/StreakCelebrationScreen.tsx';
import { guestStreak } from '../onboarding/guestProgress.ts';
import { freshPreAccountDraft, type PreAccountOnboardingDraft } from '../onboarding/preAccountDraft.ts';
import { HIT, paper, radius, space, type } from '../theme.ts';
import { HowItsGoingPreview, YourFrenchPreview } from './YourFrenchPreview.tsx';
import { TodayPreview } from './TodayPreview.tsx';
import { TODAY_PREVIEW_KEYS, TODAY_PREVIEW_LABELS, todayPreviewState } from './todayPreviewFixtures.ts';
import { preferredMode, type MainMode } from '../main/appearanceModel.ts';
import { ModeScope, useB } from '../main/bTheme.tsx';
import { YOUR_FRENCH_STATES, type YourFrenchState } from '../journey/yourFrenchFixtures.ts';
import { PROGRESS_STATES, type ProgressState } from '../journey/progressFixtures.ts';

const unavailable = async (): Promise<AuthResult> => ({ ok: false, message: 'Screen preview only. No account was created or changed.' });
const previewAdapterBase: AuthAdapter = {
  kind: 'mock', getSession: async () => null, onAuthStateChange: () => () => {},
  signUpWithPassword: unavailable, signInWithPassword: unavailable,
  signInWithGoogle: unavailable, signInWithApple: unavailable,
  resendConfirmation: unavailable, sendPasswordReset: unavailable, completePasswordReset: unavailable,
  reauthenticateForDeletion: unavailable, deleteAccount: unavailable,
  signOut: async () => {}, getAccessToken: async () => null,
};
const previewDay = '2026-10-10' as DayKey;
const previewStreak = guestStreak([previewDay], previewDay)!;
const previewLongStreak = guestStreak(Array.from({ length: 7 }, (_, i) => addDays(previewDay, i - 6)), previewDay)!;
const previewFirstLive: FirstLiveRecord = {
  brief: {version:1, goals:['food','trip'], level:'zero', confidence:'hesitant', focus:'speaking', minutes:5, tutorVoice:'emilie'},
  sessionId:'11111111-1111-4111-8111-111111111111', outcome:'completed', seconds:240, completedAt:Date.parse('2026-10-10T10:00:00Z'),
  contributions:[{id:'u1',text:'Une table pour deux, s’il vous plaît.',input:'typed'},{id:'u2',text:'La carte, merci.',input:'typed'}],
  pack:buildConversationPack({id:'11111111-1111-4111-8111-111111111111',sessionId:'11111111-1111-4111-8111-111111111111',learnerId:'screen-preview',createdAt:'2026-10-10T10:00:00Z',title:{fr:'Au restaurant',en:'At the restaurant'},summary:'A restaurant conversation.',
    keyPhrases:[{fr:'Une table pour deux',frWritten:null,en:'A table for two'},{fr:'La carte',frWritten:null,en:'The menu'}]})
};
const PREVIEWS = ['orb', 'live-speaking', 'live-typing', 'live-tap-to-send', 'live-wrap-up', 'hear-it', 'reason', 'interests', 'start-level', 'confidence', 'focus', 'time', 'plan', 'tutor', 'signup', 'signin', 'auth-flow', 'streak', 'streak-long', 'streak-empty', 'saved', 'celebration', 'partial', 'account', 'journey', 'your-french-full', 'your-french-sounds', 'your-french-scenes', 'your-french-forward', 'your-french-free', 'how-its-going-both', 'how-its-going-better', 'how-its-going-again', 'how-its-going-free', ...TODAY_PREVIEW_KEYS, 'select'] as const;
type Preview = typeof PREVIEWS[number];
const LABELS: Record<Preview, string> = {
  'live-speaking': 'Live speaking layout', 'live-typing': 'Live typing layout',
  'live-tap-to-send': 'Live tap to send, a turn held', 'live-wrap-up': 'Live wrap-up note',
  orb: 'Fluid orb states', 'hear-it': 'Welcome', reason: 'Purpose', interests: 'Interests', 'start-level': 'French today', confidence: 'Confidence', focus: 'Practice style', time: 'Daily goal',
  'auth-flow': 'Sign in and create account flow', journey: 'Complete onboarding flow', plan: 'Personal plan', tutor: 'Choose your tutor', signup: 'Create account', signin: 'Sign in', streak: 'Streak', 'streak-long': '7-day streak', 'streak-empty': 'Before first practice', saved: 'First session achievements', celebration: 'First session celebration', partial: 'Interrupted practice', account: 'Account ready', select: 'Screen preview',
  'your-french-full': 'Your French, full', 'your-french-sounds': 'Your French, sounds only', 'your-french-scenes': 'Your French, scenes only',
  'your-french-forward': 'Your French, nothing yet', 'your-french-free': 'Your French, free plan',
  'how-its-going-both': 'How it’s going, both rows', 'how-its-going-better': 'How it’s going, getting better only',
  'how-its-going-again': 'How it’s going, another go only', 'how-its-going-free': 'How it’s going, free plan',
  ...TODAY_PREVIEW_LABELS,
};
function previewOptions() {
  const query = Platform.OS === 'web' && typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
  const wanted = query?.get('preview');
  // Begin streak review from the selector so the launch overlay cannot consume
  // its synthetic achievement; explicit setup/account/tutor links stay useful.
  const theme = query?.get('theme');
  return {
    screen: PREVIEWS.includes(wanted as Preview) && !wanted?.startsWith('streak') ? wanted as Preview : 'select' as Preview,
    controls: query?.get('controls') !== '0',
    theme: theme === 'dark' || theme === 'light' ? theme as MainMode : null,
  };
}

/** The Your French state a preview key names, or null for every other screen. */
function yourFrenchState(screen: Preview): YourFrenchState | null {
  const state = screen.startsWith('your-french-') ? screen.slice('your-french-'.length) : null;
  return YOUR_FRENCH_STATES.find((value) => value === state) ?? null;
}

/** The How it’s going state a preview key names, or null for every other screen. */
function progressState(screen: Preview): ProgressState | null {
  const state = screen.startsWith('how-its-going-') ? screen.slice('how-its-going-'.length) : null;
  return PROGRESS_STATES.find((value) => value === state) ?? null;
}

/** A developer-only presentation fixture. Voice previews play the existing bundled lesson identities. */
export function OnboardingPreview() {
  const [options] = useState(previewOptions);
  const [controlsVisible, setControlsVisible] = useState(options.controls);
  const [screen, setScreen] = useState<Preview>(options.screen);
  const [orbState, setOrbState] = useState<OrbState>('ready');
  const [orbActive, setOrbActive] = useState(true);
  const [draft, setDraft] = useState<PreAccountOnboardingDraft>(() => ({
    ...freshPreAccountDraft(), reason: 'trip', startLevel: 'few', speakingConfidence: 'trying', practiceFocus: 'speaking', minutes: 10,
  }));
  const [formDraft, setFormDraft] = useState<SignUpFormDraft>(emptySignUpFormDraft);
  const [requestPending, setRequestPending] = useState(false);
  const signupPromise = useRef<Promise<AuthResult> | null>(null);
  const signupResolver = useRef<((result: AuthResult) => void) | null>(null);
  // One in-memory adapter and request expose both forms' loading and retry
  // states without transmitting credentials or creating an account.
  const [previewAdapter] = useState<AuthAdapter>(() => {
    const pendingRequest = () => {
      if (signupPromise.current) return signupPromise.current;
      const request = new Promise<AuthResult>((resolve) => { signupResolver.current = resolve; });
      signupPromise.current = request;
      setRequestPending(true);
      return request;
    };
    return { ...previewAdapterBase, signUpWithPassword: pendingRequest, signInWithPassword: pendingRequest, signInWithGoogle: pendingRequest, signInWithApple: pendingRequest, resendConfirmation: pendingRequest };
  });
  const settleSignup = (result: AuthResult) => {
    const resolve = signupResolver.current;
    signupResolver.current = null;
    signupPromise.current = null;
    setRequestPending(false);
    resolve?.(result);
  };
  useEffect(() => () => {
    const resolve = signupResolver.current;
    signupResolver.current = null;
    signupPromise.current = null;
    resolve?.({ ok: false, message: 'Screen preview request cancelled.' });
  }, []);
  const insets = useSafeAreaInsets();
  // The web query names the mode for screenshots; otherwise the device's appearance (the simulator's on native).
  const yourFrenchMode = options.theme ?? preferredMode('system', useColorScheme());
  const yourFrench = yourFrenchState(screen);
  const going = progressState(screen);
  const today = todayPreviewState(screen);
  const transition = useOnboardingTransition();
  const go = (next: Preview) => {
    transition.transition(() => {
      if (next !== 'signup' && next !== 'signin') settleSignup({ ok: false, message: 'Screen preview request cancelled.' });
      setScreen(next);
    });
  };
  const titles: Partial<Record<Preview, string>> = {
    'hear-it': 'Welcome to Luvani', reason: 'Make French yours', 'start-level': 'How’s your French?', confidence: 'How does speaking feel?',
    focus: 'What would help you most?', time: 'Your daily French moment', plan: 'Your personal plan',
  };
  return <AuthProvider adapter={previewAdapter}>
    <View style={st.root}>
      {screen === 'select' ? <ScrollScreen>
        <View style={[readingColumn, { gap: space(4) }]}>
          <Text accessibilityRole="header" style={[type.title, st.heading]}>Screen preview</Text>
          <Text style={[type.body, st.ink]}>Synthetic examples. Account buttons cannot contact a service or save an account. Authentication stays loading until you choose Fail or Complete in the preview controls. Listen plays the existing bundled voice samples.</Text>
          <PillButton tone="white" label={controlsVisible ? 'Hide preview controls' : 'Show preview controls'} onPress={() => setControlsVisible(value => !value)} />
          {PREVIEWS.filter(value => value !== 'select').map(value => <PillButton key={value} label={LABELS[value]} onPress={() => go(value)} />)}
        </View>
      </ScrollScreen> : yourFrench !== null ? <YourFrenchPreview state={yourFrench} mode={yourFrenchMode} onBack={controlsVisible ? () => go('select') : undefined} /> : going !== null ? <HowItsGoingPreview state={going} mode={yourFrenchMode} onBack={controlsVisible ? () => go('select') : undefined} /> : today !== null ? <TodayPreview state={today} mode={yourFrenchMode} onBack={controlsVisible ? () => go('select') : undefined} />
      : <OnboardingFrame initialProgress={onboardingProgress({ page: screen === 'tutor' ? 'choose-tutor' : screen.startsWith('streak') ? 'remind' : screen })}>
        <Animated.View style={[st.root, transition.style]}>
          {screen === 'orb' && <ScrollScreen><View style={[readingColumn, { gap: 24, alignItems: 'center' }]}><Text accessibilityRole="header" style={[type.title, st.heading]}>Fluid voice orb</Text><Text style={[type.body, st.caption]}>Synthetic state preview. No microphone or live audio.</Text><BoldVoiceOrb state={orbState} size={280} active={orbActive} /><Text accessibilityLiveRegion="polite" style={[type.bodyStrong, st.ink]}>{orbState}</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{(['ready', 'connecting', 'listening', 'thinking', 'speaking', 'error'] as const).map(value => <PillButton key={value} label={value} onPress={() => setOrbState(value)} />)}</View><PillButton label={orbActive ? 'Pause motion' : 'Resume motion'} onPress={() => setOrbActive(!orbActive)} /></View></ScrollScreen>}
          {screen === 'tutor' && <PreAccountOnboarding previewOnly initialDraft={{ ...draft, page: 'choose-tutor' }} onDraftChange={setDraft} onCreateAccount={() => { go('signup'); return Promise.resolve(true); }} onSignIn={() => go('signin')} />}
          {screen === 'signup' && <SignUpScreen onBack={() => go('select')} onSignIn={() => go('signin')} planDraft={draft} formDraft={formDraft} onFormDraftChange={setFormDraft} />}
          {screen === 'auth-flow' && <AuthFlow initialDraft={null} returning onDraftChange={() => {}} onCreateAccount={() => {}} onDiscardDraft={() => {}} onSignIn={() => {}} refused={false} onRefuse={() => {}} />}
          {screen === 'signin' && <SignInScreen onCreateAccount={() => go('signup')} />}
          {(screen === 'streak' || screen === 'streak-long' || screen === 'streak-empty') && <StreakCelebrationScreen design="bold-rhythm"
            streak={screen === 'streak-empty' ? null : screen === 'streak-long' ? previewLongStreak : previewStreak}
            today={previewDay}
            moment={screen === 'streak' || screen === 'streak-long' ? `streak:${previewDay}` : null}
            onBack={() => go('select')}
            onContinue={() => go(screen === 'streak-empty' ? 'select' : 'saved')}
          />}
          {screen === 'celebration' && <FirstSessionCelebration record={previewFirstLive} progress={onboardingProgress({page:'recap'})} onDone={() => go('saved')} />}
          {(screen === 'saved' || screen === 'partial') && <FirstSessionSummary record={screen === 'partial' ? {...previewFirstLive,outcome:'interrupted'} : previewFirstLive}
            progress={onboardingProgress({page:'keep'})} onSave={() => go('signup')} />}
          {screen === 'journey' && <PreAccountOnboarding previewOnly initialDraft={null} onDraftChange={() => {}} onCreateAccount={() => { go('signup'); return Promise.resolve(true); }} onSignIn={() => go('signin')} />}
          {screen === 'account' && <AccountWelcome onDone={() => go('select')} />}
          {(screen === 'live-speaking' || screen === 'live-typing' || screen === 'live-tap-to-send' || screen === 'live-wrap-up') && <ModeScope mode={yourFrenchMode}><LiveRoomPreview key={screen} startTyping={screen === 'live-typing'} tapToSend={screen === 'live-tap-to-send'} wrappingUp={screen === 'live-wrap-up'} controls={controlsVisible} onEnd={() => go('celebration')} /></ModeScope>}
          {(titles[screen] !== undefined || screen === 'interests') && <PreAccountOnboarding key={screen} previewOnly
            initialDraft={{ ...draft, page: screen as PreAccountOnboardingDraft['page'] }} onDraftChange={setDraft}
            onCreateAccount={() => { go('signup'); return Promise.resolve(true); }} onSignIn={() => go('signin')} />}

        </Animated.View>
      </OnboardingFrame>}
      {(controlsVisible || requestPending) && screen !== 'select' && !screen.startsWith('streak') && yourFrench === null && going === null && today === null && <View style={[st.badgeFrame, { top: insets.top + space(2) }]}>
        <Press accessibilityRole="button" accessibilityLabel="Screen preview. Choose another synthetic screen" onPress={() => go('select')} style={st.badge}>
          <Text style={[type.small, st.ink]}>{requestPending ? 'Preview' : 'Screen preview'}</Text>
        </Press>
        {requestPending && <>
          <Press accessibilityRole="button" accessibilityLabel="Fail preview request" onPress={() => settleSignup({ ok: false, message: 'The connection dropped. Check your internet and try again.' })} style={st.badge}>
            <Text style={[type.small, st.ink]}>Fail</Text>
          </Press>
          <Press accessibilityRole="button" accessibilityLabel="Complete preview request" onPress={() => settleSignup({ ok: true, message: 'Almost there. Check your email for a confirmation link, then sign in.' })} style={st.badge}>
            <Text style={[type.small, st.ink]}>Complete</Text>
          </Press>
        </>}
      </View>}
    </View>
  </AuthProvider>;
}

/** Uses the production room and transcript. These messages never reach a tutor service. */
function LiveRoomPreview({ startTyping, tapToSend: startTapToSend = false, wrappingUp = false, controls, onEnd }: { startTyping: boolean; tapToSend?: boolean; wrappingUp?: boolean; controls: boolean; onEnd: () => void }) {
  useOnboardingFramePresentation(onboardingProgress({ page: 'practice' }), { hideProgress: true });
  const [typing, setTyping] = useState(startTyping);
  const [micOpen, setMicOpen] = useState(!startTyping);
  const [transcript, setTranscript] = useState(true);
  const { quietVoice, onQuietVoice } = useQuietVoice(setTranscript);
  // Held here, not in the device store: a preview never writes the learner's choice.
  const [tapToSend, setTapToSend] = useState(startTapToSend);
  const [heldTurn, setHeldTurn] = useState<HeldTurnState | null>(startTapToSend ? 'open' : null);
  const [draft, setDraft] = useState('');
  const [turns, setTurns] = useState<TurnLine[]>([
    { id: 'n1', who: 'narration', fr: 'It is early and the café is nearly empty.', frWritten: null, en: 'It is early and the café is nearly empty.' },
    { id: 't1', who: 'tutor', fr: 'Bonjour ! Qu’est-ce que je vous sers ?', frWritten: null, en: 'Hello! What can I get you?' },
    { id: 'u1', who: 'learner', fr: 'Je veux un café.', frWritten: null, en: null, recasts: [{ quote: 'Je veux un café.', kind: 'grammar-slip', better: 'Je voudrais un café.', betterEn: 'I would like a coffee.', why: 'Softer and more polite.' }] },
    { id: 't2', who: 'tutor', fr: 'Très bien. Sur place ou à emporter ?', frWritten: null, en: 'Of course. For here or to go?' },
  ]);
  const [reportPending, setReportPending] = useState(false);
  const goals = [
    { id: 'g1', goalEn: 'Say hello and order a coffee', goalShortEn: 'Order a coffee', achieved: true },
    { id: 'g2', goalEn: 'Say whether it is for here or to go', goalShortEn: 'Here or to go', achieved: false },
    { id: 'g3', goalEn: 'Pay for your coffee', goalShortEn: 'Pay', achieved: false },
  ];
  const sequence = useRef(3);
  const addTutor = () => setTurns(held => [...held, { id: `t${sequence.current++}`, who: 'tutor', fr: 'Parfait. Ça fait deux euros, s’il vous plaît.', frWritten: null, en: 'Perfect. That is two euros, please.' }]);
  return <C2LiveRoom tutorName="Émilie" voice="emilie" title="The first coffee" pace="About 3 min" goals={goals}
    report={{ pending: reportPending, onPending: setReportPending }} onReplayTutor={() => {}}
    support={<PreviewSupport />}
    description="At the café, synthetic preview" state={typing ? 'ready' : micOpen ? 'listening' : 'ready'}
    caption={typing ? 'Ready for your message' : micOpen ? 'Your turn. Take your time.' : 'Microphone paused'}
    turns={turns} tutorSpeaking={false} typing={typing} micOpen={micOpen} transcriptVisible={transcript} onTranscriptVisibility={setTranscript} quietVoice={quietVoice} onQuietVoice={onQuietVoice}
    tapToSend={tapToSend} onTapToSend={setTapToSend} heldTurn={heldTurn} onSendTurn={() => setHeldTurn('sent')} wrappingUp={wrappingUp}
    draft={draft} onDraft={setDraft} onEnd={onEnd} onMic={() => setMicOpen(value => !value)}
    onModeChange={value => { setTyping(value); setMicOpen(!value); }} onSend={async () => {
      const text = draft.trim();
      if (!text) return false;
      setDraft('');
      setTurns(held => [...held, { id: `u${sequence.current++}`, who: 'learner', fr: text, frWritten: null, en: null }]);
      return true;
    }} top={controls ? <Press accessibilityRole="button" accessibilityLabel="Add a synthetic tutor reply" onPress={addTutor} style={st.badge}><Text style={[type.small, st.ink]}>Add a tutor reply</Text></Press> : undefined} />;
}

/** The preview's Help content, in the sheet's own themed ink. */
function PreviewSupport() {
  const t = useB();
  return <Text style={[type.small, { color: t.text }]}>Start with Je voudrais, then name what you want.</Text>;
}

const st = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
  story: { gap: space(5) },
  ink: { color: paper.ink },
  heading: { color: paper.ink, textAlign: 'center' },
  caption: { color: paper.inkSoft, textAlign: 'center' },
  badgeFrame: { position: 'absolute', right: space(4), flexDirection: 'row', gap: space(1) },
  badge: { minHeight: HIT, paddingHorizontal: space(3), justifyContent: 'center', borderRadius: radius.pill, backgroundColor: paper.card },
});
