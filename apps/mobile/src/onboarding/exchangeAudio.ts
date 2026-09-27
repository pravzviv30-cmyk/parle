/**
 * The bundled recording behind each line of the first-run exchange.
 *
 * Only bundled assets: the three onboarding lines in Alexandre's voice
 * (`tutorLineAudio.ts`, generated) and the learner's reply from the daily
 * manifest, which every tutor already voices. Nothing is synthesised on the
 * device and nothing is fetched. A separate file from `firstRun.ts` because
 * `require` of an audio asset is a Metro thing that node tests cannot load.
 */

import { TUTOR_LINE_AUDIO } from './tutorLineAudio.ts';
import { TUTOR_DAILY_AUDIO } from '../daily/tutorAudioManifest.ts';
import { tutorAudioFor } from '../daily/tutorAudio.ts';
import type { ExchangeLine } from './firstRun.ts';

/** The asset for a line, or undefined when it is not bundled (the line is still shown). */
export function clipFor(line: ExchangeLine): number | undefined {
  return line.pack === 'onboarding' ? TUTOR_LINE_AUDIO[line.id] : tutorAudioFor(TUTOR_DAILY_AUDIO, line.id, line.voice);
}
