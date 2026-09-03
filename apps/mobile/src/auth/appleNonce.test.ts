/**
 * Which nonce goes where — F375.
 *
 * The rule is pure and is called directly, against a published SHA-256 vector
 * rather than against whichever digest the runtime happens to have. The wiring
 * in `apple.native.ts` is a source read, because that file imports a native
 * module the test runner cannot load: the read can see which of the two values
 * is handed to Apple and which is handed to Supabase, and it cannot see a real
 * sheet, a real token, or Apple's own verification of either.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';

import { makeNonce, rawNonce, sha256Hex, toHex } from './appleNonce.ts';

const AUTH_DIR = import.meta.dirname;
const read = (name: string): string => readFileSync(path.join(AUTH_DIR, name), 'utf8');

/** FIPS 180-2 / RFC 6234 test vector: SHA-256 of "abc". */
const SHA256_ABC = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
/** And of the empty string, which is the one a broken encoder still gets right by accident. */
const SHA256_EMPTY = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

describe('the nonce an Apple sign-in carries — F375', () => {
  test('the nonce Apple signs is the digest of the one Supabase checks — F375', async () => {
    // The digest itself, against a vector nobody in this repo chose.
    assert.equal(await sha256Hex('abc'), SHA256_ABC, 'the digest is not SHA-256, or it is not lowercase hex');
    assert.equal(await sha256Hex(''), SHA256_EMPTY);

    // The raw nonce is lowercase hex of the bytes, leading zeroes and all. A
    // dropped zero would shorten the value and still look like a nonce.
    assert.equal(rawNonce(new Uint8Array([0, 1, 15, 16, 171, 255])), '00010f10abff');
    assert.equal(toHex(new Uint8Array([0])), '00', 'a zero byte must still be two characters');
    for (const count of [1, 16, 32]) {
      const hex = rawNonce(new Uint8Array(count).fill(0xab));
      assert.equal(hex.length, count * 2, `${count} bytes made a nonce of ${hex.length} characters`);
      assert.match(hex, /^[0-9a-f]+$/, `"${hex}" is not lowercase hex`);
    }

    // And the pairing. `hashed` is the digest of `raw` and never the other way
    // round: swapping the two is the single mistake this module exists to stop,
    // and it fails on the server with a message about a nonce.
    const bytes = new Uint8Array(32).fill(7);
    const pair = await makeNonce(bytes);
    assert.equal(pair.raw, rawNonce(bytes), 'the raw nonce is not the bytes it was made from');
    assert.equal(pair.hashed, await sha256Hex(pair.raw), 'the hashed nonce is not the digest of the raw one');
    assert.notEqual(pair.raw, pair.hashed, 'both halves are the same string, so the swap could never be caught');

    // An injected digest is used as given, which is how the phone gets the same
    // rule with expo-crypto doing the hashing.
    const injected = await makeNonce(bytes, async (text) => `DIGEST(${text})`.toUpperCase());
    assert.equal(injected.hashed, `digest(${pair.raw})`, 'the supplied digest was ignored, or its case was not normalised');

    // The wiring: Apple gets the hash, Supabase gets the raw value.
    const native = read('apple.native.ts');
    const toApple = /signInAsync\(\{[\s\S]*?nonce:\s*(\w+)/.exec(native);
    const toSupabase = /signInWithIdToken\(\{[\s\S]*?nonce:\s*(\w+)/.exec(native);
    assert.ok(toApple, 'apple.native.ts no longer calls signInAsync with a nonce; this test is reading nothing');
    assert.ok(toSupabase, 'apple.native.ts no longer calls signInWithIdToken with a nonce; this test is reading nothing');
    assert.equal(toApple[1], 'hashed', 'Apple is handed the raw nonce, so the token it signs will never match');
    assert.equal(toSupabase[1], 'raw', 'Supabase is handed the hashed nonce, so it will compare a digest against a digest of a digest');
    assert.match(
      native,
      /provider: 'apple'/,
      'the identity token is exchanged for something other than an Apple session',
    );
  });
});
