import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { AudioDecoderSlots } from './audioDecoderSlots.ts';

test('a guest decode never holds the last shared decoder, even while a failed one is closing', () => {
  const slots = new AudioDecoderSlots();
  const guest = slots.reserve(true)!;
  const close = slots.claim(guest)!;
  guest.release(); // HTTP/decode promise failed; child has not closed.
  assert.equal(slots.reserve(true), null);
  const paid = slots.reserve(false)!;
  assert.ok(paid, 'paid scoring still owns the other slot');
  assert.equal(slots.reserve(false), null);
  assert.equal(slots.claim(guest), null, 'one reservation cannot launch two children');
  close(); close(); // close/error teardown is idempotent.
  const nextGuest = slots.reserve(true)!;
  assert.ok(nextGuest);
  assert.equal(slots.reserve(false), null, 'double close must not manufacture capacity');
  nextGuest.release(); paid.release();
  assert.equal(slots.claim(nextGuest), null);
  assert.equal(slots.claim({ release() {} }), null, 'forged capacity is refused');
});

test('a guest take refused because the decoder is busy keeps the learner\'s attempt', () => {
  const route = readFileSync(new URL('../token-server/src/server.ts', import.meta.url), 'utf8');
  const reservation = route.indexOf('const decoderLease =');
  const attemptCall = route.indexOf('await guestAttempt(', reservation);
  assert.ok(reservation > 0 && attemptCall > reservation);
  assert.match(route.slice(reservation, attemptCall), /decoderLease/);
  const slots = new AudioDecoderSlots();
  const held = slots.reserve(true)!;
  let attempts = 0;
  const attempt = () => {
    const lease = slots.reserve(true);
    if (!lease) return false;
    try { attempts++; return true; } finally { lease.release(); }
  };
  assert.equal(attempt(), false);
  assert.equal(attempts, 0);
  held.release();
  assert.equal(attempt(), true);
  assert.equal(attempts, 1);
});
