/**
 * Onboarding, one gentle question per page: name, birthday, why, how much.
 *
 * Four pages, progress dots, a back chevron, and nothing to fail. Option
 * pages advance on tap; typed pages validate only when Continue is pressed.
 * A learner migrated from the pre-account era arrives with `existing` set and
 * their old answers pre-selected — they are asked only what is new.
 */

import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { paper, space, type, HIT } from '../theme.ts';
import { PillButton, OptionCard, Field, ProgressDots, ChevronLeft } from '../components.tsx';
import { OnboardWave, OnboardCake, OnboardSuitcase, OnboardClock } from '../illustrations.tsx';
import type { OnboardingAnswers, StoredProfile } from '../profile/store.ts';

const MOTIVATIONS = [
  { tag: 'trip', label: 'A trip coming up', gloss: 'Order, ask, get around' },
  { tag: 'someone', label: 'Someone I love', gloss: 'Their language, your effort' },
  { tag: 'work', label: 'For work', gloss: 'Meetings, emails, career' },
  { tag: 'want', label: 'Because I want to', gloss: 'The best reason there is' },
] as const;

const GOALS = [
  { minutes: 5, label: 'Five minutes', gloss: 'A gentle start' },
  { minutes: 10, label: 'Ten minutes', gloss: 'The steady middle' },
  { minutes: 15, label: 'Fifteen minutes', gloss: 'Serious momentum' },
] as const;

const PAGES = ['name', 'dob', 'why', 'goal'] as const;
type Page = (typeof PAGES)[number];

/** Youngest learner the product is made for. */
const MIN_AGE = 13;

/** '12/05/1998' → '1998-05-12', or null when it is not a real date. */
export function isoFromDobInput(text: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text.trim());
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  const real =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day && year >= 1900;
  return real ? `${match[3]}-${match[2]}-${match[1]}` : null;
}

/** Whole years between the ISO birthday and now. Future birthdays go negative. */
export function ageOn(iso: string, now: Date): number {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  let age = now.getFullYear() - y;
  const beforeBirthday = now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d);
  if (beforeBirthday) age -= 1;
  return age;
}

/** Digits in, DD/MM/YYYY out — the slashes type themselves. */
function formatDobInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function OnboardingFlow({
  existing,
  onDone,
}: {
  existing: StoredProfile | null;
  onDone: (answers: OnboardingAnswers) => void;
}) {
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState<Page>('name');
  const [name, setName] = useState(existing?.name ?? '');
  const [dobText, setDobText] = useState('');
  const [dobError, setDobError] = useState<string | null>(null);
  const [motivation, setMotivation] = useState<string | null>(existing?.motivation ?? null);

  const index = PAGES.indexOf(page);

  const back = () => {
    if (index > 0) setPage(PAGES[index - 1]!);
  };

  const submitDob = () => {
    const iso = isoFromDobInput(dobText);
    if (iso === null || ageOn(iso, new Date()) > 120) {
      setDobError('That date does not look right yet. Day, month, then year.');
      return;
    }
    if (ageOn(iso, new Date()) < MIN_AGE) {
      setDobError('Parle is for learners thirteen and up.');
      return;
    }
    setDobError(null);
    setPage('why');
  };

  const finish = (dailyGoalMin: 5 | 10 | 15) => {
    const iso = isoFromDobInput(dobText);
    onDone({
      name: name.trim(),
      // The dob page validated already; this fallback only guards a dev jump.
      dob: iso ?? '2000-01-01',
      motivation: motivation ?? 'want',
      dailyGoalMin,
    });
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      enabled={Platform.OS !== 'web'}
    >
      <View style={[st.root, { paddingTop: insets.top + space(3), paddingBottom: insets.bottom + space(6) }]}>
        <View style={st.topRow}>
          {index > 0 ? (
            <Pressable onPress={back} accessibilityRole="button" accessibilityLabel="Back" style={st.back}>
              <ChevronLeft />
            </Pressable>
          ) : (
            <View style={st.back} />
          )}
          <ProgressDots total={PAGES.length} index={index} />
          <View style={st.back} />
        </View>

        <ScrollView contentContainerStyle={st.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {page === 'name' && (
            <>
              <View style={st.art}>
                <OnboardWave width={170} />
              </View>
              <Text style={st.question}>What should we call you?</Text>
              <Text style={st.sub}>Your tutor greets you by name.</Text>
              <View style={{ marginTop: space(6) }}>
                <Field
                  value={name}
                  onChangeText={setName}
                  placeholder="Your name"
                  autoCapitalize="words"
                  autoFocus={Platform.OS === 'web'}
                  maxLength={40}
                  returnKeyType="done"
                  onSubmitEditing={() => name.trim() !== '' && setPage('dob')}
                />
              </View>
            </>
          )}

          {page === 'dob' && (
            <>
              <View style={st.art}>
                <OnboardCake width={170} />
              </View>
              <Text style={st.question}>When were you born?</Text>
              <Text style={st.sub}>Parle is made for teens and adults.</Text>
              <View style={{ marginTop: space(6) }}>
                <Field
                  value={dobText}
                  onChangeText={(t) => {
                    setDobText(formatDobInput(t));
                    setDobError(null);
                  }}
                  placeholder="DD/MM/YYYY"
                  keyboardType="number-pad"
                  error={dobError}
                  center
                  maxLength={10}
                  returnKeyType="done"
                  onSubmitEditing={submitDob}
                />
              </View>
            </>
          )}

          {page === 'why' && (
            <>
              <View style={st.art}>
                <OnboardSuitcase width={170} />
              </View>
              <Text style={st.question}>Why are you learning French?</Text>
              <View style={st.options}>
                {MOTIVATIONS.map((m) => (
                  <OptionCard
                    key={m.tag}
                    text={m.label}
                    gloss={m.gloss}
                    selected={motivation === m.tag}
                    onPress={() => {
                      setMotivation(m.tag);
                      setPage('goal');
                    }}
                  />
                ))}
              </View>
            </>
          )}

          {page === 'goal' && (
            <>
              <View style={st.art}>
                <OnboardClock width={170} />
              </View>
              <Text style={st.question}>How much time each day?</Text>
              <Text style={st.sub}>Small and daily beats big and rare.</Text>
              <View style={st.options}>
                {GOALS.map((g) => (
                  <OptionCard key={g.minutes} text={g.label} gloss={g.gloss} onPress={() => finish(g.minutes)} />
                ))}
              </View>
            </>
          )}
        </ScrollView>

        {page === 'name' && (
          <PillButton label="Continue" onPress={() => setPage('dob')} disabled={name.trim() === ''} />
        )}
        {page === 'dob' && <PillButton label="Continue" onPress={submitDob} disabled={dobText.length < 10} />}
      </View>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: paper.ground, paddingHorizontal: space(6) },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space(2) },
  back: { minHeight: HIT, minWidth: HIT, alignItems: 'flex-start', justifyContent: 'center' },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingVertical: space(4) },
  art: { alignItems: 'center', marginBottom: space(5) },
  question: { ...type.display, color: paper.ink, textAlign: 'center' },
  sub: { ...type.body, color: paper.inkSoft, textAlign: 'center', marginTop: space(2) },
  options: { gap: space(3), marginTop: space(6) },
});
