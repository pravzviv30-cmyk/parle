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
import { accent, paper, signal, space, type, radius, HAIRLINE } from '../theme.ts';
import { EarGlyph, Label } from '../components.tsx';
import type { TurnLine } from '../live/turns.ts';
import { settleIn, useReduceMotion } from '../motion.ts';
import { replayEar } from './replayEar.ts';

function Recast({ quote, better, betterEn, why }: { quote: string; better: string; betterEn: string; why: string }) {
  return (
    <View style={st.recast}>
      <Text style={[type.small, { color: paper.inkSoft, textDecorationLine: 'line-through' }]}>{quote}</Text>
      <Text style={[type.french, { color: paper.ink, marginTop: space(0.5) }]}>{better}</Text>
      <Text style={[type.small, { color: paper.inkSoft }]}>{betterEn}</Text>
      <Text style={[type.small, { color: paper.inkSoft, marginTop: space(1) }]}>{why}</Text>
    </View>
  );
}

function Line({
  turn,
  onReplay,
  isLastTutorLine,
  tutorName,
  tutorSpeaking,
}: {
  turn: TurnLine;
  onReplay?: () => void;
  /** This is the most recent tutor line in the thread. */
  isLastTutorLine: boolean;
  /** Who the learner chose, said above each of their lines. */
  tutorName: string;
  /** The tutor holds the floor right now, which lights the ear. */
  tutorSpeaking: boolean;
}) {
  if (turn.who === 'narration') {
    return (
      <View style={st.narration}>
        <Text style={[type.small, { color: paper.inkSoft, textAlign: 'center' }]}>{turn.en ?? turn.fr}</Text>
      </View>
    );
  }

  const learner = turn.who === 'learner';
  // Hidden, ink, or the accent on a quiet disc. The rule is in replayEar.ts so
  // it can be asked a question; `learner` is folded into the first input here
  // rather than there, because "a learner line is never the last tutor line" is
  // a fact about this thread rather than a case the module has to know.
  const ear = replayEar({
    isLastTutorLine: !learner && isLastTutorLine,
    canReplay: onReplay !== undefined,
    sounding: tutorSpeaking,
  });
  const body = (
    <>
      <Text style={[type.french, { color: paper.ink }]}>{turn.fr}</Text>
      {turn.frWritten && turn.frWritten !== turn.fr ? (
        <Text style={[type.small, { color: paper.inkSoft, marginTop: space(0.5) }]}>{turn.frWritten}</Text>
      ) : null}
      {turn.en ? <Text style={[type.small, { color: paper.inkSoft, marginTop: space(0.5) }]}>{turn.en}</Text> : null}
    </>
  );

  return (
    <View style={learner ? st.rowRight : st.rowLeft}>
      <View style={{ maxWidth: '82%' }}>
        {/* Who is talking, said above every tutor bubble. A thread with two
            sides and no names reads as two anonymous voices, and the learner
            picked this person. Violet, because a name is identity. The
            learner's own side needs none: it is their words on their side. */}
        {learner ? null : (
          <View style={st.speaker}>
            <Label>{tutorName}</Label>
          </View>
        )}
        {/* Replay lives on the bubble rather than on a button in the control
            row, which is how "say that again" is served without a fifth chip
            competing for the space the learner reaches with one thumb. Only
            the tutor's own lines: replaying the learner's would be the app
            reading somebody's French back at them. The ear is what says so;
            before it, the whole affordance was that the bubble happened to be
            pressable, which is a control only somebody who knows finds. */}
        {onReplay ? (
          <Pressable
            onPress={onReplay}
            accessibilityRole="button"
            accessibilityLabel={`Hear that line again: ${turn.fr}`}
            style={({ pressed }) => [st.tutorBubble, st.withEar, pressed && { opacity: 0.7 }]}
          >
            <View style={{ flex: 1 }}>{body}</View>
            {ear === 'hidden' ? null : (
              <View style={ear === 'sounding' ? st.earSounding : st.ear}>
                <EarGlyph size={18} color={ear === 'sounding' ? accent.primary : paper.ink} />
              </View>
            )}
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
  tutorName,
  tutorSpeaking,
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
  /**
   * Who this learner chose, drawn above every tutor bubble.
   *
   * Passed in rather than read here, for the reason `choosingView` gives: the
   * tutor is whoever the learner picked, and a constant would put Luc's name
   * over Celine's sentences.
   */
  tutorName: string;
  /** The tutor is sounding right now, which lights the ear on its last line. */
  tutorSpeaking: boolean;
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
          <Line
            key={t.id}
            turn={t}
            onReplay={onReplayTutor && t.id === lastTutorId ? onReplayTutor : undefined}
            isLastTutorLine={t.id === lastTutorId}
            tutorName={tutorName}
            tutorSpeaking={tutorSpeaking}
          />
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
  // The name sits on the bubble's leading edge, indented by the bubble's own
  // padding so the caps line and the French below it share a left margin.
  speaker: { paddingLeft: space(3.5), marginBottom: space(0.5) },
  // The bubble becomes a row when it carries the ear, so the glyph sits at the
  // trailing edge of the words rather than under them.
  withEar: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  // The same treatment OptionCard gives an auditioning voice: a quiet disc, and
  // the glyph in the accent. Colour rather than movement, because there is
  // nothing here for reduce motion to withhold.
  ear: { padding: space(1) },
  earSounding: { padding: space(1), backgroundColor: paper.groundDeep, borderRadius: radius.pill },
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
