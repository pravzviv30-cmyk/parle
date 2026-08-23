/**
 * Who is holding the phone, for anyone below the navigator.
 *
 * This exists because screens stopped being props. Mounted INSIDE SignedInRoot,
 * after `setActiveUser` has resolved — every store here reads through
 * `userKey()`, which throws when no user scope is set, so a provider hoisted
 * any higher would race the scope and crash on a cold start.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { LearnerProfile } from '@parle/brain/profile';
import { loadProfile, saveProfile, type StoredProfile } from '../profile/store.ts';
import { needsOnboarding } from '../onboarding/answers.ts';

interface ProfileValue {
  profile: StoredProfile;
  /** Persist a whole new profile — fire and forget, the screen does not wait. */
  update: (next: StoredProfile) => void;
  /** Persist just the tutor's memory of the learner, from a recap. */
  updateBrain: (blob: LearnerProfile) => void;
}

const Ctx = createContext<ProfileValue | null>(null);

export function useProfile(): ProfileValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useProfile called outside ProfileProvider');
  return v;
}

/**
 * Loads the stored profile, then hands the tree one of three things: a spinner
 * while the disk answers, the onboarding flow when there is nobody yet (or a
 * pre-account profile missing the newer answers), or the app.
 */
export function ProfileGate({
  onboarding,
  children,
}: {
  /** Rendered when there is no usable profile. Calls back with the saved one. */
  onboarding: (existing: StoredProfile | null, done: (p: StoredProfile) => void) => React.ReactElement;
  children: React.ReactNode;
}) {
  const [profile, setProfile] = useState<StoredProfile | null | 'loading'>('loading');

  useEffect(() => {
    let cancelled = false;
    void loadProfile().then((p) => {
      if (!cancelled) setProfile(p);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback((next: StoredProfile) => {
    // The write catches up while the screen already shows the new value.
    void saveProfile(next);
    setProfile(next);
  }, []);

  const updateBrain = useCallback((blob: LearnerProfile) => {
    setProfile((current) => {
      if (current === null || current === 'loading') return current;
      const next: StoredProfile = { ...current, brain: blob };
      void saveProfile(next);
      return next;
    });
  }, []);

  const value = useMemo<ProfileValue | null>(
    () => (profile === null || profile === 'loading' ? null : { profile, update, updateBrain }),
    [profile, update, updateBrain],
  );

  if (profile === 'loading') return null;
  if (needsOnboarding(profile)) {
    return onboarding(profile, (p) => update(p));
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
