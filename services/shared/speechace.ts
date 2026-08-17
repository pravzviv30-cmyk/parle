/**
 * Pronunciation assessment.
 *
 * Speechace is the primary because it natively supports French (FR and CA) with
 * phoneme, syllable and lexical-stress scoring. Azure's Pronunciation Assessment
 * is the cost fallback, but note the asymmetry before swapping: Azure returns
 * fr-FR phoneme *scores* without phoneme *names* (names and syllable grouping are
 * en-US only), so an Azure path needs our own alignment layer mapping scores back
 * onto the reference text's expected phonemes.
 *
 * Everything here is behind one narrow interface for exactly that reason — the
 * differentiator should not be welded to a single vendor.
 */

import type { PhonemeObservation } from '@parle/core';

export interface ScoreRequest {
  /** The text the learner was supposed to say. Accuracy scoring is meaningless without it. */
  reference: string;
  /** Raw audio for the utterance. Absent until the audio tap is wired. */
  audio?: Uint8Array;
  /** 'fr-fr' or 'fr-ca'. */
  dialect?: 'fr-fr' | 'fr-ca';
}

const ENDPOINT = 'https://api.speechace.co/api/scoring/text/v9/json';

/**
 * Score one utterance, or return nothing.
 *
 * Returning `[]` rather than throwing is deliberate. `grade()` in the session
 * engine treats an absent score as "do not invent a penalty", so a scorer outage
 * degrades the session to text-only grading instead of ending it. A learner
 * mid-conversation should never be interrupted because a third-party API is down.
 */
export async function scoreUtterance(req: ScoreRequest): Promise<PhonemeObservation[]> {
  const key = process.env.SPEECHACE_API_KEY;
  if (!key || !req.audio) return [];

  try {
    const form = new FormData();
    form.append('text', req.reference);
    form.append('user_audio_file', new Blob([req.audio as BlobPart]), 'utterance.wav');
    form.append('dialect', req.dialect ?? 'fr-fr');

    const url = `${ENDPOINT}?key=${encodeURIComponent(key)}&dialect=${req.dialect ?? 'fr-fr'}`;
    const res = await fetch(url, { method: 'POST', body: form });
    if (!res.ok) {
      console.warn(`[speechace] ${res.status} — falling back to text-only grading`);
      return [];
    }
    return parseSpeechace(await res.json());
  } catch (err) {
    console.warn('[speechace] request failed — falling back to text-only grading', err);
    return [];
  }
}

/** Speechace's nested word→phone shape, flattened into our observations. */
export function parseSpeechace(payload: unknown): PhonemeObservation[] {
  const words = (payload as { text_score?: { word_score_list?: unknown[] } })?.text_score?.word_score_list;
  if (!Array.isArray(words)) return [];

  const out: PhonemeObservation[] = [];
  for (const w of words) {
    const word = (w as { word?: string }).word;
    const phones = (w as { phone_score_list?: unknown[] }).phone_score_list;
    if (!word || !Array.isArray(phones)) continue;

    for (const p of phones) {
      const phone = p as { phone?: string; quality_score?: number; sound_most_like?: string };
      if (typeof phone.phone !== 'string' || typeof phone.quality_score !== 'number') continue;
      out.push({
        ipa: phone.phone,
        score: phone.quality_score,
        word,
        // `sound_most_like` is what the learner actually produced — the single most
        // useful field in the response, because it turns "your /y/ was 44%" into
        // "you said 'tout' when you meant 'tu'".
        substituted: phone.sound_most_like && phone.sound_most_like !== phone.phone ? phone.sound_most_like : undefined,
      });
    }
  }
  return out;
}
