/** A still cue that there is measured content below the visible scroll body. */
export function footerOverflow(contentHeight: number, viewportHeight: number, offset: number): boolean {
  return viewportHeight > 0 && contentHeight > viewportHeight + 1
    && contentHeight - viewportHeight - Math.max(0, offset) > 1;
}
