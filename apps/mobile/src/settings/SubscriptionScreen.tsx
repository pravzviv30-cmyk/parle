/**
 * Subscription: the plan, the speaking time in words, and what the store can do
 * about it (P2 · Luvani, 2026-10-19). A root stack sibling pushed from
 * Settings' and Profile's plan rows.
 *
 * ## Unknown is never Free
 *
 * When the server cannot be reached, `subscriptionView` answers `unknown` and
 * this screen says it could not check, offers Try again, and still draws Manage
 * and Restore so a learner who cannot see their plan can still reach the store.
 * It never names a plan it has not been told, and above all never says Free.
 *
 * ## No count, no date
 *
 * The plan's period is a distance in words and the speaking time a band, as
 * `purchases/planStatus.ts` hands them over (F377, F541). There is no price
 * row: nothing on the phone says which of the store's products this account
 * holds, and a price for the wrong one would be the first lie on the page.
 *
 * ## The store, asked once at a time
 *
 * The same rule Settings keeps: Manage reports only a store that could not
 * finish, a dismissed sheet says nothing, and Restore says what the store
 * found (`subscriptionRestore.ts`): only a granted restore
 * says the purchase is here, nothing found says so, and a grant re-reads the
 * plan. Present only when the store answered with a real product, which keeps
 * it honest in Expo Go, on the web and on a build with no keys.
 */

import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { Press } from '../components.tsx';
import { ScrollScreen, ScreenHeader } from '../layout.tsx';
import { radius, space, type } from '../theme.ts';
import { useAuth } from '../auth/useAuth.tsx';
import { useMainAppearance } from '../main/MainAppearance.tsx';
import { PlanCard } from '../profile/PlanCard.tsx';
import { purchases, type StoreOffering } from '../purchases/adapter.ts';
import { restorePurchases } from '../purchases/restore.ts';
import { PURCHASE_TROUBLE, RESTORE_BUSY } from '../purchases/paywallView.ts';
import { RESTORE_ROW, subscriptionGroup, type SubscriptionAction } from '../purchases/subscription.ts';
import { scopeGeneration } from '../storage/scope.ts';
import { SettingsAppearance } from './SettingsAppearance.tsx';
import { SettingsGroup } from './SettingsGroup.tsx';
import { SettingsRow } from './SettingsRow.tsx';
import { restoreResult } from './subscriptionRestore.ts';
import { usePlanStatus } from './usePlanStatus.ts';
import {
  CANCEL_FOOTER,
  COMPARE_PLANS_ROW,
  MANAGE_APPLE_ROW,
  NEXT_RENEWAL_ROW,
  PLAN_CHECKING,
  PLAN_RETRY,
  SEE_PLANS_ROW,
  SUBSCRIPTION_TITLE,
  subscriptionView,
} from './profileView.ts';

