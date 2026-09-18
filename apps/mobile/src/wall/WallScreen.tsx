import { useEffect, useRef, useState } from 'react';
import { Text } from 'react-native';

import { paper, space, type } from '../theme.ts';

import { useAuth } from '../auth/useAuth.tsx';
import { useProfile } from '../app/ProfileContext.tsx';
import { trackProductEvent } from '../analytics/track.ts';
import { Card, Label, PillButton, ProgressDots } from '../components.tsx';
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
import { loadDeck } from '../review/store.ts';
import { tutorNameOf } from '../tutor/tutorName.ts';
import { latestCatalogue, noteCatalogue } from './catalogue.ts';
import { WallFrenchPage } from './WallFrenchPage.tsx';
import { WallMapPage } from './WallMapPage.tsx';
import { WallPlansPage } from './WallPlansPage.tsx';
import { WallYoursPage } from './WallYoursPage.tsx';
import { PLANS_CHOOSE, WALL_BUSY, WALL_DONE, WALL_NEXT, WALL_READY, YOURS_NEXT } from './wallCopy.ts';
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
}: {
  entry: WallEntry;
  onLeave: () => void;
  onOpenBank: () => void;
  onOpenPolicy: () => void;
  onOpenTerms: () => void;
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
  const [offeringLoaded, setOfferingLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const shown = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setLoadFailed(false);
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
    ).catch(() => {
      if (!cancelled) setLoadFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [profile, retry]);

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
  const last = index === pages.length - 1;

  // Fired once per showing, with the door and the length, because a drop-off at
  // page two says nothing without knowing how many pages there were.
  useEffect(() => {
    if (!offeringLoaded || (!loaded && entry !== 'settings') || pages.length === 0 || shown.current) return;
    shown.current = true;
    void trackProductEvent({ name: 'wall_shown', properties: { entry, pages: pages.length } });
    // The page count is settled by the time this runs, and re-firing on a page
    // turn would make one showing look like several.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, offeringLoaded, entry, pages.length]);

  useEffect(() => {
    if (!offeringLoaded || (!loaded && entry !== 'settings') || page === undefined) return;
    void trackProductEvent({ name: 'wall_page_seen', properties: { page, index } });
  }, [loaded, offeringLoaded, entry, page, index]);

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

  // A missing native store or a failed disk read must never become a blank page.
  // Settings can show real plans without waiting for progress data it never uses.
  const unavailable = offeringLoaded && page === undefined;
  const failed = loadFailed && entry !== 'settings';
  const loading = !offeringLoaded || (entry !== 'settings' && (!loaded || map === null || french === null));
  if (unavailable || failed || loading) {
    return (
      <ScrollScreen
        bottom="inset"
        header={<ScreenHeader back={{ onPress: onLeave }} title="Your plan" />}
        footer={<PillButton label={unavailable || failed ? 'Try again' : 'Back'} onPress={unavailable || failed ? () => setRetry((value) => value + 1) : onLeave} />}
      >
        <Card tone="feature">
          <Label>Luvani · Your next chapter</Label>
          <Text accessibilityLiveRegion="polite" style={{ ...type.display, color: paper.ink, marginTop: space(4) }}>
            {unavailable ? 'Plans aren’t available here yet.' : failed ? 'Let’s try that again.' : 'Getting things ready.'}
          </Text>
          <Text style={{ ...type.body, color: paper.ink, marginTop: space(4) }}>
            {unavailable ? 'We couldn’t load a store offering on this device. You can go back and keep using your current plan.' : failed ? 'Your progress couldn’t be loaded. Nothing has been changed. Try again, or go back to your French.' : 'A moment while we load your next steps.'}
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
        <PillButton
          label={label}
          // Nothing to buy until a tier is chosen: a purchase needs a product id,
          // and a pill that opens the store with none is a pill that fails.
          disabled={busy || (action === 'buy' && chosen === null)}
          onPress={forward}
        />
      }
    >
      {page === 'map' && map !== null && <WallMapPage map={map} />}
      {page === 'french' && french !== null && <WallFrenchPage french={french} onOpenBank={onOpenBank} />}
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
