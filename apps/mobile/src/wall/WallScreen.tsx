import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { useMainAppearance } from '../main/MainAppearance.tsx';
import { colour, paper, space, type } from '../theme.ts';

import { useAuth } from '../auth/useAuth.tsx';
import { beginPendingPurchase, clearPendingPurchase, confirmsPendingPurchase, loadPendingPurchase, type PendingPurchase } from '../purchases/pendingPurchase.ts';
import { scopeGeneration } from '../storage/scope.ts';
import { trackProductEvent } from '../analytics/track.ts';
import { IconAction, Card, GhostButton, HeroNumber, PillButton, ProgressDots } from '../components.tsx';
import { Illustration } from '../art/flat/Illustration.tsx';
import { purchasePill, successLine, wallSuccess } from './wallSuccess.ts';
import { WALL_CONFIRMING, buyLabel, perWeekLine } from './wallCopy.ts';
import { ScreenHeader, ScrollScreen } from '../layout.tsx';
import { useHardwareBack } from '../nav/useHardwareBack.ts';
import { purchases, type PaidPlan, type StoreOffering } from '../purchases/adapter.ts';
import type { BillingStatus } from '../purchases/billingStatus.ts';
import { fetchBillingStatus, refreshBilling } from '../purchases/client.ts';
import { paywallSurface, restoreTrouble } from '../purchases/paywallView.ts';
import { restorePurchases, settleStoreAction } from '../purchases/restore.ts';
import { latestCatalogue, noteCatalogue } from './catalogue.ts';
import { WallPlansAtButton, WallPlansPage } from './WallPlansPage.tsx';
import { WallYoursPage } from './WallYoursPage.tsx';
import { billedPrice, PLANS_CHOOSE, WALL_BUSY, WALL_DONE, WALL_LEAVE, WALL_NEXT, WALL_READY, YOURS_NEXT } from './wallCopy.ts';
import { wallAccount } from './wallAccount.ts';
import { chosenOffer, preselectedOffer, storeTrialMinutes, wallPlanRows } from './wallPlans.ts';
import { TRIAL_REMINDER_SCHEDULED, trialTimeline } from './trialTimeline.ts';
import { previewCatalogue, previewOffering } from './preview.ts';
import { wallAction, wallPages, type WallEntry } from './wallPages.ts';
import { publishCelebrations } from '../celebrate/events.ts';
import { purchaseMoment } from '../celebrate/purchaseMoment.ts';
import { useGoal } from '../game/GameProvider.tsx';
import { ICON_MOTION } from '../icons/iconMotion.ts';
import { MORPH } from '../motion/tokens.ts';

/**
 * How long the pill's check stays before the success page takes over: the
 * check draws, then holds (MORPH.hold), so the learner sees it land.
 */
