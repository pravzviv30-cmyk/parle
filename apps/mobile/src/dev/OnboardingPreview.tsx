/** Real presentation components with synthetic data. No accounts, guest sessions or paid generation. */
import { useState } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { tutorVoice, type DayKey, type TutorVoiceKey } from '@luvani/core';
import { AuthProvider } from '../auth/useAuth.tsx';
import type { AuthAdapter, AuthResult } from '../auth/types.ts';
import { SignUpScreen } from '../auth/SignUpScreen.tsx';
import { Choice, PillButton, Press } from '../components.tsx';
import { ScrollScreen, readingColumn } from '../layout.tsx';
import { AccountWelcome } from '../onboarding/AccountWelcome.tsx';
import { OnboardingFrame, OnboardingLayout, useOnboardingTransition } from '../onboarding/OnboardingLayout.tsx';
import { onboardingProgress } from '../onboarding/onboardingProgress.ts';
import { TutorSelection } from '../onboarding/TutorSelection.tsx';
import { PersonalPlan } from '../onboarding/PersonalPlan.tsx';
import { OnboardingScene } from '../onboarding/motion/OnboardingScenes.tsx';
import { DayOne } from '../onboarding/firstRun/DayOne.tsx';
import { WeekStrip } from '../onboarding/firstRun/WeekStrip.tsx';
import { InvestmentList } from '../onboarding/firstRun/InvestmentList.tsx';
import { guestStreak, type InvestmentRow } from '../onboarding/guestProgress.ts';
import { freshPreAccountDraft, type PreAccountOnboardingDraft } from '../onboarding/preAccountDraft.ts';
import { CONFIDENCE_OPTIONS, FOCUS_OPTIONS, REASONS, START_LEVELS, practiceForecast } from '../onboarding/plan.ts';
import { FULL_SETUP } from '../onboarding/flow.ts';
import { GOAL_TIERS } from '../onboarding/firstRun/planModel.ts';
import { GoalTile } from '../onboarding/firstRun/GoalTile.tsx';
import { colour, HIT, paper, radius, space, type } from '../theme.ts';
import { useTutorPreview } from '../tutor/useTutorPreview.ts';

const unavailable = async (): Promise<AuthResult> => ({ ok: false, message: 'Screen preview only. No account was created or changed.' });
const previewAdapter: AuthAdapter = {
  kind: 'mock', getSession: async () => null, onAuthStateChange: () => () => {},
  signUpWithPassword: unavailable, signInWithPassword: unavailable,
  signInWithGoogle: unavailable, signInWithApple: unavailable,
  sendPasswordReset: unavailable, completePasswordReset: unavailable,
  reauthenticateForDeletion: unavailable, deleteAccount: unavailable,
  signOut: async () => {}, getAccessToken: async () => null,
};
const previewDay = '2026-10-10' as DayKey;
const previewStreak = guestStreak([previewDay], previewDay)!;
const previewRows: InvestmentRow[] = [
  { key: 'streak', icon: 'flame', text: 'Day 1 of your streak' },
  { key: 'replies', icon: 'chat', text: 'Your first French reply' },
  { key: 'plan', icon: 'calendar', text: 'Your personal plan: 10 minutes a day' },
  { key: 'tutor', icon: 'user', text: `Your AI tutor: ${tutorVoice('emilie').persona.name}` },
];
const PREVIEWS = ['hear-it', 'reason', 'start-level', 'confidence', 'focus', 'time', 'plan', 'tutor', 'signup', 'streak', 'saved', 'account', 'select'] as const;
type Preview = typeof PREVIEWS[number];
const LABELS: Record<Preview, string> = {
  'hear-it': 'Welcome', reason: 'Purpose', 'start-level': 'French today', confidence: 'Confidence', focus: 'Practice style', time: 'Daily goal',
  plan: 'Personal plan', tutor: 'Choose your tutor', signup: 'Create account', streak: 'Streak', saved: 'Save progress', account: 'Account ready', select: 'Screen preview',
};
function previewOptions() {
  const query = Platform.OS === 'web' && typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
  const wanted = query?.get('preview');
  return { screen: PREVIEWS.includes(wanted as Preview) ? wanted as Preview : 'tutor' as Preview, controls: query?.get('controls') !== '0' };
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
  const transition = useOnboardingTransition();
  const go = (next: Preview) => { transition.transition(() => setScreen(next)); };
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
          <Text style={[type.body, st.ink]}>Synthetic examples. Account buttons cannot contact a service. Listen plays the existing bundled voice samples.</Text>
          {PREVIEWS.filter(value => value !== 'select').map(value => <PillButton key={value} label={LABELS[value]} onPress={() => go(value)} />)}
        </View>
      </ScrollScreen> : <OnboardingFrame initialProgress={onboardingProgress({ page: screen === 'tutor' ? 'choose-tutor' : screen })}>
        <Animated.View style={[st.root, transition.style]}>
          {screen === 'tutor' && <TutorFixture chosen={chosen} onChoose={setChosen} onDone={() => go('streak')} />}
          {screen === 'signup' && <SignUpScreen onBack={() => go('select')} onSignIn={() => go('select')} planDraft={draft} />}
          {screen === 'streak' && <OnboardingLayout page="remind" footer={<PillButton label="Continue" onPress={() => go('saved')} />}>
            <View style={st.story}>
              <DayOne streak={previewStreak} moment="preview-streak" />
              <Text style={[type.heading, st.heading]}>Practise every day to keep your streak going</Text>
              <WeekStrip week={previewStreak.week} today={previewDay} moment="preview-streak" />
            </View>
          </OnboardingLayout>}
          {screen === 'saved' && <OnboardingLayout page="keep" footer={<PillButton label="Save my progress" onPress={() => go('signup')} />}>
            <View style={st.story}>
              <Text accessibilityRole="header" style={[type.title, st.heading]}>Save your progress</Text>
              <InvestmentList rows={previewRows} />
              <Text style={[type.body, st.caption]}>{practiceForecast(10)!.line}</Text>
            </View>
          </OnboardingLayout>}
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
      {options.controls && screen !== 'select' && <Press accessibilityRole="button" accessibilityLabel="Screen preview. Choose another synthetic screen" onPress={() => go('select')} frame={st.badgeFrame} style={st.badge}>
        <Text style={[type.small, st.ink]}>Screen preview</Text>
      </Press>}
    </View>
  </AuthProvider>;
}

const st = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
  story: { gap: space(5) },
  ink: { color: paper.ink },
  heading: { color: paper.ink, textAlign: 'center' },
  caption: { color: paper.inkSoft, textAlign: 'center' },
  badgeFrame: { position: 'absolute', right: space(4), top: space(3) },
  badge: { minHeight: HIT, paddingHorizontal: space(3), justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colour.sun },
});
