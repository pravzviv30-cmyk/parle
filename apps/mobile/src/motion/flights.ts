/**
 * The tokens in the air (TokenFlight, come alive section 3).
 *
 * A token flies from where it was chosen to where it is kept, drawn by the one
 * `FlightLayer` at the root. This is the list between the two: `useTokenFlight`
 * puts a flight in, the layer draws what is in it, and every flight comes out
 * by landing, which says so to its caller exactly once (`onLand`, when the
 * target shows the real token).
 *
 * A flight never strands its caller. It lands where it is going at once, with
 * nothing drawn, when there is no layer to fly in, when two are already in the
 * air (`FLIGHT.max`), or when either end failed to measure; and everything in
 * the air lands at once when the layer goes, the app leaves the foreground or
 * reduced motion is turned on.
 *
 * Pure (a React type, erased, and the tokens), so a Node suite drives it.
 */

import type { ReactNode } from 'react';
import { FLIGHT } from './tokens.ts';

/** A measured box in window coordinates, as `measureInWindow` gives it. */
export type Box = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };

export type Flight = {
  readonly id: number;
  readonly from: Box;
  readonly to: Box;
  /** What flies: a copy of the token, drawn decorative; the real one appears at the target on landing. */
  readonly token: ReactNode;
};

export type Flights = {
  /** Whether a token launched now would fly: a layer is drawing and there is room in the air. */
  canFly(): boolean;
  /** Put a token in the air, or land it at once when it cannot fly. */
  launch(from: Box | null, to: Box | null, token: ReactNode, onLand: () => void): void;
  /** A token arrived, or is landed early: say so once, and take it out of the air. */
  land(id: number): void;
  /** Land everything in the air at once. */
  landAll(): void;
  /** The layer starts drawing. One layer at a time. Returns how it stops, which lands everything. */
  attach(draw: (inAir: readonly Flight[]) => void): () => void;
  /** What is in the air now. */
  inAir(): readonly Flight[];
};

/** A box that measured: every number finite and the box not empty. */
export function measured(box: Box | null | undefined): box is Box {
  return (
    box != null &&
    [box.x, box.y, box.width, box.height].every((n) => Number.isFinite(n)) &&
    box.width > 0 &&
    box.height > 0
  );
}

export function createFlights(max: number = FLIGHT.max): Flights {
  let air: { flight: Flight; onLand: () => void }[] = [];
  let draw: ((inAir: readonly Flight[]) => void) | null = null;
  let next = 1;
  const show = () => draw?.(air.map((a) => a.flight));
  const flights: Flights = {
    canFly: () => draw !== null && air.length < max,
    launch(from, to, token, onLand) {
      if (!flights.canFly() || !measured(from) || !measured(to)) {
        onLand();
        return;
      }
      air = [...air, { flight: { id: next, from, to, token }, onLand }];
      next += 1;
      show();
    },
    land(id) {
      const found = air.find((a) => a.flight.id === id);
      if (found === undefined) return;
      air = air.filter((a) => a !== found);
      show();
      found.onLand();
    },
    landAll() {
      const landing = air;
      if (landing.length === 0) return;
      air = [];
      show();
      for (const a of landing) a.onLand();
    },
    attach(drawer) {
      draw = drawer;
      show();
      return () => {
        if (draw !== drawer) return;
        flights.landAll();
        draw = null;
      };
    },
    inAir: () => air.map((a) => a.flight),
  };
  return flights;
}

/** The app's one list of tokens in the air. */
export const flights = createFlights();
