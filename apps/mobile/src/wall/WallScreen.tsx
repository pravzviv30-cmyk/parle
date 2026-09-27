import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { paper, space, type } from '../theme.ts';

import { useAuth } from '../auth/useAuth.tsx';
import { trackProductEvent } from '../analytics/track.ts';
import { Card, PillButton, ProgressDots } from '../components.tsx';
import { ScreenHeader, ScrollScreen } from '../layout.tsx';
import { useHardwareBack } from '../nav/useHardwareBack.ts';
import { purchases, type PaidPlan, type StoreOffering } from '../purchases/adapter.ts';
import type { BillingStatus } from '../purchases/billingStatus.ts';
import { fetchBillingStatus } from '../purchases/client.ts';
import { paywallSurface, restoreTrouble } from '../purchases/paywallView.ts';
import { restorePurchases, settleStoreAction } from '../purchases/restore.ts';
import { latestCatalogue, noteCatalogue } from './catalogue.ts';
import { WallPlansAtButton, WallPlansPage } from './WallPlansPage.tsx';
import { WallYoursPage } from './WallYoursPage.tsx';
import { PLANS_CHOOSE, WALL_BUSY, WALL_DONE, WALL_NEXT, WALL_READY, YOURS_NEXT } from './wallCopy.ts';
import { wallAccount } from './wallAccount.ts';
import { wallPlanRows } from './wallPlans.ts';
import { previewCatalogue, previewOffering } from './preview.ts';
import { wallAction, wallPages, type WallEntry } from './wallPages.ts';

/**
 * The subscription wall: two pages, what you get and then the plans, or one
 * page when there is nothing to sell.
 *
 * The frame owns the paging, the one primary button and the two analytics
 * events. Every page under it is null gates and a stylesheet, and every decision
 * either page draws was made in a module a test can call, because apps/mobile
 * has no renderer.
 *
 * 2026-09-27, notebook Phase 6-E: the map and French pages left, and with them
 * the wall's disk reads. The first page needs no store and no progress at all,
 * which is not a convenience: the purchase half cannot be switched on until the
 * RevenueCat keys exist, and a wall nobody could look at until then is a wall
 * nobody could correct. So the first page stands alone, on web as well, and ends
 * on the free promise when there is nothing to sell.
 *
 * `onOpenBank` is still accepted because the navigator hands it over, and it
 * opened the phrase bank from the retired French page. Nothing here uses it now.
 */
