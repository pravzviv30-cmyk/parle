import { transcriptTail, replyAnnouncement } from './transcriptTail.ts';
import { authoredCorrectionReason, type CorrectionReasonId } from '@luvani/core';
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

import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, AccessibilityInfo, Platform } from 'react-native';
import { accent, frenchText, paper, space, type, radius, HAIRLINE, HIT } from '../theme.ts';
import { EarGlyph, Highlight, Label } from '../components.tsx';
import type { TurnLine } from '../live/turns.ts';
import { useReduceMotion } from '../motion.ts';
import { replayEar } from './replayEar.ts';

function Recast({ better, betterEn, reason, latest }: { quote: string; better: string; betterEn: string; reason?: CorrectionReasonId; latest: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const explanation = authoredCorrectionReason(reason);
  return (
    <View style={st.recast}>
      <Label>A more natural way</Label>
      {latest ? <Highlight text={better} /> : <Text {...frenchText} style={[type.french, { color: paper.ink, marginTop: space(0.5) }]}>{better}</Text>}
      <Text style={[type.small, { color: paper.inkSoft }]}>{betterEn}</Text>
      {explanation !== null && <>
        <Pressable accessibilityRole="button" accessibilityLabel="Why this form?" accessibilityState={{expanded}}
          onPress={() => setExpanded(value => !value)} style={{minHeight:HIT,minWidth:HIT,justifyContent:'center'}}>
          <Text style={[type.small, {color:paper.ink}]}>Why?</Text>
        </Pressable>
        {expanded && <Text style={[type.small, {color:paper.inkSoft}]}>{explanation}</Text>}
      </>}
    </View>
  );
}

function Line({
  turn,
  latestCorrection,
  onReplay,
  isLastTutorLine,
  tutorName,
  tutorSpeaking,
  announceReply = false,
}: {
  turn: TurnLine;
  latestCorrection: boolean;
  onReplay?: () => void;
  /** This is the most recent tutor line in the thread. */
  isLastTutorLine: boolean;
  /** Who the learner chose, said above each of their lines. */
  tutorName: string;
  /** The tutor holds the floor right now, which lights the ear. */
  tutorSpeaking: boolean;
  announceReply?: boolean;
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
      <Text {...frenchText} accessibilityLiveRegion={announceReply && isLastTutorLine ? 'polite' : 'none'} style={[type.french, { color: learner ? paper.onInk : paper.ink }]}>{turn.fr}</Text>
      {turn.frWritten && turn.frWritten !== turn.fr ? (
        <Text style={[type.small, { color: learner ? paper.onInk : paper.inkSoft, marginTop: space(0.5) }]}>{turn.frWritten}</Text>
      ) : null}
      {turn.en ? <Text style={[type.small, { color: learner ? paper.onInk : paper.inkSoft, marginTop: space(0.5) }]}>{turn.en}</Text> : null}
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
            {/* flexShrink, never flex: 1. The bubble is sized by its content
                and the row has no free space to grow into, so on a phone Yoga
                gives a flex: 1 child a zero basis and the words vanish, leaving
                a bubble the width of its ear. A browser sizes the same row from
                its content, which is how F372 shipped looking whole (F385). */}
            <View style={{ flexShrink: 1 }}>{body}</View>
            {ear === 'hidden' ? null : (
              <View style={ear === 'sounding' ? st.earSounding : st.ear}>
                <EarGlyph size={18} color={ear === 'sounding' ? accent.primary : paper.ink} />
              </View>
            )}
          </Pressable>
        ) : learner ? (
          // The learner's own side is the deeper paper rather than a tint, since
          // the notebook redesign retired the tints: these are their words, set
          // on the page itself, and the tutor's are the white card opposite.
          <View style={st.learnerBubble}>{body}</View>
        ) : (
          <View style={st.tutorBubble}>{body}</View>
        )}
        {turn.recasts?.map((r, index) => (
          <Recast key={`${r.textTurnId ?? 'legacy'}:${r.correctionIndex ?? index}:${r.quote}:${r.better}:${r.reason ?? 'none'}`} {...r} latest={latestCorrection && index === turn.recasts!.length - 1} />
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
  announceReply = false,
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
  announceReply?: boolean;
}) {
  const ref = useRef<ScrollView>(null);
  const nearBottom = useRef(true);
  const [newLines, setNewLines] = useState(false);
  // The thread arrives in place (notebook Phase 4, 2026-09-27): only the orb
  // and the highlighter move in this app. Reduce motion still decides whether
  // the scroll to the newest line glides or jumps.
  const reduced = useReduceMotion();
  // Which bubble carries the replay. Found by walking back rather than by
  // index, because the last line in the thread is usually the learner's.
  const latest = transcriptTail(turns);
  const lastCorrectionId = latest.correctionId;
  const lastTutorId = latest.tutor?.id;
  const announcedTutor = useRef<string | null>(null);
  useEffect(() => {
    if (latest.tutor === null || announcedTutor.current === latest.tutor.id) return;
    announcedTutor.current = latest.tutor.id;
    if (announceReply && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(replyAnnouncement(latest.tutor, tutorName));
  }, [lastTutorId, announceReply, tutorName]);

  return (
    <View style={st.frame}>
      <ScrollView
        ref={ref}
        style={st.scroll}
        contentContainerStyle={st.content}
        showsVerticalScrollIndicator={false}
        // A plain ScrollView rather than a FlatList: the list is capped at forty
        // and windowing would fight the stick-to-bottom below.
        onScroll={({ nativeEvent: { contentOffset, contentSize, layoutMeasurement } }) => {
          nearBottom.current = contentSize.height - layoutMeasurement.height - contentOffset.y < 64;
          if (nearBottom.current) setNewLines(false);
        }}
        scrollEventThrottle={100}
        onContentSizeChange={() => {
          if (nearBottom.current) ref.current?.scrollToEnd({ animated: !reduced });
          else setNewLines(true);
        }}
        // A learner may be typing into the box below this one while it scrolls.
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        accessibilityLabel="Your conversation so far"
      >
        {turns.map((t) => (
          <Line
            key={t.id}
            turn={t}
            latestCorrection={t.id === lastCorrectionId}
            onReplay={onReplayTutor && t.id === lastTutorId ? onReplayTutor : undefined}
            isLastTutorLine={t.id === lastTutorId}
            tutorName={tutorName}
            tutorSpeaking={tutorSpeaking}
            announceReply={announceReply}
          />
        ))}
      </ScrollView>
      {newLines && <Pressable accessibilityRole="button" accessibilityLabel="Go to the latest message" onPress={() => { nearBottom.current = true; setNewLines(false); ref.current?.scrollToEnd({ animated: !reduced }); }} style={st.latest}>
        <Text style={[type.small, { color: paper.ink }]}>Latest message ↓</Text>
      </Pressable>}
    </View>
  );
}

const st = StyleSheet.create({
  latest: { minHeight: HIT, alignSelf: 'center', justifyContent: 'center', paddingHorizontal: space(4), backgroundColor: paper.groundDeep, borderRadius: radius.control },
  // The wrapper carries the same flex the scroll does, so it moves nothing:
  // minHeight 0 is what stops a flex child from refusing to shrink and pushing
  // the controls off the bottom of the screen.
  frame: { flex: 1, minHeight: 0 },
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
  // The tutor speaks from a white card on the paper hairline, and no shadow:
  // the notebook retired the whisper, and the rule alone keeps the card from
  // dissolving into the ground. Same bargain `components.tsx` states for Card.
  tutorBubble: {
    backgroundColor: paper.card,
    borderRadius: radius.card,
    paddingHorizontal: space(4),
    paddingVertical: space(3.5),
  },
  // Tighter corners than the card: the learner's side is the page itself,
  // a shade deeper, rather than an object sitting on it.
  learnerBubble: {
    backgroundColor: paper.ink,
    borderRadius: radius.row,
    paddingHorizontal: space(3.5),
    paddingVertical: space(3),
  },
  narration: { paddingHorizontal: space(4), paddingVertical: space(1) },
  recast: {
    marginTop: space(1.5),
    paddingLeft: space(3),
    borderLeftWidth: 2,
    borderLeftColor: paper.ink,
  },
});
