/**
 * A run of siblings arriving one after another (come alive section 3).
 *
 * Each direct child is wrapped in an `Enter` and starts `step` after the one
 * before it, with the step shortened when there are many so the whole cascade
 * starts within `STAGGER_SPAN_MS`. Past `max` children the rest arrive with the
 * last one in the cascade rather than queueing behind it. It plays once, on
 * first mount: a child added later is simply there.
 *
 * Reduced motion comes from `useReduceMotion` through each `Enter`, which
 * lands every child on its final frame at once, and watches the setting live.
 * This file asks too, so a cascade the learner has asked to keep still never
 * computes one.
 */

import { Children, isValidElement, useEffect, useRef, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { useReduceMotion } from '../motion.ts';
import { Enter } from './layout.tsx';
import { DUR, ENTER_DISTANCE, STAGGER, STAGGER_SPAN_MS } from './tokens.ts';

/** The most children a cascade is built for (the spec's budget). More still render; they arrive together. */
export const STAGGER_CHILDREN_MAX = 12;

export function StaggerIn({
  step = STAGGER.base,
  from = 'down',
  distance = ENTER_DISTANCE,
  duration = DUR.base,
  delay = 0,
  max = 8,
  itemStyle,
  children,
}: {
  /** The gap between siblings. A `STAGGER` token. */
  step?: number;
  from?: 'down' | 'up' | 'none';
  distance?: number;
  duration?: number;
  /** Wait before the first child starts. */
  delay?: number;
  /** The most children that cascade; the rest arrive with the last of them. */
  max?: number;
  /** Style for each child's wrapper, for a row or grid parent. */
  itemStyle?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  const reduced = useReduceMotion();
  // The cascade belongs to the first mount. A child that arrives later is
  // shown at rest rather than starting a cascade of its own.
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
  }, []);
  const items = Children.toArray(children);
  const cascading = Math.max(1, Math.min(items.length, max, STAGGER_CHILDREN_MAX));
  const gap = Math.min(step, STAGGER_SPAN_MS / cascading);
  return (
    <>
      {items.map((child, i) => (
        <Enter
          key={isValidElement(child) && child.key !== null ? child.key : i}
          index={reduced ? 0 : Math.min(i, cascading - 1)}
          step={gap}
          from={from}
          distance={distance}
          duration={duration}
          delay={delay}
          play={!mounted.current}
          style={itemStyle}
        >
          {child}
        </Enter>
      ))}
    </>
  );
}
