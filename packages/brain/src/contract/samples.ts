/**
 * Valid sample objects for tests and the mock client.
 *
 * Not fixtures for learners — these are minimal, obviously-fake payloads that
 * satisfy the schemas, with override hooks so a test can bend exactly the field
 * it cares about and nothing else.
 */

import type { SupportMaterial, TutorTurn } from './types.ts';

export function sampleSupport(overrides: Partial<SupportMaterial> = {}): SupportMaterial {
  return {
    fullLine: { fr: "Un café, s'il vous plaît", frWritten: null, en: 'A coffee, please' },
    options: [
      { fr: "Un café, s'il vous plaît", en: 'A coffee, please' },
      { fr: "Un thé, s'il vous plaît", en: 'A tea, please' },
    ],
    hintEn: 'Order a drink.',
    ...overrides,
  };
}

/**
 * A clean, well-behaved turn: learner did fine, no coaching, scene moves on.
 * Deep overrides go section by section so callers never rebuild the world.
 */
export function sampleTurn(overrides: Partial<TutorTurn> = {}): TutorTurn {
  return {
    assessment: {
      understood: true,
      taskAchieved: true,
      comprehensibility: 'clear',
      language: 'french',
      cefrEvidence: 'A2',
    },
    coach: [],
    coachLine: null,
    sceneReply: {
      speaker: 'Karim',
      fr: 'Ça marche, un café !',
      frWritten: null,
      en: 'Coming up, one coffee!',
    },
    narration: null,
    support: sampleSupport(),
    newPhrases: [],
    profileSignals: { errorPatterns: [], usedWell: [] },
    scene: { beat: 'order-drink', beatDone: false, sceneDone: false },
    ...overrides,
  };
}

export function sampleCoachItem(overrides: Partial<TutorTurn['coach'][number]> = {}): TutorTurn['coach'][number] {
  return {
    kind: 'textbook-phrasing',
    quote: 'Je ne sais pas',
    better: "J'sais pas",
    betterWritten: 'Je sais pas',
    betterEn: "I don't know",
    why: 'The ne disappears in speech almost every time.',
    weight: 'matters-now',
    ...overrides,
  };
}
