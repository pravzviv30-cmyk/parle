/**
 * The Streak screen (F770; README Part 5.D): the run, the lifetime total and
 * the longest run; this week; the month; the freezes and the repair a plan
 * holds; the milestones.
 *
 * Every word and every day's state is `streakScreenView.ts`'s, from the game
 * view, which read the same practice days and covers the number counts: this
 * file is layout. There is no "missed" anywhere: a day without practice is "no
 * practice", a covered day says what covered it.
 *
 * - The hero flame is lit only when today counts. The run is drawn where it
 *   stands on every visit, never counted up from nought again, and with no
 *   run going there is no number, only the words for how one starts. The
 *   lifetime line always sits beside it (D2).
 * - Seven columns, Monday first, on a phone and on an iPad alike. Every cell
 *   says its full weekday or date to a screen reader; only the letter or the
 *   number is drawn.
 * - The month arrows are labelled icon buttons ("Previous month", "Next
 *   month") at the touch floor, off where the months run out.
 * - A subscriber sees the freezes card, and the repair card while a repair is
 *   being earned. A free learner sees one calm line and See plans, and only
 *   just after a reset that a plan could still repair (D4). No notification,
 *   no countdown, and nothing at all while the plan is unknown.
 *
 * It reads the game layer on its own: sand while the facts load, and a plain
 * line with a way to try again when they could not be read.
 */

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Card, IconAction, IconButton, Skeleton } from '../components.tsx';
import { Icon } from '../icons/Icon.tsx';
import { ScrollScreen, ScreenHeader } from '../layout.tsx';
import { useMainAppearance } from '../main/MainAppearance.tsx';
import { CountUp } from '../motion/CountUp.tsx';
import { LivingBar } from '../motion/LivingBar.tsx';
import { useBackToHome } from '../nav/useBackToHome.ts';
import { HIT, HAIRLINE, accent, colour, paper, radius, space, type } from '../theme.ts';
import { Flame } from './art/Flame.tsx';
import { FreezeMark } from './art/FreezeMark.tsx';
import { Medal } from './art/Medal.tsx';
import { RepairMark } from './art/RepairMark.tsx';
import { GAME_COPY } from './copy.ts';
import { useGame } from './GameProvider.tsx';
import { monthOf, shiftMonth, streakScreenView, type CalendarMonth, type DayCellView } from './streakScreenView.ts';

const HERO_FLAME = space(30);
const MARK = space(7);
const MEDAL = space(12);
/** One seventh of the row: seven columns on any width. */
const COLUMN = `${100 / 7}%` as const;

