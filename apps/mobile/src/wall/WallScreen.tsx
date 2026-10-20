import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useMainAppearance } from '../main/MainAppearance.tsx';
import { paper, space, type } from '../theme.ts';

import { useAuth } from '../auth/useAuth.tsx';
import { beginPendingPurchase, clearPendingPurchase, confirmsPendingPurchase, loadPendingPurchase, markPendingDeferred, resolvePendingCheckout, type PendingPurchase } from '../purchases/pendingPurchase.ts';
import { scopeGeneration } from '../storage/scope.ts';
import { trackProductEvent } from '../analytics/track.ts';
import { IconAction, PillButton } from '../components.tsx';
import { Illustration } from '../art/flat/Illustration.tsx';
import { purchasePill, wallSuccess } from './wallSuccess.ts';
import { WALL_CONFIRMING } from './wallCopy.ts';
import { ScreenHeader, ScrollScreen } from '../layout.tsx';
import { useHardwareBack } from '../nav/useHardwareBack.ts';
import { purchases, type PaidPlan, type StoreOffering } from '../purchases/adapter.ts';
import type { BillingStatus } from '../purchases/billingStatus.ts';
import { fetchBillingStatus, refreshBilling } from '../purchases/client.ts';
import { PURCHASE_AWAITING_APPROVAL, paywallSurface, restoreTrouble } from '../purchases/paywallView.ts';
import { restorePurchases, settleStoreAction } from '../purchases/restore.ts';
import { LOCAL_CALENDAR } from '../reminders/plan.ts';
import { trialReminderSlot } from '../reminders/trialReminder.ts';
import { scheduleTrialReminder } from '../reminders/trialReminderSync.ts';
import { useTrialReminder } from '../reminders/useTrialReminder.ts';
import { latestCatalogue, noteCatalogue } from './catalogue.ts';
import { WallPlansAtButton, WallPlansPage } from './WallPlansPage.tsx';
import { WallYoursPage } from './WallYoursPage.tsx';
import { WallCta, WallLinks, WallNotice, WallSecondary, WallTextLink, WallTopRow, wallType } from './WallParts.tsx';
import {
  PAYWALL_CHECK_AGAIN, PAYWALL_LOADING, PAYWALL_PENDING_TITLE, PAYWALL_START_AGAIN, PAYWALL_START_AGAIN_TROUBLE, PAYWALL_START_AGAIN_WAIT, PAYWALL_TRY_AGAIN, PAYWALL_UNAVAILABLE_BODY, PAYWALL_UNAVAILABLE_TITLE,
  SUCCESS_FOOTNOTE, SUCCESS_TITLE, WALL_DONE, WALL_LEAVE, WALL_NEXT, WALL_READY, YOURS_DECLINE, YOURS_NEXT,
} from './wallCopy.ts';
import { wallAccount } from './wallAccount.ts';
import { chosenOffer, preselectedOffer, storeTrialMinutes, wallPlanRows } from './wallPlans.ts';
import { trialTimeline } from './trialTimeline.ts';
import { effectiveSelection, paywallCta, paywallNotice, paywallOffer, pendingCheckoutNotice, shouldScheduleTrialReminder, successSummary, trialEndsAt } from './trialPaywall.ts';
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
  // The trial-ending reminder's real state: the timeline promises it only when
  // it will be kept, and the success page names it only once it is scheduled.
  const trialReminder = useTrialReminder();
  // When the purchase this wall started began, for a trial end the server did not state.
  const boughtAt = useRef<number | null>(null);
  // What the learner last asked the store for, so a notice can say which ended.
  const lastAction = useRef<'buy' | 'restore' | null>(null);
  const remindedFor = useRef<number | null>(null);
  const [reminder, setReminder] = useState<{ scheduled: boolean; endsAt: number | null }>({ scheduled: false, endsAt: null });
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
    boughtAt.current = null;
    lastAction.current = null;
    remindedFor.current = null;
    setReminder({ scheduled: false, endsAt: null });
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;
    const owner = scopeGeneration();
    setPendingRead('loading'); setPendingPurchase(null);
    if (user === null) { setPendingRead('ready'); return; }
    void loadPendingPurchase().then(pending => {
      if (cancelled || owner !== scopeGeneration()) return;
      setPendingPurchase(pending); setPendingRead('ready');
      if (pending === null) return;
      storeGranted.current = true;
      // A quiet look on open, with no store sync and so no Apple ID prompt: the
      // fence comes down only when the server confirms or the store holds nothing.
      const id = user.id;
      void Promise.all([purchases.storeHolds(id, false), fetchBillingStatus(id)]).then(async ([store, server]) => {
        if (cancelled || owner !== scopeGeneration() || storeActionInFlight.current) return;
        if (resolvePendingCheckout(pending, store, server, 'open') !== 'clear') return;
        const cleared = await clearPendingPurchase(pending).catch(() => false);
        if (cancelled || owner !== scopeGeneration() || !cleared) return;
        setPendingPurchase(null); storeGranted.current = false;
      }).catch(() => {});
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
  const success = granted ? wallSuccess(confirmedGrant, latestCatalogue(), purchaseAccepted && boughtTrial.current) : null;

  // The page's own suggestion (D16, README Part 5.G): the yearly product of the
  // plan that covers the learner's daily goal, chosen once, while nothing is,
  // and only once the server has said what the learner holds. It is not the
  // learner's choice, so it records nothing: `plan_selected` is fired by a tap
  // alone, in `onSelect` below.
  const suggestion = status === null ? null : preselectedOffer(planRows, goal, status)?.productId ?? null;
  // What the page shows and the button buys: the learner's choice, else the
  // suggestion, else the default (Starter yearly), so an available offering
  // always shows a priced offer (`effectiveSelection`).
  const showing = effectiveSelection(planRows, selected, suggestion);
  const chosen = chosenOffer(planRows, showing);
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

  // The trial bought here is confirmed: schedule its reminder for the
  // server's period end (else purchase time plus the offer's trial days).
  // Never asks for notification permission; `scheduleTrialReminder` keeps
  // its own promise rule and answers whether a reminder is now scheduled.
  useEffect(() => {
    if (!ownsWall || !shouldScheduleTrialReminder(success, confirmedGrant)) return;
    const endsAt = trialEndsAt(confirmedGrant?.periodEnd ?? null, boughtAt.current, chosen?.trialDays ?? null);
    if (endsAt === null || remindedFor.current === endsAt) return;
    remindedFor.current = endsAt;
    const owner = scopeGeneration();
    setReminder({ scheduled: false, endsAt });
    void scheduleTrialReminder({ trialEndsAt: endsAt, now: Date.now() })
      .then((scheduled) => { if (owner === scopeGeneration()) setReminder({ scheduled, endsAt }); })
      .catch(() => {});
  }, [ownsWall, success, confirmedGrant, chosen?.trialDays]);

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
    remind: trialReminder.promised,
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
    if (outcome.kind === 'awaiting-approval') {
      // Ask to Buy: no grant and the fence stays. Only the saved words change, so a reopen still says it.
      await markPendingDeferred(checkout).catch(() => false);
      if (owner !== scopeGeneration()) return;
      setPendingPurchase({ ...checkout, deferred: true });
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

  /**
   * The pending page's way out of a checkout the store no longer holds (a
   * declined or expired Ask to Buy, a failed sheet). It syncs with the store,
   * reads the server, and clears the fence only on `resolvePendingCheckout`'s
   * clear. It never buys, restores, grants or schedules anything.
   */
  const startAgain = async () => {
    if (!ownsWall || user === null || pendingPurchase === null || busy || storeActionInFlight.current) return;
    const owner = scopeGeneration();
    const record = pendingPurchase;
    storeActionInFlight.current = true; setBusy(true); setMessage(null);
    const store = await purchases.storeHolds(user.id, true);
    if (owner !== scopeGeneration()) return;
    await refreshBilling(user.id, owner);
    if (owner !== scopeGeneration()) return;
    const standing = await fetchBillingStatus(user.id);
    if (owner !== scopeGeneration()) return;
    const answer = resolvePendingCheckout(record, store, standing, 'start-again');
    if (answer === 'clear') {
      const cleared = await clearPendingPurchase(record).catch(() => false);
      if (owner !== scopeGeneration()) return;
      if (cleared) {
        setPendingPurchase(null);
        if (!purchaseAccepted) storeGranted.current = false;
        if (standing !== null) setStatus(standing);
        const plans = pages.indexOf('plans');
        if (plans >= 0) setIndex(plans);
      } else setMessage(PAYWALL_START_AGAIN_TROUBLE);
    } else setMessage(answer === 'wait' ? PAYWALL_START_AGAIN_WAIT : PAYWALL_START_AGAIN_TROUBLE);
    storeActionInFlight.current = false; setBusy(false);
  };

  const forward = () => {
    if (action === 'buy') {
      lastAction.current = 'buy';
      // The pill answers the purchase it starts. Only a purchase that can
      // actually begin turns it; `buy` itself still decides whether it does.
      if (chosen !== null && !busy && !granted && pendingPurchase === null && !storeGranted.current) {
        boughtTrial.current = chosen.hasFreeTrial;
        boughtAt.current = Date.now();
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

  // What the page says for the chosen product (trial or standard), the notice
  // above the button, and the button itself: all decided in trialPaywall.ts.
  const offerView = chosen === null ? null : paywallOffer(chosen, trial);
  const notice = paywallNotice(message, lastAction.current);
  const morphLabel = morph === 'done' ? WALL_READY : granted && morph === 'busy' ? WALL_CONFIRMING : null;
  const cta = action === 'buy'
    ? paywallCta({ offer: offerView, busy, morphLabel, notice })
    : { label: action === 'to-plans' ? YOURS_NEXT : action === 'done' ? WALL_DONE : WALL_NEXT, dim: 1 };
  const label = cta.label;
  const onRestore = () => { lastAction.current = 'restore'; void restore(); };

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
  // published under exactly this condition, and nowhere else. No close mark:
  // the one way on is the button.
  if (success !== null && !holding) {
    const reminderAt = reminder.scheduled && reminder.endsAt !== null ? trialReminderSlot(reminder.endsAt, Date.now(), LOCAL_CALENDAR)?.at ?? null : null;
    const summary = successSummary({
      success, offer: chosen, catalogue: latestCatalogue(), plan: confirmedGrant?.plan ?? null,
      endsAt: reminder.endsAt ?? (confirmedGrant?.periodEnd ? Date.parse(confirmedGrant.periodEnd) : null),
      reminderScheduled: reminder.scheduled, reminderAt,
    });
    return (
      <ScrollScreen ground={colors.background} topGap={0} bottom="inset" header={<WallTopRow />}
        footer={<View style={st.footer}>
          <WallCta label={startSpeakingLabel} onPress={() => leave('speak')} />
          <Text style={[wallType.detail, { color: colors.muted }]}>{SUCCESS_FOOTNOTE}</Text>
        </View>}>
        <View style={st.body}>
          <Text accessibilityRole="header" style={[wallType.headline, { color: colors.text }]}>{SUCCESS_TITLE}</Text>
          <Text style={[wallType.body, st.centred, { color: colors.muted }]}>{summary.body}</Text>
          <View style={[st.summary, { backgroundColor: colors.surface }]}>
            {summary.rows.map((row, at) => (
              <View key={row.key} style={[st.summaryRow, at > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
                <Text style={[wallType.line, { color: colors.muted }]}>{row.key}</Text>
                <Text style={[wallType.line, { color: colors.text }]}>{row.value}</Text>
              </View>
            ))}
          </View>
        </View>
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
      <ScrollScreen bottom="inset" ground={colors.background} header={<ScreenHeader ink={colors.text} back={{ onPress: () => leave() }} title="Your purchase is confirmed" />}
        footer={<PillButton label="Back to practice" tone="brand" onPress={() => leave('back', onOpenPractice)} />}>
        <Text accessibilityLiveRegion="polite" style={[type.title, { color: colors.text }]}>
          {grantReadPending ? 'Checking your speaking allowance.' : 'We couldn’t read your speaking allowance.'}
        </Text>
        <Text style={[type.body, { color: colors.text, marginTop: space(3) }]}>Your purchase or restore was confirmed. Please do not buy again. Free local practice is available while we check your plan.</Text>
        <IconAction layout="inline" icon="refresh" busy={grantReadPending} label="Check my allowance again" disabled={grantReadPending} onPress={() => setRetry((value) => value + 1)} />
      </ScrollScreen>
    );
  }

  if (pendingPurchase !== null) return (
    <ScrollScreen ground={colors.background} topGap={0} bottom="inset" header={<WallTopRow onPress={() => leave()} />}
      footer={<View style={st.footer}>
        <WallNotice notice={pendingCheckoutNotice(pendingPurchase.deferred === true) ?? { title: PAYWALL_PENDING_TITLE, body: 'A store purchase was started on this phone. Its matching paid plan has not been confirmed. Please do not buy again. Free local practice is available while confirmation catches up.', danger: false }} />
        {message !== null && message !== PURCHASE_AWAITING_APPROVAL && <Text accessibilityLiveRegion="polite" style={[wallType.detail, { color: colors.muted }]}>{message}</Text>}
        <WallCta label={PAYWALL_CHECK_AGAIN} dim={busy ? 0.6 : 1} disabled={busy} state={busy ? 'busy' : 'idle'} onPress={() => void checkAcceptedPurchase()} />
        <WallSecondary label={PAYWALL_START_AGAIN} disabled={busy} onPress={() => void startAgain()} />
        <WallLinks onTerms={onOpenTerms} onPrivacy={onOpenPolicy} />
      </View>}>
      <View style={st.body}>
        {purchaseAccepted && <Text style={[wallType.line, st.centred, { color: colors.muted }]}>The store accepted the purchase; its speaking allowance is still being checked.</Text>}
      </View>
    </ScrollScreen>
  );

  // A missing native store must never become a blank page. The wall reads no
  // progress any more, so the store is the one thing it waits for.
  // A plans page with nothing it can price is the unavailable state, never an empty page.
  const unavailable = offeringLoaded && (page === undefined || (page === 'plans' && chosen === null));
  const loading = !offeringLoaded;
  if (unavailable || loading) {
    return (
      <ScrollScreen ground={colors.background} topGap={0} bottom="inset" center={unavailable} header={<WallTopRow onPress={unavailable ? () => leave('back', onOpenPractice) : () => leave()} />}
        footer={<View style={st.footer}>
          {loading && <WallCta label={PAYWALL_LOADING} dim={0.45} disabled onPress={() => {}} />}
          {notice !== null && <WallNotice notice={notice} />}
          <WallLinks onRestore={unavailable ? onRestore : undefined} restoreDisabled={busy} onTerms={onOpenTerms} onPrivacy={onOpenPolicy} />
        </View>}
      >
        {loading
          ? <WallPlansPage rows={[]} catalogue={null} account={null} selected={null} trial={null} offer={null} loading onSelect={() => {}} />
          : <View style={[st.body, st.unavailable]}>
            <Illustration name="state-offline" fit="small" />
            <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={[wallType.stateTitle, { color: colors.text }]}>{PAYWALL_UNAVAILABLE_TITLE}</Text>
            <Text style={[wallType.body, st.centred, { color: colors.muted }]}>{PAYWALL_UNAVAILABLE_BODY}</Text>
            <WallSecondary label={PAYWALL_TRY_AGAIN} disabled={busy} onPress={() => setRetry((value) => value + 1)} />
            {/* The one clear way back to free practice; `leave` records wall_left once. */}
            <WallTextLink label={YOURS_DECLINE} onPress={() => leave('back', onOpenPractice)} />
          </View>}
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
        header={<WallTopRow onPress={() => leave()} />}
        footer={
          <View style={st.footer}>
            {page === 'plans' && notice !== null && <WallNotice notice={notice} />}
            <WallCta
              label={label}
              dim={cta.dim}
              // While it answers its own purchase the button keeps its fill and
              // waits in place (`state`). Nothing to buy until a way to pay is
              // chosen: a purchase needs a product id.
              state={morph}
              disabled={(busy && morph === 'idle') || (action === 'buy' && chosen === null)}
              onPress={forward}
            />
            {page === 'plans' && <WallPlansAtButton disclosure={offerView?.disclosure ?? null} busy={busy} onRestore={onRestore} onOpenTerms={onOpenTerms} onOpenPolicy={onOpenPolicy} />}
            {/* D24: the wall opens on its own now (on launch, on a locked feature), so declining is said in words too, beside the close mark. */}
            {page === 'plans' && <WallTextLink label={WALL_LEAVE} onPress={() => leave()} />}
            {page !== 'plans' && notice !== null && <Text accessibilityLiveRegion="polite" style={[wallType.detail, { color: colors.text }]}>{notice.body}</Text>}
          </View>
        }
      >
        {page === 'yours' && <WallYoursPage canBuy={storeHasPlans} onLeave={() => leave()} />}
        {page === 'plans' && planRows !== null && (
          <WallPlansPage
            rows={planRows}
            catalogue={latestCatalogue()}
            account={wallAccount(status, latestCatalogue(), Date.now())}
            selected={showing}
            trial={trial}
            offer={offerView}
            busy={busy || holding}
            onSelect={(offer) => {
              // The learner's own choice, and the only place one is recorded.
              touched.current = true;
              setSelected(offer.productId);
              void trackProductEvent({ name: 'plan_selected', properties: { plan: offer.plan } });
            }}
          />
        )}
      </ScrollScreen>
    );
  }
}

const st = StyleSheet.create({
  footer: { paddingTop: space(3), gap: 10 },
  body: { paddingHorizontal: space(2), paddingTop: space(5), gap: space(3) },
  centred: { textAlign: 'center' },
  unavailable: { alignItems: 'stretch', gap: space(4) },
  summary: { borderRadius: 20, paddingHorizontal: space(4), marginTop: space(3) },
  summaryRow: { minHeight: 48, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: space(3) },
});
