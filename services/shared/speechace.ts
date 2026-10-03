/**
 * Pronunciation assessment: the Speechace adapter.
 *
 * Speechace natively supports French (FR and CA) with phoneme, syllable and
 * lexical-stress scoring. Since 2026-09-29 it is the alternative rather than
 * the default: TonePerfect scores unless `LUVANI_SCORING_VENDOR=speechace` says
 * otherwise, and pronunciation.ts is where that choice is made. Azure's
 * Pronunciation Assessment is the cost fallback nobody has built, and note the
 * asymmetry before adding it: Azure returns fr-FR phoneme *scores* without
 * phoneme *names* (names and syllable grouping are en-US only), so an Azure
 * adapter needs our own alignment layer mapping scores back onto the reference
 * text's expected phonemes.
 *
 * Everything here sits behind the one narrow interface in pronunciation.ts for
 * exactly that reason: the differentiator should not be welded to a single vendor.
 */

import type { PhonemeObservation } from '@luvani/core';
import { toInventoryIpa } from './phoneMap.ts';
import type { ScoreDeps, ScoreFetch, ScoreRequest } from './pronunciation.ts';

const ENDPOINT = 'https://api.speechace.co/api/scoring/text/v9/json';

/**
 * Score one utterance with Speechace, or return nothing.
 *
 * Called through `scoreUtterance` in pronunciation.ts, which owns the vendor
 * choice and the deadline; this only has to honour the signal it is handed.
 * Returning `[]` rather than throwing is the same promise the router makes: an
 * outage is text-only grading, never an invented penalty.
 */
export async function scoreWithSpeechace(req: ScoreRequest, deps: ScoreDeps = {}): Promise<PhonemeObservation[]> {
  const key = (deps.env ?? process.env).SPEECHACE_API_KEY?.trim();
  if (!key || !req.audio || req.audio.length === 0) return [];
  const fetchFn = deps.fetchFn ?? (globalThis.fetch as unknown as ScoreFetch);

  try {
    const dialect = req.dialect ?? 'fr-fr';
    const form = new FormData();
    form.append('text', req.reference);
    form.append('user_audio_file', new Blob([req.audio as BlobPart]), 'utterance.wav');
    form.append('dialect', dialect);

    // The key rides in the query string, never in the multipart body — the body
    // is the part that gets logged when a vendor call is being debugged.
    const url = `${ENDPOINT}?key=${encodeURIComponent(key)}&dialect=${dialect}`;
    const res = await fetchFn(url, { method: 'POST', body: form, ...(deps.signal ? { signal: deps.signal } : {}) });
    if (!res.ok) {
      console.warn(`[speechace] ${res.status} — falling back to text-only grading`);
      return [];
    }
    return parseSpeechace(await res.json());
  } catch (err) {
    // A fired deadline is the router's to report, and it already has.
    if (deps.signal?.aborted) return [];
    console.warn('[speechace] request failed — falling back to text-only grading', err);
    return [];
  }
}

/** Speechace's nested word→phone shape, flattened into our observations. */
export function parseSpeechace(payload: unknown): PhonemeObservation[] {
  const words = (payload as { text_score?: { word_score_list?: unknown[] } })?.text_score?.word_score_list;
  if (!Array.isArray(words)) return [];

  const out: PhonemeObservation[] = [];
  const unknown = new Set<string>();
  for (const w of words) {
    const word = (w as { word?: string }).word;
    const phones = (w as { phone_score_list?: unknown[] }).phone_score_list;
    if (!word || !Array.isArray(phones)) continue;

    for (const p of phones) {
      const phone = p as { phone?: string; quality_score?: number; sound_most_like?: string };
      if (typeof phone.phone !== 'string' || typeof phone.quality_score !== 'number') continue;

      // Translated rather than trusted. Downstream this becomes an exact lookup
      // into the inventory, and a symbol that misses is skipped without a word —
      // so a vendor answering in X-SAMPA produces a session where every single
      // observation is silently dropped and there is never a focus point.
      const ipa = toInventoryIpa(phone.phone);
      if (ipa === null) {
        unknown.add(phone.phone);
        continue;
      }
      // `sound_most_like` is what the learner actually produced — the single most
      // useful field in the response, because it turns "your /y/ was 44%" into
      // "you said 'tout' when you meant 'tu'". Kept verbatim when it is not a
      // French phoneme: an English vowel is exactly the answer worth showing.
      const heard = phone.sound_most_like ? (toInventoryIpa(phone.sound_most_like) ?? phone.sound_most_like) : undefined;
      out.push({
        ipa,
        score: phone.quality_score,
        word,
        substituted: heard && heard !== ipa ? heard : undefined,
      });
    }
  }

  if (unknown.size > 0) {
    console.warn(
      `[speechace] ${unknown.size} phone symbol(s) are not in the French inventory, so nothing can be said about ` +
        `them: ${[...unknown].join(' ')}. If the whole response is listed here, the vendor has changed alphabet.`,
    );
  }
  return out;
}
