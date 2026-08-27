/**
 * Onboarding, one page at a time: age, name, and who is answering.
 *
 * Three pages, progress dots, a back chevron, and nothing to fail. The name
 * page's Continue is always live, because a name is encouraged and never
 * required. A learner migrated from the pre-account era arrives with `existing`
 * set and their old answers pre-filled, so they are asked only what is new.
 *
 * What used to be here and is not any more: a typed date of birth, the daily
 * goal, and the reason they are learning French. The date became one
 * confirmation, because the only thing the product needs to know is that the
 * learner is thirteen; the goal moved to a Profile row, because nothing on the
 * way to a first conversation should be a preference; and the why page went
 * because nothing ever read the answer. All three are the same idea: ask less
 * before the value, and never ask a question the product does not use.
 *
 * The last page is the one addition. It is not a question — it is the app
 * saying, before the first scene rather than after it, that the tutor is AI,
 * that no person hears you, that the microphone is about to be asked for, and
 * that typing is there for anyone who cannot speak out loud. Every word of it
 * comes from `onboarding/disclosure.ts`, which is also where the welcome and
 * TutorIntro get theirs, so the three cannot drift apart.
 *
 * Every rule this file used to hold now lives in `answers.ts`, where a test can
 * reach it. What is left here is layout.
 */

import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { paper, space, type, HIT } from '../theme.ts';
import { PillButton, GhostButton, Field, ProgressDots, ChevronLeft } from '../components.tsx';
import { OnboardWave, OnboardCake, SpeakBubbles } from '../illustrations.tsx';
import type { StoredProfile } from '../profile/store.ts';
import { TUTOR_NAME } from '../tutor/tutorName.ts';
import {
  AGE_CONFIRM,
  AGE_DENY,
  AGE_QUESTION,
  AGE_SUB,
  NAME_LABEL,
  NAME_QUESTION,
  NAME_SKIP_HINT,
  PAGES,
  ageGate,
  answersFrom,
  pageBefore,
  type OnboardingAnswers,
  type Page,
} from './answers.ts';
import {
  MEET_AI,
  MEET_MIC,
  MEET_MORE,
  MEET_PILL,
  MEET_PRIVACY,
  MEET_TITLE,
  MEET_TYPING,
} from './disclosure.ts';
import { trackProductEvent } from '../analytics/track.ts';

export function OnboardingFlow({
  existing,
  onDone,
}: {
  existing: StoredProfile | null;
  onDone: (answers: OnboardingAnswers) => void;
}) {
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState<Page>('age');
  const [name, setName] = useState(existing?.name ?? '');
  // What the learner said about their age on this pass. Null until they answer
  // either way, so the refusal only appears once it has been earned.
  const [oldEnough, setOldEnough] = useState<boolean | null>(
    existing?.ageConfirmed === true ? true : null,
  );

  const index = PAGES.indexOf(page);
  const previous = pageBefore(page);
  const refusal = oldEnough === false ? ageGate(false).refusal : null;

  const finish = () => {
    void trackProductEvent({
      name: 'onboarding_completed',
      properties: { personalisedGreeting: name.trim().length > 0 },
    });
    // Nothing asks why any more, so nothing here invents an answer. What it
    // does do is hand back whatever the record already carried: `completeProfile`
    // writes this field straight through, so a hardcoded null here would erase a
    // stored value on the one path that re-onboards an existing learner — a
    // pre-account record whose age was never confirmed. Nothing reads the field
    // today, which is exactly why deleting somebody's copy of it would go
    // unnoticed until something did.
    onDone(answersFrom({ name, ageConfirmed: oldEnough === true, motivation: existing?.motivation ?? null }));
  };

  const confirmAge = () => {
    setOldEnough(true);
    setPage('name');
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
          {/* The gate comes first, and deliberately before the name. Asking
              somebody's name and then turning them away takes a personal
              detail from a learner the product has already decided not to
              serve, and no amount of not persisting it makes that the right
              order to ask in. */}
          {page === 'age' && (
            <>
              <View style={st.art}>
                <OnboardCake width={170} />
              </View>
              <Text accessibilityRole="header" style={st.question}>
                {AGE_QUESTION}
              </Text>
              <Text style={st.sub}>{AGE_SUB}</Text>
              {refusal !== null && <Text style={st.refusal}>{refusal}</Text>}
              <View style={st.secondary}>
                <GhostButton label={AGE_DENY} onPress={() => setOldEnough(false)} />
              </View>
            </>
          )}

          {page === 'name' && (
            <>
              <View style={st.art}>
                <OnboardWave width={170} />
              </View>
              <Text accessibilityRole="header" style={st.question}>
                {NAME_QUESTION}
              </Text>
              <Text style={st.sub}>{`${TUTOR_NAME} greets you by name.`}</Text>
              <View style={{ marginTop: space(6) }}>
                {/* A visible label rather than a placeholder alone: a
                    placeholder disappears the moment somebody types, and it is
                    the only thing assistive tech had to go on here. */}
                <Field
                  label={NAME_LABEL}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  autoFocus={Platform.OS === 'web'}
                  maxLength={40}
                  returnKeyType="done"
                  onSubmitEditing={() => setPage('meet')}
                />
              </View>
              <Text style={st.hint}>{NAME_SKIP_HINT}</Text>
            </>
          )}

          {page === 'meet' && (
            <>
              <View style={st.art}>
                <SpeakBubbles width={150} />
              </View>
              <Text accessibilityRole="header" style={st.question}>
                {MEET_TITLE}
              </Text>
              <View style={st.lines}>
                <Text style={st.line}>{MEET_AI}</Text>
                <Text style={st.line}>{MEET_PRIVACY}</Text>
                <Text style={st.line}>{MEET_MIC}</Text>
                <Text style={st.line}>{MEET_TYPING}</Text>
              </View>
              <Text style={st.hint}>{MEET_MORE}</Text>
            </>
          )}
        </ScrollView>

        {/* Gone once they have said they are younger. A refusal with the way
            through still sitting under it is not a gate, it is a suggestion:
            the previous shape showed the honest refusal text and left this pill
            rendered and enabled directly beneath it, one tap from walking
            straight past. Nothing is persisted, so closing the app and coming
            back offers the question again, which is the escape hatch for a
            mis-tap and is deliberately not a button. */}
        {page === 'age' && oldEnough !== false && <PillButton label={AGE_CONFIRM} onPress={confirmAge} />}
        {page === 'name' && <PillButton label="Continue" onPress={() => setPage('meet')} />}
        {page === 'meet' && <PillButton label={MEET_PILL} onPress={finish} />}
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
  lines: { gap: space(3), marginTop: space(4) },
  line: { ...type.body, color: paper.inkSoft, textAlign: 'center' },
  secondary: { marginTop: space(5) },
});
