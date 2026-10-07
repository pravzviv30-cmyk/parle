/**
 * A saved phrase, confirmed (README Part 5.A, "phrase saved `save` +
 * `arrived()` everywhere"): a small ink pill that rises in near the foot of
 * whatever screen is showing, stays a moment and fades.
 *
 * It blocks nothing: every touch passes through it. It is hidden from
 * assistive technology, because the screen that saved the phrase already says
 * so where the learner is; announcing it again would say the same thing twice.
 * Published only once the save is durable, and once per phrase in a session.
 * Still and silent while a microphone or a live room is open (the queue does
 * not raise it then). Under reduced motion it appears and leaves without
 * moving, and its sound and haptic still play once.
 *
 * It sits a share of the window above the foot rather than measuring the safe
 * area, which the shared frame alone reads (F307): clear of the home indicator
 * and the tab bar on every phone and iPad size.
 */

import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { GAME_COPY } from '../game/copy.ts';
import { Icon } from '../icons/Icon.tsx';
import { useReduceMotion } from '../motion.ts';
import { useAnswered } from '../motion/landing.ts';
import { Enter, Exit } from '../motion/layout.tsx';
import { colour, decorative, paper, radius, space, type } from '../theme.ts';
import { fireBeat, fireStill } from './effects.ts';
import type { ToastItem } from './queue.ts';
import { COLUMN_MAX } from './Takeover.tsx';
import { TIMELINES, beatAt, playsStill } from './timelines.ts';
import { useLatch, useTimeline } from './useTimeline.ts';

const TIMELINE = TIMELINES.toast;
const LEAVES_AT = beatAt(TIMELINE, 'leave');

export function Toast({ item, onDone }: { item: ToastItem; onDone: (id: string) => void }) {
  const answered = useAnswered(useReduceMotion(true));
  const [shown, setShown] = useState(true);

  const still = useLatch(answered === true);

  useTimeline(TIMELINE, {
    ready: answered !== null,
    final: still,
    still: playsStill({ reduced: still, stopped: false }),
    onCue: fireBeat,
    onStill: () => fireStill(TIMELINE),
    onEnd: () => {},
  });

  useEffect(() => {
    const leave = setTimeout(() => setShown(false), LEAVES_AT);
    const done = setTimeout(() => onDone(item.id), TIMELINE.end);
    return () => {
      clearTimeout(leave);
      clearTimeout(done);
    };
    // One toast, one life: a new toast is a new item with its own id.
  }, [item.id]);

  return (
    <View {...decorative} style={st.layer}>
      {shown ? (
        <Exit style={st.anchor}>
          <Enter from="down" distance={10}>
            <View style={st.pill}>
              <Icon name="tick-circle" variant="bulk" size={20} color={colour.mint} />
              <Text style={[type.label, { color: paper.onInk }]}>{GAME_COPY.phraseSaved}</Text>
            </View>
          </Enter>
        </Exit>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFill, pointerEvents: 'none' },
  anchor: { position: 'absolute', left: space(5), right: space(5), bottom: '14%', alignItems: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    maxWidth: COLUMN_MAX,
    paddingVertical: space(3),
    paddingHorizontal: space(5),
    borderRadius: radius.pill,
    backgroundColor: paper.ink,
  },
});
