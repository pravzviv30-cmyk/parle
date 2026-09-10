/**
 * One refusal, drawn where it happened and said out loud.
 *
 * Settings is the screen where the most things can fail for reasons that are
 * not the learner's fault: the phone will not open its own settings, no mail
 * app is set up, the disk refuses a consent write, the export cannot be built.
 * Every one of those used to be a bare `Text`, and two of them were the whole
 * of F489 and F491 between them.
 *
 * ## What a bare Text gets wrong
 *
 * It changes pixels and nothing else. VoiceOver and TalkBack say nothing, so a
 * learner who cannot see the change is left tapping a control that keeps not
 * working, which is the dead switch F239 refused arriving by a quieter route.
 * `components.tsx`'s `Field` already had this right for its own error line, and
 * `surfaceContract.test.ts` already holds it there; this is the same three
 * mechanisms for a line that has no field to belong to:
 *
 * - `role="alert"` for the web,
 * - `accessibilityLiveRegion="polite"` for Android,
 * - and `announceForAccessibility` for iOS, which has neither.
 *
 * Polite rather than assertive, and it is a deliberate choice. A refusal here
 * is never urgent: nothing was lost and nothing is running out. Assertive would
 * cut across whatever the learner was already reading to say so.
 *
 * The announcement lives in this file rather than in the screen because the
 * screen may hold no effect of its own: `settings/phone.test.ts` pins Settings
 * to one `useFocusEffect` and no `useEffect`, so that what the operating system
 * said is read in exactly one place and which read wins is never a guess.
 *
 * ## The colour
 *
 * `signal.correspondance` is a word colour, not a mark colour: DESIGN.md
 * records it clearing the 4.5 text floor on the ground and on a card. These are
 * sentences a learner has to read and act on, so they are held to the text
 * floor and never to the 3 a dot would be allowed.
 */

import { useEffect } from 'react';
import { AccessibilityInfo, Platform, Text } from 'react-native';
import { signal, space, type } from '../theme.ts';

export function TroubleLine({
  message,
  strong = false,
}: {
  message: string;
  /**
   * Body weight rather than the small print, for the delete sheet.
   *
   * A refusal listed inside a card sits among rows set in `small`, and matching
   * them is what keeps it reading as part of that group. The delete sheet is
   * not a list: it is one question filling the screen, and its refusal is set
   * at body weight so it is not the smallest thing on the most consequential
   * page in the app.
   */
  strong?: boolean;
}) {
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    AccessibilityInfo.announceForAccessibility(message);
  }, [message]);

  return (
    <Text
      role="alert"
      accessibilityLiveRegion="polite"
      style={[
        strong ? type.bodyStrong : type.small,
        { color: signal.correspondance },
        strong ? { marginTop: space(4) } : { marginBottom: space(3) },
      ]}
    >
      {message}
    </Text>
  );
}
