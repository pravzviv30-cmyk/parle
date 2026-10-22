/**
 * Fixed learners for the Your French section (2026-10-22): the inputs the real
 * `yourFrenchView` takes, one per state the section can draw. Imported only by
 * the dev screen preview (`dev/YourFrenchPreview.tsx`) and by tests, so the
 * screenshots and the assertions read the same records. Nothing here touches
 * storage or an account.
 *
 * The builders follow `journeyView.test.ts` (`card`, `check`, `progressOf`,
 * `focus`, `clear`) so a fixture means what the view's own tests mean.
 */

import { FRENCH_PHONEMES, MISSIONS, missionStates, type ReviewCard } from '@luvani/core';

import type { FeatureAccess, LockedFeature } from '../access/featureAccess.ts';
import { missionCompletionsFrom } from '../missions/chooserView.ts';
import type { SoundCheckEvidence } from '../soundcheck/model.ts';
import type { StoredCompletion, yourFrenchView } from './journeyView.ts';

export const YOUR_FRENCH_STATES = ['full', 'sounds', 'scenes', 'forward', 'free'] as const;
export type YourFrenchState = (typeof YOUR_FRENCH_STATES)[number];

const DAY = 24 * 60 * 60 * 1000;
/** A Tuesday at noon local time, as journeyView.test.ts's NOW, so day words are stable across zones. */
export const FIXTURE_NOW = new Date(2026, 9, 20, 12, 0, 0).getTime();

const A0 = MISSIONS.filter((m) => m.cefr === 'A0').map((m) => m.id);
const progressOf = (stored: readonly StoredCompletion[]) => missionStates(missionCompletionsFrom(stored), [], FIXTURE_NOW);

/** A phrase used in conversation at least once, so it is retained. */
function card(id: string, front: string, back: string, daysAgo: number, convoUses: number, transfers = 0): ReviewCard {
  return {
    id, kind: 'vocab', front, back, context: '', ipa: '',
    addedAt: FIXTURE_NOW - daysAgo * DAY, due: FIXTURE_NOW + DAY, intervalDays: 6, ease: 2.5, reps: 3, lapses: 0,
    evidence: { retrievals: 1, convoUses, transfers },
  };
}

/** Eight used phrases, more than the featured one and five chips, so "and 2 more" shows. Two held. */
const PHRASES: readonly ReviewCard[] = [
  card('p-croissant', 'je voudrais un croissant', 'I would like a croissant', 2, 5, 1),
  card('p-addition', 'l’addition, s’il vous plaît', 'the bill, please', 3, 3, 1),
  card('p-cafe', 'un café, s’il vous plaît', 'a coffee, please', 4, 3),
  card('p-merci', 'merci beaucoup', 'thank you very much', 5, 2),
  card('p-ou', 'où sont les toilettes ?', 'where are the toilets?', 6, 2),
  card('p-combien', 'c’est combien ?', 'how much is it?', 7, 1),
  card('p-appelle', 'je m’appelle Yasmin', 'my name is Yasmin', 8, 1),
  card('p-bonne', 'bonne journée', 'have a good day', 9, 1),
];

/** Practised once, never used in conversation: on the journey, but no evidence. */
const UNUSED: readonly ReviewCard[] = [card('p-bonjour', 'bonjour', 'hello', 2, 0)];

function check(at: number, kind: SoundCheckEvidence['kind'], phoneme: string | null): SoundCheckEvidence {
  return { missionId: 'mission:cafe', reference: 'Bonjour', at, kind, focus: null, phoneme };
}
/** A line called out on one of its sounds, then the same line back clear two days later. */
const SOUNDS: readonly SoundCheckEvidence[] = [
  check(FIXTURE_NOW - 3 * DAY, 'assessed-focus', FRENCH_PHONEMES[0]!.ipa),
  check(FIXTURE_NOW - DAY, 'assessed-clear', null),
];

/** Two scenes earned on your own, the newer one leading. */
const OWN: readonly StoredCompletion[] = [
  { id: A0[0]!, at: FIXTURE_NOW - 4 * DAY, rung: 4 },
  { id: A0[1]!, at: FIXTURE_NOW - DAY, rung: 4 },
];
/** A scene finished with help: a practised journey with nothing earned yet. */
const HELPED: readonly StoredCompletion[] = [{ id: A0[0]!, at: FIXTURE_NOW - DAY, rung: 2 }];

const open = (_feature: LockedFeature): FeatureAccess => 'unlocked';
/** The free plan, as the view's own lock tests shape it: phrases and sounds locked, scenes free. */
const free = (feature: LockedFeature): FeatureAccess => (feature === 'fullJourney' || feature === 'sounds' ? 'locked' : 'unlocked');

export type YourFrenchInput = Parameters<typeof yourFrenchView>[0];

/** The real `yourFrenchView` input for one state. */
export function yourFrenchFixture(state: YourFrenchState): YourFrenchInput {
  const at = (deck: readonly ReviewCard[], checks: readonly SoundCheckEvidence[], done: readonly StoredCompletion[], access = open): YourFrenchInput =>
    ({ deck, checks, progress: progressOf(done), completions: done, now: FIXTURE_NOW, access });
  switch (state) {
    case 'full': return at(PHRASES, SOUNDS, OWN);
    case 'sounds': return at(UNUSED, SOUNDS, HELPED);
    case 'scenes': return at(UNUSED, [], OWN);
    case 'forward': return at(UNUSED, [], HELPED);
    case 'free': return at(PHRASES, SOUNDS, OWN, free);
  }
}
