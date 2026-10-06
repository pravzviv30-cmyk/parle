/**
 * A celebration's confetti: the `Burst` primitive while it plays, and its final
 * frame after.
 *
 * On a device the burst falls and is gone, which is its final frame. Under
 * reduced motion the burst draws nothing, so the still drawing stands in for
 * it; on the web the still drawing follows the burst once it has fallen,
 * because a page that keeps no trace of the moment reads as a page that did
 * not change (motion-sound review finding 1). Decorative and untouchable either
 * way, and seeded from the moment's own key, so one moment always throws the
 * same confetti.
 */

import { useState } from 'react';
import { Platform } from 'react-native';

import { Burst } from '../motion/Burst.tsx';
import type { ConfettiColour } from '../motion/particles.ts';
import { ConfettiStill } from './ConfettiStill.tsx';

export function Confetti({
  seed,
  started,
  final,
  reduced,
  width,
  height,
  count,
  palette,
  ground,
  spread,
}: {
  /** The moment's key. */
  seed: string;
  /** True once the burst's beat is reached. */
  started: boolean;
  /** The card shows its final frame. */
  final: boolean;
  /** Movement is reduced. */
  reduced: boolean;
  /** The stage the confetti falls on, in points; it leaves from the middle. */
  width: number;
  height: number;
  count?: number;
  palette?: readonly ConfettiColour[];
  ground?: ConfettiColour;
  spread?: number;
}) {
  const web = Platform.OS === 'web';
  const [fallen, setFallen] = useState(false);
  if (final || fallen) return reduced || web ? <ConfettiStill /> : null;
  if (!started) return null;
  return (
    <Burst
      seed={seed}
      origin={{ x: width / 2, y: height / 2 }}
      count={count}
      palette={palette}
      ground={ground}
      spread={spread}
      onDone={() => setFallen(true)}
    />
  );
}
