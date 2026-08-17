/**
 * Form checks shared by the auth screens. Deliberately gentle: the server has
 * the final word, these only catch what would certainly bounce.
 */

export const PASSWORD_MIN = 8;

export function looksLikeEmail(value: string): boolean {
  const v = value.trim();
  return v.includes('@') && v.indexOf('@') > 0 && v.indexOf('@') < v.length - 3 && !v.includes(' ');
}

export function passwordTooShort(value: string): boolean {
  return value.length < PASSWORD_MIN;
}
