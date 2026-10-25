/**
 * Which voices a warm run pays for, and what that costs.
 *
 * The warm cache used to be free to run and free to think about: one voice, one
 * corpus, a few cents, rerun whenever. Eight voices changes that. The scripted
 * corpus (authoredSpeech.ts) is 110 sentences and 2,950 characters, and a voice
 * is a whole second copy of it because the voice is part of the cache key, so
 * `all` (six voices) is about 17,700 characters, spent by a
 * command that reads like a cache warm.
 *
 * That is why the plan is a separate, pure module rather than three lines
 * inside the script:
 *
 *   1. The default must be one voice. A cold clone running `npm run warm-cache`
 *      is following the README, not asking to spend a third of the month.
 *   2. A typo must refuse BEFORE the first synthesis, not after seven voices.
 *      That is only possible if choosing the voices is a parse with no vendor
 *      in it, which is what this file is.
 *   3. The cost has to be printable before it is spent. `warmCost` states it
 *      per voice and in total from the corpus itself, so the number in the
 *      terminal cannot drift from the number in this comment.
 *
 * Nothing here talks to a vendor, reads a key or touches disk, so all of it is
 * testable without spending a character.
 */

import { DEFAULT_TUTOR_VOICE, isTutorVoiceKey, TUTOR_VOICES, type TutorVoiceKey } from '@luvani/core';
import { BEGINNER_SPEED } from './voiceConfiguration.ts';

/**
 * The variable name, exported so the script, the tests and any future doc line
 * read it from one place instead of each carrying the literal. Getting this
 * string wrong in one of three copies is a silent "warmed the default again".
 */
export const WARM_VOICES_ENV = 'LUVANI_WARM_VOICES';

type Env = Record<string, string | undefined>;

/** The catalogue's own order, which is the order every report prints in. */
function catalogueKeys(): TutorVoiceKey[] {
  return Object.keys(TUTOR_VOICES) as TutorVoiceKey[];
}

/**
 * Which voices this run warms.
 *
 *   unset (or empty)  the default voice, and only it
 *   all               every voice in the catalogue
 *   a,comma,list      exactly those, in catalogue order, deduplicated
 *
 * Parsed with the same idiom as `selectedVoiceVendor` in voice.ts: trim,
 * lowercase, treat empty as absent. The reason is the same one documented
 * there. This .env is edited by hand, and a `LUVANI_WARM_VOICES=` line left
 * behind after a run reads to a human as "not set" — it must not read to the
 * code as "warm nothing", which would be a warm run that silently did no work
 * and reported success.
 *
 * The one place it deliberately diverges from `selectedVoiceVendor` is the
 * unknown value. A typo'd vendor falls back, because a typo must not stop a
 * worker booting on the vendor it has always used. A typo'd voice THROWS,
 * because the alternative is worse than not booting: falling back would warm
 * the wrong voice and bill for it, and the operator would find out by reading
 * a report they had already stopped watching.
 *
 * Returns catalogue order rather than the order asked, and deduplicates. Both
 * are about the report being comparable between runs: `emilie,celine` and
 * `celine,emilie` are the same request and should print the same, and a voice
 * named twice must not appear as two voices in a cost line.
 */
export function voicesToWarm(env: Env = process.env): TutorVoiceKey[] {
  const raw = (env[WARM_VOICES_ENV] ?? '').trim().toLowerCase();
  if (raw === '') return [DEFAULT_TUTOR_VOICE];
  if (raw === 'all') return catalogueKeys();

  const asked = raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '');
  // `,` or `, ,` is a value that names no voice at all. Treated as unset for
  // the same reason an empty string is: it is a mistyped absence, not a
  // request to do nothing quietly.
  if (asked.length === 0) return [DEFAULT_TUTOR_VOICE];

  const unknown = asked.filter((key) => !isTutorVoiceKey(key));
  if (unknown.length > 0) {
    // The message carries the whole catalogue on purpose. An operator who has
    // just mistyped a voice key is exactly the person who does not know the
    // spelling, and sending them to another file to look it up is how a warm
    // run gets abandoned. `all` is named too, because it is the other legal
    // value and cannot be guessed from a list of keys.
    throw new Error(
      `${WARM_VOICES_ENV} names ${unknown.length === 1 ? 'a voice' : 'voices'} not in the catalogue: ` +
        `${unknown.map((key) => `"${key}"`).join(', ')}. ` +
        `The catalogue is ${catalogueKeys().join(', ')}, or the word all. ` +
        `Nothing was synthesized.`,
    );
  }

  const wanted = new Set(asked);
  return catalogueKeys().filter((key) => wanted.has(key));
}

export const WARM_SPEED_ENV = 'LUVANI_WARM_SPEED';

/**
 * Which live voice speeds this run warms (VOICE-016). The speed is part of the
 * cache key, so each one is a whole second copy of the corpus.
 *
 *   unset, empty or normal  the normal voice only (undefined: today's keys)
 *   slower                  BEGINNER_SPEED only
 *   both                    normal, then slower
 *
 * Anything else throws for the same reason a typo'd voice does: falling back
 * would bill a warm of the wrong copy.
 */
export function speedsToWarm(env: Env = process.env): (number | undefined)[] {
  const raw = (env[WARM_SPEED_ENV] ?? '').trim().toLowerCase();
  if (raw === '' || raw === 'normal') return [undefined];
  if (raw === 'slower') return [BEGINNER_SPEED];
  if (raw === 'both') return [undefined, BEGINNER_SPEED];
  throw new Error(`${WARM_SPEED_ENV} must be normal, slower or both, not "${raw}". Nothing was synthesized.`);
}

/** What a run is about to cost, in the only unit the vendor bills in. */
export interface WarmCost {
  voices: number;
  /** Speeds per voice; each is its own cache, so each pays the corpus again. */
  speeds: number;
  lines: number;
  /** Characters in the corpus once. Every voice pays this again from cold. */
  charsPerVoice: number;
  charsTotal: number;
}

/**
 * The bill for a cold run, computed from the corpus rather than remembered.
 *
 * `charsTotal` is a straight multiplication and that is the honest worst case:
 * the cache key carries the voice, so nothing one voice synthesized is ever
 * replayed for another. There is no sharing to discount for.
 */
export function warmCost(voices: readonly TutorVoiceKey[], lines: readonly string[], speeds = 1): WarmCost {
  const charsPerVoice = lines.reduce((total, line) => total + line.length, 0);
  return {
    voices: voices.length,
    speeds,
    lines: lines.length,
    charsPerVoice,
    charsTotal: charsPerVoice * voices.length * speeds,
  };
}

/**
 * The line printed before any money moves. Worst case, stated plainly, so the
 * operator can stop a run they did not mean to start — a rerun is nearly all
 * cache hits and costs almost nothing, and only the terminal knows which of the
 * two this is going to be.
 */
export function warmPlanLine(cost: WarmCost): string {
  return (
    `${cost.voices} ${cost.voices === 1 ? 'voice' : 'voices'} x ${cost.lines} lines, ` +
    (cost.speeds > 1 ? `x ${cost.speeds} speeds, ` : '') +
    `${cost.charsPerVoice} characters per voice, ` +
    `up to ${cost.charsTotal} characters if nothing is cached`
  );
}

/** What one voice actually cost, printed as that voice finishes. */
export function warmVoiceLine(
  voice: TutorVoiceKey,
  tally: { cached: number; synthesized: number; chars: number },
): string {
  return `${voice}: ${tally.cached} already cached, ${tally.synthesized} synthesized (~${tally.chars} chars billed)`;
}
