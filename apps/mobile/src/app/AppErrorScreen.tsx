/**
 * What a learner sees once the app error boundary has caught a throw: a title,
 * one plain sentence and one way back (F794).
 *
 * Drawn the way the door's other notices are, EraseNoticeScreen and
 * DeletionPendingNotice: a title, the line said through TroubleLine (which
 * also tells VoiceOver, since this replaces whatever was on screen), and the
 * one pill at the foot. No header and no back arrow, because there is nothing
 * behind it to go back to.
 *
 * Made only of parts that need nothing below the boundary: the safe-area
 * insets from App, the theme and the shared frame, line and pill. No
 * navigation, auth, profile or store, because whichever of those broke is
 * still broken while this is on screen, and a way back that throws takes the
 * app down after all. It holds no launch and releases no native launch: the
 * launch is drawn over it until it is done, then fades onto it like any other
 * screen.
 *
 * It is handed the way back and never the error, so a raw error cannot reach
 * a learner. Its words are in appErrorCopy.ts.
 */

import { Text } from 'react-native';
import { PillButton } from '../components.tsx';
import { ScrollScreen } from '../layout.tsx';
import { TroubleLine } from '../settings/TroubleLine.tsx';
import { paper, type } from '../theme.ts';
import { APP_ERROR_BODY, APP_ERROR_TITLE, APP_ERROR_TRY_AGAIN } from './appErrorCopy.ts';

export function AppErrorScreen({ onTryAgain }: { onTryAgain: () => void }) {
  return (
    <ScrollScreen footer={<PillButton label={APP_ERROR_TRY_AGAIN} onPress={onTryAgain} />}>
      <Text accessibilityRole="header" style={[type.title, { color: paper.ink }]}>{APP_ERROR_TITLE}</Text>
      <TroubleLine message={APP_ERROR_BODY} strong />
    </ScrollScreen>
  );
}
