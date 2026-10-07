/**
 * Confetti is seeded, bounded and drawn in the palette (come alive section 3,
 * Burst).
 *
 * particles.ts imports only the palette and the tokens, so this suite loads it
 * directly and checks the pieces a burst throws without a renderer.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { colour, highlight, lilac, paper } from '../palette.ts';
import {
  BURST,
  CONFETTI_COLOURS,
  CONFETTI_SHAPES,
  burstLimit,
  mulberry32,
  particleFrame,
  particles,
  seedOf,
  type ConfettiColour,
} from './particles.ts';
import { BURST_MAX, DUR, IPAD_WIDTH } from './tokens.ts';

const ALL: ConfettiColour[] = ['blue', 'coral', 'sun', 'mint', 'paper'];

describe('a burst is seeded, bounded and drawn in the palette', () => {
  test('the same key always throws the same burst, and another key throws another', () => {
    const one = particles({ seed: 'reply-accepted:abc', count: 36, limit: 36 });
    const again = particles({ seed: 'reply-accepted:abc', count: 36, limit: 36 });
    const other = particles({ seed: 'reply-accepted:abd', count: 36, limit: 36 });
    assert.equal(one.length, 36);
    assert.deepEqual(again, one, 'one key threw two different bursts');
    assert.notDeepEqual(other, one, 'two keys threw the same burst');
    // The generator under it is the seeded one, not Math.random.
    const a = mulberry32(seedOf('x'));
    const b = mulberry32(seedOf('x'));
    for (let i = 0; i < 20; i += 1) {
      const n = a();
      assert.equal(n, b());
      assert.ok(n >= 0 && n < 1, `the generator gave ${n}`);
    }
    const code = readFileSync(fileURLToPath(new URL('./particles.ts', import.meta.url)), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    assert.doesNotMatch(
      code,
      /Math\.random/,
      'particles.ts reaches for Math.random, so a key no longer decides its burst',
    );
  });

  test('a burst never throws more than its device allows: 36 on a phone, 56 on an iPad, 24 on the web', () => {
    assert.deepEqual(BURST_MAX, { phone: 36, ipad: 56, web: 24 });
    assert.equal(burstLimit('ios', 390), 36);
    assert.equal(burstLimit('ios', IPAD_WIDTH - 1), 36);
    assert.equal(burstLimit('ios', IPAD_WIDTH), 56);
    assert.equal(burstLimit('android', 1024), 56);
    assert.equal(burstLimit('web', 1440), 24, 'the web is held to 24 however wide the window');
    for (const [platform, width] of [['ios', 390], ['ios', 1024], ['web', 1440]] as const) {
      const limit = burstLimit(platform, width);
      assert.equal(particles({ seed: 'k', count: 500, limit }).length, limit, `${platform} at ${width} was not held to ${limit}`);
    }
    // Asked for more than any device allows, even with a wild limit, it stays within the largest.
    assert.ok(particles({ seed: 'k', count: 500, limit: 500 }).length <= Math.max(...Object.values(BURST_MAX)));
    assert.deepEqual(particles({ seed: 'k', count: 0, limit: 36 }), []);
    assert.deepEqual(particles({ seed: 'k', count: -3, limit: 36 }), []);
  });

  test('confetti is drawn only in the four colours and the card white, never the highlighter or lilac', () => {
    assert.deepEqual(CONFETTI_COLOURS, { blue: colour.blue, coral: colour.coral, sun: colour.sun, mint: colour.mint, paper: paper.card });
    const allowed = new Set<string>([...Object.values(colour), paper.card]);
    const seen = new Set<string>();
    for (let k = 0; k < 40; k += 1) {
      for (const piece of particles({ seed: `event:${k}`, count: 56, limit: 56, palette: ALL })) {
        seen.add(piece.colour);
        assert.ok(allowed.has(piece.colour), `a piece was drawn in ${piece.colour}`);
        assert.notEqual(piece.colour.toLowerCase(), highlight.toLowerCase(), 'a piece was drawn in the highlighter');
        assert.notEqual(piece.colour.toLowerCase(), lilac.toLowerCase(), 'a piece was drawn in the illustrations\' lilac');
      }
    }
    assert.equal(seen.size, ALL.length, 'some palette colour never appears, so this walk is not reading the whole palette');
  });

  test('every piece is a bar, a dot or a ring from the illustrations\' confetti vocabulary', () => {
    assert.deepEqual(CONFETTI_SHAPES, {
      bar: { width: 14, height: 6, radius: 3, border: 0 },
      dot: { width: 8, height: 8, radius: 4, border: 0 },
      ring: { width: 10, height: 10, radius: 5, border: 2 },
    });
    const shapes = new Set(particles({ seed: 'shapes', count: 56, limit: 56 }).map((p) => p.shape));
    assert.deepEqual([...shapes].sort(), ['bar', 'dot', 'ring'], 'a burst of 56 did not use the whole vocabulary, or used a shape outside it');
  });

  test('a colour that matches the ground it falls on is left out', () => {
    for (const ground of ALL) {
      const pieces = particles({ seed: `ground:${ground}`, count: 56, limit: 56, palette: ALL, ground });
      assert.ok(pieces.length > 0);
      assert.ok(
        pieces.every((p) => p.colour !== CONFETTI_COLOURS[ground]),
        `a piece on ${ground} was drawn in ${ground}`,
      );
    }
    assert.deepEqual(particles({ seed: 'k', count: 10, limit: 36, palette: ['sun'], ground: 'sun' }), [], 'a burst with no colour left still threw something');
  });

  test('a piece leaves upward inside the fan, falls, turns, and has faded by the end of the burst', () => {
    assert.equal(BURST.seconds, DUR.burst / 1000);
    const half = (BURST.spread / 2) * (Math.PI / 180);
    for (const piece of particles({ seed: 'physics', count: 56, limit: 56 })) {
      const speed = Math.hypot(piece.vx, piece.vy);
      assert.ok(speed >= BURST.power[0] - 1e-6 && speed <= BURST.power[1] + 1e-6, `a piece left at ${speed}`);
      assert.ok(piece.vy < 0, 'a piece left downward');
      const fromUp = Math.abs(Math.atan2(piece.vx, -piece.vy));
      assert.ok(fromUp <= half + 1e-9, 'a piece left outside the fan');
      assert.ok(Math.abs(piece.spin) <= BURST.spin, `a piece spun at ${piece.spin}`);

      const start = particleFrame(piece, 0);
      assert.ok(Math.abs(start.x) === 0 && Math.abs(start.y) === 0 && start.opacity === 1, 'a piece did not start where it was thrown');
      assert.ok(particleFrame(piece, 0.1).y < 0, 'a piece did not rise first');
      assert.ok(particleFrame(piece, 1).y > particleFrame(piece, 0.5).y, 'a piece did not fall');
      assert.equal(particleFrame(piece, BURST.fadeFrom - 0.01).opacity, 1, 'a piece faded before its last quarter');
      assert.equal(particleFrame(piece, 1).opacity, 0, 'a piece is still showing at the end of the burst');
      assert.equal(particleFrame(piece, 2).opacity, 0, 'a late frame brought a piece back');
    }
  });
});
