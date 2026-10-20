/**
 * Whether a drill draws the moment it replays (2026-10-20 UI-008, B-Today's
 * fix card). A node that asks for it after the try (`afterTry`) sees it only
 * once the learner has answered, so the better line is never shown first.
 */
export function momentShown(input: { afterTry?: boolean; answering: boolean; answered: number }): boolean {
  return input.afterTry !== true || input.answering || input.answered > 0;
}
