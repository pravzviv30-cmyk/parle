import { PreAccountOnboarding } from '../onboarding/PreAccountOnboarding.tsx';
import { FirstSessionSummary, FirstSessionCelebration } from '../onboarding/FirstSessionResult.tsx';
import type { FirstLiveRecord } from '../onboarding/firstLiveModel.ts';
/** Real presentation components with synthetic data. No accounts, guest sessions or paid generation. */
import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { buildConversationPack, addDays, tutorVoice, type DayKey, type TutorVoiceKey } from '@luvani/core';
import { AuthProvider } from '../auth/useAuth.tsx';
import type { AuthAdapter, AuthResult } from '../auth/types.ts';
import { SignUpScreen } from '../auth/SignUpScreen.tsx';
import { emptySignUpFormDraft, type SignUpFormDraft } from '../auth/signUpFormDraft.ts';
import { Choice, PillButton, Press } from '../components.tsx';
import { ScrollScreen, readingColumn } from '../layout.tsx';
import { AccountWelcome } from '../onboarding/AccountWelcome.tsx';
import { OnboardingFrame, OnboardingLayout, useOnboardingTransition } from '../onboarding/OnboardingLayout.tsx';
import { onboardingProgress } from '../onboarding/onboardingProgress.ts';
import { TutorSelection } from '../onboarding/TutorSelection.tsx';
import { PersonalPlan } from '../onboarding/PersonalPlan.tsx';
import { OnboardingScene } from '../onboarding/motion/OnboardingScenes.tsx';
import { StreakCelebrationScreen } from '../onboarding/firstRun/StreakCelebrationScreen.tsx';
import { guestStreak } from '../onboarding/guestProgress.ts';
import { freshPreAccountDraft, type PreAccountOnboardingDraft } from '../onboarding/preAccountDraft.ts';
import { CONFIDENCE_OPTIONS, FOCUS_OPTIONS, REASONS, START_LEVELS } from '../onboarding/plan.ts';
import { FULL_SETUP } from '../onboarding/flow.ts';
import { GOAL_TIERS } from '../onboarding/firstRun/planModel.ts';
import { GoalTile } from '../onboarding/firstRun/GoalTile.tsx';
import { colour, HIT, paper, radius, space, type } from '../theme.ts';
import { useTutorPreview } from '../tutor/useTutorPreview.ts';