export function WallScreen({
  entry,
  onLeave,
  onOpenPolicy,
  onOpenTerms,
}: {
  entry: WallEntry;
  onLeave: () => void;
  onOpenBank: () => void;
  onOpenPolicy: () => void;
  onOpenTerms: () => void;
}) {
  const { user } = useAuth();
  const [selected, setSelected] = useState<PaidPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [offering, setOffering] = useState<StoreOffering>({ available: false });
  const [offeringLoaded, setOfferingLoaded] = useState(false);
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [retry, setRetry] = useState(0);
  const shown = useRef(false);

  // The account in hand, for the plans page's minutes left. The same read the
  // Settings card makes. It never blocks the wall: until it answers, and when it
  // cannot, the page simply says nothing about the account. It is read again
  // once a purchase or restore has granted something, so the minutes above the
  // plans are never the ones from before the learner paid.
  const granted = message === WALL_READY;
  useEffect(() => {
    let cancelled = false;
    if (user === null) return;
    void fetchBillingStatus(user.id).then((next) => {
      if (!cancelled) setStatus(next);
    });
    return () => {
      cancelled = true;
    };
  }, [user, retry, granted]);

  useEffect(() => {
    let cancelled = false;
    setOfferingLoaded(false);
    // In a preview there is no session behind this, so nothing has sent a
    // catalogue and the plans page would show no minutes. `noteCatalogue`
    // ignores null, so on every real build this line does nothing at all.
    noteCatalogue(previewCatalogue());
    // A store that answers nothing is the expected answer today, and the page
    // list is built from it rather than around it.
    void purchases.offering('wall').then((next) => {
      if (cancelled) return;
      // The real store first, always. The fixture stands in only when there is no
      // store and this is a preview build, which is never a build a learner has.
      setOffering(next.available ? next : (previewOffering() ?? next));
      setOfferingLoaded(true);
    }).catch(() => {
      if (cancelled) return;
      setOffering({ available: false });
      setOfferingLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [retry]);

  const storeHasPlans = paywallSurface(offering) !== null;
  const pages = wallPages({ entry, storeHasPlans });
  const page = pages[index];

  // Fired once per showing, with the door and the length, because a drop-off at
  // page two says nothing without knowing how many pages there were.
  useEffect(() => {
    if (!offeringLoaded || pages.length === 0 || shown.current) return;
    shown.current = true;
    void trackProductEvent({ name: 'wall_shown', properties: { entry, pages: pages.length } });
    // The page count is settled by the time this runs, and re-firing on a page
    // turn would make one showing look like several.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offeringLoaded, entry, pages.length]);

  useEffect(() => {
    if (!offeringLoaded || page === undefined) return;
    void trackProductEvent({ name: 'wall_page_seen', properties: { page, index } });
  }, [offeringLoaded, page, index]);

  const back = () => (index > 0 ? setIndex((at) => at - 1) : onLeave());
  useHardwareBack(true, back);

  const action = wallAction(pages, index);
  const planRows = wallPlanRows(offering, latestCatalogue());
  const chosen = planRows?.find((row) => row.plan === selected) ?? null;

  /**
   * The half that happens once the store has answered, shared with restore.
   *
   * `done` is the only ending that may say the speaking time is ready, because
   * since F265 it is the only one that means the server granted something.
   */
  const settle = async (outcome: Awaited<ReturnType<typeof settleStoreAction>>, plan: PaidPlan) => {
    void trackProductEvent({ name: 'purchase_settled', properties: { plan, outcome: outcome.kind } });
    setMessage(outcome.kind === 'done' ? WALL_READY : restoreTrouble(outcome));
    setBusy(false);
  };

  const buy = async () => {
    if (user === null || chosen === null || busy) return;
    setBusy(true);
    setMessage(null);
    void trackProductEvent({ name: 'purchase_started', properties: { plan: chosen.plan } });
    await settle(await settleStoreAction(await purchases.purchase(user.id, chosen.productId)), chosen.plan);
  };

  const restore = async () => {
    if (user === null || busy) return;
    setBusy(true);
    setMessage(null);
    const outcome = await restorePurchases(user.id);
    // A restore is not a purchase of any particular tier, so it reports the one
    // the learner was looking at rather than inventing one.
    await settle(outcome, chosen?.plan ?? 'starter');
  };

  const forward = () => {
    if (action === 'buy') {
      void buy();
      return;
    }
    if (action === 'done') {
      onLeave();
      return;
    }
    setIndex((at) => at + 1);
  };

  const label = busy
    ? WALL_BUSY
    : action === 'buy'
      ? PLANS_CHOOSE
      : action === 'to-plans'
        ? YOURS_NEXT
        : action === 'done'
          ? WALL_DONE
          : WALL_NEXT;

  // A missing native store must never become a blank page. The wall reads no
  // progress any more, so the store is the one thing it waits for.
  const unavailable = offeringLoaded && page === undefined;
  const loading = !offeringLoaded;
  if (unavailable || loading) {
    return (
      <ScrollScreen
        bottom="inset"
        header={<ScreenHeader back={{ onPress: onLeave }} title="Your plan" />}
        footer={<PillButton label={unavailable ? 'Try again' : 'Back'} onPress={unavailable ? () => setRetry((value) => value + 1) : onLeave} />}
      >
        <Card>
          <Text accessibilityLiveRegion="polite" style={{ ...type.display, color: paper.ink }}>
            {unavailable ? 'Plans aren’t available here yet.' : 'Getting things ready.'}
          </Text>
          <Text style={{ ...type.body, color: paper.ink, marginTop: space(4) }}>
            {unavailable ? 'We couldn’t load a store offering on this device. You can go back and keep using your current plan.' : 'A moment while we load your next steps.'}
          </Text>
        </Card>
      </ScrollScreen>
    );
  }

  return (
    <ScrollScreen
      bottom="inset"
      header={<ScreenHeader back={{ onPress: back }} title={<ProgressDots total={pages.length} index={index} />} />}
      footer={
        <View>
          <PillButton
            label={label}
            // Nothing to buy until a tier is chosen: a purchase needs a product id,
            // and a pill that opens the store with none is a pill that fails.
            disabled={busy || (action === 'buy' && chosen === null)}
            onPress={forward}
          />
          {page === 'plans' && <WallPlansAtButton />}
        </View>
      }
    >
      {page === 'yours' && <WallYoursPage canBuy={storeHasPlans} />}
      {page === 'plans' && planRows !== null && (
        <WallPlansPage
          rows={planRows}
          account={wallAccount(status, latestCatalogue(), Date.now())}
          selected={selected}
          onSelect={(plan) => {
            setSelected(plan);
            void trackProductEvent({ name: 'plan_selected', properties: { plan } });
          }}
          onRestore={() => void restore()}
          onOpenPolicy={onOpenPolicy}
          onOpenTerms={onOpenTerms}
          onLeave={onLeave}
        />
      )}
      {message !== null && (
        <Text accessibilityLiveRegion="polite" style={{ ...type.small, color: paper.ink, marginTop: space(4), textAlign: 'center' }}>
          {message}
        </Text>
      )}
    </ScrollScreen>
  );
}
