/** Fit the normal form before decorative art; preserve readable type and touch targets. */
export function welcomeLayout(usableHeight: number, fontScale: number, compactPhone: boolean) {
  const compact = compactPhone || usableHeight < 740 || fontScale > 1.3;
  const orbSize = fontScale > 1.3 || usableHeight < 600 ? 0 : compact ? 64 : 104;
  return { compact, orbSize, center: usableHeight >= 900 };
}
