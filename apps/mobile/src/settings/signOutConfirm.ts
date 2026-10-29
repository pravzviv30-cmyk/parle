/**
 * Signing out asks first (F938). The safe answer, staying, is the solid pill
 * and comes first; signing out is the quiet link. Every other way off the sheet
 * (the scrim, a screen reader's escape, the back gesture) is staying.
 *
 * The body is chosen when the sheet opens, from the real sync state
 * (`signOutBody`). With nothing pending the learning is saved to the account.
 * The local mock has no account to save to: it keeps the learning on this
 * device under the learner's own namespace (`storage/scope.ts`), and says so.
 * With writes still pending on Supabase it
 * is not yet, so the sheet says where it is: on this phone, pushed on the next
 * sign-in here (`sync/engine.ts` keeps the dirty set in the learner's namespace).
 */
export const SIGN_OUT_CONFIRM = {
  title: 'Sign out?',
  body: 'Your French stays saved to your account.',
  deviceBody: 'Your French stays saved on this device.',
  stay: 'Stay signed in',
  leave: 'Sign out',
  leaving: 'Signing out',
  pendingBody: "Some of today's practice hasn't synced yet. It will sync the next time you sign in on this phone.",
} as const;

/** The sheet's body, from the auth provider and what is still waiting to sync when it opens. */
export function signOutBody(pending: number, provider?: string): string {
  if (provider === 'mock') return SIGN_OUT_CONFIRM.deviceBody;
  return pending > 0 ? SIGN_OUT_CONFIRM.pendingBody : SIGN_OUT_CONFIRM.body;
}

/** How long sign-out waits for a last push before it goes anyway. */
export const SIGN_OUT_FLUSH_MS = 2_000;

/**
 * The running account's sync, as sign-out needs it. `App.tsx` registers it
 * when the engine starts (`startAccountSync`); nothing clears it. Once that
 * engine stops (sign-out or account switch) the registration reports nothing
 * pending and its flush does nothing, and the next account's engine replaces
 * it. Null means no engine ever started (the local mock): nothing to flush.
 */
export type SignOutSync = { pending: () => number; flush: () => Promise<unknown> };
let activeSync: SignOutSync | null = null;
export function registerSignOutSync(sync: SignOutSync | null): void { activeSync = sync; }
export function pendingAtSignOut(): number { return activeSync?.pending() ?? 0; }

/**
 * Try one last push before sign-out stops sync, bounded so an offline or stuck
 * network never holds the learner. Never throws: whatever does not land stays
 * dirty in the learner's namespace and pushes on the next sign-in here.
 */
export async function flushBeforeSignOut(
  sync: SignOutSync | null = activeSync,
  timeoutMs: number = SIGN_OUT_FLUSH_MS,
): Promise<void> {
  if (sync === null || sync.pending() === 0) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => { timer = setTimeout(resolve, timeoutMs); });
  try {
    await Promise.race([sync.flush().then(() => {}, () => {}), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** `open` with `signOut` is the busy sheet: confirmed, saving, then signing out. */
export type SignOutSheet = { open: boolean; signOut: boolean };
export type SignOutEvent = 'ask' | 'stay' | 'dismiss' | 'leave' | 'done';

/**
 * One step of the sheet. Only `leave` signs out, and only from an open sheet.
 * Once confirmed the sheet stays open and busy; dismissals are ignored so the
 * learner's answer stands, and only `done` (sign-out finished) closes it.
 */
export function signOutStep(state: SignOutSheet, event: SignOutEvent): SignOutSheet {
  if (event === 'done') return { open: false, signOut: false };
  if (state.open && state.signOut) return state;
  if (event === 'ask') return { open: true, signOut: false };
  if (event === 'leave') return { open: state.open, signOut: state.open };
  return { open: false, signOut: false };
}
