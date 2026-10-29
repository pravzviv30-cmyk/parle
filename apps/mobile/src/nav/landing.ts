/**
 * Where the navigator opens once a learner is signed in (F938).
 *
 * - `first-run`: onboarding just finished in this launch, so the first-run
 *   reset (`openFirstRun` in App.tsx) owns the landing. That covers "Save and
 *   finish the scene", which continues into the café scene, and must win.
 * - `today`: the learner signed in (or back in) while the app was running, so
 *   the address the last session left behind (/settings, /plans) is not theirs
 *   to resume. Tabs, Home.
 * - `keep`: a cold load that already had a session. Its address is a deep link
 *   or a reload, and it stands.
 */
export type Landing = 'first-run' | 'today' | 'keep';

export function landingAfterAuth(input: { justOnboarded: boolean; signedInThisLaunch: boolean }): Landing {
  if (input.justOnboarded) return 'first-run';
  return input.signedInThisLaunch ? 'today' : 'keep';
}

export type AuthPhase = 'loading' | 'signedOut' | 'signedIn';

/**
 * Has this launch seen the door closed? A latch: once signed out, every later
 * sign-in happened inside the running app. A cold load with a session goes
 * loading to signedIn and never trips it.
 */
export function sawSignedOut(previously: boolean, status: AuthPhase): boolean {
  return previously || status === 'signedOut';
}

/**
 * On web, a sign-out wipes the address back to `/`, so the next sign-in's
 * container does not restore the last learner's screen. Native has no address.
 */
export function addressAfterSignOut(platform: string, wasSignedIn: boolean, nowSignedOut: boolean): '/' | null {
  return platform === 'web' && wasSignedIn && nowSignedOut ? '/' : null;
}
