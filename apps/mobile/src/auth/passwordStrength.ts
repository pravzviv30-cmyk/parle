import { PASSWORD_MIN } from './validate.ts';

/** This is guidance, not an additional password acceptance rule. */
export function passwordStrength(value: string) {
  const met = value.length >= PASSWORD_MIN;
  const mixed = /\p{L}/u.test(value) && /\d/.test(value) && /[^\p{L}\p{N}\s]/u.test(value);
  const repetitive = new Set(value.toLowerCase()).size < 4;
  const common = /^(?:password|qwerty|123456|letmein|welcome)/i.test(value);
  const longPhrase = value.length >= 16 && new Set(value.toLowerCase()).size >= 6;
  const level = !met || repetitive || common ? 'low' : mixed || longPhrase ? 'good' : 'medium';
  return {
    met,
    level,
    // Twelve fills the visual meter; longer passwords are welcome and never truncated.
    progress: Math.min(value.length / 12, 1),
    text: value.length === 0 ? `${PASSWORD_MIN} characters minimum` : level === 'good' ? 'Good mix' : 'Add symbols and numbers',
  } as const;
}
