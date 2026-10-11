import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { screenGeometry } from '../responsiveLayout.ts';
import { welcomeLayout } from './welcomeLayout.ts';

test('short sign-in viewports surrender decorative art before the form', () => {
  for (const height of [-100, 0, 320, 599, 599.99]) {
    assert.deepEqual(welcomeLayout(height, 1, false), { compact: true, orbSize: 0, center: false });
  }
  for (const height of [600, 667, 739, 739.99]) {
    assert.deepEqual(welcomeLayout(height, 1, false), { compact: true, orbSize: 64, center: false });
  }
});

test('roomier sign-in viewports retain the exported orb and center only on tall screens', () => {
  for (const height of [740, 800, 899, 899.99]) {
    assert.deepEqual(welcomeLayout(height, 1, false), { compact: false, orbSize: 104, center: false });
  }
  for (const height of [900, 1024, 1200]) {
    assert.deepEqual(welcomeLayout(height, 1, false), { compact: false, orbSize: 104, center: true });
  }
});

test('narrow phones and larger reading sizes keep room for the account controls', () => {
  assert.equal(welcomeLayout(800, 1.3, false).orbSize, 104);
  for (const height of [600, 740, 900, 1200]) {
    assert.equal(welcomeLayout(height, 1, true).orbSize, 64, 'a narrow phone received the full decoration');
    for (const scale of [1.3001, 1.5, 2, 3]) {
      const layout = welcomeLayout(height, scale, false);
      assert.equal(layout.orbSize, 0, 'decorative art competes with larger text');
      assert.equal(layout.compact, true);
    }
  }
  assert.equal(welcomeLayout(599, 1, true).orbSize, 0, 'compact-phone art overrides the short-screen limit');
  assert.equal(welcomeLayout(1200, 2, true).center, true, 'a tall accessibility layout lost its shared frame centering');
});

test('missing measurements and safe-area subtraction cannot create negative artwork', () => {
  for (const height of [Number.NaN, -100, 0, 1]) {
    const { orbSize } = welcomeLayout(height, 1, false);
    assert.ok(Number.isFinite(orbSize) && orbSize >= 0 && orbSize <= 104);
  }
  const obscured = screenGeometry(320, 80, { top: 59, bottom: 34, left: 0, right: 0 });
  assert.equal(obscured.usableHeight, 0);
  assert.equal(welcomeLayout(obscured.usableHeight, 1, obscured.compact).orbSize, 0);
});

test('sign-in uses shared geometry and compact gaps while keeping scroll available for overflow', () => {
  const screen = readFileSync(new URL('./SignInScreen.tsx', import.meta.url), 'utf8');
  assert.match(screen, /const geometry = useScreenGeometry\(\);/);
  assert.match(screen, /welcomeLayout\(geometry\.usableHeight, fontScale, geometry\.compact\)/);
  assert.doesNotMatch(screen, /useSafeAreaInsets|Dimensions\.get|scrollEnabled=\{false\}/);
  assert.match(screen, /const Frame = ScrollScreen;/);
  assert.match(screen, /center=\{layout\.center\}/);
  assert.match(screen, /topGap=\{layout\.compact \? space\(2\) : space\(4\)\}/);
  assert.match(screen, /layout\.compact && st\.headCompact/);
  assert.match(screen, /layout\.compact && st\.doorsCompact/);
  assert.match(screen, /layout\.compact && st\.orCompact/);
  assert.match(screen, /gap: layout\.compact \? space\(3\) : space\(4\)/);
  assert.match(screen, /boldType\.title/);
  assert.doesNotMatch(screen, /<WelcomeOrb/, 'C keeps the form focused on provider and email actions');
  assert.match(screen, /automaticallyAdjustKeyboardInsets/);
  assert.match(screen, /maxFontSizeMultiplier=\{liveFontMultiplier\}/);
});
