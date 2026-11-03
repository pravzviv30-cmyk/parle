/**
 * Say it aloud's pinned foot, measured so it fits under the screen's foot cap
 * (`screenGeometry().footerMaxHeight`) on a small phone with the quiet control
 * in sight. Cloud listens in the answer area, not here.
 */

/** The mic, the 8 gap, the 20 label, the 12 gap, the 44 quiet control, and the frame's 16 over the bottom inset. */
export function sayFootHeight(mic: number, bottomInset: number): number {
  return mic + 8 + 20 + 12 + 44 + 16 + bottomInset;
}
