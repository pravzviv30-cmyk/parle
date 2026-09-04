/**
 * Apple sign-in, native half: the system sheet, a nonce, and one exchange.
 *
 * Nothing leaves the app. iOS presents its own sheet over the screen, hands
 * back an identity token it has signed, and that token is traded for a Supabase
 * session in process. There is no browser, no deep link and no code exchange,
 * which is why this is a different file from `oauth.native.ts` rather than a
 * branch inside it.
 *
 * The nonce is the part worth reading twice. Apple signs the SHA-256 of the
 * value it is given; Supabase verifies the token against the raw value sent
 * beside it. `appleNonce.ts` owns that pairing and is testable without a
 * device, because a swap between the two is a refusal nobody can debug from
 * the sentence it produces.
 *
 * Two failures are told apart on purpose. A dismissed sheet is a choice, not an
 * error, and `ERR_REQUEST_CANCELED` is how iOS says so. Everything else is the
 * generic Apple failure, which still points at the door that stayed open.
 *
 * Apple returns the email only on the very first sign-in for an account, so
 * nothing here treats a missing email as a problem. The identity token is what
 * establishes identity, and Supabase keeps whatever the first sign-in carried.
 *
 * There is no log in this file and there must not be. It holds an identity
 * token, a nonce and an email address, and a device log outlives the session
 * that wrote it (`tokenHygiene.test.ts`).
 */

import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthResult } from './types.ts';
import { friendly, APPLE_CLOSED, APPLE_START_FAILED } from './friendly.ts';
import { makeNonce, type Sha256Hex } from './appleNonce.ts';

/** 32 bytes, which is 64 hex characters. Apple accepts any string; this is one nobody guesses. */
const NONCE_BYTES = 32;

/** React Native has no WebCrypto, so the digest comes from expo-crypto. Lowercase hex by default. */
const digest: Sha256Hex = (text) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text);

/**
 * Whether this device can show the sheet at all.
 *
 * iOS only, and even there it is asked rather than assumed: `isAvailableAsync`
 * is false below iOS 13 and inside runtimes that have no such capability. A
 * throw is the same answer as false, because a door we cannot confirm is a door
 * we do not draw.
 */
export async function appleSignInOffered(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function startAppleSignIn(client: SupabaseClient): Promise<AuthResult> {
  const { raw, hashed } = await makeNonce(await Crypto.getRandomBytesAsync(NONCE_BYTES), digest);

  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashed,
    });
  } catch (thrown) {
    const code = (thrown as { code?: unknown } | null)?.code;
    // A swipe down is not a failure. Saying "try again" to somebody who just
    // decided not to would be arguing with them.
    return { ok: false, message: code === 'ERR_REQUEST_CANCELED' ? APPLE_CLOSED : APPLE_START_FAILED };
  }

  const token = credential.identityToken;
  // Without the token there is nothing to verify. The sheet said yes and the
  // app has no proof of it, which is the same conversation as never starting.
  if (!token) return { ok: false, message: APPLE_START_FAILED };

  const { error } = await client.auth.signInWithIdToken({ provider: 'apple', token, nonce: raw });
  return error ? { ok: false, message: friendly(error) } : { ok: true };
}
