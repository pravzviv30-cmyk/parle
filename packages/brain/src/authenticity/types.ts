/**
 * The authenticity pack — curated knowledge about how a language is actually
 * spoken, as data rather than prompt prose.
 *
 * This is the differentiator's home. Duolingo teaches the left column of every
 * contrast pair below; people in France speak the right column. Keeping it as
 * typed data means it can be tested for integrity and copy rules, rendered
 * byte-stably into the cached prompt prefix, and grown per language without
 * touching a prompt template.
 */

import type { RegisterId } from '../types.ts';

export interface RegisterDef {
  id: RegisterId;
  /** Short display label, e.g. "familier (relaxed)". */
  label: string;
  whenToUse: string;
  /** Signature forms that mark this register. */
  markers: string[];
}

/** A textbook form and what people actually say. The core teaching unit. */
export interface ContrastPair {
  textbook: string;
  spoken: string;
  /** Standard spelling when `spoken` uses eye-dialect ("J'sais pas"), else null. */
  spokenWritten: string | null;
  en: string;
  /** One short plain sentence a learner could be told. */
  why: string;
  register: RegisterId;
}

/** The small words that make speech sound real. */
export interface Filler {
  fr: string;
  en: string;
  useWhen: string;
  register: RegisterId;
}

export interface SlangEntry {
  fr: string;
  /** Standard spelling when the form bends it, else null. */
  frWritten: string | null;
  en: string;
  /** Word-for-word gloss when it differs and is fun or useful, else null. */
  enLiteral: string | null;
  register: RegisterId;
  topic: 'money' | 'food' | 'people' | 'work' | 'reactions' | 'general';
  /** When a form can misfire (dated, regional, too street for outsiders), else null. */
  caution: string | null;
}

export interface AuthenticityPack {
  language: 'fr';
  /** Short prose rules the tutor always applies. */
  principles: string[];
  registers: RegisterDef[];
  contrasts: ContrastPair[];
  fillers: Filler[];
  slang: SlangEntry[];
}
