/**
 * The preview switch, and the three things that must all be true before it opens.
 *
 * This is the only way to reach the wall before a store exists, so it is the
 * only thing standing between "a reviewer can see it" and "a shipped app opens
 * on a subscription screen". It is gated the way the token server's development
 * entitlement store is gated, and for the same reason: a preview that can be
 * switched on from outside is not a preview, it is a feature nobody designed.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';

import { PLANS } from '@luvani/core';

import { previewCatalogue, previewOffering, wallPreviewEnabled } from './preview.ts';

const ON = {
  EXPO_PUBLIC_LUVANI_WALL_PREVIEW: '1',
  EXPO_PUBLIC_LUVANI_LOCAL_DEVELOPMENT: '1',
  NODE_ENV: 'development',
};

describe('the wall opens itself only for a reviewer', () => {
  test('all three conditions together, and nothing less', () => {
    assert.equal(wallPreviewEnabled(ON), true);
    assert.equal(wallPreviewEnabled({ ...ON, EXPO_PUBLIC_LUVANI_WALL_PREVIEW: undefined }), false);
    assert.equal(wallPreviewEnabled({ ...ON, EXPO_PUBLIC_LUVANI_LOCAL_DEVELOPMENT: undefined }), false);
    assert.equal(wallPreviewEnabled({ ...ON, NODE_ENV: 'production' }), false);
  });

  test('a production build refuses it however loudly the flags are set', () => {
    // The one that matters. Everything else is a mistake somebody can make in a
    // terminal; this is the one that would reach a learner.
    assert.equal(
      wallPreviewEnabled({
        EXPO_PUBLIC_LUVANI_WALL_PREVIEW: '1',
        EXPO_PUBLIC_LUVANI_LOCAL_DEVELOPMENT: '1',
        NODE_ENV: 'production',
      }),
      false,
    );
  });

  test('it rides the same switch the mock auth adapter needs, so it cannot reach real infrastructure', () => {
    // `EXPO_PUBLIC_LUVANI_LOCAL_DEVELOPMENT` is what `selectAuthMode` requires
    // before it will hand out the on-device mock. Requiring it here means a build
    // pointed at a real Supabase project cannot also be previewing the wall.
    assert.equal(wallPreviewEnabled({ ...ON, EXPO_PUBLIC_LUVANI_LOCAL_DEVELOPMENT: '0' }), false);
    const source = readFileSync(fileURLToPath(new URL('./preview.ts', import.meta.url)), 'utf8');
    assert.match(source, /EXPO_PUBLIC_LUVANI_LOCAL_DEVELOPMENT !== '1'/);
  });

  test('an empty environment is off, which is what every build that never heard of it has', () => {
    assert.equal(wallPreviewEnabled({}), false);
  });
});

describe('the fixture offering exists only where the switch does', () => {
  test('a production build is offered nothing, whatever the flags say', () => {
    // Page four is the one page selling anything, so it is the one page whose
    // preview could actually charge somebody if it escaped. It cannot: this is
    // the same gate, and the gate refuses production outright.
    assert.equal(previewOffering({ ...ON, NODE_ENV: 'production' }), null);
    assert.equal(previewOffering({ ...ON, EXPO_PUBLIC_LUVANI_LOCAL_DEVELOPMENT: undefined }), null);
    assert.equal(previewOffering({}), null);
  });

  test('a preview build gets two obviously made-up products', () => {
    const offering = previewOffering(ON);
    assert.ok(offering?.available);
    assert.deepEqual(offering.products.map((p) => p.plan), ['starter', 'regular']);
    // 7 October 2026 (F772): the yearly products ride with them, so the yearly
    // rows and the trial timeline can be reviewed; they are fixtures the same way.
    assert.deepEqual(offering.yearly?.map((p) => [p.plan, p.period]), [['starter', 'year'], ['regular', 'year']]);
    for (const product of [...offering.products, ...(offering.yearly ?? [])]) {
      // Made up in the open. An id that did not say so could be mistaken for a
      // real store product in a bug report, and no real store has ever heard of
      // these, so no purchase can complete against one.
      assert.match(product.productId, /preview/, 'a fixture product id does not say it is a fixture');
    }
  });

  test('the fixture never wins over a real store answer', () => {
    const frame = readFileSync(fileURLToPath(new URL('./WallScreen.tsx', import.meta.url)), 'utf8');
    assert.match(
      frame.replace(/\/\/[^\n]*/g, ''),
      /next\.available \? next : \(previewOffering\(\) \?\? next\)/,
      'the wall prefers a fixture to the store, or no longer prefers the store to a fixture',
    );
  });
});

describe('the preview catalogue is the one compiled allowance, and it is fenced', () => {
  test('a production build gets no catalogue from here, which is the whole point', () => {
    // This is the shape the rest of the feature refuses: an allowance in the
    // binary can disagree with the meter that enforces it, which is F266. It is
    // tolerable only because it cannot run in an app anybody has.
    assert.equal(previewCatalogue({ ...ON, NODE_ENV: 'production' }), null);
    assert.equal(previewCatalogue({ ...ON, EXPO_PUBLIC_LUVANI_LOCAL_DEVELOPMENT: undefined }), null);
    assert.equal(previewCatalogue({ ...ON, EXPO_PUBLIC_LUVANI_WALL_PREVIEW: undefined }), null);
    assert.equal(previewCatalogue({}), null);
  });

  test('core PLANS is the only thing it can return, so it cannot drift on its own', () => {
    assert.equal(previewCatalogue(ON), PLANS, 'the preview invented a catalogue rather than reusing core');
  });
});
