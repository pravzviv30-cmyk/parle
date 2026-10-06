/**
 * The one frame every full-screen celebration shares (motion-sound sections 4.3
 * and 5).
 *
 * - Modal to assistive technology and to the hardware back button: a screen
 *   reader stays inside it, focus moves to its title, and the title and the
 *   main value are announced as it appears.
 * - The stage (the template's art) on top, then the number, the title, the
 *   lines and any "Also today" rows, in a column at most `COLUMN_MAX` wide and
 *   centred on an iPad, inside the shared frame's scroll, so text at any
 *   reading size scrolls rather than being cut. Nothing caps a line.
 * - Continue is always there. It is ready by `INPUT_READY_MS`, and at once
 *   under reduced motion or with a screen reader on. Nothing dismisses itself.
 * - The first tap anywhere skips to the end: every part jumps to its final
 *   frame, waiting haptic beats are dropped and sounds stop. Android's back is
 *   Continue once Continue is ready, and a skip before.
 * - Reduced motion shows the final frame at once and is watched live; its one
 *   sound and haptic still play once, because they are not motion.
 * - A hold (a microphone, a live room, a sheet, the app leaving the screen)
 *   lands the card on its final frame and keeps it there; it never replays.
 */

import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import {
  AccessibilityInfo,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  findNodeHandle,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';

import { PillButton } from '../components.tsx';
import { GAME_COPY } from '../game/copy.ts';
import { ScrollScreen } from '../layout.tsx';
import { useReduceMotion } from '../motion.ts';
import { useAnswered } from '../motion/landing.ts';
import { Enter } from '../motion/layout.tsx';
import { StaggerIn } from '../motion/StaggerIn.tsx';
import { DUR, INPUT_READY_MS, IPAD_WIDTH } from '../motion/tokens.ts';
import { colour, onColour, paper, space, textOn, type } from '../theme.ts';
import type { TakeoverType } from './events.ts';
import { cardView, type CardGround, type CardView } from './cardView.ts';
import { fireBeat, fireStill, stopEffects } from './effects.ts';
import type { TakeoverCard } from './queue.ts';
import { BadgeEarned } from './templates/BadgeEarned.tsx';
import { LevelUp } from './templates/LevelUp.tsx';
import { PurchaseConfirmed } from './templates/PurchaseConfirmed.tsx';
import { QuestChest } from './templates/QuestChest.tsx';
import type { StageProps } from './templates/stage.tsx';
import { StreakExtended } from './templates/StreakExtended.tsx';
import { StreakMilestone } from './templates/StreakMilestone.tsx';
import { TIMELINES, beatAt, type Timeline } from './timelines.ts';
import { useScreenReader } from './useScreenReader.ts';
import { useLatch, useTimeline } from './useTimeline.ts';

/** The widest a takeover's column grows, centred, on an iPad or the web. */
export const COLUMN_MAX = 520;

const STAGES: Readonly<Record<TakeoverType, (props: StageProps) => ReactElement>> = {
  'purchase-confirmed': PurchaseConfirmed,
  'streak-milestone': StreakMilestone,
  'streak-extended': StreakExtended,
  'quest-chest': QuestChest,
  'level-up': LevelUp,
  'badge-earned': BadgeEarned,
};

const GROUND: Readonly<Record<CardGround, string>> = {
  paper: paper.ground,
  blue: colour.blue,
  coral: colour.coral,
  sun: colour.sun,
  mint: colour.mint,
};

/** The words' two colours on each ground: ink and soft ink on paper, the ground's own pair on a colour. */
function inks(ground: CardGround): { ink: string; soft: string } {
  if (ground === 'paper') return { ink: paper.ink, soft: paper.inkSoft };
  return { ink: textOn[ground], soft: onColour[ground] };
}

/** The stage's height: under a third of the window, and taller on an iPad. */
function stageHeight(width: number, height: number): number {
  return Math.round(Math.min(width >= IPAD_WIDTH ? 320 : 240, height * 0.3));
}

export function Takeover({
  card,
  paused,
  onFinal,
  onContinue,
}: {
  card: TakeoverCard;
  /** Something holds the queue: land on the final frame and stay there. */
  paused: boolean;
  /** Said once, when the card reaches its final frame or is skipped there. */
  onFinal: (id: string) => void;
  onContinue: (id: string) => void;
}) {
  const view = useMemo(() => cardView(card), [card]);
  const timeline = TIMELINES[view.timeline];
  const answered = useAnswered(useReduceMotion(true));
  const reader = useScreenReader();
  const [landed, setLanded] = useState(false);
  const reduced = answered === true;
  // Once final, always final: turning Reduce Motion off mid-card never replays it.
  const final = useLatch(reduced || landed);

  useEffect(() => {
    if (!paused) return;
    stopEffects();
    setLanded(true);
  }, [paused]);

  const elapsed = useTimeline(timeline, {
    ready: answered !== null,
    final,
    onCue: fireBeat,
    onStill: () => fireStill(timeline),
    onEnd: () => onFinal(card.id),
  });
  // Counted from the card appearing, not from the clock, which may wait a moment for the OS.
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setWaited(true), INPUT_READY_MS);
    return () => clearTimeout(timer);
  }, []);
  const ready = final || reader === true || waited;

  const skip = () => {
    if (final) return;
    stopEffects();
    setLanded(true);
  };
  const next = () => {
    stopEffects();
    onContinue(card.id);
  };
  const back = () => (ready ? next() : skip());

  const dims = useWindowDimensions();
  const [columnWidth, setColumnWidth] = useState(Math.min(COLUMN_MAX, dims.width - space(10)));
  const onColumn = (event: LayoutChangeEvent) => {
    const measured = Math.round(event.nativeEvent.layout.width);
    if (measured > 0 && measured !== columnWidth) setColumnWidth(measured);
  };

  const title = useRef<Text>(null);
  const focusTitle = () => {
    if (Platform.OS === 'web') {
      (title.current as unknown as { focus?: () => void } | null)?.focus?.();
      return;
    }
    const handle = findNodeHandle(title.current);
    if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
  };
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(view.announce);
    // The title enters over DUR.base; focus lands once it is there to land on.
    const timer = setTimeout(focusTitle, DUR.base);
    return () => clearTimeout(timer);
  }, [view.announce]);

  const groundName = view.ground;
  const { ink, soft } = inks(groundName);
  const reached = (element: string): boolean => final || elapsed >= beatAt(timeline, element);
  const Stage = STAGES[card.type];
  const mode = final ? 'final' : 'play';

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={back} supportedOrientations={['portrait']}>
      <Enter from="none" duration={DUR.fast} style={st.fill}>
        <View accessibilityViewIsModal style={st.fill}>
          <ScrollScreen
            ground={GROUND[groundName]}
            bottom="inset"
            footer={
              <View style={st.column}>
                <PillButton label={GAME_COPY.continue} onPress={next} disabled={!ready} tone={groundName === 'blue' || groundName === 'coral' ? 'white' : 'ink'} />
              </View>
            }
          >
            <Pressable accessible={false} focusable={false} onPress={skip} style={st.tap}>
              <View style={st.column} onLayout={onColumn}>
                <Stage key={mode} card={card} view={view} final={final} reduced={reduced} reached={reached} width={columnWidth} height={stageHeight(dims.width, dims.height)} />
                <Words key={mode} view={view} timeline={timeline} final={final} reached={reached} ink={ink} soft={soft} titleRef={title} />
              </View>
            </Pressable>
          </ScrollScreen>
        </View>
      </Enter>
    </Modal>
  );
}

