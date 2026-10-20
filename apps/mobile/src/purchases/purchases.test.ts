import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative as relativePath } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { guiltIn } from '../copy/guilt.ts';
import { purchases, type PaidPlan, type StoreProduct } from './adapter.ts';
import {
  PURCHASE_TROUBLE,
  REFRESH_TROUBLE,
  RESTORE_BUSY,
  paywallSurface,
  restoreTrouble,
} from './paywallView.ts';
import {
  MANAGE_ROW,
  MANAGE_SUB,
  RESTORE_DONE,
  RESTORE_ROW,
  RESTORE_SUB,
  SUBSCRIPTION_COPY,
  subscriptionGroup,
} from './subscription.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
const WEB = read('./adapter.ts');
const CONTRACT = read('./contract.ts');
const NATIVE = read('./adapter.native.ts');
const PAYWALL = read('./Paywall.tsx');
const RESTORE = read('./restore.ts');
const SETTLEMENT = read('./storeSettlement.ts');
const SUBSCRIPTION = read('./subscription.ts');
const SETTINGS_SCREEN = read('../settings/SettingsScreen.tsx');

/** One store product, as the store would hand it over. */
const product = (plan: PaidPlan, localizedPrice: string, title = 'Core'): StoreProduct => ({
  plan,
  productId: `luvani_${plan}_monthly`,
  title,
  localizedPrice,
  period: 'month',
  intro: null,
  introEligible: false,
});
const SRC = fileURLToPath(new URL('..', import.meta.url));

/** Every non-test source file in the app, so "one function" can be checked app wide. */
function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** The files whose source matches, named relative to src/ so a failure reads. */
function filesContaining(pattern: RegExp): string[] {
  return sourceFiles(SRC)
    .filter((file) => pattern.test(readFileSync(file, 'utf8')))
    .map((file) => relativePath(SRC, file))
    .sort();
}

describe('the purchases platform pair — F249', () => {
  test('only the native half of the purchases pair imports the store SDK', () => {
    assert.doesNotMatch(WEB, /react-native-purchases/);
    assert.match(NATIVE, /from 'react-native-purchases'/);
    assert.equal((NATIVE.match(/from 'react-native-purchases'/g) ?? []).length, 1);
  });

  test('without a configured key the adapter reports purchases unavailable', () => {
    // A key and at least one product id. Either alone buys nothing: a key with
    // no product has nothing to sell, and a product id with no key cannot reach
    // the store to ask about it. This read `!STARTER_PRODUCT` when starter was
    // the only tier the app could buy.
    assert.match(NATIVE, /if \(!key \|\| configuredPlans\(\)\.length === 0\) return false/);
    assert.match(NATIVE, /if \(priced\.length === 0\) return \{ available: false \}/);
    assert.match(NATIVE, /ExecutionEnvironment\.StoreClient/);
    assert.match(WEB, /return \{ available: false \}/);
  });
});

describe('the shared paywall — F250', () => {
  test('the paywall stays dark until the store returns a purchasable product', () => {
    assert.equal(paywallSurface({ available: false }), null);
    assert.equal(paywallSurface({ available: true, products: [] }), null, 'an empty offering is not a product');
    assert.equal(
      paywallSurface({ available: true, products: [product('starter', '   ')] }),
      null,
      'a blank store price is not a product',
    );
    const shown = paywallSurface({ available: true, products: [product('starter', '£14.99')] });
    assert.equal(shown?.purchaseLabel, 'Continue with Core · £14.99');

    // Two tiers, one button. The terminal refusal offers the cheapest and never a
    // choice: somebody who has just been stopped at a room door is not in a
    // position to weigh two plans, and the wall is where that comparison belongs.
    const both = paywallSurface({
      available: true,
      products: [product('regular', '£24.99', 'Max'), product('starter', '£14.99')],
    });
    assert.equal(both?.product.plan, 'starter', 'the refusal block offers the dearer tier');
    assert.equal(both?.purchaseLabel, 'Continue with Core · £14.99');

    // And it names what the store named. A build configured with only the second
    // product would otherwise have offered Max under the word Starter, with a
    // price beside it making that look deliberate.
    const maxOnly = paywallSurface({ available: true, products: [product('regular', '£24.99', 'Max')] });
    assert.equal(maxOnly?.purchaseLabel, 'Continue with Max · £24.99');
  });

  test('paywall copy carries no banned words and no invented price', () => {
    const marker = '__STORE_LOCAL_PRICE__';
    const shown = paywallSurface({ available: true, products: [product('starter', marker)] });
    assert.ok(shown);
    for (const line of [shown.title, shown.body, shown.purchaseLabel, shown.restoreLabel]) {
      assert.equal(guiltIn(line), undefined, `guilt in paywall copy: ${line}`);
    }
    assert.ok(shown.purchaseLabel.includes(marker), 'the store localized price did not reach the purchase button');
    assert.doesNotMatch(PAYWALL.replace(/surface\.purchaseLabel/g, ''), /[$€£]\s*\d|\d+[.,]\d{2}/, 'the component invents a price');
  });

  test('both out-of-minutes screens render the shared paywall surface', () => {
    for (const screen of ['../LiveSessionScreen.tsx', '../ConvoScreen.tsx']) {
      const source = read(screen);
      const at = source.indexOf("live.status.phase === 'out-of-minutes'");
      assert.notEqual(at, -1, `${screen} has no out-of-minutes branch`);
      const branch = source.slice(at, at + 1200);
      // Stage 3 (2026-09-25): the lesson hands this phase to its own page on
      // the scrolling frame, so its paywall is read there.
      const page = /<OutOfMinutesView\b/.test(branch) ? read('../live/OutOfMinutesView.tsx') : branch;
      assert.match(branch, /<OutOfMinutesView label=\{live.status.label\} message=\{live.status.message\}/);
      assert.match(page, /<Sheet visible title=\{label\} onClose=\{onExit\}/);
      assert.match(page, /nav.navigate\('Wall', \{ entry: 'refused', resumeRouteKey: route.key \}\)/);
      assert.match(page, /label="Back to practice" onPress=\{onExit\}/);
      assert.doesNotMatch(page, /<Paywall/);
    }
  });
});

