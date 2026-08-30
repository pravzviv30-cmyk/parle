import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { GhostButton, PillButton } from '../components.tsx';
import { paper, space, type } from '../theme.ts';
import { purchases, type StoreOffering } from './adapter.ts';
import { refreshBilling } from './client.ts';
import {
  PURCHASE_READY,
  PURCHASE_TROUBLE,
  REFRESH_TROUBLE,
  paywallSurface,
} from './paywallView.ts';

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

  const finish = async (kind: 'buying' | 'restoring') => {
    if (action !== 'idle') return;
    setAction(kind);
    setMessage(null);
    const result = kind === 'buying'
      ? await purchases.purchase(userId, surface.product.productId)
      : await purchases.restore(userId);
    if (!result.ok) {
      setAction('idle');
      if (!result.cancelled) setMessage(PURCHASE_TROUBLE);
      return;
    }
    const refreshed = await refreshBilling();
    setAction(refreshed ? 'ready' : 'idle');
    setMessage(refreshed ? PURCHASE_READY : REFRESH_TROUBLE);
  };

  return (
    <View style={{ marginTop: space(6), width: '100%' }}>
      <Text style={[type.bodyStrong, { color: paper.ink, textAlign: 'center' }]}>{surface.title}</Text>
      <Text style={[type.small, { color: paper.inkSoft, textAlign: 'center', marginTop: space(2) }]}>
        {surface.body}
      </Text>
      {message ? (
        <Text accessibilityLiveRegion="polite" style={[type.small, { color: paper.ink, textAlign: 'center', marginTop: space(3) }]}>
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
            label={action === 'restoring' ? 'Checking the store…' : surface.restoreLabel}
            disabled={action !== 'idle'}
            onPress={() => void finish('restoring')}
          />
        </>
      ) : null}
    </View>
  );
}
