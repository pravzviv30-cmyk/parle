/**
 * Say it aloud's pinned foot, measured so it fits under the screen's foot cap
 * (`screenGeometry().footerMaxHeight`) on a small phone with the quiet control
 * in sight. Cloud listens, and the muted mic picture sits, in the answer area, not here.
 */

/**
 * The 108 mic, 8 gap and 20 label, or without a mic the 54 Type instead and 44 I said it;
 * then the 12 gap, the 44 quiet control, and the frame's 16 over the bottom inset.
 */
export function sayFootHeight(mic: 'armed' | 'silent', bottomInset: number): number {
  const top = mic === 'silent' ? 54 + 44 : 108 + 8 + 20;
  return top + 12 + 44 + 16 + bottomInset;
}
