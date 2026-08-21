/**
 * First launch. Two pages now: the welcome, then the why.
 *
 * Page one says hello and moves; page two says what Parle is and why speaking
 * out loud is the whole point, in three sentences, because a wall of text at
 * the door is how apps get deleted. The same paging idiom as TutorIntro and
 * onboarding: ProgressDots, a back chevron, one pill per page.
 *
 * The motion rules this screen established, because the app had none and the
 * next animated screen must not invent a second language:
 *   - transform and opacity only, always `useNativeDriver: true`
 *   - never animate an SVG attribute (r, d, cx): those cannot cross to the
 *     native driver and drop the whole animation onto the JS thread
 *   - one continuous loop, plus one settling entrance; nothing bounces
 *   - reduce-motion is honoured by rendering the final frame, not by rendering
 *     nothing — the scene is the welcome, the movement is the flourish
 */

import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Animated, Easing, StyleSheet, AccessibilityInfo } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Ellipse, G } from 'react-native-svg';
import { HIT, STROKE, decorative, paper, space, type } from '../theme.ts';
import { PillButton, ChevronLeft, ProgressDots } from '../components.tsx';
import { LearnStack } from '../illustrations.tsx';
import { settleIn, useReduceMotion } from '../motion.ts';

/** The still art is a 200x150 viewBox drawn at 1.3x. */
const SCENE_W = 260;
const SCENE_H = 195;

/**
 * The café table again, but taken apart so the pieces can move independently:
 * the table holds still, the steam drifts off the cup, and two bubbles arrive
 * as if someone just started talking. Same pen and same rules as
 * illustrations.tsx.
 *
 * Geometry note, because it is easy to get wrong twice: the still art is drawn
 * in a 200x150 viewBox rendered at 260x195, so every absolutely-positioned
 * moving piece has to be placed in CONTAINER pixels — viewBox units times 1.3 —
 * not in the coordinates the paths are written in.
 */
function Scene({ steam, bubbleA, bubbleB }: { steam: Animated.Value; bubbleA: Animated.Value; bubbleB: Animated.Value }) {
  return (
    <View style={st.scene}>
      <Svg width={SCENE_W} height={SCENE_H} viewBox="0 0 200 150" {...decorative}>
        <G fill="none" stroke={paper.ink} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
          {/* the table, tilted a degree or two and holding still */}
          <Ellipse cx={86} cy={104} rx={60} ry={13} transform="rotate(-2 86 104)" />
          <Path d="M84 117v24" />
          <Path d="M68 147c7-6 26-6 33 0" />
          {/* the cup, saucer, handle */}
          <Ellipse cx={70} cy={92} rx={17} ry={4.5} />
          <Path d="M57 92c0 9 3.2 14 13 14s13-5 13-14" />
          <Path d="M83 94c6.4-1.2 9.6 2 7.5 6.4-1.7 3.4-6.4 3.2-8.5 1" />
          {/* a croissant on the far side of the table, for balance */}
          <Ellipse cx={122} cy={101} rx={15} ry={4} transform="rotate(2 122 101)" />
          <Path d="M111 97c1.8-6.4 8.2-9 12.8-7.2 4.6 1.8 7.2 6.4 6.4 11" transform="rotate(-6 120 95)" />
          {/* stipple, the house shading */}
          <Circle cx={104} cy={116} r={1.1} fill={paper.ink} stroke="none" />
          <Circle cx={111} cy={121} r={1.1} fill={paper.ink} stroke="none" />
          <Circle cx={97} cy={122} r={1.1} fill={paper.ink} stroke="none" />
        </G>
      </Svg>

      {/* Steam, rising straight off the cup. Only transform and opacity move. */}
      <Animated.View
        style={[
          st.steam,
          {
            opacity: steam.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.2, 1, 0.2] }),
            transform: [{ translateY: steam.interpolate({ inputRange: [0, 1], outputRange: [5, -11] }) }],
          },
        ]}
      >
        <Svg width={44} height={44} viewBox="0 0 44 44" {...decorative}>
          <G fill="none" stroke={paper.ink} strokeWidth={STROKE} strokeLinecap="round">
            <Path d="M15 38c-3.4-7 3.4-10.5 0-17.5" />
            <Path d="M29 38c3.4-7-3.4-10.5 0-17.5" />
          </G>
        </Svg>
      </Animated.View>

      {/* Two bubbles over the table, arriving one after the other. */}
      <Animated.View style={[st.bubbleA, bubbleStyle(bubbleA)]}>
        <Svg width={62} height={50} viewBox="0 0 62 50" {...decorative}>
          <G fill="none" stroke={paper.ink} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M9 5h44a6 6 0 0 1 6 6v16a6 6 0 0 1-6 6H24l-9 8v-8H9a6 6 0 0 1-6-6V11a6 6 0 0 1 6-6Z" />
            <Circle cx={22} cy={19} r={1.9} fill={paper.ink} stroke="none" />
            <Circle cx={31} cy={19} r={1.9} fill={paper.ink} stroke="none" />
            <Circle cx={40} cy={19} r={1.9} fill={paper.ink} stroke="none" />
          </G>
        </Svg>
      </Animated.View>
      <Animated.View style={[st.bubbleB, bubbleStyle(bubbleB)]}>
        <Svg width={54} height={46} viewBox="0 0 54 46" {...decorative}>
          <G fill="none" stroke={paper.ink} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M45 5H9a6 6 0 0 0-6 6v14a6 6 0 0 0 6 6h22l9 7v-7h5a6 6 0 0 0 6-6V11a6 6 0 0 0-6-6Z" />
            {/* the solid accent, and the only one in the scene */}
            <Path
              d="M27 27c-6-4.6-9.4-7-9.4-10.6a4.7 4.7 0 0 1 9.4-1.9 4.7 4.7 0 0 1 9.4 1.9C36.4 20 33 22.4 27 27Z"
              fill={paper.ink}
              stroke="none"
            />
          </G>
        </Svg>
      </Animated.View>
    </View>
  );
}

