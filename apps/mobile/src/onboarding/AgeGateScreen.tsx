/**
 * The age gate, reached the second way.
 *
 * A session ended because the learner said in a scene that they are under
 * thirteen, `profile/store.ts` wrote that down, and this is what the next
 * launch shows. It is the same gate as onboarding's first page: the same two
 * pills, the same refusal, the same rule that the confirmation is the only way
 * past. What changes is two lines of copy and everything that is NOT here.
 *
 * Nothing is asked twice. No name, no goal, no pages, no progress dots, and no
 * back chevron, because there is nothing behind this and nothing else to
 * answer. The learner keeps their name, their history and everything the tutor
 * knows about them, and `AGE_RETURN_SUB` says so out loud, because that is the
 * one thing anyone meeting this boundary actually wants to know.
 *
 * What the copy will not do is say what happened. A child who meets this must
 * not be made to feel caught, and the classifier is sometimes wrong, so an
 * adult reading an accusation over a misheard sentence would be worse. The
 * words are in `answers.ts` with that argument written beside them; this file
 * is layout.
 */

import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { paper, space, type } from '../theme.ts';
import { PillButton, GhostButton } from '../components.tsx';
import { OnboardCake } from '../illustrations.tsx';
import { AGE_CONFIRM, AGE_DENY, AGE_RETURN_SUB, AGE_RETURN_TITLE, ageGate } from './answers.ts';

export function AgeGateScreen({ onPass }: { onPass: () => void }) {
  const insets = useSafeAreaInsets();
  // What they said on this pass. Null until they answer either way, so the
  // refusal only appears once it has been earned.
  const [oldEnough, setOldEnough] = useState<boolean | null>(null);
  const refusal = oldEnough === false ? ageGate(false).refusal : null;

  return (
    <View style={[st.root, { paddingTop: insets.top + space(6), paddingBottom: insets.bottom + space(6) }]}>
      <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>
        <View style={st.art}>
          <OnboardCake width={170} />
        </View>
        <Text accessibilityRole="header" style={st.question}>
          {AGE_RETURN_TITLE}
        </Text>
        <Text style={st.sub}>{AGE_RETURN_SUB}</Text>
        {refusal !== null && (
          <Text accessibilityLiveRegion="polite" style={st.refusal}>
            {refusal}
          </Text>
        )}
        <View style={st.secondary}>
          <GhostButton label={AGE_DENY} onPress={() => setOldEnough(false)} />
        </View>
      </ScrollView>

      {/* Gone once they have said they are younger. A refusal with the way
          through still sitting under it is not a gate, it is a suggestion.
          Closing the app and coming back offers the question again, which is
          the escape hatch for a mis-tap and is deliberately not a button. */}
      {oldEnough !== false && (
        <PillButton
          label={AGE_CONFIRM}
          onPress={() => {
            setOldEnough(true);
            onPass();
          }}
        />
      )}
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: paper.ground, paddingHorizontal: space(6) },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingVertical: space(4) },
  art: { alignItems: 'center', marginBottom: space(5) },
  question: { ...type.display, color: paper.ink, textAlign: 'center' },
  sub: { ...type.body, color: paper.inkSoft, textAlign: 'center', marginTop: space(2) },
  refusal: { ...type.bodyStrong, color: paper.ink, textAlign: 'center', marginTop: space(5) },
  secondary: { marginTop: space(5) },
});
