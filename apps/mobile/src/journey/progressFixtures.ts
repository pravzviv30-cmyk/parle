/**
 * Fixed learners for "How it’s going" (2026-10-28, LEARN-013): the inputs the
 * real `progressRowsView` takes, one per state the section can draw. Imported
 * only by the dev screen preview (`dev/YourFrenchPreview.tsx`) and by tests, so
 * screenshots and assertions read the same records. Nothing here touches
 * storage or an account.
 */

import { createProfile, type LearnerProfile } from '@luvani/brain/profile';
import type { ReviewCard } from '@luvani/core';

import type { FeatureAccess, LockedFeature } from '../access/featureAccess.ts';
import { FIXTURE_NOW } from './yourFrenchFixtures.ts';
import type { progressRowsView } from './journeyView.ts';

export const PROGRESS_STATES = ['both', 'better', 'again', 'free'] as const;
export type ProgressState = (typeof PROGRESS_STATES)[number];
export type ProgressInput = Parameters<typeof progressRowsView>[0];

const DAY = 24 * 60 * 60 * 1000;

/** A deck phrase, due `dueDaysAgo` days ago. */
function card(front: string, back: string, dueDaysAgo: number, lapses: number): ReviewCard {
  return {
    id: `phrase:${front.trim().toLowerCase()}`, kind: 'vocab', front, back, context: '', ipa: '',
    addedAt: FIXTURE_NOW - 20 * DAY, due: FIXTURE_NOW - dueDaysAgo * DAY, intervalDays: 1, ease: 2.3, reps: 2, lapses,
    evidence: { retrievals: 1, convoUses: 0, transfers: 0 },
  };
}

/** Three due phrases: two missed once in review, one only said with help. */
const DECK: readonly ReviewCard[] = [
  card('je voudrais un croissant', 'I would like a croissant', 3, 1),
  card('l’addition, s’il vous plaît', 'the bill, please', 2, 0),
  card('où sont les toilettes ?', 'where are the toilets?', 1, 2),
];

/** Two recurring patterns, last seen in conversation 2, then eight more conversations without them. */
function brain(withPatterns: boolean): LearnerProfile {
  const base = createProfile();
  return {
    ...base,
    stats: { ...base.stats, sessions: 10 },
    errorPatterns: withPatterns
      ? {
          'gender-agreement': { count: 3, lastSeen: '2026-10-10T12:00:00Z', example: 'le table', sessions: 2, lastSession: 2 },
          'tu-vous-mixing': { count: 2, lastSeen: '2026-10-09T12:00:00Z', example: 'tu voulez', sessions: 2, lastSession: 1 },
        }
      : {},
    phrases: {
      addition: {
        fr: 'l’addition, s’il vous plaît', frWritten: null, en: 'the bill, please', register: 'courant',
        introducedAt: '2026-10-01T12:00:00Z', timesUsedWell: 0, timesAssisted: 1, mastered: false,
      },
    },
  };
}

const open = (_feature: LockedFeature): FeatureAccess => 'unlocked';
const free = (feature: LockedFeature): FeatureAccess => (feature === 'fullJourney' ? 'locked' : 'unlocked');

/** The real `progressRowsView` input for one state. */
export function progressFixture(state: ProgressState): ProgressInput {
  switch (state) {
    case 'both': return { brain: brain(true), deck: DECK, now: FIXTURE_NOW, access: open };
    case 'better': return { brain: brain(true), deck: [], now: FIXTURE_NOW, access: open };
    case 'again': return { brain: brain(false), deck: DECK, now: FIXTURE_NOW, access: open };
    case 'free': return { brain: brain(true), deck: DECK, now: FIXTURE_NOW, access: free };
  }
}
