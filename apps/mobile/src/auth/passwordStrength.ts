import { PASSWORD_MIN } from './validate.ts';

/** This is guidance, not an additional password acceptance rule. */
export function passwordStrength(value: string) {
  const met = value.length >= PASSWORD_MIN;
  const mixed = /\p{L}/u.test(value) && /\d/.test(value) && /[^\p{L}\p{N}\s]/u.test(value);
  const repetitive = new Set(value.toLowerCase()).size < 4;
  const common = /^(?:password|qwerty|123456|letmein|welcome)/i.test(value);
  const longPhrase = value.length >= 16 && new Set(value.toLowerCase()).size >= 6;
  const level = !met || repetitive || common ? 'low' : mixed || longPhrase ? 'good' : 'medium';
  // A long repetitive/common value stays low, even after meeting the policy.
  // Within each band, length still changes the target rather than stepping
  // through fixed segments. No score changes password acceptance.
  const progress = value.length === 0 ? 0 : level === 'low'
    ? Math.min(value.length / PASSWORD_MIN, 1) * 0.32
    : level === 'medium'
      ? 0.4 + Math.min((value.length - PASSWORD_MIN) / 8, 1) * 0.28
      : 0.72 + Math.min((value.length - PASSWORD_MIN) / 12, 1) * 0.28;
  return {
    met,
    level,
    progress,
    text: value.length === 0 ? 'Not entered' : level === 'good' ? 'Strong' : level === 'medium' ? 'Fair' : 'Weak',
  } as const;
}
