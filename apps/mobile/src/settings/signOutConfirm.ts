/**
 * Signing out asks first (F938). The safe answer, staying, is the solid pill
 * and comes first; signing out is the quiet link. Every other way off the sheet
 * (the scrim, a screen reader's escape, the back gesture) is staying.
 *
 * The body is true for both adapters: Supabase reconciles the account's
 * learning with the server, and the local mock keeps it on this device under
 * the learner's own namespace (`storage/scope.ts`), so signing back in finds it.
 */
export const SIGN_OUT_CONFIRM = {
  title: 'Sign out?',
  body: 'Your French stays saved to your account.',
  stay: 'Stay signed in',
  leave: 'Sign out',
} as const;

export type SignOutSheet = { open: boolean; signOut: boolean };
export type SignOutEvent = 'ask' | 'stay' | 'dismiss' | 'leave';

/** One step of the sheet. Only `leave` signs out, and only from an open sheet. */
export function signOutStep(state: SignOutSheet, event: SignOutEvent): SignOutSheet {
  if (event === 'ask') return { open: true, signOut: false };
  if (event === 'leave') return { open: false, signOut: state.open };
  return { open: false, signOut: false };
}
