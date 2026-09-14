import { useEffect, useState } from 'react';
import { Text } from 'react-native';

import { paper, space, type } from '../theme.ts';

import { useAuth } from '../auth/useAuth.tsx';
import { useProfile } from '../app/ProfileContext.tsx';
import { trackProductEvent } from '../analytics/track.ts';
import { PillButton, ProgressDots } from '../components.tsx';
import { ScreenHeader, ScrollScreen } from '../layout.tsx';
import { missionStates, type MissionProgress } from '@luvani/core';
import { missionCompletionsFrom } from '../missions/chooserView.ts';
import { loadMissionCompletions } from '../missions/store.ts';
import { useHardwareBack } from '../nav/useHardwareBack.ts';
import { loadActivity } from '../progress/activity.ts';
import { momentumFrom } from '../progress/momentum.ts';
import { purchases, type PaidPlan, type StoreOffering } from '../purchases/adapter.ts';
import { paywallSurface, restoreTrouble } from '../purchases/paywallView.ts';
import { restorePurchases, settleStoreAction } from '../purchases/restore.ts';
import type { OutOfMinutesCode } from '../live/useLiveSession.ts';
import { loadDeck } from '../review/store.ts';
import { tutorNameOf } from '../tutor/tutorName.ts';
import { latestCatalogue, noteCatalogue } from './catalogue.ts';
import { WallFrenchPage } from './WallFrenchPage.tsx';
import { WallLimitPage } from './WallLimitPage.tsx';
import { WallMapPage } from './WallMapPage.tsx';
import { WallPlansPage } from './WallPlansPage.tsx';
import { WallYoursPage } from './WallYoursPage.tsx';
import { LIMIT_NEXT, PLANS_CHOOSE, WALL_BUSY, WALL_DONE, WALL_NEXT, WALL_READY, WALL_START, YOURS_NEXT } from './wallCopy.ts';
import { wallPlanRows } from './wallPlans.ts';
import { previewCatalogue, previewOffering } from './preview.ts';
import { wallFrench, type WallFrench } from './wallFrench.ts';
import { wallMap, type WallMap } from './wallMap.ts';
import { wallAction, wallPages, type WallEntry } from './wallPages.ts';

/**
 * The subscription wall: a short paged report that ends in a price, or does not.
 *
 * The frame owns the paging, the one primary button and the two analytics
 * events. Every page under it is null gates and a stylesheet, and every decision
 * either page draws was made in a module a test can call, because apps/mobile
 * has no renderer.
 *
 * Three of the four pages need no store at all, which is not a convenience. The
 * purchase half cannot be switched on until the RevenueCat keys exist and
 * F263 and F266 close, and a wall nobody could look at until then is a wall
 * nobody could correct. So the value sequence stands alone, on web as well, and
 * ends on the free promise when there is nothing to sell.
 */
