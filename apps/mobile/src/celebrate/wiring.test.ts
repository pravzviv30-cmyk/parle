/**
 * Where the celebration host meets the app (F743), read from source because
 * apps/mobile has no renderer (the `nav/wiring.test.ts` idiom): one host at the
 * root, holds taken at their sources, a purchase published only behind a
 * confirmed entitlement, takeovers that are modal, announced and uncapped, and
 * the catalogue's confetti drawing still drawn.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const SRC = join(HERE, '..');

/** Comments may say anything; the checks read code. */
function code(path: string): string {
  const source = readFileSync(path, 'utf8');
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}
const app = (): string => code(join(SRC, '..', 'App.tsx'));
const src = (path: string): string => code(join(SRC, path));

/** The body of a function, from its declaration to the next top-level declaration. */
function region(body: string, start: string): string {
  const at = body.indexOf(start);
  assert.notEqual(at, -1, `${start} is missing`);
  const next = body.slice(at + start.length).search(/\n(?:export )?(?:function|const|default) /);
  return next === -1 ? body.slice(at) : body.slice(at, at + start.length + next);
}

function celebrateFiles(dir = HERE): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...celebrateFiles(full));
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe('the celebration host in the app — F743', () => {
  test('one host is mounted at the root, outside the navigator, with the one flight layer', () => {
    const body = app();
    assert.equal((body.match(/<CelebrationHost \/>/g) ?? []).length, 1, 'the host is not mounted exactly once');
    assert.equal((body.match(/<FlightLayer \/>/g) ?? []).length, 1, 'the flight layer is not mounted exactly once');
    const root = region(body, 'export default function App(');
    assert.match(root, /<CelebrationHost \/>/, 'the host is not in the root component');
    assert.ok(root.indexOf('<Gate />') < root.indexOf('<CelebrationHost />'), 'the host is drawn under the app instead of over it');
    for (const inner of ['function Gate(', 'function SignedInRoot(']) {
      assert.doesNotMatch(region(body, inner), /<CelebrationHost|<FlightLayer/, `the host sits inside ${inner.slice(9, -1)}, under the navigator's screens`);
    }
    assert.match(region(body, 'function SignedInRoot('), /<NavigationContainer/, 'the navigator moved, so the check above reads the wrong component');
    const listeners = celebrateFiles().filter((file) => /attachCelebrationListener\(/.test(code(file))).map((file) => file.slice(HERE.length));
    assert.deepEqual(listeners.sort(), ['CelebrationHost.tsx', 'events.ts'], 'something listens for moments beside the one host');
  });

  test('every hold is taken where it begins', () => {
    const sheet = region(src('components.tsx'), 'export function Sheet(');
    assert.match(sheet, /useEffect\(\(\) => \(present \? holdCelebrations\(\) : undefined\), \[present\]\);/, 'a presented sheet does not hold the queue, so a takeover would play under its Modal');
    const stop = region(src('tutor/SafetyStopView.tsx'), 'export function SafetyStopView(');
    assert.match(stop, /useEffect\(\(\) => suppressCelebrations\(\), \[\]\);/, 'the safety stop does not clear and refuse celebrations (F137)');
    assert.doesNotMatch(region(src('tutor/SafetyStopView.tsx'), 'export function SafetyBanner('), /suppressCelebrations/, 'a redirect, which ends nothing, suppressed celebrations');
    assert.match(src('celebrate/EndScene.tsx'), /useEffect\(\(\) => holdCelebrations\(\), \[\]\);/, 'an end card on screen does not hold the queue');
    const host = src('celebrate/CelebrationHost.tsx');
    assert.match(host, /onUserScopeReset\(\(\) => queue\.reset\(\)\)/, 'a sign-out does not clear the queue');
    assert.match(host, /AppState\.addEventListener\('change'/, 'the queue does not hold while the app is away');
    assert.match(host, /hasSeen,\s*markSeen,\s*enqueuePending: enqueueCelebrations,\s*dropPending: dropCelebrations,/, 'the host does not bind the synced seen list and the crash-replay queue');
  });

  test('the wall publishes a purchase only behind a confirmed entitlement, never on a restore', () => {
    const wall = src('wall/WallScreen.tsx');
    assert.equal((wall.match(/publishCelebrations\(/g) ?? []).length, 1);
    const effect = wall.slice(wall.lastIndexOf('useEffect(', wall.indexOf('publishCelebrations(')), wall.indexOf('publishCelebrations('));
    assert.match(effect, /!purchaseAccepted/, 'a restore, which the store never accepted as a purchase, would celebrate');
    assert.match(effect, /confirmedGrant === null\) return;/, 'a purchase is celebrated before the server confirmed it');
    assert.match(effect, /wallSuccess\(confirmedGrant, latestCatalogue\(\)\) === null\) return;/, 'a purchase is celebrated without the confirmed entitlement the success page needs');
    const firstReturn = wall.indexOf('if (!ownsWall) return (');
    assert.ok(wall.indexOf('publishCelebrations(') < firstReturn, 'the purchase hook sits below an early return, so the hooks run in a different order');
    for (const handler of ['  const settle = async (', '  const buy = async () => {', '  const restore = async () => {', '  const checkAcceptedPurchase = async () => {']) {
      const at = wall.indexOf(handler);
      assert.notEqual(at, -1, `${handler.trim()} moved`);
      assert.doesNotMatch(wall.slice(at, wall.indexOf('\n  };\n', at)), /publishCelebrations/, `${handler.trim()} publishes a moment from inside the money code`);
    }
  });

  test('a takeover is modal, announced, focused on its title, ready by the budget and never caps a line', () => {
    const frame = src('celebrate/Takeover.tsx');
    assert.match(frame, /accessibilityViewIsModal/, 'a screen reader can wander behind the takeover');
    assert.match(frame, /AccessibilityInfo\.announceForAccessibility\(view\.announce\)/, 'the moment is not announced');
    assert.match(frame, /accessibilityRole="header"/, 'the title is not a header to land on');
    assert.match(frame, /AccessibilityInfo\.setAccessibilityFocus\(handle\)/, 'focus does not move to the title');
    assert.match(frame, /onRequestClose=\{back\}/, "Android's back does not answer the takeover");
    assert.match(frame, /setTimeout\(\(\) => setWaited\(true\), INPUT_READY_MS\)/, 'Continue is not ready by the input budget');
    assert.match(frame, /const ready = final \|\| reader === true \|\| waited;/, 'Continue waits for a screen reader user or under reduced motion');
    assert.match(frame, /label=\{GAME_COPY\.continue\} onPress=\{next\} disabled=\{!ready\}/);
    assert.match(frame, /const final = useLatch\(reduced \|\| landed\);/, 'reduced motion does not land on the final frame, or turning it off replays the card');
    assert.match(src('celebrate/EndScene.tsx'), /const final = useLatch\(reduced \|\| !first\);/, 'turning Reduce Motion off replays an end card');
    assert.match(src('celebrate/Toast.tsx'), /const still = useLatch\(answered === true\);/, 'turning Reduce Motion off replays a toast and its sound');
    assert.equal((frame.match(/onContinue\(/g) ?? []).length, 1, 'something other than Continue moves the learner on, so a takeover could dismiss itself');
    assert.match(frame, /export const COLUMN_MAX = 520;/, 'the column is not held to 520 on an iPad');
    for (const file of celebrateFiles()) {
      const body = code(file);
      assert.doesNotMatch(body, /numberOfLines|adjustsFontSizeToFit|maxFontSizeMultiplier|allowFontScaling/, `${file} caps a line, so large text is cut`);
      assert.doesNotMatch(body, /<Text\b[^>]*>\s*[A-Za-z]/, `${file} writes words of its own into a Text instead of reading them from the copy`);
    }
  });

  test('the stage and the words remount under keys of their own when a card turns final', () => {
    const frame = src('celebrate/Takeover.tsx');
    // Two siblings under one key: React keeps one, and the playing stage would never unmount (its loops and listeners leak).
    assert.doesNotMatch(frame, /key=\{mode\}/, 'a sibling is keyed by the mode alone, so the stage and the words can share a key');
    const stage = frame.match(/<Stage key=\{(`[^`]*`)\}/)?.[1];
    const words = frame.match(/<Words key=\{(`[^`]*`)\}/)?.[1];
    assert.ok(stage && words, 'the stage or the words no longer remount when the card turns final');
    assert.match(stage, /\$\{mode\}/, 'the stage does not remount when the card turns final, so a primitive is left halfway');
    assert.match(words, /\$\{mode\}/, 'the words do not remount when the card turns final, so a line is left halfway');
    assert.notEqual(stage, words, 'the stage and the words share a key');
  });

  test('a screen reader keeps its place on the title of a takeover and hears the whole moment there', () => {
    const frame = src('celebrate/Takeover.tsx');
    const words = region(frame, 'function Words(');
    assert.match(words, /accessibilityRole="header"\s+accessibilityLabel=\{view\.announce\}/, 'the title a reader lands on does not say the main value');
    assert.match(words, /<View \{\.\.\.decorative\} style=\{st\.hero\}>/, 'the big number is read out as well as the title that says it');
    assert.match(frame, /shownTitle\(view, \{ titleReached: [^}]*, screenReader: reader \}\)/, 'a level title changes under a screen reader, so its focus is lost');
    assert.match(words, /<Enter key=\{shown\}/);
    // Focus is placed again whenever the words are redrawn, and the moment is announced only where focus cannot land.
    assert.match(frame, /\}, \[mode, shown, view\.announce\]\);/, 'focus is not placed again when the words remount');
    assert.match(frame, /if \(focusTitle\(\) \|\| announced\.current\) return;/, 'an announcement is said over the focus that says the same, and is cut off');
  });

  test('the toast blocks nothing and is hidden from assistive technology', () => {
    const toast = src('celebrate/Toast.tsx');
    assert.match(toast, /<View \{\.\.\.decorative\} style=\{st\.layer\}>/, 'the toast is announced, though the screen already said it was saved');
    assert.match(toast, /layer: \{ \.\.\.StyleSheet\.absoluteFill, pointerEvents: 'none' \}/, 'the toast can catch a touch meant for the screen');
    assert.match(toast, /\{GAME_COPY\.phraseSaved\}/);
  });

  test('sound and haptics reach the device only through the one effects module', () => {
    for (const file of celebrateFiles()) {
      if (file.endsWith('effects.ts')) continue;
      const body = code(file);
      assert.doesNotMatch(body, /from '\.\.\/(?:\.\.\/)?motion\/haptics\.ts'/, `${file} reaches the haptics itself`);
      assert.doesNotMatch(body, /\bplay\(|pauseAllSfx/, `${file} plays or stops a sound itself`);
    }
  });

  test('the catalogue confetti is still drawn, as the burst\'s still final frame', () => {
    assert.match(src('celebrate/ConfettiStill.tsx'), /<Illustration name="celebrate-confetti"/, 'the confetti drawing no longer reaches a screen (J14, F599)');
    const confetti = src('celebrate/Confetti.tsx');
    assert.match(confetti, /if \(final \|\| fallen\) return reduced \|\| web \? <ConfettiStill \/> : null;/, 'reduced motion or the web lost the still final frame');
    for (const path of ['templates/StreakExtended.tsx', 'templates/StreakMilestone.tsx', 'templates/LevelUp.tsx', 'templates/PurchaseConfirmed.tsx', 'EndScene.tsx']) {
      assert.match(src(`celebrate/${path}`), /<Confetti\b/, `${path} throws no confetti`);
    }
  });
});
