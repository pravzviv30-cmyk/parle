/**
 * The inline paywall inside the out-of-minutes card — Stage 3.
 *
 * With no store offering, `Paywall` used to return null, so a learner out of
 * minutes on the web, in Expo Go or on a keyless build met a card with nothing
 * in it and a Back button. Now the card always says something true: either the
 * store's own offer with its renewal terms and the two documents beside the
 * buy button, or a plain store-unavailable block that still offers a restore.
 * The screen's own Back stays outside the paywall in both cases, so there is
 * always a way out that costs nothing.
 *
 * Payment-adjacent, so the pins are strict. No digit reaches the learner
 * except inside the store's own localised price. The purchase and restore
 * calls are the ones they were. Nothing here reads entitlement or metering.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { guiltIn } from '../copy/guilt.ts';
import { PLANS_PRIVACY, PLANS_RENEWAL, PLANS_RESTORE, PLANS_TERMS, PLANS_TRUST } from '../wall/wallCopy.ts';
import type { PaidPlan, StoreProduct } from './adapter.ts';
import { RESTORE_SUB } from './subscription.ts';
import {
  STORE_UNAVAILABLE_BODY,
  STORE_UNAVAILABLE_TITLE,
  inlinePaywall,
  paywallSurface,
} from './paywallView.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const PAYWALL = stripComments(read('./Paywall.tsx'));
const FLAT = PAYWALL.replace(/\s+/g, ' ');
const CONVO = read('../ConvoScreen.tsx');
const LESSON = read('../LiveSessionScreen.tsx');
const OUT_OF_MINUTES_PAGE = read('../live/OutOfMinutesView.tsx');

const product = (plan: PaidPlan, localizedPrice: string, title = 'Starter'): StoreProduct => ({
  plan,
  productId: `luvani_${plan}_monthly`,
  title,
  localizedPrice,
});

/** Every string a view can put on glass, flattened. */
function linesOf(view: ReturnType<typeof inlinePaywall>): string[] {
  if (view.kind === 'unavailable') return [view.title, view.body, view.restoreLabel, RESTORE_SUB, view.privacy, view.terms, view.trust];
  const s = view.surface;
  return [s.title, s.body, s.purchaseLabel, s.restoreLabel, view.renewal, view.privacy, view.terms, view.trust];
}

