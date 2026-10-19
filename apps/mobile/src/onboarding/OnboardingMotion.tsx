import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, View } from 'react-native';
import { colour, paper } from '../theme.ts';
import { useReduceMotion } from '../motion.ts';
import { C2Scene } from './motion/C2Scene.tsx';
import type { IllustrationName } from '../art/flat/index.ts';

export type ArtworkResponse =
  | 'welcome'
  | 'neutral'
  | 'choice'
  | 'next'
  | 'ready'
  | 'speaking'
  | 'attentive'
  | 'help'
  | 'success'
  | 'connection';
/** Existing brand illustrations, with one interruptible response to an action. */
export function OnboardingArtwork({
  name,
  response,
  event,
}: {
  name: IllustrationName;
  response: ArtworkResponse;
  event: number;
}) {
  const kind = name === 'state-headphones' ? 'confidence' : name === 'state-notebook' ? 'plan' : 'welcome';
  return <C2Scene kind={kind} width={180} eventKey={`${response}:${event}`}
    active={!['neutral', 'connection', 'attentive'].includes(response)} />;
}

export function PageArrival({
  page,
  direction,
  children,
  gap = 20,
}: {
  page: string;
  direction: number;
  children: React.ReactNode;
  gap?: number;
}) {
  const reduced = useReduceMotion();
  const arrival = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    arrival.stopAnimation();
    if (reduced) {
      arrival.setValue(1);
      return;
    }
    arrival.setValue(0);
    const motion = Animated.timing(arrival, {
      toValue: 1,
      duration: 270,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    });
    motion.start();
    return () => motion.stop();
  }, [page, reduced, arrival]);
  return (
    <Animated.View
      style={{
        gap,
        opacity: arrival,
        transform: [
          {
            translateX: arrival.interpolate({
              inputRange: [0, 1],
              outputRange: [direction * 16, 0],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}
/**
 * How many plan answers are in, as a bar. The track is the sand skeleton, not
 * the field grey that drew it as a heavy rule (come alive, first run section 4).
 */
export function SetupProgress({ completed, total = 4 }: { completed: number; total?: number }) {
  const reduced = useReduceMotion();
  const progress = useRef(new Animated.Value(completed / total)).current;
  useEffect(() => {
    progress.stopAnimation();
    const animation = Animated.timing(progress, {
      toValue: completed / total,
      duration: reduced ? 0 : 220,
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.start();
    return () => animation.stop();
  }, [completed, total, reduced, progress]);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="Plan setup"
      accessibilityValue={{
        min: 0,
        max: total,
        now: completed,
        text: `${completed} of ${total} plan answers chosen`,
      }}
      style={{
        height: 8,
        borderRadius: 4,
        backgroundColor: paper.skeleton,
        overflow: 'hidden',
        flex: 1,
      }}
    >
      <Animated.View
        style={{
          height: 8,
          backgroundColor: colour.blue,
          transformOrigin: 'left',
          transform: [{ scaleX: progress }],
        }}
      />
    </View>
  );
}