const CHECK_HELD_MS = ICON_MOTION.check.wipeAt + ICON_MOTION.check.wipe + MORPH.hold;

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
  onStartSpeaking,
  onOpenPractice,
  onOpenPolicy,
  onOpenTerms,
  startSpeakingLabel = 'Start speaking',
}: {
  entry: WallEntry;
  onLeave: () => void;
  onStartSpeaking: (canResume: boolean) => void;
  onOpenPractice: () => void;
  onOpenBank: () => void;
  onOpenPolicy: () => void;
  onOpenTerms: () => void;
  startSpeakingLabel?: string;
}) {
  const { user } = useAuth(); const { colors, mode } = useMainAppearance();
  const wallOwner = useRef({ generation: scopeGeneration(), userId: user?.id ?? null }).current;
  const ownsWall = wallOwner.generation === scopeGeneration() && wallOwner.userId === (user?.id ?? null);
  // The chosen way to pay, by store product id: a plan is bought yearly or
  // monthly (D16), and the product decides which.
  const [selected, setSelected] = useState<string | null>(null);
  // Whether the learner has chosen for themselves. Until then the page may
  // choose for them once (`preselectedOffer`); after it, never again.
  const touched = useRef(false);
  // True while the plans page's own pill answers the purchase it started: it
  // turns while the store and then the server answer, and draws its check only
  // once the server has confirmed the entitlement.
  const [closing, setClosing] = useState(false);
  // Whether the purchase the pill last started was of a product the store
  // carries a free trial on, whatever it said about eligibility, so the success
  // page can say the server's week (F742). It counts only once the store has
  // accepted that purchase (`purchaseAccepted`), so a cancelled trial purchase
  // followed by a restore is never said as a trial.
  const boughtTrial = useRef(false);
  const goal = useGoal()?.target ?? null;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [offering, setOffering] = useState<StoreOffering>({ available: false });
  const [offeringLoaded, setOfferingLoaded] = useState(false);
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [retry, setRetry] = useState(0);
  const [confirmedGrant, setConfirmedGrant] = useState<BillingStatus | null>(null);
  const [grantReadPending, setGrantReadPending] = useState(false);
  const [purchaseAccepted, setPurchaseAccepted] = useState(false);
  const [pendingPurchase, setPendingPurchase] = useState<PendingPurchase | null>(null);
  const [pendingRead, setPendingRead] = useState<'loading' | 'ready' | 'unread'>('loading');
  const [pendingAttempt, setPendingAttempt] = useState(0);
  const storeActionInFlight = useRef(false);
  const storeGranted = useRef(false);
  const shown = useRef(false);
  const left = useRef(false);
  useEffect(() => {
    setBusy(false);
    setMessage(null);
    setStatus(null);
    setConfirmedGrant(null);
    setSelected(null);
    touched.current = false;
    setClosing(false);
    boughtTrial.current = false;
    setGrantReadPending(false);
    setPurchaseAccepted(false);
    storeActionInFlight.current = false;
    storeGranted.current = false;
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;
    const owner = scopeGeneration();
    setPendingRead('loading'); setPendingPurchase(null);
    if (user === null) { setPendingRead('ready'); return; }
    void loadPendingPurchase().then(pending => {
      if (cancelled || owner !== scopeGeneration()) return;
      setPendingPurchase(pending); setPendingRead('ready');
      if (pending !== null) storeGranted.current = true;
    }).catch(() => {
      if (!cancelled && owner === scopeGeneration()) setPendingRead('unread');
    });
    return () => { cancelled = true; };
  }, [user?.id, pendingAttempt]);

  // The account in hand, for the plans page's minutes left. The same read the
  // Settings card makes. It never blocks the wall: until it answers, and when it
  // cannot, the page simply says nothing about the account. It is read again
  // once a purchase or restore has granted something, so the minutes above the
  // plans are never the ones from before the learner paid.
  const granted = message === WALL_READY;
  useEffect(() => {
    let cancelled = false;
    setConfirmedGrant(null);
    if (user === null) return;
    setGrantReadPending(granted);
    void fetchBillingStatus(user.id).then((next) => {
      if (!cancelled && wallOwner.generation === scopeGeneration()) {
        setStatus(next);
        if (granted) { setConfirmedGrant(next); setGrantReadPending(false); }
      }
    }).catch(() => {
      if (!cancelled && wallOwner.generation === scopeGeneration() && granted) setGrantReadPending(false);
    });
    return () => {
      cancelled = true;
    };
  }, [user, retry, granted]);

  useEffect(() => {
    let cancelled = false;
    setOfferingLoaded(false);
    setOffering({ available: false });
    // In a preview there is no session behind this, so nothing has sent a
    // catalogue and the plans page would show no minutes. `noteCatalogue`
    // ignores null, so on every real build this line does nothing at all.
    noteCatalogue(previewCatalogue());
    // A store that answers nothing is the expected answer today, and the page
    // list is built from it rather than around it.
    if (user === null) {
      setOffering(previewOffering() ?? { available: false });
      setOfferingLoaded(true);
      return;
    }
    void purchases.offering(user.id).then((next) => {
      if (cancelled || wallOwner.generation !== scopeGeneration()) return;
      // The real store first, always. The fixture stands in only when there is no
      // store and this is a preview build, which is never a build a learner has.
      setOffering(next.available ? next : (previewOffering() ?? next));
      setOfferingLoaded(true);
    }).catch(() => {
      if (cancelled || wallOwner.generation !== scopeGeneration()) return;
      setOffering({ available: false });
      setOfferingLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [retry, user?.id]);

  const storeHasPlans = paywallSurface(offering) !== null;
  const pages = wallPages({ entry, storeHasPlans });
  const page = pages[index];
  const planRows = wallPlanRows(offering, latestCatalogue());
  const chosen = chosenOffer(planRows, selected);
  const success = granted ? wallSuccess(confirmedGrant, latestCatalogue(), purchaseAccepted && boughtTrial.current) : null;

  // The page's own suggestion (D16, README Part 5.G): the yearly product of the
  // plan that covers the learner's daily goal, chosen once, while nothing is,
  // and only once the server has said what the learner holds. It is not the
  // learner's choice, so it records nothing: `plan_selected` is fired by a tap
  // alone, in `onSelect` below.
  const suggestion = status === null ? null : preselectedOffer(planRows, goal, status)?.productId ?? null;
  useEffect(() => {
    if (touched.current || selected !== null || suggestion === null) return;
    setSelected(suggestion);
  }, [suggestion, selected]);

  // The pill's state while it answers its own purchase. Busy while the store,
  // and then the server, answer; done, the check, only once the server has
  // confirmed the entitlement the success page names. A cancel or a failure is
  // idle again: the words come back, nothing shakes.
  const morph = purchasePill({ closing, busy, granted, purchaseAccepted, grantReadPending, success });
  const holding = closing && morph !== 'idle';
  useEffect(() => {
    if (closing && morph === 'idle') setClosing(false);
  }, [closing, morph]);
  useEffect(() => {
    if (morph !== 'done') return undefined;
    const held = setTimeout(() => setClosing(false), CHECK_HELD_MS);
    return () => clearTimeout(held);
  }, [morph]);

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

  // The purchase celebration (come alive, F743): only when the success page
  // below is the one showing, which needs the server's confirmed entitlement
  // (`wallSuccess`), and only after a purchase this wall made, never a restore.
  // Keyed by the confirmed grant, so it plays once on any device. Above every
  // early return, so the hooks run in one order on every render.
  const celebrated = useRef<string | null>(null);
  // While the pill holds its check the moment waits, so it opens with the
  // success page under it rather than over the check.
  useEffect(() => {
    if (holding || !ownsWall || pendingRead !== 'ready' || !granted || !purchaseAccepted || confirmedGrant === null) return;
    if (wallSuccess(confirmedGrant, latestCatalogue()) === null) return;
    const moment = purchaseMoment(confirmedGrant, Date.now());
    if (moment === null || celebrated.current === moment.key) return;
    celebrated.current = moment.key;
    publishCelebrations([moment]);
  }, [ownsWall, pendingRead, granted, purchaseAccepted, confirmedGrant, holding]);

  const leave = (destination: 'back' | 'speak' = 'back', returnToApp: () => void = onLeave) => {
    if (left.current) return;
    left.current = true;
    if (user) void trackProductEvent({ name: 'wall_left', properties: { entry, outcome: granted ? 'granted' : 'unchanged', destination } }, { userId: user.id, generation: scopeGeneration() });
    if (destination === 'speak') onStartSpeaking(granted && confirmedGrant?.canStart === true); else returnToApp();
  };
  const back = () => (index > 0 && !granted ? setIndex((at) => at - 1) : leave());
  useHardwareBack(true, back);

  const action = wallAction(pages, index);
  const trial = trialTimeline({
    offer: chosen,
    minutes: chosen === null ? null : storeTrialMinutes(latestCatalogue(), chosen.plan),
    remind: TRIAL_REMINDER_SCHEDULED,
  });

  /**
   * The half that happens once the store has answered, shared with restore.
   *
   * `done` is the only ending that may say the speaking time is ready, because
   * since F265 it is the only one that means the server granted something.
   */
  const settle = async (outcome: Awaited<ReturnType<typeof settleStoreAction>>, plan: PaidPlan, checkout: PendingPurchase) => {
    const owner = scopeGeneration();
    void trackProductEvent({ name: 'purchase_settled', properties: { plan, outcome: outcome.kind } });
    // These outcomes are reachable only after the store accepted a purchase.
    // A delayed server grant must never invite a second store transaction.
    const accepted = outcome.kind === 'done' || outcome.kind === 'refresh-trouble' || outcome.kind === 'nothing-granted';
    if (accepted) { storeGranted.current = true; setPurchaseAccepted(true); }
    const matching = outcome.kind === 'done' && outcome.plan === plan;
    if (matching || outcome.kind === 'cancelled') {
      const cleared = await clearPendingPurchase(checkout).catch(() => false);
      if (owner !== scopeGeneration()) return;
      if (cleared) { setPendingPurchase(null); if (!matching) storeGranted.current = false; }
    }
    setGrantReadPending(matching);
    setMessage(matching ? WALL_READY : restoreTrouble(outcome));
    storeActionInFlight.current = false;
    setBusy(false);
  };

  const buy = async () => {
    if (!ownsWall || pendingRead !== 'ready' || pendingPurchase !== null || user === null || chosen === null || busy || granted || storeGranted.current || storeActionInFlight.current) return;
    const owner = scopeGeneration();
    storeActionInFlight.current = true;
    setBusy(true);
    setMessage(null);
    const standing = await fetchBillingStatus(user.id);
    if (owner !== scopeGeneration()) return;
    if (standing === null || (standing.plan === chosen.plan && !standing.lapsed)) {
      setMessage(standing === null ? 'Your current plan could not be checked. Try again before buying.' : 'You already have this plan. Check your store subscription instead of buying it again.');
      storeActionInFlight.current = false; setBusy(false); return;
    }
    const checkout = { plan: chosen.plan, productId: chosen.productId, before: { plan: standing.plan, periodEnd: standing.periodEnd } };
    try {
      if (!(await beginPendingPurchase(checkout))) throw new Error('checkout fence unavailable');
    } catch {
      if (owner === scopeGeneration()) {
        setPendingRead('unread'); setBusy(false); storeActionInFlight.current = false;
      }
      return;
    }
    if (owner !== scopeGeneration()) return;
    setPendingPurchase(checkout);
    void trackProductEvent({ name: 'purchase_started', properties: { plan: chosen.plan } });
    const outcome = await settleStoreAction(user.id, () => purchases.purchase(user.id, chosen.productId));
    if (owner !== scopeGeneration()) return;
    await settle(outcome, chosen.plan, checkout);
  };

  const restore = async () => {
    if (!ownsWall || user === null || busy || granted || storeGranted.current || storeActionInFlight.current) return;
    const owner = scopeGeneration();
    storeActionInFlight.current = true;
    setBusy(true);
    setMessage(null);
    const outcome = await restorePurchases(user.id, 'wall');
    if (owner !== scopeGeneration()) return;
    if (outcome.kind === 'done') storeGranted.current = true;
    setGrantReadPending(outcome.kind === 'done');
    setMessage(outcome.kind === 'done' ? WALL_READY : restoreTrouble(outcome));
    storeActionInFlight.current = false;
    setBusy(false);
  };

  const checkAcceptedPurchase = async () => {
    if (!ownsWall || user === null || pendingPurchase === null || busy || storeActionInFlight.current) return;
    const owner = scopeGeneration();
    storeActionInFlight.current = true; setBusy(true);
    const refreshed = await refreshBilling(user.id, owner);
    if (owner !== scopeGeneration()) return;
    const standing = refreshed?.granted ? await fetchBillingStatus(user.id) : null;
    if (owner !== scopeGeneration()) return;
    if (confirmsPendingPurchase(pendingPurchase, standing)) {
      const cleared = await clearPendingPurchase(pendingPurchase).catch(() => false);
      if (owner !== scopeGeneration()) return;
      if (cleared) {
        setPendingPurchase(null); setGrantReadPending(true); setMessage(WALL_READY);
      } else setMessage('Your paid plan was confirmed, but its local checkout record could not be cleared. Try again.');
    } else setMessage('Your store request is still waiting for its matching paid plan. Please check again shortly.');
    storeActionInFlight.current = false; setBusy(false);
  };

  const forward = () => {
    if (action === 'buy') {
      // The pill answers the purchase it starts. Only a purchase that can
      // actually begin turns it; `buy` itself still decides whether it does.
      if (chosen !== null && !busy && !granted && pendingPurchase === null && !storeGranted.current) {
        boughtTrial.current = chosen.hasFreeTrial;
        setClosing(true);
      }
      void buy();
      return;
    }
    if (action === 'done') {
      leave();
      return;
    }
    setIndex((at) => at + 1);
  };

  const label = morph === 'done'
    ? WALL_READY
    : granted && morph === 'busy'
      ? WALL_CONFIRMING
      : busy
        ? WALL_BUSY
        : action === 'buy'
          ? chosen === null ? PLANS_CHOOSE : trial !== null ? trial.cta : buyLabel(chosen.name, chosen.price, chosen.period)
          : action === 'to-plans'
            ? YOURS_NEXT
            : action === 'done'
              ? WALL_DONE
              : WALL_NEXT;

  if (!ownsWall) return (
    <ScrollScreen header={<ScreenHeader title="Speaking plans" />}>
      <Text style={[type.body, { color: paper.inkSoft }]}>The account changed. Open plans again from your profile.</Text>
      <PillButton label="Back to practice" onPress={onLeave} />
    </ScrollScreen>
  );
  if (pendingRead !== 'ready') return (
    <ScrollScreen header={<ScreenHeader title="Checking purchase status" />}>
      <Text style={[type.body, { color: paper.inkSoft }]}>{pendingRead === 'loading' ? 'Checking whether a purchase is already in progress on this phone.' : 'Your purchase status on this phone could not be read. Try again before opening another store purchase.'}</Text>
      {pendingRead === 'unread' && <IconAction layout="inline" icon="refresh" label="Check purchase status again" onPress={() => setPendingAttempt(value => value + 1)} />}
      <PillButton label="Back to practice" onPress={() => leave('back', onOpenPractice)} />
    </ScrollScreen>
  );
  // The success page shows once the pill has held its check, or at once when
  // the purchase was confirmed some other way. The purchase moment above is
  // published under exactly this condition, and nowhere else.
  if (success !== null && !holding) {
    return (
      <ScrollScreen ground={colour.mint} bottom="inset" header={<ScreenHeader back={{ onPress: () => leave() }} title="Your plan is ready" />}
        footer={<PillButton label={startSpeakingLabel} onPress={() => leave('speak')} />}>
        <Text style={[type.title, { color: paper.ink }]}>{success.name}</Text>
        <HeroNumber value={String(success.minutes)} unit="minutes" ground="mint" />
        <Text style={[type.body, { color: paper.ink }]}>{successLine(success)}</Text>
        {success.perWeek !== null && <Text style={[type.body, { color: paper.ink }]}>{perWeekLine(success.perWeek)}</Text>}
        <Text style={[type.small, { color: paper.ink, marginTop: space(4) }]}>Your phrases and progress stay yours.</Text>
      </ScrollScreen>
    );
  }

  // While the pill is answering its own purchase, the plans page stays: the
  // store's sheet sits over it, and then the pill turns until the server
  // confirms. A failure or a delay ends that, and the pages below take over.
  if (holding) return plansScreen();

  // A confirmed store action remains confirmed even if its separate allowance
  // read fails. Do not return to Buy or guess the selected card's totals.
  if (granted) {
    return (
      <ScrollScreen bottom="inset" header={<ScreenHeader back={{ onPress: () => leave() }} title="Your purchase is confirmed" />}
        footer={<PillButton label="Back to practice" onPress={() => leave('back', onOpenPractice)} />}>
        <Text accessibilityLiveRegion="polite" style={[type.title, { color: paper.ink }]}>
          {grantReadPending ? 'Checking your speaking allowance.' : 'We couldn’t read your speaking allowance.'}
        </Text>
        <Text style={[type.body, { color: paper.ink, marginTop: space(3) }]}>Your purchase or restore was confirmed. Please do not buy again. Free local practice is available while we check your plan.</Text>
        <IconAction layout="inline" icon="refresh" busy={grantReadPending} label="Check my allowance again" disabled={grantReadPending} onPress={() => setRetry((value) => value + 1)} />
      </ScrollScreen>
    );
  }

  if (pendingPurchase !== null) return (
    <ScrollScreen bottom="inset" header={<ScreenHeader back={{ onPress: () => leave() }} title="Checking your purchase" />}
      footer={<PillButton label="Back to practice" onPress={() => leave('back', onOpenPractice)} />}>
      <Text accessibilityLiveRegion="polite" style={[type.body, { color: paper.ink }]}>A store purchase was started on this phone. Its matching paid plan has not been confirmed. Please do not buy again. Free local practice is available while confirmation catches up.</Text>
      {purchaseAccepted && <Text style={[type.small, { color: paper.inkSoft }]}>The store accepted the purchase; its speaking allowance is still being checked.</Text>}
      {message !== null && <Text accessibilityLiveRegion="polite" style={[type.small, { color: paper.inkSoft, marginTop: space(3) }]}>{message}</Text>}
      <IconAction layout="inline" icon="refresh" busy={busy} label={busy ? 'Checking your purchase' : 'Check my purchase again'} disabled={busy} onPress={() => void checkAcceptedPurchase()} />
    </ScrollScreen>
  );

  // A missing native store must never become a blank page. The wall reads no
  // progress any more, so the store is the one thing it waits for.
  const unavailable = offeringLoaded && page === undefined;
  const loading = !offeringLoaded;
  if (unavailable || loading) {
    return (
      <ScrollScreen
        bottom="inset"
        header={<ScreenHeader back={{ onPress: () => leave() }} title="Your plan" />}
        footer={<PillButton label={unavailable ? 'Back to practice' : 'Back'} onPress={unavailable ? () => leave('back', onOpenPractice) : () => leave()} />}
      >
        <Card>
          {unavailable && <Illustration name="state-offline" fit="small" />}
          <Text accessibilityLiveRegion="polite" style={{ ...type.display, color: paper.ink }}>
            {unavailable ? 'Plans aren’t available here yet.' : 'Getting things ready.'}
          </Text>
          <Text style={{ ...type.body, color: paper.ink, marginTop: space(4) }}>
            {unavailable ? 'We couldn’t load a store offering on this device. This does not tell us whether you have a paid plan. Free local practice is still available.' : 'A moment while we load your next steps.'}
          </Text>
        </Card>
        {unavailable && <>
          <IconAction layout="inline" icon="refresh" busy={busy} label="Try again" disabled={busy} onPress={() => setRetry((value) => value + 1)} />
          <GhostButton label="Restore purchases" disabled={busy} onPress={() => void restore()} />
        </>}
        {message !== null && <Text accessibilityLiveRegion="polite" style={type.small}>{message}</Text>}
      </ScrollScreen>
    );
  }

  return plansScreen();

  /**
   * The wall's own pages: what stays yours, then the plans. A declaration, so
   * it is drawn from two places: as the wall's ordinary page here, and above,
   * while the pill answers the purchase it started.
   */
  function plansScreen() {
    return (
      <ScrollScreen
        ground={colors.background}
        topGap={0}
        bottom="inset"
        header={<ScreenHeader ink={colors.text} muted={colors.muted} leave={{ label: WALL_LEAVE, onPress: () => leave() }} title={pages.length > 1 ? <ProgressDots ground={mode === 'dark' ? 'blue' : 'paper'} total={pages.length} index={index} /> : 'Luvani'} />}
        footer={
          <View>
            <PillButton
              label={label}
              tone="brand"
              // While it answers its own purchase the pill keeps its fill and
              // waits in place (`state`); any other wait (a restore) is the
              // quiet off pill it always was. Nothing to buy until a way to pay
              // is chosen: a purchase needs a product id, and a pill that opens
              // the store with none is a pill that fails.
              state={morph}
              disabled={(busy && morph === 'idle') || (action === 'buy' && chosen === null)}
              onPress={forward}
            />
            {page === 'plans' && <WallPlansAtButton trialTerms={trial?.terms ?? null} priceTerms={chosen ? billedPrice(chosen.price, chosen.period) : null} />}
          </View>
        }
      >
        {page === 'yours' && <WallYoursPage canBuy={storeHasPlans} onLeave={() => leave()} />}
        {page === 'plans' && planRows !== null && (
          <WallPlansPage
            rows={planRows}
            account={wallAccount(status, latestCatalogue(), Date.now())}
            selected={selected}
            trial={trial}
            onSelect={(offer) => {
              // The learner's own choice, and the only place one is recorded.
              touched.current = true;
              setSelected(offer.productId);
              void trackProductEvent({ name: 'plan_selected', properties: { plan: offer.plan } });
            }}
            onRestore={() => void restore()}
            onOpenPolicy={onOpenPolicy}
            onOpenTerms={onOpenTerms}
            onLeave={() => leave()}
          />
        )}
        {message !== null && (
          <Text accessibilityLiveRegion="polite" style={{ ...type.small, color: colors.text, marginTop: space(4), textAlign: 'center' }}>
            {message}
          </Text>
        )}
      </ScrollScreen>
    );
  }
}
