/**
 * The Streak screen (F770; README Part 5.D), rebuilt 2026-10-20 UI-008 to the
 * B-Streak artboard, in light and dark.
 *
 * Top to bottom: the butter band (back, "Your streak", the run at 52/800 with
 * the dancing flame, the longest run and the lifetime line, the week strip and
 * today's line), the freeze card, the next milestone, the month, how a day
 * counts, and the Evening nudge.
 *
 * Every word and every day's state is `streakScreenView.ts`'s, from the game
 * view, which read the same practice days and covers the number counts; the
 * nudge is `streakNudge.ts`'s over the daily reminder. This file is layout.
 * There is no "missed" anywhere: a day without practice is "no practice", a
 * covered day says what covered it.
 *
 * - The run is drawn where it stands on every visit, never counted up from
 *   nought again, and with no run going there is no number, only the words for
 *   how one starts. The lifetime line always sits beside it (D2).
 * - Seven columns, Monday first, on a phone and on an iPad alike. Every cell
 *   says its full weekday or date to a screen reader; only the letter or the
 *   number is drawn.
 * - The month arrows are labelled buttons ("Previous month", "Next month") at
 *   the touch floor, off where the months run out.
 * - The freeze card shows what the plan holds once the plan is known: the free
 *   plan's one freeze "Free with every account" (D23) and the trial pill for a
 *   second freeze and repair; a subscriber's two. A subscriber earning a repair
 *   sees the repair card; a free learner just after a reset sees one calm line
 *   and See plans (D4). No notification, no countdown.
 * - The milestone row has no reward line: no milestone carries one yet.
 * - The Evening nudge is the daily reminder's switch, absent on a build that
 *   cannot schedule one and until it has been read.
 *
 * It reads the game layer on its own: sand while the facts load, and a plain
 * line with a way to try again when they could not be read.
 */

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { BArt } from '../art/BArt.tsx';
import { IconAction, Skeleton } from '../components.tsx';
import { BackButton } from '../journey/JourneyParts.tsx';
import { ScrollScreen, TopInset } from '../layout.tsx';
import { LivingBar } from '../motion/LivingBar.tsx';
import { useB, useThemedStyles, type B } from '../main/bTheme.tsx';
import { useBackToHome } from '../nav/useBackToHome.ts';
import { BButton } from '../today/TodayParts.tsx';
import { bType, radius, space } from '../theme.ts';
import { GAME_COPY } from './copy.ts';
import { useGame } from './GameProvider.tsx';
import { FreezeCard, HowCard, MilestoneRow, MonthArrow, MonthGrid, NudgeRow, StreakHead, WeekStrip } from './StreakParts.tsx';
import { NUDGE_COPY } from '../settings/streakNudge.ts';
import { streakDays } from './todayHeroView.ts';
import { WEEKDAY_LETTERS, monthOf, shiftMonth, streakScreenView, type CalendarMonth } from './streakScreenView.ts';
import { useEveningNudge } from '../settings/useEveningNudge.ts';