export function SubscriptionScreen() {
  const { colors } = useMainAppearance();
  const nav = useNavigation<{ goBack: () => void; canGoBack: () => boolean; navigate: (screen: string, params?: object) => void }>();
  const { user } = useAuth();
  const plan = usePlanStatus();
  const view = subscriptionView(plan.view);
  const [offering, setOffering] = useState<StoreOffering | null>(null);
  const [storeBusy, setStoreBusy] = useState<'none' | SubscriptionAction>('none');
  const [storeMessage, setStoreMessage] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      if (user) {
        void purchases
          .offering(user.id)
          .then((next) => { if (!cancelled) setOffering(next); })
          .catch(() => {
            // No store, no store rows.
          });
      }
      return () => { cancelled = true; };
    }, [user]),
  );

  const store = offering === null ? null : subscriptionGroup(offering);
  const storeLine = storeBusy === 'restore' ? RESTORE_BUSY : storeMessage;

  const askStore = (action: SubscriptionAction) => {
    if (!user || storeBusy !== 'none') return;
    const owner = scopeGeneration();
    setStoreBusy(action);
    setStoreMessage(null);
    const asked: Promise<string | null> =
      action === 'manage'
        ? purchases.manage(user.id).then((result) => (result.ok || result.cancelled ? null : PURCHASE_TROUBLE))
        : restorePurchases(user.id).then((outcome) => {
            const result = restoreResult(outcome);
            if (result.refreshPlan && owner === scopeGeneration()) plan.retry();
            return result.message;
          });
    void asked
      .then((message) => { if (owner === scopeGeneration()) setStoreMessage(message); })
      .catch(() => { if (owner === scopeGeneration()) setStoreMessage(PURCHASE_TROUBLE); })
      .finally(() => { if (owner === scopeGeneration()) setStoreBusy('none'); });
  };

  const seePlans = () => nav.navigate('Wall', { entry: 'settings' });

  return (
    <SettingsAppearance>
    <ScrollScreen
      ground={colors.background}
      bottom="inset"
      header={<ScreenHeader back={{ onPress: () => (nav.canGoBack() ? nav.goBack() : nav.navigate('Settings')), label: 'Back to Settings' }} title={SUBSCRIPTION_TITLE} ink={colors.text} muted={colors.muted} backAppearance={{ disc: colors.surface, mark: colors.text }} />}
    >
      {view.kind === 'checking' ? (
        <Text accessibilityLiveRegion="polite" style={[type.body, { color: colors.muted }]}>{PLAN_CHECKING}</Text>
      ) : null}

      {view.kind === 'unknown' ? (
        <View style={st.unknown}>
          <View style={[st.notice, { backgroundColor: colors.inset }]} accessibilityLiveRegion="polite">
            <Text accessibilityRole="header" style={[type.bodyStrong, { color: colors.text }]}>{view.title}</Text>
            <Text style={[type.body, { color: colors.text }]}>{view.body}</Text>
          </View>
          <Press haptic="selection" onPress={plan.retry} accessibilityRole="button" accessibilityLabel={PLAN_RETRY} style={[st.retry, { backgroundColor: colors.inset }]}>
            <Text style={[type.button, { color: colors.text, textAlign: 'center' }]}>{PLAN_RETRY}</Text>
          </Press>
        </View>
      ) : null}

      {view.kind === 'free' || view.kind === 'paid' ? (
        <View>
          <Text accessibilityRole="header" style={[type.title, { color: colors.text }]}>{view.title}</Text>
          <Text style={[type.body, { color: colors.muted, marginTop: space(1) }]}>{view.period}</Text>
          <PlanCard band={view.band} period={view.period} />
        </View>
      ) : null}

      {view.kind === 'paid' ? (
        <SettingsGroup>
          <SettingsRow first label={NEXT_RENEWAL_ROW} sub={view.period} />
        </SettingsGroup>
      ) : null}

      <SettingsGroup footer={view.kind === 'paid' ? CANCEL_FOOTER : undefined} style={st.last}>
        {storeLine !== null && <Text accessibilityLiveRegion="polite" style={[type.small, st.storeLine, { color: colors.muted }]}>{storeLine}</Text>}
        {store !== null && view.kind !== 'free' && view.kind !== 'checking' ? (
          <SettingsRow first={storeLine === null} label={MANAGE_APPLE_ROW} onPress={() => askStore('manage')} />
        ) : null}
        <SettingsRow
          first={storeLine === null && (store === null || view.kind === 'free' || view.kind === 'checking')}
          label={view.kind === 'free' ? SEE_PLANS_ROW : COMPARE_PLANS_ROW}
          onPress={seePlans}
        />
        {store !== null ? <SettingsRow label={RESTORE_ROW} onPress={() => askStore('restore')} /> : null}
      </SettingsGroup>
    </ScrollScreen>
    </SettingsAppearance>
  );
}

const st = StyleSheet.create({
  unknown: { gap: space(4) },
  notice: { borderRadius: radius.tile, padding: space(4), gap: space(1) },
  retry: { minHeight: 56, borderRadius: radius.feature, justifyContent: 'center', paddingHorizontal: space(4) },
  last: { paddingBottom: space(6) },
  storeLine: { paddingHorizontal: space(4), paddingTop: space(3) },
});
