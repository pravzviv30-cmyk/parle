/**
 * The twelve Luvani sound effects, as recipes for scripts/sfx/synth.mjs.
 * Source: docs/come-alive/motion-sound.md section 6.1 (the recipes table).
 *
 * Every pitch a sound rests on is in C-major pentatonic (C D E G A), so sounds that overlap
 * still agree. Two rows of the table name frequencies just outside the scale, and here they
 * are moved to the nearest scale note: `count-tick` 2400 Hz is D7 (2349.3 Hz, 37 cents lower),
 * and the `save` glide 900 to 620 Hz runs A5 to E5 (880 to 659.3 Hz). Overtones (partials),
 * the bell's inharmonic partials, detune and vibrato are colour, not pitches.
 *
 * Changing any recipe, or RECIPE_VERSION, changes the sound's wavSha256, which withdraws the
 * founder's approval of it until he has listened again (decision D9).
 */

/** Bump to re-roll every seed. Each bump makes every sound need approval again. */
export const RECIPE_VERSION = 1;

const NOTE_INDEX = /** @type {const} */ ({ C: -9, D: -7, E: -5, G: -2, A: 0 });

/** The pentatonic note names a recipe may use. */
export const PENTATONIC = /** @type {const} */ (['C', 'D', 'E', 'G', 'A']);

/**
 * Equal-tempered frequency of a pentatonic note, A4 = 440 Hz.
 * @param {`${'C' | 'D' | 'E' | 'G' | 'A'}${number}`} name e.g. 'E6'
 */
export function hz(name) {
  const letter = /** @type {'C' | 'D' | 'E' | 'G' | 'A'} */ (name[0]);
  const octave = Number(name.slice(1));
  const semitones = NOTE_INDEX[letter] + (octave - 4) * 12;
  return 440 * Math.pow(2, semitones / 12);
}

/** Warm partials shared by the chimes: the octave and the twelfth, quietly. */
const CHIME = [{ ratio: 1, gain: 1 }, { ratio: 2, gain: 0.35 }, { ratio: 3, gain: 0.12 }];
const SOFT = [{ ratio: 1, gain: 1 }, { ratio: 2, gain: 0.25 }];
const PURE = [{ ratio: 1, gain: 1 }];

/** @typedef {import('./synth.mjs').Recipe} Recipe */