export function WallScreen({
  entry,
  onLeave,
  onOpenBank,
  onOpenPolicy,
  onOpenTerms,
  onDone,
  reason = 'exhausted',
}: {
  entry: WallEntry;
  onLeave: () => void;
  onOpenBank: () => void;
  onOpenPolicy: () => void;
  onOpenTerms: () => void;
  onDone: () => void;
  reason?: OutOfMinutesCode;
}) {
  const { profile } = useProfile();
  const { user } = useAuth();
  const [selected, setSelected] = useState<PaidPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [map, setMap] = useState<WallMap | null>(null);
  const [french, setFrench] = useState<WallFrench | null>(null);
  const [offering, setOffering] = useState<StoreOffering>({ available: false });
  const [loaded, setLoaded] = useState(false);
  const [purchaseReady, setPurchaseReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const now = Date.now();
    void Promise.all([loadActivity(), loadDeck(), loadMissionCompletions()]).then(
      ([activity, deck, completions]) => {
        if (cancelled) return;
        // Through the same door every other screen uses. The store's own
        // MissionCompletion carries `id: string`, because a disk read cannot
        // promise the id names a mission this build has, and this drops the ones
        // that do not along with any rung outside the ladder.
        const progress: readonly MissionProgress[] = missionStates(missionCompletionsFrom(completions), deck, now);
        setMap(wallMap({ progress, deck, tutorName: profile === null ? null : tutorNameOf(profile) }));
        setFrench(wallFrench(momentumFrom({ activity, deck, profile, now })));
        setLoaded(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [profile]);

  useEffect(() => {
    let cancelled = false;
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
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const storeHasPlans = paywallSurface(offering) !== null;
  const pages = wallPages({ entry, storeHasPlans });
  const page = pages[index];

  // Fired once per showing, with the door and the length, because a drop-off at
  // page two says nothing without knowing how many pages there were.
  useEffect(() => {
    if (!loaded) return;
    void trackProductEvent({ name: 'wall_shown', properties: { entry, pages: pages.length } });
    // The page count is settled by the time this runs, and re-firing on a page
    // turn would make one showing look like several.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  useEffect(() => {
    if (!loaded || page === undefined) return;
    void trackProductEvent({ name: 'wall_page_seen', properties: { page, index } });
  }, [loaded, page, index]);

  const back = () => (index > 0 ? setIndex((at) => at - 1) : onLeave());
  useHardwareBack(true, back);

  const action = wallAction(pages, index);
  const planRows = wallPlanRows(offering, latestCatalogue());
  const chosen = planRows?.find((row) => row.plan === selected) ?? null;

  // Start with the lightest plan selected. The learner can compare and change
  // it, but nobody reaches a disabled purchase button just because they have
  // not discovered that the whole card is a control.
  useEffect(() => {
    if (selected === null && planRows !== null && planRows.length > 0) setSelected(planRows[0]!.plan);
  }, [planRows, selected]);

  /**
   * The half that happens once the store has answered, shared with restore.
   *
   * `done` is the only ending that may say the speaking time is ready, because
   * since F265 it is the only one that means the server granted something.
   */
  const settle = async (outcome: Awaited<ReturnType<typeof settleStoreAction>>, plan: PaidPlan) => {
    void trackProductEvent({ name: 'purchase_settled', properties: { plan, outcome: outcome.kind } });
    const done = outcome.kind === 'done';
    setPurchaseReady(done);
    setMessage(done ? WALL_READY : restoreTrouble(outcome));
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
    if (purchaseReady) {
      onDone();
      return;
    }
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

  let label = WALL_NEXT;
  if (busy) label = WALL_BUSY;
  else if (purchaseReady) label = WALL_START;
  else if (action === 'buy') label = chosen === null ? PLANS_CHOOSE : `Continue with ${chosen.name}`;
  else if (page === 'limit') label = LIMIT_NEXT;
  else if (action === 'to-plans') label = YOURS_NEXT;
  else if (action === 'done') label = WALL_DONE;

  // Nothing is drawn from a half loaded disk: a map with no rows would be the
  // empty opening this whole design exists to refuse.
  if (!loaded || map === null || french === null || page === undefined) return null;

  return (
    <ScrollScreen
      bottom="inset"
      header={<ScreenHeader back={{ onPress: back }} title={<ProgressDots total={pages.length} index={index} />} />}
      footer={
        <PillButton
          label={label}
          // Nothing to buy until a tier is chosen: a purchase needs a product id,
          // and a pill that opens the store with none is a pill that fails.
          disabled={busy || (!purchaseReady && action === 'buy' && chosen === null)}
          onPress={forward}
        />
      }
    >
      {page === 'limit' && <WallLimitPage code={reason} canBuy={storeHasPlans} />}
      {page === 'map' && <WallMapPage map={map} />}
      {page === 'french' && <WallFrenchPage french={french} onOpenBank={onOpenBank} />}
      {page === 'yours' && <WallYoursPage canBuy={storeHasPlans} />}
      {page === 'plans' && planRows !== null && (
        <WallPlansPage
          rows={planRows}
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
