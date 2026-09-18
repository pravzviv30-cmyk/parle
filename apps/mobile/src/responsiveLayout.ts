/** Shared phone/tablet geometry; window width also follows iPad split view. */
export function screenInsets(width: number, left: number, right: number, padded = true) {
  const gutter = padded ? 20 : 0;
  const spare = Math.max(0, (width - left - right - 800) / 2);
  return { paddingLeft: left + spare + gutter, paddingRight: right + spare + gutter };
}

export function navigationWidth(width: number, left: number, right: number) {
  return Math.max(0, Math.min(640, width - left - right - 16));
}
