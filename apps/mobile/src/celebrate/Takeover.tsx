/**
 * The one frame every full-screen celebration shares (motion-sound sections 4.3
 * and 5).
 *
 * - Modal to assistive technology and to the hardware back button: a screen
 *   reader stays inside it and focus moves to its title, whose label is the
 *   title and the main value, so landing there says the whole moment. A
 *   separate announcement would be cut off by that, so the moment is announced
 *   only where focus has nowhere to land. The title never changes under a
 *   screen reader, and focus is placed again whenever the words are redrawn.
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
 *   lands the card on its final frame and keeps it there; it never replays,
 *   and a card a hold or a skip landed before it started makes no sound.
 * - The stage and the words remount under keys of their own when the card
 *   turns final, so nothing from the playing frame is left behind.
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
import { colour, decorative, onColour, paper, space, textOn, type } from '../theme.ts';
import type { TakeoverType } from './events.ts';
import { cardView, shownTitle, type CardGround, type CardView } from './cardView.ts';
import { fireBeat, fireStill, stopEffects } from './effects.ts';
import type { TakeoverCard } from './queue.ts';
import { BadgeEarned } from './templates/BadgeEarned.tsx';
import { LevelUp } from './templates/LevelUp.tsx';
import { PurchaseConfirmed } from './templates/PurchaseConfirmed.tsx';
import { QuestChest } from './templates/QuestChest.tsx';
import type { StageProps } from './templates/stage.tsx';
import { StreakExtended } from './templates/StreakExtended.tsx';
import { StreakMilestone } from './templates/StreakMilestone.tsx';
import { TIMELINES, beatAt, playsStill, type Timeline } from './timelines.ts';
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
    still: playsStill({ reduced, stopped: landed || paused }),
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

  const groundName = view.ground;
  const { ink, soft } = inks(groundName);
  const reached = (element: string): boolean => final || elapsed >= beatAt(timeline, element);
  // Only a level card has a title beat; asking any other timeline for one would throw.
  const shown = shownTitle(view, { titleReached: view.titleBefore === null || reached('title'), screenReader: reader });
  const Stage = STAGES[card.type];
  const mode = final ? 'final' : 'play';

  const title = useRef<Text>(null);
  /** Moves a screen reader to the title. False when there is nothing there to move it to. */
  const focusTitle = (): boolean => {
    if (Platform.OS === 'web') {
      const node = title.current as unknown as { focus?: () => void } | null;
      if (typeof node?.focus !== 'function') return false;
      node.focus();
      return true;
    }
    const handle = findNodeHandle(title.current);
    if (!handle) return false;
    AccessibilityInfo.setAccessibilityFocus(handle);
    return true;
  };
  const announced = useRef(false);
  useEffect(() => {
    // The title enters over DUR.base; focus lands once it is there to land on. The words
    // remount when the card turns final or its title changes, so focus is placed again then.
    const timer = setTimeout(() => {
      if (focusTitle() || announced.current) return;
      announced.current = true;
      AccessibilityInfo.announceForAccessibility(view.announce);
    }, DUR.base);
    return () => clearTimeout(timer);
  }, [mode, shown, view.announce]);

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
                <Stage key={`stage:${mode}`} card={card} view={view} final={final} reduced={reduced} reached={reached} width={columnWidth} height={stageHeight(dims.width, dims.height)} />
                <Words key={`words:${mode}`} view={view} shown={shown} timeline={timeline} final={final} ink={ink} soft={soft} titleRef={title} />
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
  shown,
  timeline,
  final,
  ink,
  soft,
  titleRef,
}: {
  view: CardView;
  /** The title as it reads this instant (`shownTitle`). */
  shown: string;
  timeline: Timeline;
  final: boolean;
  ink: string;
  soft: string;
  titleRef: { current: Text | null };
}) {
  const swapping = shown !== view.title;
  const linesAt = final ? 0 : beatAt(timeline, 'lines');

  // Hidden from assistive technology: the title's label already says the value.
  const hero = view.hero === null ? null : (
    <View {...decorative} style={st.hero}>
      <Text style={[type.hero, { color: ink }]}>{view.hero.value}</Text>
      <Text style={[type.title, st.unit, { color: ink }]}>{view.hero.unit}</Text>
    </View>
  );

  const heading = (
    <Text
      ref={titleRef}
      accessibilityRole="header"
      // The title and the main value, so wherever focus lands on it the whole moment is heard.
      accessibilityLabel={view.announce}
      // The web moves focus only to something focusable; -1 keeps it out of the tab order, as the Sheet's title does.
      {...(Platform.OS === 'web' ? ({ tabIndex: -1 } as object) : {})}
      style={[type.title, st.centre, { color: ink }]}
    >
      {shown}
    </Text>
  );

  // Keyed by place as well as words: a row can join the last card while it shows, and two may read alike.
  const lines = [
    ...view.lines.map((line, i) => (
      <Text key={`line:${i}:${line}`} style={[type.body, st.centre, { color: soft }]}>
        {line}
      </Text>
    )),
    ...(view.rows.length > 0
      ? [
          <View key="also" style={st.also}>
            <Text style={[type.label, st.centre, { color: ink }]}>{GAME_COPY.endCard.alsoToday}</Text>
            {view.rows.map((row, i) => (
              <Text key={`row:${i}:${row}`} style={[type.body, st.centre, { color: soft }]}>
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
      <Enter key={shown} distance={swapping || view.titleBefore === null ? 10 : 24}>
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
