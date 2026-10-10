/**
 * The age gate, reached the second way.
 *
 * A session ended because the learner said in a scene that they are under
 * thirteen, `profile/store.ts` wrote that down, and this is what the next
 * launch shows. It is the same gate as onboarding's first page: the same two
 * pills, the same refusal, the same rule that the confirmation is the only way
 * past. What changes is two lines of copy and everything that is NOT here.
 *
 * Nothing is asked twice. No name, no goal and no back chevron, because there
 * is nothing behind this and nothing else to
 * answer. The learner keeps their name, their history and everything the tutor
 * knows about them, and `AGE_RETURN_SUB` says so out loud, because that is the
 * one thing anyone meeting this boundary actually wants to know.
 *
 * What the copy will not do is say what happened. A child who meets this must
 * not be made to feel caught, and the classifier is sometimes wrong, so an
 * adult reading an accusation over a misheard sentence would be worse. The
 * words are in `answers.ts` with that argument written beside them; this file
 * is layout.
 *
 * It sits inside the shared onboarding frame. Its single-step progress comes
 * from the shared route model, because only eligibility is being reconfirmed.
 * Both answers ride in the footer, the quiet no above the one ink pill. The title
 * is a working title on paper, and one quiet line says how much is being asked,
 * in words that are true whichever answer comes (F636). It leaves with the
 * answers, so once refused the refusal is the only line under the sub.
 * The refusal, when it comes, is the shared `AgeRefusal`: the same spoken full
 * stop and the same sign-out exit the first-run gate shows, so a refused
 * learner meets one thing on both doors rather than two.
 */

import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { paper, space, type } from '../theme.ts';
import { PillButton, GhostButton, QuietLine } from '../components.tsx';
import { OnboardingLayout } from './OnboardingLayout.tsx';
import { onboardingProgress } from './onboardingProgress.ts';
import { AGE_CONFIRM, AGE_DENY, AGE_RETURN_NOTE, AGE_RETURN_SUB, AGE_RETURN_TITLE, ageGate } from './answers.ts';
import { AgeRefusal } from './AgeRefusal.tsx';

export function AgeGateScreen({ onPass, onSignOut }: { onPass: () => void; onSignOut: () => void }) {
  // What they said on this pass. Null until they answer either way, so the
  // refusal only appears once it has been earned.
  const [oldEnough, setOldEnough] = useState<boolean | null>(null);
  const passed = useRef(false);
  useEffect(() => {
    passed.current = false;
  }, []);
  const refusal = oldEnough === false ? ageGate(false).refusal : null;

  // Gone once they have said they are younger. A refusal with the way through
  // still sitting under it is not a gate, it is a suggestion. Closing the app
  // and coming back offers the question again, which is the escape hatch for a
  // mis-tap and is deliberately not a button.
  const answers = oldEnough !== false && (
    <View style={st.answers}>
      <GhostButton label={AGE_DENY} onPress={() => setOldEnough(false)} />
      <PillButton
        label={AGE_CONFIRM}
        onPress={() => {
          if (passed.current) return;
          passed.current = true;
          setOldEnough(true);
          onPass();
        }}
      />
    </View>
  );

  return (
    <OnboardingLayout page="age" progress={onboardingProgress({ page: 'age', eligibilityOnly: true })} footer={answers || undefined}>
      <Text accessibilityRole="header" style={st.question}>
        {AGE_RETURN_TITLE}
      </Text>
      <Text style={st.sub}>{AGE_RETURN_SUB}</Text>
      {oldEnough !== false && (
        <View style={st.note}>
          <QuietLine>{AGE_RETURN_NOTE}</QuietLine>
        </View>
      )}
      {refusal !== null && <AgeRefusal text={refusal} onSignOut={onSignOut} />}
    </OnboardingLayout>
  );
}

const st = StyleSheet.create({
  question: { ...type.title, color: paper.ink, marginTop: space(3), textAlign: 'center' },
  sub: { ...type.body, color: paper.inkSoft, marginTop: space(2), textAlign: 'center' },
  note: { marginTop: space(3) },
  answers: { gap: space(3), alignItems: 'stretch' },
});
