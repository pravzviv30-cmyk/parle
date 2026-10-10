import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { DayKey } from '@luvani/core';
import { AuthProvider } from '../auth/useAuth.tsx';
import type { AuthAdapter, AuthResult } from '../auth/types.ts';
import { SignUpScreen } from '../auth/SignUpScreen.tsx';
import { PillButton, Press } from '../components.tsx';
import { Screen, readingColumn } from '../layout.tsx';
import { AccountWelcome } from '../onboarding/AccountWelcome.tsx';
import { DayOne } from '../onboarding/firstRun/DayOne.tsx';
import { WeekStrip } from '../onboarding/firstRun/WeekStrip.tsx';
import { InvestmentList } from '../onboarding/firstRun/InvestmentList.tsx';
import { guestStreak, type InvestmentRow } from '../onboarding/guestProgress.ts';
import { colour, HIT, paper, radius, space, type } from '../theme.ts';
import { tutorVoiceLabel } from '../tutor/tutorVoice.ts';
import { practiceForecast } from '../onboarding/plan.ts';

// A design fixture, never an account or a completed eligibility answer. Every
// mutation is inert; no adapter import, network call or persistent store exists.
const unavailable = async (): Promise<AuthResult> => ({ ok: false, message: 'Screen preview only. No account was created or changed.' });
const previewAdapter: AuthAdapter = {
  kind: 'mock',
  getSession: async () => null,
  onAuthStateChange: () => () => {},
  signUpWithPassword: unavailable,
  signInWithPassword: unavailable,
  signInWithGoogle: unavailable,
  signInWithApple: unavailable,
  sendPasswordReset: unavailable,
  completePasswordReset: unavailable,
  reauthenticateForDeletion: unavailable,
  deleteAccount: unavailable,
  signOut: async () => {},
  getAccessToken: async () => null,
};
const previewDay = '2026-10-10' as DayKey;
const previewStreak = guestStreak([previewDay], previewDay)!;
const previewRows: InvestmentRow[] = [
  { key: 'streak', icon: 'flame', text: 'Day 1 of your streak' },
  { key: 'replies', icon: 'chat', text: 'Your first French reply' },
  { key: 'plan', icon: 'calendar', text: 'Your personal plan: 10 minutes a day' },
  { key: 'tutor', icon: 'user', text: `Your AI tutor: ${tutorVoiceLabel(null)}` },
];
type Preview = 'signup' | 'streak' | 'saved' | 'account' | 'select';

/** Separate development build only: renders real screens with synthetic data. */
export function OnboardingPreview() {
  const [screen, setScreen] = useState<Preview>('signup');
  const insets = useSafeAreaInsets();
  const select = () => setScreen('select');
  return <AuthProvider adapter={previewAdapter}>
    <View style={st.root}>
      {screen === 'signup' && <SignUpScreen onBack={select} onSignIn={select} />}
      {screen === 'streak' && <Screen ground={colour.sun} footer={<PillButton label="Start Your French" onPress={() => setScreen('saved')} />}>
        <View style={[readingColumn, st.story]}>
          <DayOne streak={previewStreak} moment="preview-streak" />
          <Text style={[type.heading, st.ink, { textAlign: 'center' }]}>Practice Everyday to Carry on the Streak</Text>
          <WeekStrip week={previewStreak.week} today={previewDay} moment="preview-streak" />
        </View>
      </Screen>}
      {screen === 'saved' && <Screen footer={<PillButton label="Save my progress" onPress={() => setScreen('signup')} />}>
        <View style={[readingColumn, st.story]}>
          <Text accessibilityRole="header" style={[type.title, st.ink]}>Save your progress</Text>
          <InvestmentList rows={previewRows} />
          <Text style={[type.body, st.ink]}>{practiceForecast(10)!.line}</Text>
        </View>
      </Screen>}
      {screen === 'account' && <AccountWelcome onDone={select} />}
      {screen === 'select' && <Screen>
        <View style={[readingColumn, { gap: space(4) }]}>
          <Text accessibilityRole="header" style={[type.title, st.ink]}>Screen preview</Text>
          <Text style={[type.body, st.ink]}>Synthetic examples. Account buttons cannot contact a service or save an account.</Text>
          <PillButton label="Signup" onPress={() => setScreen('signup')} />
          <PillButton label="Streak" onPress={() => setScreen('streak')} />
          <PillButton label="Saved" onPress={() => setScreen('saved')} />
          <PillButton label="Account" onPress={() => setScreen('account')} />
        </View>
      </Screen>}
      {screen !== 'select' && <Press accessibilityRole="button" accessibilityLabel="Screen preview. Choose another synthetic screen" onPress={select} frame={[st.badgeFrame, { top: insets.top + space(2) }]} style={st.badge}>
        <Text style={[type.small, st.ink]}>Screen preview</Text>
      </Press>}
    </View>
  </AuthProvider>;
}

const st = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
  story: { flex: 1, justifyContent: 'center', gap: space(5) },
  ink: { color: paper.ink },
  badgeFrame: { position: 'absolute', right: space(4) },
  badge: { minHeight: HIT, paddingHorizontal: space(3), justifyContent: 'center', borderRadius: radius.pill, backgroundColor: paper.card },
});
