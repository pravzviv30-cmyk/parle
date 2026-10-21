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

import { CountUp } from '../motion/CountUp.tsx';
import { useProfile } from '../app/ProfileContext.tsx';
import { questCounts } from '../home/homeDraw.ts';
import { useHomeDraw } from '../home/useHomeDraw.ts';
import { TODAY_COPY, questTrailing, threeDone } from '../home/todayView.ts';
import { tutorNameOf } from '../tutor/tutorName.ts';
import { useB, useThemedStyles, type B } from '../main/bTheme.tsx';
import { CheckDisc, QuestRing, SmallPill } from '../today/TodayParts.tsx';
import { HAIRLINE, bType, decorative, space, type } from '../theme.ts';
import { useGame, useGoal, useQuests } from './GameProvider.tsx';
import { questsCardView } from './questsCardView.ts';

/** A row's mark, 26 as drawn: the row is not a target. */
const MARK = 26;

/**
 * 2026-10-20, B5, B-Today: "Today's three" on the page, not in a sheet. A
 * done quest is a mint disc with a tick, so done is never colour alone; one
 * still moving is a ring drawn to its fraction; one not started is the empty
 * ring. Each row says its title and where it stands as one phrase, which is
 * the ring's label too. On the right, the quest's XP while it waits and once
 * it is done, or its count while it moves.
 *
 * 2026-10-20 UI-008, artboard B-Today: the heading and the count sit above a
 * white list card (radius 22, padding 4 16) of 52pt rows split by hairlines;
 * a done row's words are muted and struck through; every right-hand pill is
 * the small 13/700 pill, sage once done and butter otherwise. Theme tokens
 * throughout, so the card draws in dark too.
 */
export function QuestsCard() {
  const t = useB();
  const st = useThemedStyles(makeStyles);
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
    <View style={st.block}>
      <View style={st.head}>
        <Text accessibilityRole="header" style={[type.heading, st.title, { color: t.text }]}>
          {TODAY_COPY.three}
        </Text>
        <View accessibilityLiveRegion="polite">
          {done !== undefined ? (
            <CountUp key={`done-${done.mount}`} from={done.from} to={done.to} format={threeDone} textStyle={[bType.meta, { color: t.muted }]} />
          ) : null}
        </View>
      </View>
      <View style={st.card}>
        {card.rows.map((row, index) => {
          const trailing = questTrailing(row);
          return (
            <View key={`${drawn.draw.day}:${row.id}:${row.target}`} accessible accessibilityLabel={row.label} style={[st.row, index < card.rows.length - 1 && st.ruled]}>
              <View {...decorative}>
                {row.complete ? (
                  <CheckDisc size={MARK} fill={t.mint} tick={t.onMint} />
                ) : (
                  <QuestRing size={MARK} fraction={row.fraction} track={t.lavender} color={t.brand} />
                )}
              </View>
              <Text style={[bType.line16, st.words, row.complete ? st.doneWords : { color: t.text }]}>{row.title}</Text>
              <SmallPill label={trailing.label} ground={trailing.kind === 'xp' && trailing.earned ? t.sage : t.butter} />
            </View>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (t: B) =>
  StyleSheet.create({
    block: { gap: 10 },
    head: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', columnGap: space(3) },
    title: { flexShrink: 1, minWidth: 0 },
    card: { backgroundColor: t.card, borderRadius: 22, paddingVertical: space(1), paddingHorizontal: space(4) },
    row: { flexDirection: 'row', alignItems: 'center', gap: space(3), minHeight: 52, paddingVertical: space(1) },
    ruled: { borderBottomWidth: HAIRLINE, borderBottomColor: t.line },
    words: { flex: 1, minWidth: 0 },
    doneWords: { color: t.muted, textDecorationLine: 'line-through' },
  });