const unavailable = async (): Promise<AuthResult> => ({ ok: false, message: 'Screen preview only. No account was created or changed.' });
const previewAdapterBase: AuthAdapter = {
  kind: 'mock', getSession: async () => null, onAuthStateChange: () => () => {},
  signUpWithPassword: unavailable, signInWithPassword: unavailable,
  signInWithGoogle: unavailable, signInWithApple: unavailable,
  sendPasswordReset: unavailable, completePasswordReset: unavailable,
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
const PREVIEWS = ['hear-it', 'reason', 'start-level', 'confidence', 'focus', 'time', 'plan', 'tutor', 'signup', 'streak', 'streak-long', 'streak-empty', 'saved', 'celebration', 'partial', 'account', 'journey', 'select'] as const;
type Preview = typeof PREVIEWS[number];
const LABELS: Record<Preview, string> = {
  'hear-it': 'Welcome', reason: 'Purpose', 'start-level': 'French today', confidence: 'Confidence', focus: 'Practice style', time: 'Daily goal',
  journey: 'Complete onboarding flow', plan: 'Personal plan', tutor: 'Choose your tutor', signup: 'Create account', streak: 'Streak', 'streak-long': '7-day streak', 'streak-empty': 'Before first practice', saved: 'First session achievements', celebration: 'First session celebration', partial: 'Interrupted practice', account: 'Account ready', select: 'Screen preview',
};
function previewOptions() {
  const query = Platform.OS === 'web' && typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
  const wanted = query?.get('preview');
  // Begin streak review from the selector so the launch overlay cannot consume
  // its synthetic achievement; explicit setup/account/tutor links stay useful.
  return { screen: PREVIEWS.includes(wanted as Preview) && !wanted?.startsWith('streak') ? wanted as Preview : 'select' as Preview, controls: query?.get('controls') !== '0' };
}

function TutorFixture({ chosen, onChoose, onDone }: { chosen: TutorVoiceKey | null; onChoose: (voice: TutorVoiceKey) => void; onDone: () => void }) {
  const preview = useTutorPreview({ active: true });
  return <OnboardingLayout page="choose-tutor" center={false} footer={<View style={{ gap: 8 }}>
    <Text accessibilityLiveRegion="polite" style={[type.small, st.caption]}>{chosen ? `Selected: ${tutorVoice(chosen).persona.name}.` : 'Choose a tutor to continue.'}</Text>
    <PillButton label="Start your first practice" disabled={chosen === null} onPress={() => { preview.stop(); onDone(); }} />
  </View>}>
    <View style={{ gap: 20 }}>
      <Text accessibilityRole="header" style={[type.title, st.heading]}>Choose your tutor</Text>
      <TutorSelection chosen={chosen} preview={preview} onChoose={onChoose} onHear={preview.toggle} />
    </View>
  </OnboardingLayout>;
}

/** A developer-only presentation fixture. Voice previews play the existing bundled lesson identities. */
export function OnboardingPreview() {
  const [options] = useState(previewOptions);
  const [screen, setScreen] = useState<Preview>(options.screen);
  const [chosen, setChosen] = useState<TutorVoiceKey | null>(null);
  const [draft, setDraft] = useState<PreAccountOnboardingDraft>(() => ({
    ...freshPreAccountDraft(), reason: 'trip', startLevel: 'few', speakingConfidence: 'trying', practiceFocus: 'speaking', minutes: 10,
  }));
  const [formDraft, setFormDraft] = useState<SignUpFormDraft>(emptySignUpFormDraft);
  const [requestPending, setRequestPending] = useState(false);
  const signupPromise = useRef<Promise<AuthResult> | null>(null);
  const signupResolver = useRef<((result: AuthResult) => void) | null>(null);
  // One in-memory adapter and request expose the real form's loading and retry
  // states without transmitting credentials or creating an account.
  const [previewAdapter] = useState<AuthAdapter>(() => ({
    ...previewAdapterBase,
    signUpWithPassword: () => {
      if (signupPromise.current) return signupPromise.current;
      const request = new Promise<AuthResult>((resolve) => { signupResolver.current = resolve; });
      signupPromise.current = request;
      setRequestPending(true);
      return request;
    },
  }));
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
      if (next !== 'signup') settleSignup({ ok: false, message: 'Screen preview request cancelled.' });
      setScreen(next);
    });
  };
  const next = () => {
    const index = FULL_SETUP.indexOf(screen as typeof FULL_SETUP[number]);
    go((FULL_SETUP[index + 1] as Preview | undefined) ?? 'tutor');
  };
  const question = screen === 'reason' ? REASONS : screen === 'start-level' ? START_LEVELS
    : screen === 'confidence' ? CONFIDENCE_OPTIONS : screen === 'focus' ? FOCUS_OPTIONS : null;
  const field = screen === 'reason' ? 'reason' : screen === 'start-level' ? 'startLevel'
    : screen === 'confidence' ? 'speakingConfidence' : screen === 'focus' ? 'practiceFocus' : null;
  const titles: Partial<Record<Preview, string>> = {
    'hear-it': 'Welcome to Luvani', reason: 'Make French yours', 'start-level': 'How’s your French?', confidence: 'How does speaking feel?',
    focus: 'What would help you most?', time: 'Your daily French moment', plan: 'Your personal plan',
  };
  return <AuthProvider adapter={previewAdapter}>
    <View style={st.root}>
      {screen === 'select' ? <ScrollScreen>
        <View style={[readingColumn, { gap: space(4) }]}>
          <Text accessibilityRole="header" style={[type.title, st.heading]}>Screen preview</Text>
          <Text style={[type.body, st.ink]}>Synthetic examples. Account buttons cannot contact a service or save an account. Signup stays loading until you choose Fail or Complete in the preview controls. Listen plays the existing bundled voice samples.</Text>
          {PREVIEWS.filter(value => value !== 'select').map(value => <PillButton key={value} label={LABELS[value]} onPress={() => go(value)} />)}
        </View>
      </ScrollScreen> : <OnboardingFrame initialProgress={onboardingProgress({ page: screen === 'tutor' ? 'choose-tutor' : screen.startsWith('streak') ? 'remind' : screen })}>
        <Animated.View style={[st.root, transition.style]}>
          {screen === 'tutor' && <TutorFixture chosen={chosen} onChoose={setChosen} onDone={() => go('streak')} />}
          {screen === 'signup' && <SignUpScreen onBack={() => go('select')} onSignIn={() => go('select')} planDraft={draft} formDraft={formDraft} onFormDraftChange={setFormDraft} />}
          {(screen === 'streak' || screen === 'streak-long' || screen === 'streak-empty') && <StreakCelebrationScreen
            streak={screen === 'streak-empty' ? null : screen === 'streak-long' ? previewLongStreak : previewStreak}
            today={previewDay}
            moment={screen === 'streak' || screen === 'streak-long' ? `streak:${previewDay}` : null}
            onBack={() => go('select')}
            onContinue={() => go(screen === 'streak-empty' ? 'select' : 'saved')}
          />}
          {screen === 'celebration' && <FirstSessionCelebration record={previewFirstLive} progress={onboardingProgress({page:'recap'})} onDone={() => go('saved')} />}
          {(screen === 'saved' || screen === 'partial') && <FirstSessionSummary record={screen === 'partial' ? {...previewFirstLive,outcome:'interrupted'} : previewFirstLive}
            progress={onboardingProgress({page:'keep'})} onSave={() => go('signup')} />}
          {screen === 'journey' && <PreAccountOnboarding previewOnly initialDraft={null} onDraftChange={() => {}} onCreateAccount={() => { go('signup'); return Promise.resolve(true); }} onSignIn={() => go('signup')} />}
          {screen === 'account' && <AccountWelcome onDone={() => go('select')} />}
          {titles[screen] !== undefined && <OnboardingLayout page={screen} footer={<PillButton label={screen === 'plan' ? 'Choose your tutor' : 'Continue'} onPress={next} />}>
            <View style={st.story}>
              {screen === 'hear-it' && <View style={{ alignItems: 'center' }}><OnboardingScene kind="welcome" size={190} /></View>}
              {screen === 'start-level' && <View style={{ alignItems: 'center' }}><OnboardingScene kind="level" size={150} /></View>}
              <Text accessibilityRole="header" style={[type.title, st.heading]}>{titles[screen]}</Text>
              {screen === 'hear-it' && <Text style={[type.body, st.caption]}>Find your voice in French. Start with a small conversation, and make it yours.</Text>}
              {question && field && <View accessibilityRole="radiogroup" style={{ gap: 10 }}>{question.map(option => <Choice key={option.key} title={option.title}
                detail={'gloss' in option ? option.gloss : undefined} selected={draft[field] === option.key}
                onPress={() => setDraft(current => ({ ...current, [field]: option.key }))} />)}</View>}
              {screen === 'time' && <View accessibilityRole="radiogroup" style={{ gap: 10 }}>{GOAL_TIERS.map(tier => <GoalTile key={tier.minutes} tier={tier} suggested={false}
                selected={draft.minutes === tier.minutes} onPress={() => setDraft(current => ({ ...current, minutes: tier.minutes }))} />)}</View>}
              {screen === 'plan' && <PersonalPlan draft={draft} compact={false} onEdit={() => go('reason')} />}
            </View>
          </OnboardingLayout>}
        </Animated.View>
      </OnboardingFrame>}
      {options.controls && screen !== 'select' && !screen.startsWith('streak') && <View style={[st.badgeFrame, { top: insets.top + space(2) }]}>
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

const st = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
  story: { gap: space(5) },
  ink: { color: paper.ink },
  heading: { color: paper.ink, textAlign: 'center' },
  caption: { color: paper.inkSoft, textAlign: 'center' },
  badgeFrame: { position: 'absolute', right: space(4), flexDirection: 'row', gap: space(1) },
  badge: { minHeight: HIT, paddingHorizontal: space(3), justifyContent: 'center', borderRadius: radius.pill, backgroundColor: paper.card },
});
