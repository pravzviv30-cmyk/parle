/**
 * The conversation as a thread.
 *
 * Chat conventions, translated into this world rather than imported from it:
 * no timestamps, no avatars, no tails, no read receipts. What a learner needs
 * is which of us said it and what it meant, so a bubble carries the French in
 * the serif with its gloss underneath, and nothing else.
 *
 * Three kinds, not two. The narrator sets the scene and is not a character in
 * it, so narration gets no side and no bubble — giving it one would make the
 * scene-setting sound like a third speaker.
 *
 * A recast renders under the learner line it corrects. A correction that
 * floats free at the bottom of a screen is one the learner has to match back up
 * themselves, which is most of the reason recasts fail to land.
 */

import { useEffect, useRef } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Animated } from 'react-native';
import { paper, signal, space, type, radius, HAIRLINE } from '../theme.ts';
import type { TurnLine } from '../live/turns.ts';
import { settleIn, useReduceMotion } from '../motion.ts';

function Recast({ quote, better, betterEn, why }: { quote: string; better: string; betterEn: string; why: string }) {
  return (
    <View style={st.recast}>
      <Text style={[type.small, { color: paper.inkFaint, textDecorationLine: 'line-through' }]}>{quote}</Text>
      <Text style={[type.french, { color: paper.ink, marginTop: space(0.5) }]}>{better}</Text>
      <Text style={[type.small, { color: paper.inkSoft }]}>{betterEn}</Text>
      <Text style={[type.small, { color: paper.inkFaint, marginTop: space(1) }]}>{why}</Text>
    </View>
  );
}

function Line({ turn, onReplay }: { turn: TurnLine; onReplay?: () => void }) {
  if (turn.who === 'narration') {
    return (
      <View style={st.narration}>
        <Text style={[type.small, { color: paper.inkSoft, textAlign: 'center' }]}>{turn.en ?? turn.fr}</Text>
      </View>
    );
  }

  const learner = turn.who === 'learner';
  const body = (
    <>
      <Text style={[type.french, { color: paper.ink }]}>{turn.fr}</Text>
      {turn.frWritten && turn.frWritten !== turn.fr ? (
        <Text style={[type.small, { color: paper.inkFaint, marginTop: space(0.5) }]}>{turn.frWritten}</Text>
      ) : null}
      {turn.en ? <Text style={[type.small, { color: paper.inkSoft, marginTop: space(0.5) }]}>{turn.en}</Text> : null}
    </>
  );

  return (
    <View style={learner ? st.rowRight : st.rowLeft}>
      <View style={{ maxWidth: '82%' }}>
        {/* Replay lives on the bubble rather than on a button in the control
            row, which is how "say that again" is served without a fifth chip
            competing for the space the learner reaches with one thumb. Only
            the tutor's own lines: replaying the learner's would be the app
            reading somebody's French back at them. */}
        {onReplay ? (
          <Pressable
            onPress={onReplay}
            accessibilityRole="button"
            accessibilityLabel={`Hear that line again: ${turn.fr}`}
            style={({ pressed }) => [st.tutorBubble, pressed && { opacity: 0.7 }]}
          >
            {body}
          </Pressable>
        ) : (
          <View style={learner ? st.learnerBubble : st.tutorBubble}>{body}</View>
        )}
        {turn.recasts?.map((r) => (
          <Recast key={r.better} {...r} />
        ))}
      </View>
    </View>
  );
}

export function Transcript({
  turns,
  onReplayTutor,
}: {
  turns: readonly TurnLine[];
  /**
   * Play the tutor's last line again. Given only when there is a voice to
   * replay and the learner holds the floor, and attached only to the LAST
   * tutor line, because that is the one `hear` asks the agent for: a bubble
   * five turns up that spoke a different sentence would be a control that
   * lied about what it does.
   */
  onReplayTutor?: () => void;
}) {
  const ref = useRef<ScrollView>(null);
  // One settling entrance, in the vocabulary the splash established and the
  // only one this app has: transform and opacity, native driver, nothing
  // bounces. It lives here rather than at the call site so both places the
  // thread appears get it, and neither has to remember the numbers.
  const settle = useRef(new Animated.Value(0)).current;

  // The final frame when movement is withheld. The conversation is the content;
  // the arrival is the flourish, and nobody should sit through a flourish to
  // read. settleIn owns both halves of that, for every surface.
  const reduced = useReduceMotion();
  // Which bubble carries the replay. Found by walking back rather than by
  // index, because the last line in the thread is usually the learner's.
  const lastTutorId = [...turns].reverse().find((t) => t.who === 'tutor')?.id;
  useEffect(() => {
    const animation = settleIn(settle, reduced);
    return () => animation?.stop();
  }, [settle, reduced]);

  return (
    <Animated.View
      style={[
        st.settleBox,
        {
          opacity: settle,
          transform: [{ translateY: settle.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
        },
      ]}
    >
      <ScrollView
        ref={ref}
        style={st.scroll}
        contentContainerStyle={st.content}
        showsVerticalScrollIndicator={false}
        // A plain ScrollView rather than a FlatList: the list is capped at forty
        // and windowing would fight the stick-to-bottom below.
        onContentSizeChange={() => ref.current?.scrollToEnd({ animated: true })}
        // A learner may be typing into the box below this one while it scrolls.
        keyboardShouldPersistTaps="handled"
        accessibilityLabel="Your conversation so far"
      >
        {turns.map((t) => (
          <Line key={t.id} turn={t} onReplay={onReplayTutor && t.id === lastTutorId ? onReplayTutor : undefined} />
        ))}
      </ScrollView>
    </Animated.View>
  );
}

const st = StyleSheet.create({
  // The entrance wrapper carries the same flex the scroll used to, so adding it
  // moves nothing: minHeight 0 is what stops a flex child from refusing to
  // shrink and pushing the controls off the bottom of the screen.
  settleBox: { flex: 1, minHeight: 0 },
  scroll: { flex: 1, minHeight: 0 },
  // Short conversations sit against the controls instead of stranded at the top.
  content: { flexGrow: 1, justifyContent: 'flex-end', gap: space(3), paddingVertical: space(3) },
  rowLeft: { alignItems: 'flex-start' },
  rowRight: { alignItems: 'flex-end' },
  tutorBubble: {
    backgroundColor: paper.card,
    borderWidth: HAIRLINE,
    borderColor: paper.lineOnCard,
    borderRadius: radius.card,
    borderBottomLeftRadius: 4,
    paddingHorizontal: space(3.5),
    paddingVertical: space(2.5),
  },
  learnerBubble: {
    backgroundColor: paper.groundDeep,
    borderRadius: radius.card,
    borderBottomRightRadius: 4,
    paddingHorizontal: space(3.5),
    paddingVertical: space(2.5),
  },
  narration: { paddingHorizontal: space(4), paddingVertical: space(1) },
  recast: {
    marginTop: space(1.5),
    paddingLeft: space(3),
    borderLeftWidth: 2,
    borderLeftColor: signal.correspondance,
  },
});
