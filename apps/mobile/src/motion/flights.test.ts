/**
 * A flying token never strands its caller (come alive section 3, TokenFlight).
 *
 * flights.ts is the list between `useTokenFlight` and the one `FlightLayer`.
 * It imports a React type (erased) and the tokens, so this suite drives it
 * directly: every way a token can fail to fly, and every way it can be landed
 * early, still says `onLand` exactly once.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { createFlights, measured, type Box, type Flight } from './flights.ts';
import { FLIGHT } from './tokens.ts';

const A: Box = { x: 10, y: 400, width: 120, height: 48 };
const B: Box = { x: 200, y: 120, width: 120, height: 48 };

/** A layer that records what it was asked to draw. */
function layer() {
  const frames: (readonly Flight[])[] = [];
  return { draw: (inAir: readonly Flight[]) => frames.push(inAir), frames, last: () => frames[frames.length - 1] ?? [] };
}

describe('a flying token always lands, exactly once', () => {
  test('with no layer to fly in, a token lands where it is going at once', () => {
    const flights = createFlights();
    let landed = 0;
    assert.equal(flights.canFly(), false);
    flights.launch(A, B, null, () => (landed += 1));
    assert.equal(landed, 1);
    assert.deepEqual(flights.inAir(), []);
  });

  test('at most two tokens fly at once; another lands at once', () => {
    assert.equal(FLIGHT.max, 2);
    const flights = createFlights();
    const drawn = layer();
    flights.attach(drawn.draw);
    const landed: string[] = [];
    flights.launch(A, B, 'first', () => landed.push('first'));
    flights.launch(A, B, 'second', () => landed.push('second'));
    assert.equal(flights.canFly(), false);
    flights.launch(A, B, 'third', () => landed.push('third'));
    assert.deepEqual(landed, ['third'], 'a third token waited, or a flying one landed early');
    assert.deepEqual(drawn.last().map((f) => f.token), ['first', 'second']);
    // Room again once one arrives.
    flights.land(drawn.last()[0]!.id);
    assert.deepEqual(landed, ['third', 'first']);
    assert.equal(flights.canFly(), true);
  });

  test('an end that failed to measure lands the token at once, with nothing drawn', () => {
    const flights = createFlights();
    const drawn = layer();
    flights.attach(drawn.draw);
    let landed = 0;
    for (const bad of [null, { ...B, width: 0 }, { ...B, height: 0 }, { ...B, x: Number.NaN }, { ...B, y: Number.POSITIVE_INFINITY }]) {
      flights.launch(A, bad, null, () => (landed += 1));
      flights.launch(bad, B, null, () => (landed += 1));
    }
    assert.equal(landed, 10);
    assert.deepEqual(flights.inAir(), []);
    assert.equal(measured(A), true);
    assert.equal(measured(undefined), false);
  });

  test('a token says it landed once, however many times it is told to land', () => {
    const flights = createFlights();
    const drawn = layer();
    flights.attach(drawn.draw);
    let landed = 0;
    flights.launch(A, B, null, () => (landed += 1));
    const id = drawn.last()[0]!.id;
    flights.land(id);
    flights.land(id);
    flights.landAll();
    assert.equal(landed, 1);
    assert.deepEqual(drawn.last(), [], 'the layer still draws a token that landed');
  });

  test('everything in the air lands when the layer goes, and later launches land at once', () => {
    const flights = createFlights();
    const drawn = layer();
    const detach = flights.attach(drawn.draw);
    const landed: number[] = [];
    flights.launch(A, B, null, () => landed.push(1));
    flights.launch(B, A, null, () => landed.push(2));
    detach();
    assert.deepEqual(landed.sort(), [1, 2]);
    assert.equal(flights.canFly(), false);
    flights.launch(A, B, null, () => landed.push(3));
    assert.deepEqual(landed, [1, 2, 3]);
    // A second layer replacing the first: the old one's detach does not take the new one down.
    const second = layer();
    const detachSecond = flights.attach(second.draw);
    detach();
    assert.equal(flights.canFly(), true);
    detachSecond();
    assert.equal(flights.canFly(), false);
  });
});