export function StreakScreen() {
  const back = useBackToHome();
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const { view, failed, refresh } = useGame();
  const [wanted, setWanted] = useState<CalendarMonth | null>(null);
  const nudge = useEveningNudge();
  const t = useB();
  const s = useThemedStyles(makeStyles);
  const copy = GAME_COPY.streakScreen;

  if (view === null) {
    return (
      <ScrollScreen bottom="inset" padded={false} topGap={space(3)}>
        <View style={s.page}>
          <View style={s.headRow}>
            <BackButton onPress={back} />
            <Text accessibilityRole="header" style={[bType.section22, { color: t.text }]}>{copy.title}</Text>
          </View>
          {failed ? (
            <View style={s.group}>
              <Text style={[bType.line16, { color: t.text }]}>{copy.unread}</Text>
              <IconAction layout="inline" icon="refresh" label={copy.retry} onPress={refresh} />
            </View>
          ) : (
            <Skeleton blocks={[{ height: space(60), radius: radius.feature }, { height: space(20), radius: radius.card }, { height: space(80), radius: radius.card }]} />
          )}
        </View>
      </ScrollScreen>
    );
  }

  const screen = streakScreenView(view, wanted ?? monthOf(view.today));
  const { hero, month } = screen;
  const openPlans = () => nav.navigate('Wall', { entry: 'settings' });

  return (
    <ScrollScreen bottom="inset" padded={false} bleedTop>
      {/* The band: butter, rounded 0 0 40 40, padding 58 22 22 (the safe area plus 12), gap 6. */}
      <View style={s.band}>
        <TopInset extra={12} />
        <View style={s.headRow}>
          <BackButton onPress={back} />
          <Text accessibilityRole="header" style={[bType.section22, { color: t.text }]}>{copy.title}</Text>
        </View>
        <View style={s.heroRow} accessible accessibilityLabel={hero.label}>
          <View style={s.heroWords}>
            {/* Drawn where it stands on every visit; with no run, the words for how one starts. */}
            <Text style={[bType.run52, { color: t.text }]}>{hero.running ? streakDays(hero.count) : hero.words}</Text>
            {hero.running ? <Text style={[bType.line16, { color: t.text }]}>{copy.inARow}</Text> : null}
            {hero.longest !== null ? <Text style={[bType.chip, s.longest, { color: t.text }]}>{hero.longest}</Text> : null}
            <Text style={[bType.note, { color: t.text }]}>{hero.lifetime}</Text>
          </View>
          <BArt name="flame-dance" width={170} height={156} style={s.dance} />
        </View>
        <WeekStrip week={screen.week} />
        <Text style={[bType.line15, s.centred, s.today, { color: t.text }]}>{hero.today}</Text>
      </View>

      <View style={s.body}>
        {screen.freezeCard !== null ? (
          <FreezeCard {...screen.freezeCard} onUpsell={openPlans} />
        ) : null}

        {screen.repair !== null ? (
          <View style={s.card}>
            <Text accessibilityRole="header" style={[bType.bold18, { color: t.text }]}>{screen.repair.title}</Text>
            <Text style={[bType.para15, { color: t.secondary }]}>{screen.repair.line}</Text>
            <LivingBar to={screen.repair.done / screen.repair.needed} accessibilityLabel={screen.repair.progress} />
            <Text style={[bType.note, { color: t.muted }]}>{screen.repair.progress}</Text>
          </View>
        ) : null}

        {screen.repairForSubscribers !== null ? (
          <View style={s.card}>
            <Text style={[bType.para15, { color: t.secondary }]}>{screen.repairForSubscribers.line}</Text>
            <BButton label={screen.repairForSubscribers.action} height={44} ground={t.primary} ink={t.onPrimary} text={bType.bold15} hug onPress={openPlans} />
          </View>
        ) : null}

        <View style={s.section}>
          <StreakHead title={copy.nextHead} />
          <MilestoneRow title={screen.milestone.title} progress={screen.milestone.progress} fraction={screen.milestone.fraction} />
        </View>

        <View style={s.section}>
          <StreakHead
            title={month.title}
            right={
              <View style={s.arrows}>
                <MonthArrow label={copy.previousMonth} back disabled={!month.canGoBack} onPress={() => setWanted(shiftMonth(month, -1))} />
                <MonthArrow label={copy.nextMonth} back={false} disabled={!month.canGoForward} onPress={() => setWanted(shiftMonth(month, 1))} />
              </View>
            }
          />
          <MonthGrid month={month} weekdays={WEEKDAY_LETTERS} />
        </View>

        <HowCard title={copy.howTitle} line={copy.howLine} />

        {nudge !== null ? (
          <NudgeRow title={NUDGE_COPY.title} line={NUDGE_COPY.line} note={nudge.note} trouble={nudge.trouble} on={nudge.on} busy={nudge.busy} onChange={nudge.toggle} />
        ) : null}
      </View>
    </ScrollScreen>
  );
}

const makeStyles = (t: B) =>
  StyleSheet.create({
    page: { paddingHorizontal: 22, gap: 22 },
    band: { backgroundColor: t.butter, borderBottomLeftRadius: 40, borderBottomRightRadius: 40, paddingHorizontal: 22, paddingBottom: 22, gap: 6 },
    headRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    heroRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
    heroWords: { flex: 1, minWidth: 0, gap: 2 },
    longest: { marginTop: 4 },
    dance: { marginRight: -12, flexShrink: 0 },
    centred: { textAlign: 'center' },
    today: { marginTop: 4 },
    body: { paddingTop: 22, paddingHorizontal: 22, paddingBottom: 40, gap: 22 },
    card: { backgroundColor: t.card, borderRadius: 24, padding: 16, gap: 12 },
    group: { gap: space(2) },
    section: { gap: 10 },
    arrows: { flexDirection: 'row', gap: 6 },
  });
