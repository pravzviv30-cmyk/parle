import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { GhostButton, PillButton } from '../components.tsx';
import { paper, space, type } from '../theme.ts';

import { purchases, type StoreOffering } from './adapter.ts';
import {
  PURCHASE_READY,
  RESTORE_BUSY,
  inlinePaywall,
  restoreTrouble,
} from './paywallView.ts';
import { restorePurchases, settleStoreAction } from './restore.ts';
import { RESTORE_SUB } from './subscription.ts';

type Action = 'idle' | 'buying' | 'restoring' | 'ready';

/**
 * The inline paywall inside the out-of-minutes card.
 *
 * It never draws nothing once the store has answered (Stage 3). With an offer
 * it is the store's own words and price, with the renewal terms and the two
 * documents right beside the buy button. With no offer it says so plainly and
 * still offers a restore, because a learner who already paid needs that most on
 * the device where the store is slow. The screen's own Back sits outside this
 * block, so there is always a way out that costs nothing. Every word below is a
 * module's: `paywallView.ts`, `wall/wallCopy.ts` and `subscription.ts`.
 */
export function Paywall({ userId }: { userId: string }) {
  const nav = useNavigation<{ navigate: (screen: string) => void }>();
  const [offering, setOffering] = useState<StoreOffering>({ available: false });
  const [loaded, setLoaded] = useState(false);
  const [action, setAction] = useState<Action>('idle');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void purchases
      .offering(userId)
      .then((next) => {
        if (cancelled) return;
        setOffering(next);
        setLoaded(true);
      })
      .catch(() => { if (cancelled) return; setOffering({ available: false }); setLoaded(true); });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!loaded) return null;
  const view = inlinePaywall(offering);

  // Restoring goes through restore.ts, which the Settings row calls too, so the
  // two surfaces cannot drift about what a restore is. Buying differs only in
  // the question put to the store, and shares everything after the answer.
  const finish = async (kind: 'buying' | 'restoring') => {
    if (action !== 'idle') return;
    // Nothing to buy without an offer; the unavailable block draws no buy button.
    const offered = view.kind === 'offer' ? view.surface : null;
    if (kind === 'buying' && offered === null) return;
    setAction(kind);
    setMessage(null);
    const surface = offered;
    const outcome = kind === 'buying' && surface !== null
      ? await settleStoreAction(await purchases.purchase(userId, surface.product.productId))
      : await restorePurchases(userId);
    const done = outcome.kind === 'done';
    setAction(done ? 'ready' : 'idle');
    setMessage(done ? PURCHASE_READY : restoreTrouble(outcome));
  };

  const said = message ? (
    <Text accessibilityLiveRegion="polite" style={[type.small, { color: paper.ink, marginTop: space(3) }]}>
      {message}
    </Text>
  ) : null;

  if (view.kind === 'unavailable') {
    return (
      <View style={{ marginTop: space(4), width: '100%' }}>
        <Text style={[type.heading, { color: paper.ink }]}>{view.title}</Text>
        <Text style={[type.body, { color: paper.inkSoft, marginTop: space(2) }]}>{view.body}</Text>
        {said}
        {action !== 'ready' ? (
          <View style={{ marginTop: space(3) }}>
            <GhostButton label={action === 'restoring' ? RESTORE_BUSY : view.restoreLabel} disabled={action !== 'idle'} onPress={() => void finish('restoring')} />
            <Text style={[type.small, { color: paper.inkSoft }]}>{RESTORE_SUB}</Text>
          </View>
        ) : null}
        <Legal trust={view.trust} privacy={view.privacy} terms={view.terms} onPolicy={() => nav.navigate('Policy')} onTerms={() => nav.navigate('Terms')} />
      </View>
    );
  }

  const surface = view.surface;
  // Left, not centred, since revamp A: this block sits inside the white card the
  // out-of-minutes branch draws, and everything else in that card reads from its
  // left edge. The price is the store's own localised string, on the button only.
  return (
    <View style={{ marginTop: space(4), width: '100%' }}>
      <Text style={[type.cardTitle, { color: paper.ink }]}>{surface.title}</Text>
      <Text style={[type.body, { color: paper.inkSoft, marginTop: space(2) }]}>{surface.body}</Text>
      {said}
      {action !== 'ready' ? (
        <>
          <View style={{ marginTop: space(4) }}>
            <PillButton
              label={action === 'buying' ? 'Opening the store…' : surface.purchaseLabel}
              disabled={action !== 'idle'}
              onPress={() => void finish('buying')}
            />
          </View>
          {/* The renewal and the trust line together, right under the button they
              are about, as on the wall's plans page. */}
          <Text style={[type.small, { color: paper.inkSoft, marginTop: space(2) }]}>{view.renewal}</Text>
          <Text style={[type.small, { color: paper.inkSoft, marginTop: space(1) }]}>{view.trust}</Text>
          <GhostButton
            label={action === 'restoring' ? RESTORE_BUSY : surface.restoreLabel}
            disabled={action !== 'idle'}
            onPress={() => void finish('restoring')}
          />
        </>
      ) : null}
      <Legal privacy={view.privacy} terms={view.terms} onPolicy={() => nav.navigate('Policy')} onTerms={() => nav.navigate('Terms')} />
    </View>
  );
}

/**
 * The two documents, the same pair the Wall plans page links, and the trust
 * line when there is no buy button for it to sit beside.
 */
function Legal({ trust, privacy, terms, onPolicy, onTerms }: { trust?: string; privacy: string; terms: string; onPolicy: () => void; onTerms: () => void }) {
  return (
    <View style={{ marginTop: space(2) }}>
      {trust !== undefined ? <Text style={[type.small, { color: paper.inkSoft }]}>{trust}</Text> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(3) }}>
        <GhostButton label={privacy} onPress={onPolicy} />
        <GhostButton label={terms} onPress={onTerms} />
      </View>
    </View>
  );
}