export function StreakScreen() {
  const { colors, mode } = useMainAppearance();
  const back = useBackToHome();
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const { view, failed, refresh } = useGame();
  const [wanted, setWanted] = useState<CalendarMonth | null>(null);
  const header = <ScreenHeader ink={colors.text} muted={colors.muted} title={GAME_COPY.streakScreen.title} back={{ onPress: back }} />;

  if (view === null) {
    return (
      <ScrollScreen bottom="inset" ground={colors.background} header={header}>
        {failed ? (
          <View style={st.group}>
            <Text style={[type.body, { color: colors.text }]}>{GAME_COPY.streakScreen.unread}</Text>
            <IconAction layout="inline" ground={mode === 'dark' ? 'blue' : 'paper'} icon="refresh" label={GAME_COPY.streakScreen.retry} onPress={refresh} />
          </View>
        ) : (
          <Skeleton blocks={[{ height: HERO_FLAME + space(16), radius: radius.feature }, { height: space(20), radius: radius.card }, { height: space(80), radius: radius.card }]} />
        )}
      </ScrollScreen>
    );
  }

  const screen = streakScreenView(view, wanted ?? monthOf(view.today));
  const { hero, month } = screen;

  return (
    <ScrollScreen bottom="inset" ground={colors.background} header={header}>
      <View style={st.hero} accessible accessibilityLabel={hero.label}>
        <Flame size={HERO_FLAME} state={hero.lit ? 'lit' : 'unlit'} flicker={hero.lit} />
        <View style={st.heroCount}>
          {/* Drawn where it stands on every visit: Home is where a rise counts
              up. A rise that lands while this screen is open counts on, and a
              new day draws it again, so it never runs down. */}
          {hero.running ? <CountUp key={view.today} from={hero.count} to={hero.count} textStyle={[type.display, { color: colors.text }]} /> : null}
          <Text style={[type.heading, { color: colors.text }]}>{hero.words}</Text>
        </View>
        <Text style={[type.bodyStrong, st.centred, { color: colors.text }]}>{hero.lifetime}</Text>
        {hero.longest !== null ? <Text style={[type.small, st.centred, { color: colors.muted }]}>{hero.longest}</Text> : null}
        <Text style={[type.body, st.centred, { color: colors.text }]}>{hero.today}</Text>
      </View>

      <Card style={st.card}>
        <Text accessibilityRole="header" style={[type.heading, { color: paper.ink }]}>{GAME_COPY.streakScreen.week}</Text>
        <View style={st.grid}>
          {screen.week.map((cell) => (
            <View key={cell.day} style={st.column} accessible accessibilityLabel={cell.label}>
              <DayMark cell={cell} />
              <Text style={[type.small, { color: cell.state === 'today-open' ? paper.ink : paper.inkSoft }]}>{cell.mark}</Text>
            </View>
          ))}
        </View>
      </Card>

      <Card style={st.card}>
        <View style={st.monthHead}>
          <IconButton icon="back" label={GAME_COPY.streakScreen.previousMonth} disabled={!month.canGoBack} onPress={() => setWanted(shiftMonth(month, -1))} />
          <Text accessibilityRole="header" style={[type.heading, st.monthTitle, { color: paper.ink }]}>{month.title}</Text>
          {/* The back chevron, turned to face forward: the set's six marks have no forward one. */}
          <View style={st.mirrored}>
            <IconButton icon="back" label={GAME_COPY.streakScreen.nextMonth} disabled={!month.canGoForward} onPress={() => setWanted(shiftMonth(month, 1))} />
          </View>
        </View>
        <View style={st.grid}>
          {Array.from({ length: month.leading }, (_, i) => <View key={`lead-${i}`} style={st.column} />)}
          {month.cells.map((cell) => (
            <View key={cell.day} style={st.column} accessible accessibilityLabel={cell.label}>
              <DateMark cell={cell} />
            </View>
          ))}
        </View>
      </Card>

      {screen.freezes !== null ? (
        <Card style={st.card}>
          <Text accessibilityRole="header" style={[type.heading, { color: paper.ink }]}>{screen.freezes.title}</Text>
          <View style={st.inline} accessible accessibilityLabel={`${screen.freezes.title}: ${screen.freezes.ready}`}>
            {Array.from({ length: screen.freezes.max }, (_, i) => (
              <FreezeMark key={i} size={MARK} state={i < screen.freezes!.held ? 'ready' : 'used'} />
            ))}
            <Text style={[type.bodyStrong, { color: paper.ink }]}>{screen.freezes.ready}</Text>
          </View>
          <Text style={[type.body, { color: paper.ink }]}>{screen.freezes.line}</Text>
          {screen.freezes.returns !== null ? <Text style={[type.small, { color: paper.inkSoft }]}>{screen.freezes.returns}</Text> : null}
        </Card>
      ) : null}

      {screen.repair !== null ? (
        <Card style={st.card}>
          <View style={st.inline}>
            <RepairMark size={MARK} />
            <Text accessibilityRole="header" style={[type.heading, st.grow, { color: paper.ink }]}>{screen.repair.title}</Text>
          </View>
          <Text style={[type.body, { color: paper.ink }]}>{screen.repair.line}</Text>
          <LivingBar to={screen.repair.done / screen.repair.needed} accessibilityLabel={screen.repair.progress} />
          <Text style={[type.small, { color: paper.inkSoft }]}>{screen.repair.progress}</Text>
        </Card>
      ) : null}

      {screen.repairForSubscribers !== null ? (
        <View style={st.group}>
          <Text style={[type.body, { color: colors.text }]}>{screen.repairForSubscribers.line}</Text>
          <IconAction layout="inline" ground={mode === 'dark' ? 'blue' : 'paper'} icon="crown" label={screen.repairForSubscribers.action} onPress={() => nav.navigate('Wall', { entry: 'settings' })} />
        </View>
      ) : null}

      <Card style={st.card}>
        <Text accessibilityRole="header" style={[type.heading, { color: paper.ink }]}>{GAME_COPY.streakScreen.milestones}</Text>
        <View style={st.medals}>
          {screen.milestones.map((milestone) => (
            <View key={milestone.days} style={st.medal} accessible accessibilityLabel={milestone.label}>
              <Medal size={MEDAL} state={milestone.medal} />
              <Text style={[type.label, st.centred, { color: paper.ink }]}>{milestone.words}</Text>
              {milestone.when !== null ? <Text style={[type.small, st.centred, { color: paper.inkSoft }]}>{milestone.when}</Text> : null}
            </View>
          ))}
        </View>
        <Text style={[type.body, { color: paper.ink }]}>{screen.nextMilestone}</Text>
      </Card>
    </ScrollScreen>
  );
}

