/**
 * Which friends backend this launch runs on.
 *
 * The same seam auth/adapter.ts keeps: screens import `friends` and never
 * know which side of the interface they are on. Today there is only the
 * local sample-roster adapter, so there is nothing to pick between yet.
 */

import type { FriendsAdapter } from './types.ts';
import { createLocalAdapter } from './localAdapter.ts';

function build(): FriendsAdapter {
  // When friend servers arrive, this checks EXPO_PUBLIC_SUPABASE_URL and
  // EXPO_PUBLIC_SUPABASE_ANON_KEY exactly as auth/adapter.ts does and lazily
  // requires './supabaseAdapter.ts' so keyless dev never imports the SDK.
  // Until that file exists, every launch is local.
  return createLocalAdapter();
}

/** The one adapter for this launch. */
export const friends: FriendsAdapter = build();
