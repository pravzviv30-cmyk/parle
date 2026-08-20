/**
 * The pen. One weight, one set of house rules, and the helper that keeps a
 * moving piece the same scale as the scene under it.
 *
 * House rules, unchanged from the original illustrations file, so every scene
 * old and new coheres:
 *   - stroke `paper.ink` at STROKE (2.2), round caps and joins, never scaled
 *   - `fill="none"` everywhere except tiny solid accents (a beret, a flame, a
 *     heart) at most a tenth of any scene
 *   - shading is stipple: clusters of r~1 filled dots, never hatching
 *   - proportions are quirky on purpose: tilted verticals, one oversized small
 *     object per scene, nothing perfectly level
 *   - viewBox 0 0 200 150; scenes scale by width and stay 4:3
 *   - no gradients, and one colour unless a paper's accent is asked for
 *
 * `Moving` is the new part, and the reason the module exists. A piece that has
 * to animate cannot live inside the still `<Svg>`, because animating an SVG
 * attribute drops the whole thing onto the JS thread. So it becomes its own
 * layer. The trap is that the layer then has its own coordinate system and its
 * own stroke scale, which is how the splash ended up with steam 23% thinner
 * than the cup it rises from. `Moving` keeps the piece in SCENE coordinates
 * and sizes its box from the same unit, so a path drawn at x=70 lands over the
 * cup at x=70 and draws at the cup's weight.
 */

import { Animated } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { paper, STROKE, decorative } from '../theme.ts';
import { frameHeight, place, type Box } from './timing.ts';

/** Every scene takes exactly these. Nothing else, so they stay interchangeable. */
export interface SceneProps {
  width?: number;
  /**
   * Withhold movement without unmounting. The SCREEN owns this, because
   * `useIsFocused` throws outside a NavigationContainer and the splash, the
   * welcome screen and all four onboarding pages mount above the navigator.
   */
  paused?: boolean;
}

/** The still layer. Everything that does not move belongs in here. */
export function Frame({ width = 200, children }: { width?: number; children: React.ReactNode }) {
  return (
    <Svg width={width} height={frameHeight(width)} viewBox="0 0 200 150" {...decorative}>
      <G fill="none" stroke={paper.ink} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
        {children}
      </G>
    </Svg>
  );
}

/** The house shading. Clusters of dots, never hatching. */
export function Stipple({ points }: { points: readonly (readonly [number, number])[] }) {
  return (
    <>
      {points.map(([x, y], i) => (
        <Circle key={i} cx={x} cy={y} r={1.1} fill={paper.ink} stroke="none" />
      ))}
    </>
  );
}

/**
 * One moving piece, layered over the still frame.
 *
 * `box` is where the piece sits in the scene's own 200x150 coordinates, and
 * its children are drawn in those same coordinates: a path over the cup is
 * written at x=70 whatever width the scene is rendered at. `style` is where
 * the transform and opacity go, and they are the only two things that may.
 */
export function Moving({
  box,
  width = 200,
  style,
  children,
}: {
  box: Box;
  width?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const at = place(box, width);
  const minX = box.x - box.w / 2;
  const minY = box.y - box.h / 2;
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          // In style rather than as a prop: the prop form is deprecated and
          // logs a warning on every scene the app renders.
          pointerEvents: 'none',
          left: at.left,
          top: at.top,
          width: at.width,
          height: at.height,
        },
        style,
      ]}
    >
      <Svg
        width={at.width}
        height={at.height}
        viewBox={`${minX} ${minY} ${box.w} ${box.h}`}
        {...decorative}
      >
        <G fill="none" stroke={paper.ink} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
          {children}
        </G>
      </Svg>
    </Animated.View>
  );
}

/**
 * The wrapper a scene returns: the frame's box, so absolutely positioned
 * pieces have something to be absolute against, plus the settling entrance.
 */
export function Scene({
  width = 200,
  style,
  children,
}: {
  width?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  return (
    <Animated.View style={[{ width, height: frameHeight(width) }, style]} {...decorative}>
      {children}
    </Animated.View>
  );
}
