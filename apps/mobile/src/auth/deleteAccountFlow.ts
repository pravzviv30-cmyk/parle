/**
 * Deleting an account, in the order the four steps have to happen — F496.
 *
 * This used to be five lines inside `App.tsx`, which is a component, which
 * means the ordering nobody could test was the ordering that was wrong. The
 * steps are injected rather than imported so the sequence can be exercised with
 * a call log: `App.tsx` passes the real adapter and the real
 * `storage/scope.ts` erase, and `deleteAccountFlow.test.ts` passes doubles.
 *
 * ## The two orderings that are load-bearing
 *
 * **The erase runs before the sign-out.** The adapter deliberately keeps the
 * local session alive until this point, because `storage/scope.ts` resolves the
 * namespace to wipe from the active user, and a sign-out clears it.
 *
 * **A failed erase is recorded before the sign-out and read after it.** That is
 * the whole of F496. The warning used to be handed back to the Settings sheet,
 * which the sign-out had already unmounted, so the learner was returned to the
 * sign-in screen believing everything was gone while the device still held
 * their history. `warnLocalCopyKept` writes to something that outlives the
 * signed-in tree; `Gate` draws it on the far side of the door.
 *
 * ## What the result means
 *
 * `ok` answers one question, and it is not "did everything go perfectly": it is
 * "is the account gone". A failed local erase returns the same `ok` a clean run
 * does, because the account really was deleted and the sheet that asked has
 * already gone with it. The remainder on the disk is not silence, it is a
 * different channel with a screen of its own.
 */

import type { AuthResult } from './types.ts';

export interface DeleteAccountSteps {
  /** Prove account control immediately before the destructive call. */
  reauthenticate(secret?: string): Promise<AuthResult>;
  /** Delete the identity on the server. */
  deleteAccount(): Promise<AuthResult>;
  /** Wipe this device's copy of the account's learning data. Throws if it cannot. */
  eraseThisDevice(): Promise<void>;
  signOut(): Promise<void>;
  /**
   * Raise the notice that this device kept a copy.
   *
   * Called before the sign-out and drawn after it, deliberately: whatever is
   * behind this has to survive the unmount of the whole signed-in tree.
   */
  warnLocalCopyKept(): void;
}

/**
 * Reauthenticate, delete, erase this device, sign out.
 *
 * Stops at the first step that refuses, and a refusal before the account is
 * gone leaves the learner signed in with a sentence to read, which is what the
 * delete sheet is still there to draw.
 */
export async function deleteAccountAndErase(
  steps: DeleteAccountSteps,
  secret?: string,
): Promise<AuthResult> {
  const reauthenticated = await steps.reauthenticate(secret);
  if (!reauthenticated.ok) return reauthenticated;
  const deleted = await steps.deleteAccount();
  if (!deleted.ok) return deleted;
  try {
    await steps.eraseThisDevice();
  } catch {
    // Not rethrown and not returned. The account is gone either way, so the
    // sign-out below is not optional; the learner hears about the remainder on
    // the other side of it.
    steps.warnLocalCopyKept();
  }
  await steps.signOut();
  return deleted;
}
