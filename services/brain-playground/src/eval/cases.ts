/**
 * The curated learner utterances — the brain's entrance exam.
 *
 * Each case probes one behaviour the product depends on. Expectations are
 * deliberately loose (kind sets, regex on the better form) because model
 * phrasing varies; the hard rules (never scold, never mention hesitation,
 * copy rules) are checked separately and DO fail the run.
 */

import type { CoachKind } from '@luvani/brain';

export interface EvalExpectation {
  /** At least one coach item of one of these kinds. */
  kindsAny?: CoachKind[];
  /** Some coach item's `better` matches. */
  betterMatch?: RegExp;
  /** At balanced strictness this lands in the recap queue, not inline. */
  deferredAtBalanced?: boolean;
  /** No matters-now coaching — the learner did fine. */
  emptyCoach?: boolean;
  language?: 'french' | 'mixed' | 'english' | 'none';
  /** The pre-model rescue fired. */
  rescue?: boolean;
}

export interface EvalCase {
  id: string;
  scenario: 'cafe' | 'apero';
  input: { type: 'spoke'; text: string } | { type: 'silence' } | { type: 'help' };
  expect: EvalExpectation;
  note: string;
}

export const EVAL_CASES: EvalCase[] = [
  {
    id: 'textbook-je-ne-sais-pas',
    scenario: 'cafe',
    input: { type: 'spoke', text: 'Je ne sais pas... un café ?' },
    expect: { kindsAny: ['textbook-phrasing'], betterMatch: /j'?sais pas|chais pas/i },
    note: 'THE flagship: correct French nobody says. Must be flagged inline.',
  },
  {
    id: 'textbook-est-ce-que',
    scenario: 'apero',
    input: { type: 'spoke', text: 'Est-ce que tu as faim ?' },
    expect: { kindsAny: ['textbook-phrasing'], betterMatch: /t'as faim/i },
    note: 'Est-ce que among friends: grammatical, stiff, and never said.',
  },
  {
    id: 'textbook-nous-allons',
    scenario: 'apero',
    input: { type: 'spoke', text: 'Nous allons au cinéma samedi ?' },
    expect: { kindsAny: ['textbook-phrasing'], betterMatch: /\bon va\b/i },
    note: 'Nous in casual speech; on is the living pronoun.',
  },
  {
    id: 'anglicism-excite',
    scenario: 'apero',
    input: { type: 'spoke', text: 'Je suis très excité pour samedi !' },
    expect: { kindsAny: ['anglicism'] },
    note: 'The classic false friend; excité reads very differently in French.',
  },
  {
    id: 'anglicism-actuellement',
    scenario: 'cafe',
    input: { type: 'spoke', text: 'Actuellement, je veux un thé.' },
    expect: { kindsAny: ['anglicism', 'textbook-phrasing'] },
    note: 'Actuellement means currently, not actually.',
  },
  {
    id: 'grammar-slip-defers',
    scenario: 'cafe',
    input: { type: 'spoke', text: 'Je voudrais aller au la boulangerie après.' },
    expect: { kindsAny: ['grammar-slip'], deferredAtBalanced: true },
    note: 'Understood fine; mechanics slipped. At balanced it waits for the recap.',
  },
  {
    id: 'register-vous-to-friend',
    scenario: 'apero',
    input: { type: 'spoke', text: 'Bonsoir Chloé. Comment allez-vous ?' },
    expect: { kindsAny: ['register-mismatch', 'textbook-phrasing'], betterMatch: /ça va|tu vas/i },
    note: 'Vous to an old friend lands as distance.',
  },
  {
    id: 'register-tu-to-barista',
    scenario: 'cafe',
    input: { type: 'spoke', text: 'Salut mec, tu me fais un café ?' },
    expect: { kindsAny: ['register-mismatch'] },
    note: 'Tu and mec with staff behind a counter lands poorly.',
  },
  {
    id: 'blocking-non-sequitur',
    scenario: 'cafe',
    input: { type: 'spoke', text: "J'habite à Londres." },
    expect: { kindsAny: ['blocking-error'] },
    note: 'Clear French that does not answer the question.',
  },
  {
    id: 'english-fallback',
    scenario: 'cafe',
    input: { type: 'spoke', text: 'How do I say I want a croissant?' },
    expect: { language: 'english', kindsAny: ['english-to-french'], betterMatch: /croissant/i },
    note: 'A learner reaching for help in English must get it warmly, never a scolding.',
  },
  {
    id: 'mixed-code-switching',
    scenario: 'cafe',
    input: { type: 'spoke', text: 'Je voudrais un croissant and also un café.' },
    expect: { language: 'mixed' },
    note: 'Half-French counts as partial progress, not failure.',
  },
  {
    id: 'english-reach',
    scenario: 'cafe',
    input: { type: 'spoke', text: 'How do I say I want a coffee, please?' },
    expect: { language: 'english', kindsAny: ['english-to-french'], betterMatch: /caf[eé]/i },
    note: 'Reaching for English is reaching for words. The classification is what lets the engine pin the beat and hand the French back.',
  },
  {
    id: 'english-task-done-anyway',
    scenario: 'cafe',
    input: { type: 'spoke', text: 'Can I just have a coffee please?' },
    expect: { language: 'english', kindsAny: ['english-to-french'], betterMatch: /caf[eé]/i },
    note: 'English that does the job is still English: the beat must not complete on it, so the label has to be right.',
  },
  {
    id: 'silence-rescue',
    scenario: 'cafe',
    input: { type: 'silence' },
    expect: { rescue: true },
    note: 'Four seconds of nothing: the tutor steps in and never mentions the pause.',
  },
  {
    id: 'good-natural-order',
    scenario: 'cafe',
    input: { type: 'spoke', text: "Bonjour ! Un café, s'il vous plaît." },
    expect: { emptyCoach: true, language: 'french' },
    note: 'A clean natural order needs no coaching at all.',
  },
  {
    id: 'good-slangy-reply',
    scenario: 'apero',
    input: { type: 'spoke', text: "Bah écoute, ça va. J'suis un peu crevé, la semaine était longue." },
    expect: { emptyCoach: true, language: 'french' },
    note: 'Already speaking real French; the tutor should credit, not correct.',
  },
];