describe('the inline paywall always leaves a way forward — Stage 3', () => {
  test('with no store offering it is a store-unavailable block with a restore, never nothing', () => {
    for (const offering of [
      { available: false } as const,
      { available: true, products: [] } as const,
      { available: true, products: [product('starter', '   ')] } as const,
    ]) {
      const view = inlinePaywall(offering);
      assert.equal(view.kind, 'unavailable', `${JSON.stringify(offering)} is drawn as an offer`);
      if (view.kind !== 'unavailable') continue;
      assert.equal(view.title, STORE_UNAVAILABLE_TITLE);
      assert.equal(view.body, STORE_UNAVAILABLE_BODY);
      assert.equal(view.restoreLabel, PLANS_RESTORE, 'the restore is named something the plans page does not call it');
      assert.equal(view.privacy, PLANS_PRIVACY);
      assert.equal(view.terms, PLANS_TERMS);
      assert.equal(view.trust, PLANS_TRUST);
      // The same rule the rest of the app keeps: unavailable is not an upgrade.
      assert.doesNotMatch(`${view.title} ${view.body}`, /\b(buy|upgrade|subscribe|price)\b/i, 'a failed store read is presented as an upgrade');
      assert.match(view.body, /restore/i, 'the body does not say a plan already paid for can come back');
    }
  });

  test('with an offer, the renewal terms and the two documents sit beside the buy button', () => {
    const view = inlinePaywall({ available: true, products: [product('regular', '£24.99', 'Max'), product('starter', '£14.99')] });
    assert.equal(view.kind, 'offer');
    if (view.kind !== 'offer') return;
    assert.deepEqual(view.surface, paywallSurface({ available: true, products: [product('regular', '£24.99', 'Max'), product('starter', '£14.99')] }), 'the offer is not the shared surface');
    assert.equal(view.renewal, PLANS_RENEWAL, 'the renewal terms are not the plans page’s own');
    assert.equal(view.privacy, PLANS_PRIVACY);
    assert.equal(view.terms, PLANS_TERMS);
  });

  test('no digit reaches the learner except the store’s own price', () => {
    const marker = '£14.99';
    const offer = inlinePaywall({ available: true, products: [product('starter', marker)] });
    const unavailable = inlinePaywall({ available: false });
    for (const [name, view] of [['offer', offer], ['unavailable', unavailable]] as const) {
      for (const line of linesOf(view)) {
        assert.equal(guiltIn(line), undefined, `${name}: "${line}" carries "${guiltIn(line)}"`);
        assert.doesNotMatch(line, /—/, `${name}: "${line}" carries an em dash`);
        const withoutPrice = line.split(marker).join('');
        assert.doesNotMatch(withoutPrice, /\d/, `${name}: "${line}" carries a digit that is not the store price`);
        assert.doesNotMatch(withoutPrice, /[$€£]/, `${name}: "${line}" carries a currency that is not the store price`);
      }
    }
    // The price is present exactly once, on the button, and only in the offer.
    assert.equal(linesOf(offer).filter((l) => l.includes(marker)).length, 1, 'the store price is shown twice, or not at all');
    assert.ok(linesOf(offer).find((l) => l.includes(marker)) === (offer.kind === 'offer' ? offer.surface.purchaseLabel : ''), 'the price is somewhere other than the buy button');

    // And the component writes no price of its own.
    assert.doesNotMatch(PAYWALL, /[$€£]\s*\d|\d+[.,]\d{2}/, 'the component invents a price');
    // Every word the component draws comes from a module: no text node of its own.
    assert.doesNotMatch(FLAT, /<Text[^>]*>[^<{]*[A-Za-z][^<{]*<\/Text>/, 'the component spells learner copy in JSX, where no scan can read it');
  });

  test('the component draws both states, and the screen keeps its free way out', () => {
    // Loaded, then decided by the module rather than by a null check here.
    assert.match(FLAT, /const view = inlinePaywall\(offering\);/, 'the component decides the state for itself');
    assert.match(FLAT, /if \(!loaded\) return null;/, 'the component draws a guess before the store answers');
    assert.ok(!/surface === null\) return null/.test(FLAT), 'no offering still draws nothing at all');
    // A store that throws is read as a store with nothing, not as a spinner forever.
    assert.match(FLAT, /\.catch\(\(\) => \{ if \(cancelled\) return; setOffering\(\{ available: false \}\); setLoaded\(true\); \}\)/, 'a store read that throws leaves the card empty');

    // Unavailable: restore and the two documents, no buy button.
    const unavailable = FLAT.slice(FLAT.indexOf("if (view.kind === 'unavailable')"), FLAT.indexOf('const surface = view.surface;'));
    assert.ok(unavailable.length > 0, 'there is no unavailable branch');
    assert.match(unavailable, /\{view\.title\}/);
    assert.match(unavailable, /\{view\.body\}/);
    assert.match(unavailable, /<GhostButton label=\{action === 'restoring' \? RESTORE_BUSY : view\.restoreLabel\}/, 'the unavailable block cannot restore');
    // Settings' own line, imported rather than retyped (and not via the view,
    // because subscription.ts already imports paywallView.ts).
    assert.match(unavailable, /\{RESTORE_SUB\}/, 'the restore is not explained, or not in the words Settings uses');
    assert.match(unavailable, /<Legal /, 'the documents are not reachable when the store is away');
    assert.ok(!unavailable.includes('<PillButton'), 'the unavailable block offers a purchase');

    // Offer: the renewal line and the documents are drawn right after the buy button.
    const offer = FLAT.slice(FLAT.indexOf('const surface = view.surface;'));
    const pill = offer.indexOf('<PillButton');
    assert.ok(pill !== -1, 'the offer has no buy button');
    assert.ok(pill < offer.indexOf('{view.renewal}'), 'the renewal terms are drawn above the button, away from it');
    assert.ok(offer.indexOf('{view.renewal}') < offer.indexOf('<Legal '), 'the documents are not beside the renewal terms');
    // Both states hand the same two routes the Wall plans page uses to the
    // shared small print, and the small print wires them to its two links.
    assert.equal((FLAT.match(/onPolicy=\{\(\) => nav\.navigate\('Policy'\)\}/g) ?? []).length, 2, 'the privacy link opens nothing in one of the two states');
    assert.equal((FLAT.match(/onTerms=\{\(\) => nav\.navigate\('Terms'\)\}/g) ?? []).length, 2, 'the terms link opens nothing in one of the two states');
    assert.match(FLAT, /<GhostButton label=\{privacy\} onPress=\{onPolicy\} \/>/, 'the privacy link is not wired');
    assert.match(FLAT, /<GhostButton label=\{terms\} onPress=\{onTerms\} \/>/, 'the terms link is not wired');

    // F607 centralizes store work in the wall and preserves the free exit.
    for (const source of [LESSON, CONVO]) {
      const at = source.indexOf("live.status.phase === 'out-of-minutes'");
      assert.ok(at >= 0);
      assert.match(source.slice(at, at + 600), /<OutOfMinutesView label=\{live.status.label\} message=\{live.status.message\} userId=\{userId\} onExit=\{onExit\}/);
    }
    assert.match(OUT_OF_MINUTES_PAGE, /<Sheet visible title=\{label\} onClose=\{onExit\}/);
    assert.match(OUT_OF_MINUTES_PAGE, /nav.navigate\('Wall', \{ entry: 'refused' \}\)/);
    assert.match(OUT_OF_MINUTES_PAGE, /label="Back to my French" onPress=\{onExit\}/);
    assert.doesNotMatch(OUT_OF_MINUTES_PAGE, /<Paywall/);

  });

  test('the renewal and the no-adverts line both sit at the buy button', () => {
    // 2026-09-27, notebook Phase 6-E: the trust line moved up from the documents
    // under the restore to sit with the renewal, right under the pill, which is
    // where the wall's plans page puts the same two lines.
    const offer = FLAT.slice(FLAT.indexOf('const surface = view.surface;'));
    const pill = offer.indexOf('<PillButton');
    const renewal = offer.indexOf('{view.renewal}');
    const trust = offer.indexOf('{view.trust}');
    const restore = offer.indexOf('<GhostButton');
    assert.ok(pill !== -1 && renewal !== -1 && trust !== -1 && restore !== -1, 'the offer lost its pill, renewal, trust line or restore');
    assert.ok(pill < renewal && renewal < trust && trust < restore, 'the renewal and trust lines are not together under the buy button');
    assert.doesNotMatch(offer, /<Legal trust=/, 'the offer says the trust line twice, or down by the documents');
  });

  test('buying and restoring are the same calls, and no entitlement or metering is read here', () => {
    assert.match(PAYWALL, /await settleStoreAction\(userId, \(\) => purchases\.purchase\(userId, surface\.product\.productId\)\)/, 'the buy call changed');
    assert.match(PAYWALL, /: await restorePurchases\(userId, 'inline'\)/, 'the restore call changed');
    // What the component may import, and nothing about grants or minutes.
    const imports = [...PAYWALL.matchAll(/from '([^']+)'/g)].map((m) => m[1]!).sort();
    assert.deepEqual(imports, [
      '../components.tsx',
      '../storage/scope.ts',
      '../theme.ts',
      './adapter.ts',
      './paywallView.ts',
      './restore.ts',
      './subscription.ts',
      '@react-navigation/native',
      'react',
      'react-native',
    ].sort(), 'the inline paywall reaches for something beyond the store and its own words');
    for (const forbidden of ['refreshBilling', 'billingStatus', 'planStatus', 'capabilities', 'entitlement', 'minutesLeft', 'remaining']) {
      assert.ok(!PAYWALL.includes(forbidden), `the inline paywall reads ${forbidden}`);
    }
    const VIEW = stripComments(read('./paywallView.ts'));
    for (const forbidden of ['refreshBilling', 'billingStatus', 'planStatus', 'fetch(']) {
      assert.ok(!VIEW.includes(forbidden), `paywallView reads ${forbidden}`);
    }
  });
});