/** One day of the week strip: the flame for a practised day, the cover's mark, a ring for today, a quiet ring otherwise. */
function DayMark({ cell }: { cell: DayCellView }) {
  if (cell.state === 'practised') return <Flame size={MARK} state="lit" />;
  if (cell.state === 'covered') {
    return cell.cover === 'repair' ? <RepairMark size={MARK} /> : cell.cover === 'travel' ? <View style={st.dayMark}><Icon name="trip" variant="bulk" size={MARK - space(2)} color={accent.brand} /></View> : <FreezeMark size={MARK} />;
  }
  return <View style={[st.dayMark, st.ring, cell.state === 'today-open' && st.today, cell.state === 'ahead' && st.ahead]} />;
}

/** One date of the month: practised days are filled, a covered day ringed in the brand blue, today ringed in ink. */
function DateMark({ cell }: { cell: DayCellView }) {
  const practised = cell.state === 'practised';
  return (
    <View style={[st.date, practised && st.datePractised, cell.state === 'covered' && st.dateCovered, cell.state === 'today-open' && st.today]}>
      <Text style={[type.small, { color: cell.state === 'ahead' || cell.state === 'open' ? paper.inkSoft : paper.ink }]}>{cell.mark}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  hero: { alignItems: 'center', gap: space(2), marginBottom: space(4) },
  heroCount: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', justifyContent: 'center', columnGap: space(2) },
  centred: { textAlign: 'center' },
  card: { marginTop: space(4), gap: space(3) },
  group: { marginTop: space(4), gap: space(2) },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space(2) },
  column: { flexBasis: COLUMN, maxWidth: COLUMN, alignItems: 'center', gap: space(1) },
  monthHead: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  monthTitle: { flex: 1, minWidth: 0, textAlign: 'center' },
  mirrored: { transform: [{ scaleX: -1 }] },
  inline: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space(2) },
  grow: { flex: 1, minWidth: 0 },
  medals: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space(3) },
  // Four to a row on a phone; at a large reading size they wrap rather than squeeze.
  medal: { flexBasis: '25%', minWidth: HIT + space(4), flexGrow: 1, alignItems: 'center', gap: space(1) },
  dayMark: { width: MARK, height: MARK, borderRadius: MARK / 2, alignItems: 'center', justifyContent: 'center' },
  ring: { borderWidth: 2, borderColor: paper.field },
  today: { borderWidth: 2, borderColor: paper.ink },
  ahead: { borderWidth: HAIRLINE, borderColor: paper.line },
  date: { minWidth: MARK, minHeight: MARK, borderRadius: MARK / 2, alignItems: 'center', justifyContent: 'center' },
  datePractised: { backgroundColor: colour.sun },
  dateCovered: { borderWidth: 2, borderColor: accent.brand },
});
