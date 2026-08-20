/**
 * The scene arithmetic.
 *
 * The interesting assertion here is the last one. A moving piece that is not
 * scaled with its scene draws at a different stroke weight from the scene it
 * sits on, which is exactly what happens on the splash today: the cafe renders
 * its 2.2 stroke at 2.86px and the steam above it at 2.2px. One pen means one
 * rendered weight, and this is where that is held.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { unit, place, frameHeight, restFor, VIEW_W, VIEW_H, SETTLE_MS, ARRIVE_MS, STAGGER_MS } from './timing.ts';

describe('viewBox units become container pixels', () => {
  test('the splash scale is 1.3, and nobody has to know that', () => {
    assert.equal(unit(260), 1.3);
    assert.equal(unit(200), 1);
    assert.equal(unit(100), 0.5);
  });

  test('a scene stays 4:3 at any width', () => {
    assert.equal(frameHeight(200), 150);
    assert.equal(frameHeight(260), 195);
    assert.equal(frameHeight(170), 127.5);
    assert.equal(VIEW_W / VIEW_H, 200 / 150);
  });

  test('a piece is centred on its viewBox coordinate', () => {
    // The splash steam: a 22x22 piece centred over the cup at viewBox (70, 78),
    // in a scene rendered 260 wide.
    const p = place({ x: 70, y: 78, w: 22, h: 22 }, 260);
    assert.equal(p.width, 28.6, '22 viewBox units at 1.3 is 28.6 pixels');
    assert.equal(p.height, 28.6);
    assert.equal(p.left, 70 * 1.3 - 28.6 / 2);
    assert.equal(p.top, 78 * 1.3 - 28.6 / 2);
  });

  test('a piece at the centre of the scene lands at the centre of the box', () => {
    const width = 200;
    const p = place({ x: 100, y: 75, w: 40, h: 30 }, width);
    assert.equal(p.left + p.width / 2, 100);
    assert.equal(p.top + p.height / 2, 75);
  });

  test('placing scales with the scene, so a piece never drifts off its anchor', () => {
    const box = { x: 70, y: 78, w: 22, h: 22 } as const;
    for (const width of [140, 170, 200, 230, 260]) {
      const p = place(box, width);
      const u = unit(width);
      assert.equal(p.left + p.width / 2, box.x * u, `the anchor moved at width ${width}`);
      assert.equal(p.top + p.height / 2, box.y * u, `the anchor moved at width ${width}`);
    }
  });

  test('a placed piece is the same scale as the scene under it', () => {
    // This is the stroke bug, stated as arithmetic. A piece whose rendered
    // width is its viewBox extent times the scene's own unit draws its stroke
    // at the scene's weight. A piece rendered at its raw viewBox extent does
    // not, and that is the 23% mismatch on the splash today.
    const width = 260;
    const box = { x: 70, y: 78, w: 22, h: 22 } as const;
    const p = place(box, width);
    assert.equal(p.width / box.w, unit(width), 'the piece would draw at a different stroke weight to its scene');

    const naive = box.w; // what SplashScreen does today: width={44} for a 44 viewBox
    assert.notEqual(naive / box.w, unit(width), 'this is the mistake the helper exists to prevent');
  });
});

describe('what a scene looks like when it is not allowed to move', () => {
  test('a loop rests in the middle of its travel, not at an end', () => {
    assert.equal(restFor('loop'), 0.5);
  });

  test('an arrival rests where it was going', () => {
    assert.equal(restFor('arrival'), 1);
  });

  test('no rest value is zero, because zero is an empty box', () => {
    for (const kind of ['loop', 'arrival'] as const) {
      assert.ok(restFor(kind) > 0, `${kind} rests at nothing, so reduce-motion would render nothing`);
    }
  });
});

describe('the durations are the ones the splash already established', () => {
  test('a settle is 380ms, an arrival 420, a stagger 180', () => {
    assert.equal(SETTLE_MS, 380);
    assert.equal(ARRIVE_MS, 420);
    assert.equal(STAGGER_MS, 180);
  });

  test('a stagger is shorter than the arrival it separates', () => {
    assert.ok(
      STAGGER_MS < ARRIVE_MS,
      'two pieces have to overlap as they arrive, or the second one reads as a separate event',
    );
  });
});
