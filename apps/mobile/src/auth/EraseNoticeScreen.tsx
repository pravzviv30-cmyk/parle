/**
 * The screen a learner meets after deleting an account this device could not
 * finish erasing — F496.
 *
 * `Gate` interposes it between the sign-out and the welcome, the same way it
 * interposes the reset screen on a recovery landing. It is one sentence and one
 * way forward, so it is built on the shared frame with the pill in the footer
 * and nothing else on the page competing with the thing being said.
 *
 * The sentence is drawn by `TroubleLine`, which is the app's one announced
 * refusal: `role="alert"` for the web, `accessibilityLiveRegion="polite"` for
 * Android, and `announceForAccessibility` for iOS, which has neither. A warning
 * about a device somebody is about to hand over is exactly the kind that must
 * not be pixels only. `strong` is the delete sheet's weight, and this is the
 * other half of the delete path rather than a row in a list.
 *
 * There is no back arrow, because there is nothing behind it: the account is
 * gone and the tree it belonged to has been unmounted. The pill is the only
 * control, and it leads to the welcome.
 */

import { Text } from 'react-native';
import { paper, type } from '../theme.ts';
import { PillButton } from '../components.tsx';
import { ScrollScreen } from '../layout.tsx';
import { TroubleLine } from '../settings/TroubleLine.tsx';
import { ERASE_NOTICE_BODY, ERASE_NOTICE_DISMISS, ERASE_NOTICE_TITLE } from './eraseNotice.ts';

export function EraseNoticeScreen({ onDismiss }: { onDismiss: () => void }) {
  return (
    <ScrollScreen footer={<PillButton label={ERASE_NOTICE_DISMISS} onPress={onDismiss} />}>
      <Text accessibilityRole="header" style={[type.display, { color: paper.ink }]}>
        {ERASE_NOTICE_TITLE}
      </Text>
      <TroubleLine message={ERASE_NOTICE_BODY} strong />
    </ScrollScreen>
  );
}
