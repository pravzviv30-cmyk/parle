/**
 * The front door, and now the only one.
 *
 * The app used to open three times. A device-level splash said "Welcome to
 * Luvani!" and then spent a second page explaining what Luvani is; the auth
 * welcome said "Find your voice in French" and made the same promise in
 * different words; and TutorIntro introduced the tutor a third time once the
 * account existed. None of the three said the tutor is AI. This screen is what
 * is left of all of them before an account exists: one scene, one promise, one
 * honest sentence about what is answering, and the two ways in.
 *
 * It lives in `onboarding/` rather than in `auth/` on purpose. It is the
 * product's introduction, which happens to be shown while signed out;
 * `AuthFlow` decides *when* it appears and owns nothing it says.
 *
 * ## The scene, and why it is an import rather than a copy
 *
 * The splash drew its own animated cafe inline: steam on a 2600ms loop,
 * bubbles arriving 180ms apart, and a hand-rolled reduce-motion branch. That
 * copy is dead here rather than reproduced, because the same drawing already
 * lives in `illustrations/scenes/cafe.tsx`, where the durations come from
 * `illustrations/timing.ts` and the final-frame rule comes from
 * `useSceneMotion`. Retyping `2600` into this file would fork the motion
 * vocabulary the splash existed to establish — and it would bring back the bug
 * the module already fixed, where the splash's steam drew 23% thinner than the
 * cup it rose from because a moving layer had its own scale.
 *
 * So: reduce motion still renders the final frame rather than nothing, the
 * loop still rests in the middle of its travel, and nobody here can change a
 * duration by accident.
 *
 * ## Two smaller decisions worth naming
 *
 * The body scrolls, because the frame it sits in scrolls: nothing here caps
 * font scaling, so a learner with large text set gets large text, and a promise
 * that cannot be reached on a small phone at that size is a promise they never
 * read. `ScrollScreen center` pins the short hero to the middle and the two ways
 * in sit in the frame's footer, outside the scroll, where the notch is paid once.
 *
 * The scene is not paused. `paused` exists for scenes on a tab that stays
 * mounted after the learner leaves it; this screen unmounts the moment they
 * choose a way in, so there is nothing to pause.
 *
 * The subline names the DEFAULT persona, and it is the one screen in the app
 * entitled to. It is read before an account exists, so there is no record to
 * ask who this learner chose, and the default is genuinely who answers if they
 * never choose. It says so by handing `DEFAULT_TUTOR_PERSONA` over in as many
 * words: every other first-run page reads `tutorPersonaOf(existing)`, and the
 * one exception should be visible here rather than hidden in the copy module.
 */

import { View, Text, StyleSheet } from 'react-native';
import { paper, space, type } from '../theme.ts';
import { PillButton, GhostButton } from '../components.tsx';
import { ScrollScreen } from '../layout.tsx';
import { HeroCafe } from '../illustrations.tsx';
import { DEFAULT_TUTOR_PERSONA } from '../tutor/tutorName.ts';
import { WELCOME_SUBLINE } from './disclosure.ts';

export function WelcomeScreen({
  onCreateAccount,
  onSignIn,
}: {
  onCreateAccount: () => void;
  onSignIn: () => void;
}) {
  return (
    <ScrollScreen
      center
      footer={
        <View style={st.ways}>
          <PillButton label="Create account" onPress={onCreateAccount} />
          <GhostButton label="I already have an account" onPress={onSignIn} color={paper.ink} />
        </View>
      }
    >
      <View style={st.hero}>
        <HeroCafe width={230} />
        <Text accessibilityRole="header" style={st.title}>
          Find your voice in French
        </Text>
        <Text style={st.subline}>{WELCOME_SUBLINE(DEFAULT_TUTOR_PERSONA)}</Text>
      </View>
    </ScrollScreen>
  );
}

const st = StyleSheet.create({
  hero: { alignItems: 'center', justifyContent: 'center' },
  title: { ...type.display, color: paper.ink, textAlign: 'center', marginTop: space(6) },
  subline: { ...type.body, color: paper.inkSoft, textAlign: 'center', marginTop: space(3) },
  ways: { gap: space(3) },
});
