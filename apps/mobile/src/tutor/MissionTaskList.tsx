import { useEffect, useRef } from 'react';
import { AccessibilityInfo, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import type { MissionTasks } from '@luvani/core';
import { paper, colour, radius, space, type } from '../theme.ts';
import { CheckGlyph } from '../components.tsx';
import { Glint } from '../motion/Glint.tsx';
import { Enter } from '../motion/layout.tsx';
import { DUR } from '../motion/tokens.ts';
import { useReduceMotion } from '../motion.ts';
import { achievedIds, newlyAchieved, tickAnnouncement } from './taskTicks.ts';

/**
 * Quiet, session-local goal observations; uncertainty stays unticked.
 *
 * A goal the learner reaches while the list is on screen ticks once
 * (`tutor/taskTicks.ts`): its mint disc pops in and the check lands in it a
 * beat later, the row glints once, the list scrolls it into view, and a screen
 * reader hears "Goal reached:" and the goal's own words. What was already
 * reached the first time the list was seen (a reconnect, a resumed room) is
 * simply drawn ticked. At rest a tick is exactly what it always was: an ink
 * check on a mint disc. No count, no sound and no haptic: a live room is
 * silent and still to the touch (decision D8), and a number would turn the
 * room into a test. Reduce Motion shows the tick at once and jumps the scroll,
 * watched live.
 */
export function MissionTaskList({ items }: { items: MissionTasks['items'] }) {
  const reduced = useReduceMotion();
  const scroll = useRef<ScrollView>(null);
  const rows = useRef(new Map<string, number>());
  // The list as it was first seen. Decided in the render that first has goals,
  // so a goal that ticks is drawn ticking from its very first frame.
  const firstLook = useRef<ReadonlySet<string> | null>(null);
  if (firstLook.current === null && items.length > 0) firstLook.current = achievedIds(items);
  const fresh = new Set(newlyAchieved(firstLook.current, items));
  const told = useRef(new Set<string>());

  const freshKey = [...fresh].join('|');
  useEffect(() => {
    const news = items.filter((item) => fresh.has(item.id) && !told.current.has(item.id));
    if (news.length === 0) return;
    for (const item of news) told.current.add(item.id);
    const line = tickAnnouncement(news.map((item) => item.goalEn));
    if (line !== null) AccessibilityInfo.announceForAccessibility(line);
    const y = rows.current.get(news[news.length - 1]!.id);
    if (y !== undefined) scroll.current?.scrollTo({ y: Math.max(0, y - space(2)), animated: !reduced });
    // The ticks are the fact that moves this; the items array is new every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freshKey]);

  if (items.length === 0) return null;
  return (
    <ScrollView ref={scroll} style={{ flexGrow: 0, maxHeight: 104 }} contentContainerStyle={{ gap: space(1), paddingVertical: space(2) }}>
      {items.map(item => {
        const ticking = fresh.has(item.id);
        return (
          <View key={item.id} accessible accessibilityLabel={`${item.goalEn}. ${item.achieved ? 'Achieved in this conversation' : 'To practise'}`}
            onLayout={(event: LayoutChangeEvent) => { rows.current.set(item.id, event.nativeEvent.layout.y); }}
            style={st.row}>
            <View importantForAccessibility="no" style={st.tick}>
              <View style={[st.disc, st.open]} />
              {item.achieved ? (
                <Enter from="none" scaleFrom={0.6} duration={DUR.fast} play={ticking} style={st.cover}>
                  <View style={[st.disc, st.done]}>
                    <Enter from="none" scaleFrom={0.4} delay={DUR.micro} duration={DUR.fast} play={ticking}>
                      <CheckGlyph size={14} color={paper.ink} />
                    </Enter>
                  </View>
                </Enter>
              ) : null}
            </View>
            <Text style={[type.small, { color: paper.ink, flex: 1 }]}>{item.goalEn}</Text>
            {ticking ? <Glint when wait={DUR.fast} radius={radius.chip} /> : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space(2), borderRadius: radius.chip },
  tick: { width: 20, height: 20 },
  disc: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  open: { backgroundColor: paper.card, borderColor: paper.line },
  done: { backgroundColor: colour.mint, borderColor: colour.mint },
  // The ticked disc sits exactly over the open one, so popping in covers it.
  cover: { position: 'absolute', top: 0, left: 0 },
});