/** The number, the title, the lines and the "Also today" rows, each arriving on its beat. */
function Words({
  view,
  timeline,
  final,
  reached,
  ink,
  soft,
  titleRef,
}: {
  view: CardView;
  timeline: Timeline;
  final: boolean;
  reached: (element: string) => boolean;
  ink: string;
  soft: string;
  titleRef: { current: Text | null };
}) {
  const swapping = view.titleBefore !== null && !reached('title');
  const shownTitle = swapping ? view.titleBefore! : view.title;
  const linesAt = final ? 0 : beatAt(timeline, 'lines');

  const hero = view.hero === null ? null : (
    <View accessible accessibilityLabel={`${view.hero.value} ${view.hero.unit}`} style={st.hero}>
      <Text style={[type.hero, { color: ink }]}>{view.hero.value}</Text>
      <Text style={[type.title, st.unit, { color: ink }]}>{view.hero.unit}</Text>
    </View>
  );

  const heading = (
    <Text
      ref={titleRef}
      accessibilityRole="header"
      accessibilityLabel={view.title}
      // The web moves focus only to something focusable; -1 keeps it out of the tab order, as the Sheet's title does.
      {...(Platform.OS === 'web' ? ({ tabIndex: -1 } as object) : {})}
      style={[type.title, st.centre, { color: ink }]}
    >
      {shownTitle}
    </Text>
  );

  const lines = [
    ...view.lines.map((line) => (
      <Text key={`line:${line}`} style={[type.body, st.centre, { color: soft }]}>
        {line}
      </Text>
    )),
    ...(view.rows.length > 0
      ? [
          <View key="also" style={st.also}>
            <Text style={[type.label, st.centre, { color: ink }]}>{GAME_COPY.endCard.alsoToday}</Text>
            {view.rows.map((row) => (
              <Text key={`row:${row}`} style={[type.body, st.centre, { color: soft }]}>
                {row}
              </Text>
            ))}
          </View>,
        ]
      : []),
  ];

  if (final) {
    return (
      <View style={st.words}>
        {hero}
        {heading}
        {lines}
      </View>
    );
  }
  return (
    <View style={st.words}>
      {hero !== null && (
        <Enter delay={beatAt(timeline, 'number')} distance={24}>
          {hero}
        </Enter>
      )}
      <Enter key={shownTitle} distance={swapping || view.titleBefore === null ? 10 : 24}>
        {heading}
      </Enter>
      {lines.length > 0 && <StaggerIn delay={linesAt}>{lines}</StaggerIn>}
    </View>
  );
}

const st = StyleSheet.create({
  fill: { flex: 1 },
  tap: { flexGrow: 1 },
  column: { width: '100%', maxWidth: COLUMN_MAX, alignSelf: 'center' },
  words: { alignItems: 'stretch', gap: space(3), paddingTop: space(4), paddingBottom: space(6) },
  hero: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'center', columnGap: space(2) },
  unit: { paddingBottom: space(1.5) },
  centre: { textAlign: 'center' },
  also: { gap: space(1), marginTop: space(3) },
});
