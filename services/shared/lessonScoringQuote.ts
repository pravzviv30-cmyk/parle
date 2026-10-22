/** The reviewed Speechace scoring component a 'lesson' quote carries when live scoring is on (F863).
 * The price is the cost model (DEFAULT_COST_MODEL.assessmentPerUtterance), not a verified vendor quote. */
import {DEFAULT_COST_MODEL} from '@luvani/core/metering';
import type {PaidComponent} from './paidAdmission.ts';
import {paidConfigurationSha256,SCORING_MAX_WAV_BYTES} from './paidExecution.ts';
/** Longest audio one call may carry, from the per-call WAV ceiling (32 bytes/ms after the 44-byte header). */
export const LESSON_SCORING_MAX_CALL_MILLIS=(SCORING_MAX_WAV_BYTES-44)/32;
/** Four scores per reference turn of the 12-turn cafe lesson; scoring fires only when the learner says the reference line. */
export const LESSON_SCORING_EFFECTS=48;
/** The whole 900 s lesson, which is also the supported audio maximum. */
export const LESSON_SCORING_AUDIO_MILLIS=900000;
/** A reference line is short; 256 bytes per score is generous. */
export const LESSON_SCORING_TEXT_BYTES_PER_EFFECT=256;
/** Speechace counts text plus 4096 bytes of multipart overhead; the WAV is bounded by audio millis. */
export const LESSON_SCORING_INPUT_BYTES_PER_EFFECT=4096+LESSON_SCORING_TEXT_BYTES_PER_EFFECT;
/** Cost model price per scored utterance, in micro-USD, rounded up. */
export const LESSON_SCORING_MICRO_USD_PER_EFFECT=Math.ceil(DEFAULT_COST_MODEL.assessmentPerUtterance*1e6);
/** Matches what describePaidHttp produces for scoreWithSpeechace (no dialect, so fr-fr). */
export const LESSON_SCORING_CONFIGURATION_SHA256=paidConfigurationSha256({kind:'scoring',provider:'speechace',model:'text-v9',voice:'',configuration:{path:'/api/scoring/text/v9/json',dialect:'fr-fr'}});
export const LESSON_SCORING_COMPONENT:PaidComponent=Object.freeze({key:'scoring',kind:'scoring',provider:'speechace',model:'text-v9',voice:'',configurationSha256:LESSON_SCORING_CONFIGURATION_SHA256,
 maxEffects:LESSON_SCORING_EFFECTS,maxProviderAttempts:1,maxInputBytes:LESSON_SCORING_EFFECTS*LESSON_SCORING_INPUT_BYTES_PER_EFFECT,maxOutputTokens:0,maxAudioMillis:LESSON_SCORING_AUDIO_MILLIS,
 maxTextBytes:LESSON_SCORING_EFFECTS*LESSON_SCORING_TEXT_BYTES_PER_EFFECT,microUsd:LESSON_SCORING_EFFECTS*LESSON_SCORING_MICRO_USD_PER_EFFECT});
