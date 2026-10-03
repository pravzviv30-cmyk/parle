/**
 * Who is holding the phone, for anyone below the navigator.
 *
 * This exists because screens stopped being props. Mounted INSIDE SignedInRoot,
 * after `setActiveUser` has resolved — every store here reads through
 * `userKey()`, which throws when no user scope is set, so a provider hoisted
 * any higher would race the scope and crash on a cold start.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { LearnerProfile } from '@luvani/brain/profile';
import { loadProfile, saveProfile, saveMemoryChange, withAgeGatePassed, type StoredProfile } from '../profile/store.ts';
import { activeUserId, scopeGeneration } from '../storage/scope.ts';
import { brainAfterRecap } from '../profile/memory.ts';
import { entryFor } from '../onboarding/answers.ts';
import { AgeGateScreen } from '../onboarding/AgeGateScreen.tsx';

interface ProfileValue {
  profile: StoredProfile;
  /** Persist a whole new profile — fire and forget, the screen does not wait. */
  update: (next: StoredProfile) => void;
  updateMemory: (edit: (current: StoredProfile) => StoredProfile) => Promise<boolean>;
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
 * Loads the stored profile, then hands the tree what this launch is: a spinner
 * while the disk answers, and then whichever of onboarding, the age gate or the
 * app `entryFor` names.
 *
 * One value rather than two booleans, and that is not tidying. The age gate
 * lives INSIDE onboarding, so a navigator that asked "do they need onboarding?"
 * and "is a stop standing?" separately could show the standalone gate to
 * somebody who has never seen onboarding at all. The order is the rule, the
 * rule is in `onboarding/answers.ts` where a test can reach it, and this file
 * only draws the answer.
 */
export function ProfileGate({
  onSignOut,
  onboarding,
  children,
}: {
  /**
   * The way off a refusal. The account exists before either gate, so a learner
   * the age gate turns away is signed in with nothing behind them; signing back
   * out is the honest exit, and the same door serves both gate surfaces.
   */
  onSignOut: () => void;
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
      // The recap's brain has been through the extraction, which dedupes on a
      // fact's own text and so writes back anything the learner forgot the
      // moment a session mentions it again. The tombstones are applied here,
      // at the one write, rather than in the navigator's handler, whose deps
      // must stay exactly `[updateBrain]` (F386).
      const next: StoredProfile = { ...current, brain: brainAfterRecap(blob, current) };
      void saveProfile(next);
      return next;
    });
  }, []);

  const updateMemory = useCallback(async (edit: (current: StoredProfile) => StoredProfile): Promise<boolean> => {
    const owner = activeUserId();
    const generation = scopeGeneration();
    const saved = await saveMemoryChange(edit);
    if (!saved || activeUserId() !== owner || scopeGeneration() !== generation) return false;
    setProfile((current) => current === null || current === 'loading' ? current : {
      ...current, forgottenFacts: saved.forgottenFacts, learnerGoals: saved.learnerGoals,
      brain: { ...current.brain, memory: saved.brain.memory },
    });
    return true;
  }, []);

  const value = useMemo<ProfileValue | null>(
    () => (profile === null || profile === 'loading' ? null : { profile, update, updateBrain, updateMemory }),
    [profile, update, updateBrain, updateMemory],
  );

  if (profile === 'loading') return null;

  const entry = entryFor(profile);
  if (entry === 'onboarding') {
    return onboarding(profile, (p) => update(p));
  }
  if (entry === 'age-gate') {
    // Never reached with a null profile: `entryFor` sends anyone who has not
    // been through onboarding to onboarding, gate included. The check is here
    // because this file cannot prove that to the compiler, and rendering the
    // standalone gate to somebody with no record at all is the exact mistake
    // returning one value instead of two booleans exists to prevent.
    return profile === null ? onboarding(null, (p) => update(p)) : (
      <AgeGateScreen onPass={() => update(withAgeGatePassed(profile))} onSignOut={onSignOut} />
    );
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
