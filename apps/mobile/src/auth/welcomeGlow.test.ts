import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { welcomeGlow, welcomeGlowEnabled } from './welcomeGlow.ts';

test('the welcome sign-in glow preserves the exported Figma timeline and both shadows', () => {
  const rest = '0px 4px 12px 0px rgba(87, 69, 255, 0.12), 0px 1px 3px 0px rgba(222, 229, 255, 0.14) inset';
  const peak = '0px 4px 22px 0px rgba(87, 69, 255, 0.3), 0px 1px 8px 0px rgba(222, 229, 255, 0.48) inset';
  const settle = '0px 4px 15px 0px rgba(87, 69, 255, 0.16), 0px 1px 4px 0px rgba(222, 229, 255, 0.2) inset';
  assert.deepEqual(welcomeGlow, {
    duration: '3.2s',
    rest,
    keyframes: {
      '0%': { animationTimingFunction: 'ease-in-out', boxShadow: rest },
      '14.063%': { animationTimingFunction: 'ease-in-out', boxShadow: rest },
      '37.5%': { animationTimingFunction: 'ease-in-out', boxShadow: peak },
      '71.875%': { animationTimingFunction: 'ease-in-out', boxShadow: settle },
      '100%': { boxShadow: rest },
    },
  });
});

test('the decorative glow runs only while the idle sign-in screen is visible in the foreground', () => {
  assert.equal(welcomeGlowEnabled(true, false, true, 'active'), true);
  const stopped: [string, boolean, boolean, boolean, string | null][] = [
    ['pending auth', false, false, true, 'active'],
    ['reduced motion', true, true, true, 'active'],
    ['another screen focused', true, false, false, 'active'],
    ['app backgrounded', true, false, true, 'background'],
    ['app inactive', true, false, true, 'inactive'],
    ['app state not known yet', true, false, true, null],
    ['unknown app state', true, false, true, 'unknown'],
    ['empty app state', true, false, true, ''],
    ['all stop conditions', false, true, false, 'background'],
  ];
  for (const [reason, active, reduced, focused, appState] of stopped) {
    assert.equal(welcomeGlowEnabled(active, reduced, focused, appState), false, reason);
  }
});

test('the glow overlay stays decorative and responds to auth, focus, app state and reduced motion', () => {
  const overlay = readFileSync(new URL('./WelcomeSignInGlow.tsx', import.meta.url), 'utf8');
  const screen = readFileSync(new URL('./SignInScreen.tsx', import.meta.url), 'utf8');
  assert.match(screen, /decoration=\{<WelcomeSignInGlow active=\{!busy\} \/>\}/, 'pending auth leaves the glow active');
  assert.match(overlay, /<Reanimated\.View\s+\{\.\.\.decorative\}\s+pointerEvents="none"/, 'the overlay can intercept presses or be read by assistive technology');
  assert.match(overlay, /const reduced = useReduceMotion\(\)/);
  assert.match(overlay, /navigation\.addListener\('focus', \(\) => setFocused\(true\)\)/);
  assert.match(overlay, /navigation\.addListener\('blur', \(\) => setFocused\(false\)\)/);
  assert.match(overlay, /AppState\.addEventListener\('change', setAppState\)/);
  assert.match(overlay, /const enabled = welcomeGlowEnabled\(active, reduced, focused, appState\)/);
  assert.match(overlay, /boxShadow: welcomeGlow\.rest,/);
  assert.match(overlay, /animationName: enabled \? welcomeGlow\.keyframes : 'none',/);
  assert.match(overlay, /animationDuration: welcomeGlow\.duration,/);
  assert.match(overlay, /animationIterationCount: 'infinite',/);
});
