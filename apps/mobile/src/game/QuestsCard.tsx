/**
 * Home's daily quests (F767; README Part 5.F, D22; B-Today 2026-10-20): "Today's
 * three", the day so far as "1 of 3 done", and today's three as rows, each with
 * its own progress.
 *
 * What it says is `questsCardView.ts`'s, from the game layer's `useQuests()`:
 * the three dealt and frozen for today, never a fourth, counted as "n of 3
 * done" beside the heading (B5, 2026-10-20). There is no chest,
 * no reward and no countdown. Nothing is drawn when the quests could not be
 * read or are not dealt yet.
 *
 * Home only shows the quests: progress and claims are the game layer's, and a
 * row is a fact rather than a door, so nothing here presses. What is drawn is
 * held while Home is covered or a celebration is up (`home/useHomeDraw.ts`).
 * The day's count then counts up once from what Home last showed
 * (`home/homeSeen.ts`) and is said once to a screen reader when it changes; on
 * a new day it is drawn again at the new day's count and never runs down, and
 * each row is keyed on its day and target, so a bar is never handed a lower
 * fill to run back to. No sound of its own: the end card that finished a
 * quest played it.
 */

import { StyleSheet, Text, View } from 'react-native';

import { Card, CheckGlyph, Chip } from '../components.tsx';
import { CountUp } from '../motion/CountUp.tsx';
import { ProgressRing } from '../motion/ProgressRing.tsx';
import { useProfile } from '../app/ProfileContext.tsx';
import { questCounts } from '../home/homeDraw.ts';
import { useHomeDraw } from '../home/useHomeDraw.ts';
import { TODAY_COPY, questTrailing, threeDone } from '../home/todayView.ts';
import { tutorNameOf } from '../tutor/tutorName.ts';
import { HIT, colour, decorative, paper, pastel, space, type } from '../theme.ts';
import { useGame, useGoal, useQuests } from './GameProvider.tsx';
import { questsCardView } from './questsCardView.ts';

/** A row's mark, a little under the touch floor: the row is not a target. */
const MARK = HIT - space(5);

/**
 * 2026-10-20, B5, B-Today: "Today's three" on the page, not in a sheet. A
 * done quest is a mint disc with a tick, so done is never colour alone; one
 * still moving is a ring drawn to its fraction; one not started is the empty
 * ring. Each row says its title and where it stands as one phrase, which is
 * the ring's label too. On the right, the quest's XP while it waits and once
 * it is done, or its count while it moves.
 */
export function QuestsCard() {
  const { profile } = useProfile();
  const { view } = useGame();
  const quests = useQuests();
  const goal = useGoal();
  const fresh = questsCardView(quests, { tutorName: tutorNameOf(profile), goalTarget: goal?.target ?? null });
  const drawn = useHomeDraw(view?.today ?? null, fresh, questCounts);
  if (fresh === null || drawn === null) return null;
  const card = drawn.model;
  const done = drawn.draw.counters.questsDone;

  return (
    <Card style={st.card}>
      <View style={st.head}>
        <Text accessibilityRole="header" style={[type.heading, st.title, { color: paper.ink }]}>
          {TODAY_COPY.three}
        </Text>
        <View accessibilityLiveRegion="polite">
          {done !== undefined ? (
            <CountUp key={`done-${done.mount}`} from={done.from} to={done.to} format={threeDone} textStyle={[type.small, { color: paper.inkSoft }]} />
          ) : null}
        </View>
      </View>
      {card.rows.map((row) => {
        const trailing = questTrailing(row);
        return (
          <View key={`${drawn.draw.day}:${row.id}:${row.target}`} accessible accessibilityLabel={row.label} style={st.row}>
            <View {...decorative}>
              {row.complete ? (
                <View style={[st.done, { backgroundColor: colour.mint }]}><CheckGlyph size={MARK - space(2)} color={paper.ink} /></View>
              ) : (
                <ProgressRing from={row.fraction} to={row.fraction} size={MARK} stroke={space(0.75)} color={colour.blue} track={pastel.lavender} />
              )}
            </View>
            <Text style={[type.label, st.words, { color: paper.ink }]}>{row.title}</Text>
            {trailing.kind === 'xp' ? (
              <Chip variant="meta" tone={trailing.earned ? 'sage' : 'butter'} label={trailing.label} />
            ) : (
              <Text style={[type.small, { color: paper.inkSoft }]}>{trailing.label}</Text>
            )}
          </View>
        );
      })}
    </Card>
  );
}

const st = StyleSheet.create({
  card: { gap: space(2) },
  head: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', columnGap: space(3) },
  title: { flexShrink: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), minHeight: HIT, paddingVertical: space(1) },
  words: { flex: 1, minWidth: 0 },
  done: { width: MARK, height: MARK, borderRadius: MARK / 2, alignItems: 'center', justifyContent: 'center' },
});
