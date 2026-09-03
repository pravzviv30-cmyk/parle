/**
 * The two nonces an Apple sign-in needs, and why they are not the same string.
 *
 * Apple signs the value it is handed into the identity token, as a SHA-256
 * hash. Supabase then verifies that token against the *raw* value the client
 * sends alongside it. So the flow holds one secret in two forms at once, and
 * the two are easy to swap: pass the raw one to Apple and the hash to Supabase
 * and every sign-in is refused with a message about a nonce that nobody outside
 * this file can act on.
 *
 * That decision is one line of code, which is exactly why it lives in a module
 * with no expo import in it. `apple.native.ts` cannot be loaded by the test
 * runner — it reaches for a native module that only exists inside a build — so
 * a rule left inline there is a rule nothing checks. `makeNonce` is the whole
 * pairing, and the platform file only supplies the randomness and the digest.
 *
 * The digest is injected for the same reason. Node has WebCrypto and React
 * Native does not, so `sha256Hex` is the runtime's own and `expo-crypto`'s
 * `digestStringAsync` is handed in on device. Both answer lowercase hex, and
 * `appleNonce.test.ts` pins the pair against a published SHA-256 vector rather
 * than against whichever implementation happens to be loaded.
 *
 * Nothing here is logged and nothing is stored. A nonce is single-use and
 * lives for the length of one sheet.
 */

/** A SHA-256 that answers lowercase hex. The runtime supplies it. */
export type Sha256Hex = (text: string) => Promise<string>;

/** Lowercase hex, two characters per byte, leading zeroes kept. */
export function toHex(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0');
  return out;
}

/**
 * The raw nonce: the random bytes as lowercase hex.
 *
 * Hex rather than base64 on purpose. This value travels as a query-safe string
 * through a native sheet and a JSON body, and hex has no padding, no `+` and
 * no `/` to be re-encoded by something in between.
 */
export function rawNonce(bytes: Uint8Array): string {
  return toHex(bytes);
}

/** SHA-256 as lowercase hex, via the runtime's own WebCrypto. */
export async function sha256Hex(text: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle || typeof TextEncoder === 'undefined') {
    // Deliberately loud. A silent fallback here would hand Apple something
    // that is not a digest, and the sign-in would fail on the server with a
    // message nobody could trace back to this line.
    throw new Error('This runtime has no WebCrypto digest. Pass the platform digest to makeNonce.');
  }
  return toHex(new Uint8Array(await subtle.digest('SHA-256', new TextEncoder().encode(text))));
}

/** The pair: what Supabase checks, and what Apple signs. */
export interface AppleNonce {
  /** Sent to Supabase with the identity token. */
  readonly raw: string;
  /** Sent to Apple, and what ends up inside the token Apple signs. */
  readonly hashed: string;
}

/**
 * Make both halves from one set of random bytes.
 *
 * The caller supplies the bytes so the randomness stays where the platform's
 * CSPRNG is, and supplies the digest so the same rule runs under the test
 * runner and on a phone.
 */
export async function makeNonce(bytes: Uint8Array, sha256: Sha256Hex = sha256Hex): Promise<AppleNonce> {
  const raw = rawNonce(bytes);
  return { raw, hashed: (await sha256(raw)).toLowerCase() };
}
