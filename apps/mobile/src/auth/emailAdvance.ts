/** A stricter completeness signal for focus only; submission still defers to the server. */
export function emailReadyToAdvance(value: string): boolean {
  const trimmed = value.trim();
  if (/\s/.test(trimmed)) return false;
  const parts = trimmed.split('@');
  if (parts.length !== 2 || !parts[0]) return false;
  const domain = parts[1]!;
  const labels = domain.split('.');
  if (labels.length < 2 || labels.some((label) => !label || label.startsWith('-') || label.endsWith('-'))) return false;
  return /^[\p{L}\p{N}.-]+$/u.test(domain) && /^[\p{L}]{2,63}$/u.test(labels.at(-1)!);
}

/** Wait for a typing pause, rather than moving focus as the first suffix character arrives. */
export const EMAIL_ADVANCE_IDLE_MS = 1400;
