/**
 * The press builds its ring only for a choice.
 *
 * Every tappable thing in the app is a `Press`, and most of them are actions,
 * not choices. The blue ring layer a choice wears is its own child, mounted
 * only when `selected` is given, so an action builds one animated style, not
 * two, and no ring value to drive or stop. Read as text: components.tsx loads
 * the engine (motion.test.ts, rule 7). components.test.ts (F597) and
 * motion.test.ts hold what the press and the ring look like; this holds where
 * the ring's work lives.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const components = readFileSync(fileURLToPath(new URL('../components.tsx', import.meta.url)), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);

/** A function's text, from its declaration to the next top-level declaration. */
function fn(start: string): string {
  const at = components.indexOf(start);
  assert.notEqual(at, -1, `${start} is missing from components.tsx`);
  const next = components.slice(at + start.length).search(/\n(?:export )?function \w/);
  return components.slice(at, next === -1 ? undefined : at + start.length + next);
}

describe('the selected ring', () => {
  test('an action builds no ring: its value and animated style mount only for a choice', () => {
    const press = fn('export function Press(');
    const ring = fn('function SelectRing(');

    // The press: one animated style, the surface's, and nothing of the ring's.
    assert.equal((press.match(/\buseAnimatedStyle\(/g) ?? []).length, 1, 'every press builds a second animated style');
    assert.equal((press.match(/\buseSharedValue\(/g) ?? []).length, 1, 'every press builds a second shared value');
    assert.doesNotMatch(press, /\bring\b|ringTo\(|SELECT_RING_OPACITY/, 'the press drives the ring itself, so an action pays for it');
    assert.match(
      press,
      /\{selected !== undefined \? \(\s*<SelectRing selected=\{selected\} scale=\{scale\} glowRadius=\{glowRadius\} reduced=\{reduced\} \/>\s*\) : null\}/,
      'the ring is mounted for an action, or is not handed the press scale and the live reduced answer',
    );

    // The ring: its own value, its own style that scales with the press, and its own stop.
    assert.match(ring, /const ring = useSharedValue\(selected \? SELECT_RING_OPACITY : 0\);/, 'a ring that mounts chosen does not start at rest');
    assert.match(ring, /useAnimatedStyle\(\(\) => \(\{ opacity: ring\.value, transform: \[\{ scale: scale\.value \}\] \}\)\)/, 'the ring does not scale with the press');
    assert.match(ring, /useEffect\(\(\) => \(\) => stopMotion\(ring\), \[ring\]\);/, 'the ring keeps fading after it unmounts');
    assert.match(ring, /if \(reduced\) ringTo\(ring, chosen\.current, true\);/, 'reduced motion turned on mid-fade does not land the ring');
    assert.match(ring, /ringTo\(ring, now, reduced\);/, 'the ring does not follow the choice');
  });
});