describe('manage subscription and restore, on Settings as well as the paywall — F475', () => {
  const starter = (localizedPrice: string) => ({
    available: true as const,
    products: [product('starter', localizedPrice)],
  });

  test('the subscription group is drawn only when the store answers with a product', () => {
    // Expo Go, the web, and any build without RevenueCat keys all land here.
    // Two rows that open onto nothing are worse than no group at all.
    assert.equal(subscriptionGroup({ available: false }), null);
    assert.equal(subscriptionGroup(starter('   ')), null, 'a blank store price is not a product');

    const rows = subscriptionGroup(starter('£14.99'));
    assert.ok(rows, 'a real product drew no group');
    assert.deepEqual(rows.map((row) => row.action), ['manage', 'restore']);
    assert.deepEqual(rows.map((row) => row.label), [MANAGE_ROW, RESTORE_ROW]);
    assert.deepEqual(rows.map((row) => row.sub), [MANAGE_SUB, RESTORE_SUB]);

    // The store's own price reached the paywall in the same call and must not
    // have followed the rows onto a settings screen.
    for (const row of rows) assert.doesNotMatch(`${row.label} ${row.sub}`, /14\.99|£/, 'a price reached a settings row');
  });

  test('restore on Settings and restore on the paywall are one function', () => {
    // The adapter and the billing refresh are spoken to in exactly one place,
    // so a second surface cannot half-restore by forgetting the server.
    assert.deepEqual(filesContaining(/purchases\.restore\(/), ['purchases/restore.ts']);
    assert.deepEqual(filesContaining(/refreshBilling\(/), ['purchases/client.ts', 'purchases/restore.ts', 'wall/WallScreen.tsx']);
    // 3 Oct F704: accepted checkout recovery refreshes only the server, without reopening a store sheet.
    const wall = readFileSync(new URL('../wall/WallScreen.tsx', import.meta.url), 'utf8');
    const recovery = wall.slice(wall.indexOf('  const checkAcceptedPurchase ='), wall.indexOf('  const forward ='));
    assert.match(recovery, /refreshBilling\(user.id, owner\)/);
    assert.match(recovery, /confirmsPendingPurchase\(pendingPurchase, standing\)/);
    assert.doesNotMatch(recovery, /purchases\.(?:purchase|restore)\(/);

    // Store first, server second, and the server only once the store said yes.
    assert.match(RESTORE, /const outcome = await settleStoreAction\(userId, \(\) => purchases\.restore\(userId\)\)/);
    assert.match(SETTLEMENT, /if \(!action\.ok\) return \{ kind: action\.cancelled \? 'cancelled' : 'store-trouble' \}/);
    // A truthy refresh is no longer a grant. `(await refreshBilling()) ? done :
    // refresh-trouble` read `response.ok`, which is true for a learner with nothing
    // to restore, so owning nothing and having just subscribed produced the same
    // ending (F265). The server now says which, and these three lines are that.
    assert.match(RESTORE, /\(\) => refreshBilling\(userId, owner\)/);
    assert.match(SETTLEMENT, /if \(!current\(\) \|\| result === null\) return \{ kind: 'refresh-trouble' \};/);
    assert.match(SETTLEMENT, /return result\.granted \? \{ kind: 'done', plan: result\.plan \} : \{ kind: 'nothing-granted' \};/);
    assert.doesNotMatch(
      RESTORE.replace(/\/\/[^\n]*/g, ''),
      /\(await refreshBilling\(\)\) \?/,
      'the store finishing is being read as the server granting',
    );

    // The paywall runs that function rather than a second copy of it.
    assert.match(PAYWALL, /import \{ restorePurchases, settleStoreAction \} from '\.\/restore\.ts'/);
    assert.match(PAYWALL, /: await restorePurchases\(userId, 'inline'\)/);
    assert.match(PAYWALL, /action === 'restoring' \? RESTORE_BUSY/, 'the paywall stopped spelling the waiting line');

    // What each ending says, which is what the two surfaces share. A learner
    // who backed out of a store sheet is told nothing, because backing out is
    // a choice and not a failure.
    assert.equal(restoreTrouble({ kind: 'store-trouble' }), PURCHASE_TROUBLE);
    assert.equal(restoreTrouble({ kind: 'refresh-trouble' }), REFRESH_TROUBLE);
    assert.equal(restoreTrouble({ kind: 'cancelled' }), null);
    assert.equal(restoreTrouble({ kind: 'done', plan: 'starter' }), null, 'the shared function invented a success line');
    // The ending that used to be indistinguishable from success. On this surface a
    // purchase has just happened, so a grant that has not landed yet is the honest
    // reading; Settings words the same outcome as "checked".
    assert.equal(restoreTrouble({ kind: 'nothing-granted' }), REFRESH_TROUBLE);
    assert.doesNotMatch(
      SETTINGS_SCREEN,
      /outcome\.kind === 'done' \? RESTORE_DONE/,
      'Settings reads a granted-nothing restore as trouble instead of as a checked store',
    );
    assert.match(SETTINGS_SCREEN, /outcome\.kind === 'done' \|\| outcome\.kind === 'nothing-granted'/);
  });

  test("manage opens the store's own sheet on a device and is unavailable on the web", async () => {
    assert.match(CONTRACT, /manage\(userId: string\): Promise<StoreAction>;/, 'manage is not on the adapter contract');
    assert.match(WEB, /export \* from '\.\/contract\.ts';/, 'the web adapter must retain its public contract exports');
    assert.doesNotMatch(WEB, /showManageSubscriptions/);
    assert.deepEqual(await purchases.manage('learner'), { ok: false, cancelled: false });

    const manage = NATIVE.slice(NATIVE.indexOf('async manage(userId)'));
    assert.notEqual(manage, NATIVE, 'the native half has no manage');
    // Configure and log in first, then the store's sheet, and a thrown
    // cancellation read the same way purchase and restore read it.
    assert.match(manage, /if \(!\(await ready\(userId\)\)\) return \{ ok: false, cancelled: false \}/);
    assert.match(manage, /await Purchases\.showManageSubscriptions\(\)/);
    assert.match(manage, /catch \(error\) \{\n\s+return actionFrom\(error\);/);
    // Nothing about a subscription is read back off the device: the sheet is
    // the store's, and entitlement is settled at token issuance.
    assert.doesNotMatch(manage, /getCustomerInfo|entitlements/);
  });

  test('subscription copy carries no price, no count and no banned word', () => {
    assert.ok(SUBSCRIPTION_COPY.length >= 8, 'the copy list is too short to be the whole surface');
    for (const line of [MANAGE_ROW, MANAGE_SUB, RESTORE_ROW, RESTORE_SUB, RESTORE_DONE, RESTORE_BUSY]) {
      assert.ok(SUBSCRIPTION_COPY.includes(line), `left out of the scanned list: ${line}`);
    }
    for (const line of SUBSCRIPTION_COPY) {
      assert.equal(guiltIn(line), undefined, `guilt in subscription copy: ${line}`);
      assert.doesNotMatch(line, /—/, `em dash in subscription copy: ${line}`);
      assert.doesNotMatch(line, /\d/, `a digit in subscription copy: ${line}`);
      assert.doesNotMatch(line, /[$€£]/, `a currency in subscription copy: ${line}`);
    }
    assert.doesNotMatch(SUBSCRIPTION, /[$€£]\s*\d|\d+[.,]\d{2}/, 'the module carries a price');

    // F377 again: the store says it finished, never what it found, and the
    // minutes are the server's to know. So this reports a check, not a result.
    assert.match(RESTORE_DONE, /has been checked/);
    assert.doesNotMatch(RESTORE_DONE, /restored|found|added|now have/i, 'the line claims what the phone cannot see');
  });
});
