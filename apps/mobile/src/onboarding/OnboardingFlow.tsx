/**
 * Onboarding, one gentle question per page: name, age, why.
 *
 * Three pages, progress dots, a back chevron, and nothing to fail. Option
 * pages advance on tap; the name page's Continue is always live, because the
 * name is encouraged and never required. A learner migrated from the
 * pre-account era arrives with `existing` set and their old answers
 * pre-selected, so they are asked only what is new.
 *
 * What used to be here and is not any more: a typed date of birth, and the
 * daily goal. The date became one confirmation, because the only thing the
 * product needs to know is that the learner is thirteen, and the goal moved to
 * a Profile row, because nothing on the way to a first conversation should be
 * a preference. Both changes are the same idea: ask less before the value.
 *
 * Every rule this file used to hold now lives in `answers.ts` and `age.ts`,
 * where a test can reach it. What is left here is layout.
 */

import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { paper, space, type, HIT } from '../theme.ts';
import { PillButton, GhostButton, OptionCard, Field, ProgressDots, ChevronLeft } from '../components.tsx';
import { OnboardWave, OnboardCake, OnboardSuitcase } from '../illustrations.tsx';
import type { StoredProfile } from '../profile/store.ts';
import { TUTOR_NAME } from '../tutor/tutorName.ts';
import {
  AGE_CONFIRM,
  AGE_DENY,
  AGE_QUESTION,
  AGE_SUB,
  MOTIVATIONS,
  NAME_QUESTION,
  NAME_SKIP_HINT,
  PAGES,
  WHY_QUESTION,
  WHY_SKIP,
  ageGate,
  answersFrom,
  pageBefore,
  type OnboardingAnswers,
  type Page,
} from './answers.ts';
import { trackProductEvent } from '../analytics/track.ts';

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
  const [motivation] = useState<string | null>(existing?.motivation ?? null);
  // What the learner said about their age on this pass. Null until they answer
  // either way, so the refusal only appears once it has been earned.
  const [oldEnough, setOldEnough] = useState<boolean | null>(
    existing?.ageConfirmed === true ? true : null,
  );

  const index = PAGES.indexOf(page);
  const previous = pageBefore(page);
  const refusal = oldEnough === false ? ageGate(false).refusal : null;

  const finish = (chosen: string | null) => {
    void trackProductEvent({
      name: 'onboarding_completed',
      properties: { personalisedGreeting: name.trim().length > 0, motivationAnswered: chosen !== null },
    });
    onDone(answersFrom({ name, ageConfirmed: oldEnough === true, motivation: chosen }));
  };

  const confirmAge = () => {
    setOldEnough(true);
    setPage('why');
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      enabled={Platform.OS !== 'web'}
    >
      <View style={[st.root, { paddingTop: insets.top + space(3), paddingBottom: insets.bottom + space(6) }]}>
        <View style={st.topRow}>
          {previous !== null ? (
            <Pressable
              onPress={() => setPage(previous)}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={st.back}
            >
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
              <Text style={st.question}>{NAME_QUESTION}</Text>
              <Text style={st.sub}>{`${TUTOR_NAME} greets you by name.`}</Text>
              <View style={{ marginTop: space(6) }}>
                <Field
                  value={name}
                  onChangeText={setName}
                  placeholder="Your name"
                  autoCapitalize="words"
                  autoFocus={Platform.OS === 'web'}
                  maxLength={40}
                  returnKeyType="done"
                  onSubmitEditing={() => setPage('age')}
                />
              </View>
              <Text style={st.hint}>{NAME_SKIP_HINT}</Text>
            </>
          )}

          {page === 'age' && (
            <>
              <View style={st.art}>
                <OnboardCake width={170} />
              </View>
              <Text style={st.question}>{AGE_QUESTION}</Text>
              <Text style={st.sub}>{AGE_SUB}</Text>
              {refusal !== null && <Text style={st.refusal}>{refusal}</Text>}
              <View style={st.secondary}>
                <GhostButton label={AGE_DENY} onPress={() => setOldEnough(false)} />
              </View>
            </>
          )}

          {page === 'why' && (
            <>
              <View style={st.art}>
                <OnboardSuitcase width={170} />
              </View>
              <Text style={st.question}>{WHY_QUESTION}</Text>
              <View style={st.options}>
                {MOTIVATIONS.map((m) => (
                  <OptionCard
                    key={m.tag}
                    text={m.label}
                    gloss={m.gloss}
                    selected={motivation === m.tag}
                    onPress={() => finish(m.tag)}
                  />
                ))}
              </View>
              <View style={st.secondary}>
                <GhostButton label={WHY_SKIP} onPress={() => finish(null)} />
              </View>
            </>
          )}
        </ScrollView>

        {page === 'name' && <PillButton label="Continue" onPress={() => setPage('age')} />}
        {/* Gone once they have said they are younger. A refusal with the way
            through still sitting under it is not a gate, it is a suggestion:
            the previous shape showed the honest refusal text and left this pill
            rendered and enabled directly beneath it, one tap from walking
            straight past. Nothing is persisted, so closing the app and coming
            back offers the question again, which is the escape hatch for a
            mis-tap and is deliberately not a button. */}
        {page === 'age' && oldEnough !== false && <PillButton label={AGE_CONFIRM} onPress={confirmAge} />}
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
  hint: { ...type.small, color: paper.inkFaint, textAlign: 'center', marginTop: space(3) },
  refusal: { ...type.bodyStrong, color: paper.ink, textAlign: 'center', marginTop: space(5) },
  options: { gap: space(3), marginTop: space(6) },
  secondary: { marginTop: space(5) },
});
