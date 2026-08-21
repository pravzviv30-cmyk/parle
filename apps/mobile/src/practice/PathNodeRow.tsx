/**
 * One stop on the practice path.
 *
 * A Duolingo path is visually loud — big coloured medallions on a winding
 * track. This is the same information in this world's voice: a row on the
 * paper, a small ink mark for where it stands, and the one node carrying the
 * primary action wearing the only heavy rule on the screen.
 *
 * The mark is drawn, not coloured in: `complete` is a filled ink dot,
 * `needs-review` is the correspondance ring the system already uses for
 * "something to change here", started is a heavier ink ring, untouched is a
 * hairline. No new tokens, and no traffic lights.
 *
 * A topic the learner has actually talked about carries a second, quieter
 * door: back to the tutor, about that topic. It sits under a hairline inside
 * the same card rather than beside the title, because the drills stay the row's
 * one obvious action and this is the offer underneath it. Who is offered it,
 * and what the learner is told it costs, are in talkAgain.ts.
 */

import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { PathNode } from '@parle/core';
import { paper, signal, space, type, radius, HAIRLINE, HIT } from '../theme.ts';
import { statusLine } from './statusLine.ts';
import { TALK_AGAIN, offersTalkAgain, talkAgainLabel } from './talkAgain.ts';
import { ArrowRight } from '../components.tsx';
import { StillWriting } from '../illustrations.tsx';

function Mark({ state }: { state: PathNode['state'] }) {
  if (state === 'complete') return <View style={[st.mark, st.markDone]} />;
  if (state === 'needs-review') return <View style={[st.mark, st.markReview]} />;
  if (state === 'locked') return <View style={[st.mark, st.markLocked]} />;
  if (state === 'in-progress') return <View style={[st.mark, st.markPart]} />;
  return <View style={[st.mark, st.markOpen]} />;
}

/** What the row says under its title. Plain English, and never a count. */
export function PathNodeRow({
  node,
  onPress,
  onTalkAgain,
  paused = false,
}: {
  node: PathNode;
  onPress: () => void;
  /** Opens a live conversation about this topic. Omitted, the offer is absent. */
  onTalkAgain?: () => void;
  /**
   * Withhold the locked row's drawing. The tab owns this, because a loop has
   * no reason to run while the learner is three tabs away.
   */
  paused?: boolean;
}) {
  const locked = node.state === 'locked';
  const talkAgain = onTalkAgain !== undefined && offersTalkAgain(node);
  return (
    <View style={[st.card, node.isNext && st.cardNext]}>
      <Pressable
        onPress={locked ? undefined : onPress}
        disabled={locked}
        accessibilityRole="button"
        accessibilityState={{ disabled: locked }}
        accessibilityLabel={`${node.title}. ${statusLine(node)}`}
        style={({ pressed }) => [st.row, pressed && !locked && { opacity: 0.7 }]}
      >
        {/* The one thing this app locks is a topic the tutor has not
            finished writing, so the row shows the pen rather than a grey dot.
            Every other state keeps the mark it had. */}
        {locked ? (
          <View style={st.lockedArt}>
            <StillWriting width={40} paused={paused} />
          </View>
        ) : (
          <Mark state={node.state} />
        )}
        <View style={{ flex: 1 }}>
          <Text style={[type.bodyStrong, { color: locked ? paper.inkFaint : paper.ink }]}>{node.title}</Text>
          <Text style={[type.small, { color: paper.inkFaint, marginTop: space(0.5) }]}>{statusLine(node)}</Text>
        </View>
        {!locked && <ArrowRight size={16} color={node.isNext ? paper.ink : paper.inkFaint} />}
      </Pressable>

      {talkAgain && (
        <Pressable
          onPress={onTalkAgain}
          accessibilityRole="button"
          accessibilityLabel={talkAgainLabel(node.title)}
          style={({ pressed }) => [st.talk, pressed && { opacity: 0.6 }]}
        >
          <Text style={[type.bodyStrong, { color: paper.ink }]}>{TALK_AGAIN.action}</Text>
          {/* Said before the tap, on screen, every time. A learner who finds
              out afterwards has been charged for a surprise. */}
          <Text style={[type.small, { color: paper.inkFaint, marginTop: space(0.5) }]}>{TALK_AGAIN.cost}</Text>
        </Pressable>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  // The card chrome lives out here so a topic's second door sits inside the
  // same card as its title rather than in one of its own.
  card: {
    backgroundColor: paper.card,
    borderRadius: radius.card,
    borderWidth: HAIRLINE,
    borderColor: paper.lineOnCard,
    overflow: 'hidden',
  },
  // The single heavy rule on the screen: this is the one to do now.
  cardNext: { borderWidth: 2, borderColor: paper.ink },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3.5),
    minHeight: HIT + space(2),
    paddingHorizontal: space(4),
    paddingVertical: space(3),
  },
  talk: {
    minHeight: HIT,
    justifyContent: 'center',
    borderTopWidth: HAIRLINE,
    borderTopColor: paper.lineOnCard,
    paddingHorizontal: space(4),
    paddingVertical: space(2.5),
  },
  // Same footprint as the mark it replaces, so the row's rhythm holds.
  lockedArt: { width: 40, alignItems: 'center', justifyContent: 'center' },
  mark: { width: 14, height: 14, borderRadius: 7 },
  // Learned reads green — the go colour marking ground already covered.
  markDone: { backgroundColor: signal.good },
  markReview: { borderWidth: 2, borderColor: signal.correspondance },
  markPart: { borderWidth: 2, borderColor: paper.ink },
  markOpen: { borderWidth: HAIRLINE, borderColor: paper.line },
  markLocked: { borderWidth: HAIRLINE, borderColor: paper.line, opacity: 0.6 },
});