function bubbleStyle(v: Animated.Value) {
  return {
    opacity: v,
    transform: [
      { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
      { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) },
    ],
  };
}

export function SplashScreen({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState(0);
  const steam = useRef(new Animated.Value(0)).current;
  const bubbleA = useRef(new Animated.Value(0)).current;
  const bubbleB = useRef(new Animated.Value(0)).current;
  const settle = useRef(new Animated.Value(0)).current;
  const reduced = useReduceMotion();

  useEffect(() => {
    let cancelled = false;
    let loop: Animated.CompositeAnimation | null = null;

    const run = () => {
      if (cancelled) return;
      if (reduced) {
        // The final frame, immediately. The scene is the welcome; the drift is
        // only the flourish, and nobody should have to sit through it.
        steam.setValue(0.5);
        bubbleA.setValue(1);
        bubbleB.setValue(1);
        settle.setValue(1);
        return;
      }
      // Each page gets one settling entrance; only page one keeps a loop.
      settle.setValue(0);
      settleIn(settle, false);
      if (page !== 0) return;
      Animated.stagger(180, [
        Animated.timing(bubbleA, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(bubbleB, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(steam, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(steam, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
      );
      loop.start();
    };

    run();

    return () => {
      cancelled = true;
      // Never leave a loop running past the page that started it.
      loop?.stop();
    };
  }, [page, reduced, steam, bubbleA, bubbleB, settle]);

  const settled = {
    opacity: settle,
    transform: [{ translateY: settle.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
  };

  return (
    <View style={[st.root, { paddingTop: insets.top + space(3), paddingBottom: insets.bottom + space(6) }]}>
      <View style={st.topRow}>
        {page > 0 ? (
          <Pressable onPress={() => setPage(0)} accessibilityRole="button" accessibilityLabel="Back" style={st.back}>
            <ChevronLeft />
          </Pressable>
        ) : (
          <View style={st.back} />
        )}
        <ProgressDots total={2} index={page} />
        <View style={st.back} />
      </View>

      {page === 0 ? (
        <>
          <Animated.View style={[st.body, settled]}>
            <Scene steam={steam} bubbleA={bubbleA} bubbleB={bubbleB} />
            <Text style={st.headline} accessibilityRole="header">
              Welcome to Parle!
            </Text>
            <Text style={st.subline}>Let's get you talking.</Text>
          </Animated.View>
          <PillButton label="Let's go" onPress={() => setPage(1)} />
        </>
      ) : (
        <>
          <Animated.View style={[st.body, settled]}>
            <LearnStack width={200} />
            <Text style={st.headline} accessibilityRole="header">
              Say it and it sticks
            </Text>
            <Text style={st.subline}>
              Parle gets you speaking French out loud from day one, with a tutor that listens and
              answers. Words you say aloud stay with you far longer than words you only read. A few
              minutes a day is plenty.
            </Text>
          </Animated.View>
          <PillButton label="Get started" onPress={onDone} />
        </>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: paper.ground, paddingHorizontal: space(6), justifyContent: 'space-between' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: HIT, height: HIT, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scene: { width: SCENE_W, height: SCENE_H, alignItems: 'center', justifyContent: 'center' },
  // cup centre sits at viewBox x=70 -> 91px; the steam box is 44 wide, so
  // left = 91 - 22. Its foot sits just above the cup rim (y=88 -> 114px).
  steam: { position: 'absolute', left: 69, top: 66 },
  bubbleA: { position: 'absolute', left: 150, top: 8 },
  bubbleB: { position: 'absolute', left: 112, top: 62 },
  headline: { ...type.display, color: paper.ink, textAlign: 'center', marginTop: space(7) },
  subline: { ...type.body, color: paper.inkSoft, textAlign: 'center', marginTop: space(3) },
});
