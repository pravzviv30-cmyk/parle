import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { guiltIn } from '../copy/guilt.ts';
import { paywallSurface } from './paywallView.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
const WEB = read('./adapter.ts');
const NATIVE = read('./adapter.native.ts');
const PAYWALL = read('./Paywall.tsx');

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
