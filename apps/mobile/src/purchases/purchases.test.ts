import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative as relativePath } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { guiltIn } from '../copy/guilt.ts';
import { purchases } from './adapter.ts';
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
const NATIVE = read('./adapter.native.ts');
const PAYWALL = read('./Paywall.tsx');
const RESTORE = read('./restore.ts');
const SUBSCRIPTION = read('./subscription.ts');
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
    assert.match(NATIVE, /if \(!key \|\| !STARTER_PRODUCT\) return false/);
    assert.match(NATIVE, /if \(!found \|\| !price\) return \{ available: false \}/);
    assert.match(NATIVE, /ExecutionEnvironment\.StoreClient/);
    assert.match(WEB, /return \{ available: false \}/);
  });
});

describe('the shared paywall — F250', () => {
  test('the paywall stays dark until the store returns a purchasable product', () => {
    assert.equal(paywallSurface({ available: false }), null);
    assert.equal(paywallSurface({
      available: true,
      product: { plan: 'starter', productId: 'starter', title: 'Starter', localizedPrice: '   ' },
    }), null);
    const shown = paywallSurface({
      available: true,
      product: { plan: 'starter', productId: 'starter', title: 'Starter', localizedPrice: '£14.99' },
    });
    assert.equal(shown?.purchaseLabel, 'Continue with Starter · £14.99');
  });

  test('paywall copy carries no banned words and no invented price', () => {
    const marker = '__STORE_LOCAL_PRICE__';
    const shown = paywallSurface({
      available: true,
      product: { plan: 'starter', productId: 'starter', title: 'Starter', localizedPrice: marker },
    });
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
      assert.match(source.slice(at, at + 1200), /<Paywall userId=\{userId\}/, `${screen} omits the shared paywall`);
    }
  });
});

describe('manage subscription and restore, on Settings as well as the paywall — F475', () => {
  const starter = (localizedPrice: string) => ({
    available: true as const,
    product: { plan: 'starter' as const, productId: 'starter', title: 'Starter', localizedPrice },
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
    assert.deepEqual(filesContaining(/refreshBilling\(/), ['purchases/client.ts', 'purchases/restore.ts']);

    // Store first, server second, and the server only once the store said yes.
    assert.match(RESTORE, /return settleStoreAction\(await purchases\.restore\(userId\)\)/);
    assert.match(RESTORE, /if \(!action\.ok\) return \{ kind: action\.cancelled \? 'cancelled' : 'store-trouble' \}/);
    assert.match(RESTORE, /await refreshBilling\(\)\) \? \{ kind: 'done' \} : \{ kind: 'refresh-trouble' \}/);

    // The paywall runs that function rather than a second copy of it.
    assert.match(PAYWALL, /import \{ restorePurchases, settleStoreAction \} from '\.\/restore\.ts'/);
    assert.match(PAYWALL, /: await restorePurchases\(userId\)/);
    assert.match(PAYWALL, /action === 'restoring' \? RESTORE_BUSY/, 'the paywall stopped spelling the waiting line');

    // What each ending says, which is what the two surfaces share. A learner
    // who backed out of a store sheet is told nothing, because backing out is
    // a choice and not a failure.
    assert.equal(restoreTrouble({ kind: 'store-trouble' }), PURCHASE_TROUBLE);
    assert.equal(restoreTrouble({ kind: 'refresh-trouble' }), REFRESH_TROUBLE);
    assert.equal(restoreTrouble({ kind: 'cancelled' }), null);
    assert.equal(restoreTrouble({ kind: 'done' }), null, 'the shared function invented a success line');
  });

  test("manage opens the store's own sheet on a device and is unavailable on the web", async () => {
    assert.match(WEB, /manage\(userId: string\): Promise<StoreAction>;/, 'manage is not on the adapter contract');
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
