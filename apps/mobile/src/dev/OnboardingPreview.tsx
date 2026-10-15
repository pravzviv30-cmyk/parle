import { BoldVoiceOrb } from '../onboarding/BoldVoiceOrb.tsx';
import type { OrbState } from '../tutor/VoiceOrb.tsx';
import { C2LiveRoom } from '../live/C2LiveRoom.tsx';
import type { TurnLine } from '../live/turns.ts';
import { PreAccountOnboarding } from '../onboarding/PreAccountOnboarding.tsx';
import { FirstSessionSummary, FirstSessionCelebration } from '../onboarding/FirstSessionResult.tsx';
import type { FirstLiveRecord } from '../onboarding/firstLiveModel.ts';
/** Real presentation components with synthetic data. No accounts, guest sessions or paid generation. */
import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
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
const PREVIEWS = ['orb', 'live-speaking', 'live-typing', 'hear-it', 'reason', 'interests', 'start-level', 'confidence', 'focus', 'time', 'plan', 'tutor', 'signup', 'signin', 'auth-flow', 'streak', 'streak-long', 'streak-empty', 'saved', 'celebration', 'partial', 'account', 'journey', 'select'] as const;
type Preview = typeof PREVIEWS[number];
const LABELS: Record<Preview, string> = {
  'live-speaking': 'Live speaking layout', 'live-typing': 'Live typing layout',
  orb: 'Fluid orb states', 'hear-it': 'Welcome', reason: 'Purpose', interests: 'Interests', 'start-level': 'French today', confidence: 'Confidence', focus: 'Practice style', time: 'Daily goal',
  'auth-flow': 'Sign in and create account flow', journey: 'Complete onboarding flow', plan: 'Personal plan', tutor: 'Choose your tutor', signup: 'Create account', signin: 'Sign in', streak: 'Streak', 'streak-long': '7-day streak', 'streak-empty': 'Before first practice', saved: 'First session achievements', celebration: 'First session celebration', partial: 'Interrupted practice', account: 'Account ready', select: 'Screen preview',
};
function previewOptions() {
  const query = Platform.OS === 'web' && typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
  const wanted = query?.get('preview');
  // Begin streak review from the selector so the launch overlay cannot consume
  // its synthetic achievement; explicit setup/account/tutor links stay useful.
  return { screen: PREVIEWS.includes(wanted as Preview) && !wanted?.startsWith('streak') ? wanted as Preview : 'select' as Preview, controls: query?.get('controls') !== '0' };
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
      </ScrollScreen> : <OnboardingFrame initialProgress={onboardingProgress({ page: screen === 'tutor' ? 'choose-tutor' : screen.startsWith('streak') ? 'remind' : screen })}>
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
          {(screen === 'live-speaking' || screen === 'live-typing') && <LiveRoomPreview key={screen} startTyping={screen === 'live-typing'} controls={controlsVisible} onEnd={() => go('celebration')} />}
          {(titles[screen] !== undefined || screen === 'interests') && <PreAccountOnboarding key={screen} previewOnly
            initialDraft={{ ...draft, page: screen as PreAccountOnboardingDraft['page'] }} onDraftChange={setDraft}
            onCreateAccount={() => { go('signup'); return Promise.resolve(true); }} onSignIn={() => go('signin')} />}

        </Animated.View>
      </OnboardingFrame>}
      {(controlsVisible || requestPending) && screen !== 'select' && !screen.startsWith('streak') && <View style={[st.badgeFrame, { top: insets.top + space(2) }]}>
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
function LiveRoomPreview({ startTyping, controls, onEnd }: { startTyping: boolean; controls: boolean; onEnd: () => void }) {
  useOnboardingFramePresentation(onboardingProgress({ page: 'practice' }), { hideProgress: true });
  const [typing, setTyping] = useState(startTyping);
  const [micOpen, setMicOpen] = useState(!startTyping);
  const [transcript, setTranscript] = useState(true);
  const [draft, setDraft] = useState('');
  const [turns, setTurns] = useState<TurnLine[]>([
    { id: 't1', who: 'tutor', fr: 'Bonjour ! Vous avez réservé une table ?', frWritten: null, en: 'Hello! Have you booked a table?' },
    { id: 'u1', who: 'learner', fr: 'Une table pour deux, s’il vous plaît.', frWritten: null, en: null },
    { id: 't2', who: 'tutor', fr: 'Bien sûr. Une table pour deux. Vous préférez à l’intérieur ou sur la terrasse ?', frWritten: null, en: 'Of course. A table for two. Would you prefer inside or on the terrace?' },
  ]);
  const sequence = useRef(3);
  const addTutor = () => setTurns(held => [...held, { id: `t${sequence.current++}`, who: 'tutor', fr: 'Très bien ! Vous voulez la carte ? Prenez votre temps, puis dites-moi ce que vous souhaitez commander.', frWritten: null, en: 'Very good! Would you like the menu? Take your time, then tell me what you would like to order.' }]);
  return <C2LiveRoom tutorName="Émilie" description="At the restaurant, synthetic preview" state={typing ? 'ready' : micOpen ? 'listening' : 'ready'}
    caption={typing ? 'Ready for your message' : micOpen ? 'Your turn. Take your time.' : 'Microphone paused'}
    turns={turns} tutorSpeaking={false} typing={typing} micOpen={micOpen} transcriptVisible={transcript} onTranscriptVisibility={setTranscript}
    draft={draft} onDraft={setDraft} onEnd={onEnd} onMic={() => setMicOpen(value => !value)}
    onModeChange={value => { setTyping(value); setMicOpen(!value); }} onSend={async () => {
      const text = draft.trim();
      if (!text) return false;
      setDraft('');
      setTurns(held => [...held, { id: `u${sequence.current++}`, who: 'learner', fr: text, frWritten: null, en: null }]);
      return true;
    }} top={controls ? <Press accessibilityRole="button" accessibilityLabel="Add a synthetic tutor reply" onPress={addTutor} style={st.badge}><Text style={[type.small, st.ink]}>Add a tutor reply</Text></Press> : undefined} />;
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
