/** Exact sounds supported by the original Revamp B drawing kit. */
const GUIDES = {
  y: 'mouth-y',
  u: 'mouth-u',
  'ʁ': 'mouth-r',
  'ɑ̃': 'mouth-nasal-an',
  'ɔ̃': 'mouth-nasal-on',
  'ʒ': 'mouth-zh',
} as const;

export function mouthGuide(ipa: string): (typeof GUIDES)[keyof typeof GUIDES] | null {
  const key = ipa.normalize('NFC');
  return Object.hasOwn(GUIDES, key) ? GUIDES[key as keyof typeof GUIDES] : null;
}
