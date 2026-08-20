/**
 * The ink illustrations, which now live in `illustrations/`.
 *
 * One file could hold eight still scenes. It could not hold fourteen scenes,
 * their moving layers, the hook that drives them and the arithmetic that keeps
 * a moving piece at the same stroke weight as the scene under it. So the pen
 * and its house rules moved to `illustrations/pen.tsx`, the motion vocabulary
 * to `illustrations/useSceneMotion.ts`, and one scene per file under
 * `illustrations/scenes/`.
 *
 * This file stays as the door. Thirteen screens import from it, several of
 * them being edited by somebody else right now, and a barrel costs one line
 * where rewriting those imports would cost a merge.
 */

export * from './illustrations/index.ts';
