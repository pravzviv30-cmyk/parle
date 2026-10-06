/**
 * The clock a throttle or a time limit measures with: milliseconds that only go
 * forward.
 *
 * `Date.now()` is the wall clock, and the wall clock jumps: the phone corrects
 * its time from the network, the time zone changes on a flight, somebody sets
 * the date by hand. A gap measured across a jump comes out negative or hours
 * long, so a count stops ticking, or a spinner gives up the moment it starts.
 * `performance.now()` counts from a fixed start and never steps back. Hermes,
 * the browsers and Node all have it; `Date.now()` stands in only where it is
 * missing.
 *
 * Read at each call, never captured once, and nothing imported, so any module
 * or test may use it. `hapticBeats.ts` writes the same test out itself, because
 * nothing may be imported there (haptics.test.ts); clock.test.ts holds the two
 * to one answer.
 */
export function monotonicNow(): number {
  const clock = globalThis.performance;
  return typeof clock?.now === 'function' ? clock.now() : Date.now();
}
