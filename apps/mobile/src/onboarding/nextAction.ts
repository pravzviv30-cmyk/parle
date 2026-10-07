/** A disabled Continue can explain the missing choice, but cannot advance. */
export function nextAction(disabled: boolean, advance: () => boolean, explain?: () => void): boolean {
  if (disabled) { explain?.(); return false; }
  return advance();
}
