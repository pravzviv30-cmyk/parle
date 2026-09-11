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

import { wallPreviewEnabled } from './preview.ts';

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