/** @type {readonly Recipe[]} */
export const RECIPES = [
  {
    id: 'tap',
    lengthMs: 40,
    peakDbfs: -18,
    plays: 'A chip landing, and icon buttons that switch on or off.',
    voices: [
      { kind: 'tone', at: 0, hz: hz('E6'), gain: 1, env: { attack: 1, tau: 12 },
        partials: [{ ratio: 1, gain: 1, wave: 'triangle' }, { ratio: 2, gain: 0.25 }] },
    ],
  },
  {
    id: 'select',
    lengthMs: 90,
    peakDbfs: -14,
    plays: 'Choosing an option tile.',
    voices: [
      { kind: 'tone', at: 0, hz: hz('G5'), gain: 1, env: { attack: 2, tau: 35 }, partials: PURE },
      { kind: 'tone', at: 0, hz: hz('D6'), gain: 0.5, env: { attack: 2, tau: 35 }, partials: PURE },
    ],
  },
  {
    id: 'correct',
    lengthMs: 300,
    peakDbfs: -8,
    plays: 'A reply accepted, and a right answer in a drill.',
    voices: [
      { kind: 'tone', at: 0, hz: hz('C6'), gain: 1, env: { attack: 3, tau: 90 }, partials: CHIME },
      { kind: 'tone', at: 70, hz: hz('E6'), gain: 1, env: { attack: 3, tau: 90 }, partials: CHIME },
    ],
  },
  {
    id: 'nearly',
    lengthMs: 220,
    peakDbfs: -12,
    plays: 'A drill answer that was close, such as a typo. It rises, never falls.',
    voices: [
      { kind: 'tone', at: 0, hz: hz('G5'), gain: 1, env: { attack: 3, tau: 70 }, partials: SOFT },
      { kind: 'tone', at: 90, hz: hz('A5'), gain: 1, env: { attack: 3, tau: 70 }, partials: SOFT },
    ],
  },
  {
    id: 'complete',
    lengthMs: 760,
    peakDbfs: -6,
    plays: 'Practice complete, a daily goal met, and a confirmed purchase.',
    voices: [
      { kind: 'tone', at: 0, hz: hz('C5'), gain: 0.9, env: { attack: 3, tau: 160 }, partials: CHIME },
      { kind: 'tone', at: 70, hz: hz('E5'), gain: 0.9, env: { attack: 3, tau: 160 }, partials: CHIME },
      { kind: 'tone', at: 140, hz: hz('G5'), gain: 0.9, env: { attack: 3, tau: 160 }, partials: CHIME },
      { kind: 'tone', at: 210, hz: hz('C6'), gain: 1, env: { attack: 3, tau: 300 }, partials: CHIME },
      { kind: 'tone', at: 260, hz: hz('C7'), gain: 0.15, env: { attack: 6, tau: 300 }, partials: PURE },
    ],
  },
  {
    id: 'streak',
    lengthMs: 820,
    peakDbfs: -6,
    plays: 'The streak flame lighting up for the day.',
    voices: [
      { kind: 'noise', at: 0, durMs: 220, gain: 0.9, env: { attack: 150, release: 70 },
        filter: { type: 'bandpass', hz: 400, toHz: 2400, q: 1.2 } },
      { kind: 'tone', at: 160, hz: hz('D5'), gain: 0.8, detuneCents: 4, env: { attack: 20, tau: 300 }, partials: SOFT },
      { kind: 'tone', at: 160, hz: hz('A5'), gain: 0.7, detuneCents: 4, env: { attack: 20, tau: 300 }, partials: SOFT },
      { kind: 'tone', at: 160, hz: hz('D6'), gain: 0.6, detuneCents: 4, env: { attack: 20, tau: 300 }, partials: SOFT },
    ],
  },
  {
    id: 'levelup',
    lengthMs: 1150,
    peakDbfs: -5,
    plays: 'Reaching a new level.',
    voices: [
      { kind: 'tone', at: 0, hz: hz('G4'), gain: 0.7, env: { attack: 3, tau: 140 }, partials: CHIME },
      { kind: 'tone', at: 60, hz: hz('C5'), gain: 0.7, env: { attack: 3, tau: 140 }, partials: CHIME },
      { kind: 'tone', at: 120, hz: hz('E5'), gain: 0.7, env: { attack: 3, tau: 140 }, partials: CHIME },
      { kind: 'tone', at: 180, hz: hz('G5'), gain: 0.7, env: { attack: 3, tau: 140 }, partials: CHIME },
      ...[hz('C6'), hz('E6'), hz('G6')].map((note) => /** @type {const} */ ({
        kind: 'tone', at: 260, hz: note, gain: 0.6, vibrato: { rate: 5, cents: 6 },
        env: { attack: 10, decay: 160, sustain: 0.6, release: 300 }, partials: SOFT,
      })),
    ],
  },
  {
    id: 'quest',
    lengthMs: 680,
    peakDbfs: -7,
    plays: 'The chest opening when all three daily quests are done.',
    voices: [
      { kind: 'noise', at: 0, durMs: 18, gain: 0.85, env: { attack: 1, tau: 5 }, filter: { type: 'lowpass', hz: 1200, q: 0.707 } },
      { kind: 'noise', at: 110, durMs: 18, gain: 0.85, env: { attack: 1, tau: 5 }, filter: { type: 'lowpass', hz: 1200, q: 0.707 } },
      { kind: 'tone', at: 220, hz: hz('A6'), gain: 0.55, env: { attack: 2, tau: 80 }, partials: [{ ratio: 1, gain: 1 }, { ratio: 2, gain: 0.15 }] },
      { kind: 'tone', at: 260, hz: hz('C7'), gain: 0.55, env: { attack: 2, tau: 80 }, partials: [{ ratio: 1, gain: 1 }, { ratio: 2, gain: 0.15 }] },
      { kind: 'tone', at: 300, hz: hz('D7'), gain: 0.55, env: { attack: 2, tau: 80 }, partials: [{ ratio: 1, gain: 1 }, { ratio: 2, gain: 0.15 }] },
      { kind: 'tone', at: 340, hz: hz('E7'), gain: 0.55, env: { attack: 2, tau: 80 }, partials: [{ ratio: 1, gain: 1 }, { ratio: 2, gain: 0.15 }] },
    ],
  },
  {
    id: 'badge',
    lengthMs: 950,
    peakDbfs: -7,
    plays: 'A badge earned, and the medal on a streak milestone.',
    voices: [
      // A bell: inharmonic partials, the higher ones dying sooner.
      { kind: 'tone', at: 0, hz: hz('E6'), gain: 1, env: { attack: 1, tau: 380 }, partials: [
        { ratio: 1, gain: 1 },
        { ratio: 2.76, gain: 0.4, tauScale: 0.6 },
        { ratio: 5.4, gain: 0.18, tauScale: 0.4 },
        { ratio: 8.93, gain: 0.06, tauScale: 0.3 },
      ] },
      { kind: 'tone', at: 40, hz: hz('C6'), gain: 0.5, env: { attack: 10, tau: 380 }, partials: [{ ratio: 1, gain: 1 }, { ratio: 2, gain: 0.15 }] },
    ],
  },
  {
    id: 'save',
    lengthMs: 140,
    peakDbfs: -10,
    plays: 'A phrase saved, an account saved, and a reminder set.',
    voices: [
      { kind: 'tone', at: 0, hz: hz('A5'), glide: { to: hz('E5'), overMs: 45 }, gain: 1, env: { attack: 1, tau: 50 }, partials: PURE },
      { kind: 'noise', at: 0, durMs: 4, gain: 0.15, env: { attack: 0.5, tau: 1.5 }, filter: { type: 'lowpass', hz: 3000, q: 0.707 } },
    ],
  },
  {
    id: 'count-tick',
    lengthMs: 18,
    peakDbfs: -24,
    plays: 'Each step of a number counting up.',
    voices: [
      { kind: 'tone', at: 0, hz: hz('D7'), gain: 1, env: { attack: 0.5, tau: 5 }, partials: PURE },
    ],
  },
  {
    id: 'whoosh',
    lengthMs: 300,
    peakDbfs: -16,
    plays: 'A full-screen celebration arriving, and a chip taking off.',
    voices: [
      { kind: 'noise', at: 0, durMs: 300, gain: 1, env: { attack: 120, release: 180 },
        filter: { type: 'bandpass', hz: 300, toHz: 1500, q: 0.9 } },
    ],
  },
];
