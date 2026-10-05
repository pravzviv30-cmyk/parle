/**
 * Keeps Reanimated's own reduce-motion flag in step with the live OS setting.
 *
 * Reanimated samples the system setting once, when its module loads, and never
 * looks again. `useReduceMotion()` in motion.ts subscribes to the change event,
 * so this one component, mounted once at the root of App.tsx, tells the engine
 * the live answer every time it changes. Unknown counts as reduced, so a cold
 * start is conservative until the OS has answered.
 *
 * This is the belt. The braces are `motion/drive.ts`, where every animation is
 * started with the same live answer passed explicitly, and the primitives,
 * which land on their final frame themselves when movement is withheld.
 *
 * In development Reanimated logs one warning when this mounts ("Reduced motion
 * setting is overwritten with mode ..."). That warning is expected and is the
 * bridge doing its job. Do not remove the bridge to quiet it.
 */

import { ReduceMotion, ReducedMotionConfig } from 'react-native-reanimated';
import { useReduceMotion } from '../motion.ts';

export function ReduceMotionBridge() {
  const reduced = useReduceMotion();
  return <ReducedMotionConfig mode={reduced ? ReduceMotion.Always : ReduceMotion.Never} />;
}
