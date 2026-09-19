import { createHash } from 'node:crypto';

export const CAP = 25000;
export const MODEL = 'eleven_flash_v2_5';
export const GAIN_DB = -4;
export const MULTIPLIERS = { alexandre: 1, emilie: 2, guillaume: 1, marie: 1, anatole: 1, sarah: 2 };
export const hash = value => createHash('sha256').update(value).digest('hex');
// Vendor rounds the base Flash charge BEFORE applying the voice multiplier.
export const estimateCredits = (text, voice) => Math.ceil(text.length * 0.25) * MULTIPLIERS[voice];
/** Stable tier-balanced prefix. Future batches exclude frozen IDs, never offsets. */
export function selectBatch(items, count = 200, excluded = []) {
  const skip = new Set(excluded);
  const pools = [1, 2, 3].map(tier => items.filter(item => item.tier === tier && !skip.has(item.id)));
  const selected = [];
  for (let index = 0; selected.length < count; index++) {
    let added = false;
    for (const pool of pools) {
      if (pool[index] && selected.length < count) { selected.push(pool[index]); added = true; }
    }
    if (!added) throw new Error('Not enough new catalogue entries.');
  }
  if (new Set(selected.map(item => item.id)).size !== count) throw new Error('Duplicate catalogue ID.');
  return selected;
}
export function reserveRequest(accounted, reserve, cap = CAP) {
  if (![accounted, reserve, cap].every(Number.isFinite) || accounted < 0 || reserve <= 0 || accounted + reserve > cap) throw new Error('Credit guard reached; no request sent.');
  return accounted + reserve;
}
