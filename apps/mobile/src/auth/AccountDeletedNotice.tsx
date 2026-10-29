/**
 * The confirmation after a complete account deletion. F914.
 *
 * Same shape as `EraseNoticeScreen`: a working title, one announced strong
 * line, and the way on pinned in the footer. On iOS and Android one more
 * control opens the store's own subscriptions page, because that is the one
 * thing the learner may still need to do and Luvani cannot do it for them. On
 * the web there is no store to pick truthfully, so no button is drawn and the
 * line names both. Copy, URLs and the platform choice are in `accountDeleted.ts`.
 *
 * Nothing is stored. No back arrow: the signed-in tree is gone.
 */

import { useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { paper, space, type } from '../theme.ts';
import { OutlineButton, PillButton } from '../components.tsx';
import { ScrollScreen } from '../layout.tsx';
import { TroubleLine } from '../settings/TroubleLine.tsx';
import { openLink } from '../settings/links.ts';
import { LINK_TROUBLE } from '../settings/sections.ts';
import {
  ACCOUNT_DELETED_BODY,
  ACCOUNT_DELETED_DISMISS,
  ACCOUNT_DELETED_STORE,
  ACCOUNT_DELETED_TITLE,
  storeSubscriptionsUrl,
} from './accountDeleted.ts';

export function AccountDeletedNotice({ onDismiss }: { onDismiss: () => void }) {
  const url = storeSubscriptionsUrl(Platform.OS);
  const [trouble, setTrouble] = useState<string | null>(null);
  return (
    <ScrollScreen footer={<PillButton label={ACCOUNT_DELETED_DISMISS} onPress={onDismiss} />}>
      <Text accessibilityRole="header" style={[type.title, { color: paper.ink }]}>
        {ACCOUNT_DELETED_TITLE}
      </Text>
      <TroubleLine message={ACCOUNT_DELETED_BODY} strong />
      {url === null ? null : (
        <View style={{ marginTop: space(6) }}>
          <OutlineButton
            label={ACCOUNT_DELETED_STORE}
            onPress={() => {
              setTrouble(null);
              void openLink(url).then((outcome) => {
                if (outcome === 'failed') setTrouble(LINK_TROUBLE);
              });
            }}
          />
          {trouble === null ? null : (
            <Text accessibilityLiveRegion="polite" style={[type.small, { color: paper.ink, marginTop: space(4) }]}>
              {trouble}
            </Text>
          )}
        </View>
      )}
    </ScrollScreen>
  );
}
