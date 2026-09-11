/**
 * Whether the wall may be opened straight away, for review, before a store exists.
 *
 * The purchase half of this feature cannot be switched on until the RevenueCat
 * keys exist and F263 and F266 close, and `docs/RELEASE_GATE.md` is explicit
 * that switching payments on first and fixing after is not acceptable. But a
 * wall nobody can look at until then is a wall nobody can correct, and the three
 * value pages need no store at all.
 *
 * So this exists, and it is gated the way `developmentEntitlementsEnabled` in
 * the token server is gated: three conditions that must all hold, one of which
 * is the absence of a production build. A reviewer sets the flag, sees the wall,
 * and nothing about a shipped app changes.
 *
 * It opens the wall and nothing else. It grants no minutes, buys nothing, and
 * makes no claim about a plan: pages one to three are the learner's own progress
 * and a promise about what stays free, all of which is as true in a preview as
 * anywhere.
 */
export interface PreviewEnvironment {
  EXPO_PUBLIC_LUVANI_WALL_PREVIEW?: string;
  EXPO_PUBLIC_LUVANI_LOCAL_DEVELOPMENT?: string;
  NODE_ENV?: string;
}

export function wallPreviewEnabled(env: PreviewEnvironment = process.env): boolean {
  // A production build never opens on this, whatever else is set.
  if (env.NODE_ENV === 'production') return false;
  // And neither does a real build pointed at real infrastructure: the preview
  // rides on the same explicit local-development switch the mock auth adapter
  // needs, so it cannot be reached by a build that talks to anything real.
  if (env.EXPO_PUBLIC_LUVANI_LOCAL_DEVELOPMENT !== '1') return false;
  return env.EXPO_PUBLIC_LUVANI_WALL_PREVIEW === '1';
}
