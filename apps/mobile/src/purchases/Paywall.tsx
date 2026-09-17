import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { GhostButton, PillButton } from '../components.tsx';
import { paper, space, type } from '../theme.ts';

import { purchases, type StoreOffering } from './adapter.ts';
import {
  PURCHASE_READY,
  RESTORE_BUSY,
  paywallSurface,
  restoreTrouble,
} from './paywallView.ts';
import { restorePurchases, settleStoreAction } from './restore.ts';

type Action = 'idle' | 'buying' | 'restoring' | 'ready';

export function Paywall({ userId }: { userId: string }) {
  const [offering, setOffering] = useState<StoreOffering>({ available: false });
  const [loaded, setLoaded] = useState(false);
  const [action, setAction] = useState<Action>('idle');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void purchases.offering(userId).then((next) => {
      if (cancelled) return;
      setOffering(next);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const surface = paywallSurface(offering);
  if (!loaded || surface === null) return null;

  // Restoring goes through restore.ts, which the Settings row calls too, so the
  // two surfaces cannot drift about what a restore is. Buying differs only in
  // the question put to the store, and shares everything after the answer.
  const finish = async (kind: 'buying' | 'restoring') => {
    if (action !== 'idle') return;
    setAction(kind);
    setMessage(null);
    const outcome = kind === 'buying'
      ? await settleStoreAction(await purchases.purchase(userId, surface.product.productId))
      : await restorePurchases(userId);
    const done = outcome.kind === 'done';
    setAction(done ? 'ready' : 'idle');
    setMessage(done ? PURCHASE_READY : restoreTrouble(outcome));
  };

  // Left, not centred, since revamp A: this block sits inside the white card the
  // out-of-minutes branch draws, and everything else in that card reads from its
  // left edge. Every word below is the store's own, unchanged; the title is the
  // card's headline now, in the bold serif the mockup gives a card that leads.
  return (
    <View style={{ marginTop: space(4), width: '100%' }}>
      <Text style={[type.cardTitle, { color: paper.ink }]}>{surface.title}</Text>
      <Text style={[type.body, { color: paper.inkSoft, marginTop: space(2) }]}>{surface.body}</Text>
      {message ? (
        <Text accessibilityLiveRegion="polite" style={[type.small, { color: paper.ink, marginTop: space(3) }]}>
          {message}
        </Text>
      ) : null}
      {action !== 'ready' ? (
        <>
          <View style={{ marginTop: space(4) }}>
            <PillButton
              label={action === 'buying' ? 'Opening the store…' : surface.purchaseLabel}
              disabled={action !== 'idle'}
              onPress={() => void finish('buying')}
            />
          </View>
          <GhostButton
            label={action === 'restoring' ? RESTORE_BUSY : surface.restoreLabel}
            disabled={action !== 'idle'}
            onPress={() => void finish('restoring')}
          />
        </>
      ) : null}
    </View>
  );
}
