/**
 * The end of a finished sitting, in place on the page that ran it (README
 * Part 6; motion-sound 5.2 as an end scene, never a takeover; drill-b.md,
 * Screens and states 10). Dark aware: every colour is `useB()`'s.
 *
 * Scene mode (every practice end): a soft lavender band with Cloud and Toast,
 * the title and its sub line, up to three stat tiles on the shared `LipTile`
 * chrome (`game/TodayStatTiles.tsx`'s `Tile`: coin, a 24/800 number counting
 * up with `CountUp`, one word), the goal ring, the quests, then the phrase list
 * with Hear it and each phrase's dot and its word, "Settled" or "Still settling" (LEARN-018).
 * Tiles mode (a lesson's or a daily phrase's end): the tiles, goal and quests
 * under the kicker and line, with no band, so the page keeps its own heading.
 *
 * Numbers come only from a GameDelta that `game/settle.ts` read back from disk
 * (`endCardModel.ts`). With a delta the scene celebrates: it holds the queue
 * while it is on screen and lets go the hold its screen took before settling
 * (`release`, F766), sounds `complete` and gives one `celebrate()` once per
 * sitting, throws the confetti in the band and counts its tiles up. On the
 * sitting that finished the day's third quest the quiet line "All three quests
 * done today." lands with the `quest` sound (D22). Under reduced motion it is
 * drawn finished at once, numbers at their value, its sound and haptic played
 * once. A scene that mounts again for the same sitting is drawn finished and
 * stays silent.
 *
 * Without a delta (a save that is not safe, a retry's end, a settle that never
 * answered) it is calm: Cloud at rest, no confetti, no tile, no sound. The
 * confetti is only ever a celebrated scene's, so it never falls on "Practice
 * was not saved on this phone." nor on a retry's end (LEARN-018).
 *
 * The actions are `EndActions`, pinned in the screen's footer so the primary
 * is always in reach on a small phone.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Cloud, CloudLids } from '../art/mascots/Cloud.tsx';
import { CLOUD_VIEWBOX } from '../art/mascots/mascotFaces.ts';
import { CLOUD_POSES } from '../art/mascots/mascotPoses.ts';
import { Toast as ToastMascot } from '../art/mascots/Toast.tsx';
import { EarGlyph, GhostButton, PillButton } from '../components.tsx';
import { FreezeMark } from '../game/art/FreezeMark.tsx';
import type { GameDelta } from '../game/delta.ts';
import { Tile } from '../game/TodayStatTiles.tsx';
import { STAT_GAP, statCoins, statRowTileWidth, statTileLayout, type StatTileLayout } from '../game/todayHeroView.ts';
import { Icon } from '../icons/Icon.tsx';
import { useB, useThemedStyles, type B } from '../main/bTheme.tsx';
import { useReduceMotion } from '../motion.ts';
import { CountUp } from '../motion/CountUp.tsx';
import { Blink } from '../motion/MascotMotion.tsx';
import { useAnswered } from '../motion/landing.ts';
import { Enter } from '../motion/layout.tsx';
import { ProgressRing } from '../motion/ProgressRing.tsx';
import { StaggerIn } from '../motion/StaggerIn.tsx';
import { DUR, STAGGER } from '../motion/tokens.ts';
import { SETTLED_LABEL, STILL_SETTLING_LABEL } from '../practice/stillSettling.ts';
import * as tutorVoice from '../speech/tutorVoice.ts';
import { scopeGeneration } from '../storage/scope.ts';
import { HIT, bType, decorative, radius, space, type, corner } from '../theme.ts';
import { StarMark } from '../today/TodayParts.tsx';
import { Confetti } from './Confetti.tsx';
import { countTick, fireBeat, fireStill } from './effects.ts';
import { endCardView, tileText, type EndCardView, type EndTile } from './endCardModel.ts';
import type { EndPhrase } from './endPhrases.ts';
import { claimInPlace, holdCelebrations } from './queue.ts';
import { TIMELINES, beatAt, playsStill } from './timelines.ts';
import { useLatch, useTimeline } from './useTimeline.ts';

/** The scene band (board `.scene`: 168 high, 28 radius). The confetti flies in it. */
const BAND = 168;
const CLOUD = 104;
/**
 * The posed cheer's box: its body as big as the face-only 104, since the
 * cheer box is wider than the unposed body's (mascotPoses.ts, mascotFaces.ts).
 */
const POSED = Math.round((CLOUD * CLOUD_POSES.cheer.viewBox.width) / CLOUD_VIEWBOX.width);
const TOAST = 64;
const SUN = 110;
const RING = 56;
const COIN_ICON = 18;
const HEAR = 44;
const DOT = 10;
/** The page margins the tile row sits in, for the first frame before it measures itself. */
const ROW_MARGINS = space(8);
const noop = () => {};

interface SceneWords {
  /** The scene's title; null in tiles mode, where the kicker and line stand. */
  readonly title?: string | null;
  readonly sub?: string | null;
  readonly phrases?: readonly EndPhrase[];
  /** Tiles mode: no band and no title, for a page with its own heading. */
  readonly tilesOnly?: boolean;
  /** Anything the page says under the sub line: a "Retry save", a held-back row. */
  readonly children?: ReactNode;
}

export function EndScene({
  delta = null,
  count = null,
  countOf = null,
  tutorName = null,
  release,
  ...words
}: SceneWords & {
  /** What the sitting changed, from `game/settle.ts`; null draws the calm scene. */
  delta?: GameDelta | null;
  /** The screen's own count for this sitting (lines said, answers right), or null for none. */
  count?: number | null;
  /** The count's whole ("4/5"), or null to draw the count alone. */
  countOf?: number | null;
  /** The chosen tutor's name, for a quest title that names them. */
  tutorName?: string | null;
  /**
   * The hold the screen took on the queue before it settled this sitting
   * (F766): settle publishes before this scene can mount, so the screen holds
   * first and hands the hold over here, and the scene lets it go when it goes.
   */
  release?: () => void;
}) {
  if (delta === null) return <Body view={null} final reached={() => true} width={0} onLayout={noop} band={null} counting={false} first={false} {...words} />;
  return <Celebrated delta={delta} count={count} countOf={countOf} tutorName={tutorName} release={release} {...words} />;
}

function Celebrated({ delta, count, countOf, tutorName, release, ...words }: SceneWords & {
  delta: GameDelta;
  count: number | null;
  countOf: number | null;
  tutorName: string | null;
  release?: () => void;
}) {
  const view = useMemo(() => endCardView(delta, { count, countOf, tutorName }), [delta, count, countOf, tutorName]);
  const timeline = TIMELINES[view.timeline];
  const answered = useAnswered(useReduceMotion(true));
  const reduced = answered === true;
  // Once per sitting: a scene that mounts again for the same sitting is drawn finished, silently.
  const [first] = useState(() => claimInPlace(`${scopeGeneration()}:${delta.key}`));
  // Once final, always final: turning Reduce Motion off mid-scene never replays it.
  const final = useLatch(reduced || !first);

  // The queue waits while the learner is reading this.
  useEffect(() => holdCelebrations(), []);
  // The hold the screen took before it settled goes with the scene, never
  // before it (F766).
  const handed = useRef(release);
  useEffect(() => {
    handed.current = release;
  });
  useEffect(() => () => handed.current?.(), []);

  const elapsed = useTimeline(timeline, {
    ready: answered !== null,
    final,
    // A scene mounted again for the same sitting is drawn finished, and was heard the first time.
    still: playsStill({ reduced, stopped: !first }),
    onCue: first ? fireBeat : noop,
    onStill: first ? () => fireStill(timeline) : noop,
    onEnd: noop,
  });
  const reached = (element: string): boolean => final || elapsed >= beatAt(timeline, element);

  const [width, setWidth] = useState(0);
  const onLayout = (event: LayoutChangeEvent) => setWidth(Math.round(event.nativeEvent.layout.width));

  const band = (
    <Confetti
      seed={delta.key}
      started={reached('burst')}
      final={final}
      reduced={reduced}
      width={width}
      height={BAND}
      count={36}
      palette={['blue', 'sun', 'coral', 'paper']}
    />
  );
  return (
    <Body
      view={view}
      final={final}
      reached={reached}
      width={width}
      onLayout={onLayout}
      band={band}
      counting={reached('tiles')}
      first={first}
      lineAt={beatAt(timeline, 'line')}
      tilesAt={beatAt(timeline, 'tiles')}
      goalAt={beatAt(timeline, 'goal')}
      rowsAt={beatAt(timeline, 'rows')}
      {...words}
    />
  );
}

function Body({
  view,
  final,
  width,
  onLayout,
  band,
  counting,
  first,
  lineAt = 0,
  tilesAt = 0,
  goalAt = 0,
  rowsAt = 0,
  title = null,
  sub = null,
  phrases = [],
  tilesOnly = false,
  children,
}: SceneWords & {
  view: EndCardView | null;
  final: boolean;
  reached: (element: string) => boolean;
  width: number;
  onLayout: (event: LayoutChangeEvent) => void;
  /** The confetti, only on a celebrated scene. */
  band: ReactNode;
  counting: boolean;
  first: boolean;
  lineAt?: number;
  tilesAt?: number;
  goalAt?: number;
  rowsAt?: number;
}) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  const { width: windowWidth, fontScale } = useWindowDimensions();
  const celebrated = view !== null;

  const viewTiles = view?.tiles ?? [];
  // The figures and their words both have to fit beside the coin whole, or the tiles stack ("Remembered" never breaks).
  const layout = statTileLayout(statRowTileWidth(width > 0 ? width : windowWidth - ROW_MARGINS), fontScale, viewTiles.flatMap((tile) => [tileText(tile, tile.value), tile.label]));
  const tiles = viewTiles.map((tile: EndTile): SceneTile => ({
    id: tile.id,
    coin: tile.id === 'xp' ? 'xp' : tile.id === 'time' ? 'time' : 'count',
    to: tile.value,
    format: (value) => tileText(tile, value),
    word: tile.label,
    tick: tile.id === 'xp' && first ? 'both' : 'none',
  }));

  const goal =
    view === null || view.goal === null ? null : (
      <View style={s.goal}>
        <ProgressRing
          from={final ? view.goal.to : view.goal.from}
          to={view.goal.to}
          size={RING}
          stroke={6}
          color={t.mint}
          track={t.ring}
          duration={DUR.reveal}
          delay={final ? 0 : goalAt}
        />
        <Text style={[type.bodyStrong, s.grow, { color: t.text }]}>{view.goal.line}</Text>
      </View>
    );

  const rows =
    view === null
      ? []
      : [
          ...view.quests.map((quest) => (
            <Text key={`quest:${quest}`} style={[type.body, { color: t.text }]}>
              {quest}
            </Text>
          )),
          ...(view.questProgress !== null
            ? [
                <Text key="quests" style={[type.small, { color: t.muted }]}>
                  {view.questProgress}
                </Text>,
              ]
            : []),
          // Board A: settle read this sitting's banked freeze back.
          ...(view.banked !== null
            ? [
                <View key="banked" style={s.banked}>
                  <FreezeMark size={22} />
                  <Text style={[type.bodyStrong, s.grow, { color: t.text }]}>{view.banked}</Text>
                </View>,
              ]
            : []),
          ...(view.capLine !== null
            ? [
                <Text key="cap" style={[type.small, { color: t.muted }]}>
                  {view.capLine}
                </Text>,
              ]
            : []),
        ];

  const heading = tilesOnly
    ? view !== null && (
        <View style={s.words}>
          <Text style={[type.label, { color: t.text }]}>{view.kicker}</Text>
          <Text style={[bType.leadTitle, { color: t.text }]}>{view.line}</Text>
        </View>
      )
    : (title ?? view?.line ?? null) !== null && (
        <View style={s.words}>
          <Text accessibilityRole="header" style={[bType.leadTitle, { color: t.text }]}>{title ?? view?.line}</Text>
          {sub !== null && <Text style={[bType.para15, { color: t.muted }]}>{sub}</Text>}
        </View>
      );

  return (
    <View style={s.scene} onLayout={onLayout}>
      {!tilesOnly && <SceneBand mood={celebrated ? 'cheer' : 'idle'} cloud="face" confetti={band} />}
      {final || !celebrated ? heading : <Enter delay={lineAt}>{heading}</Enter>}
      {children}
      <SceneTiles tiles={tiles} layout={layout} final={final} counting={counting} tilesAt={tilesAt} />
      {goal}
      {rows.length > 0 &&
        (final ? (
          <View style={s.rows}>{rows}</View>
        ) : (
          <View style={s.rows}>
            <StaggerIn delay={rowsAt}>{rows}</StaggerIn>
          </View>
        ))}
      {phrases.length > 0 && (
        <View>
          {phrases.map((phrase) => (
            <PhraseRow key={phrase.phraseKey} phrase={phrase} />
          ))}
        </View>
      )}
    </View>
  );
}

/**
 * How the band draws Cloud: `face`, a drill end's face-only Cloud; `posed`, the
 * recap's cheer pose after any reply; `resting`, the recap's idle Cloud that
 * blinks when there was no reply (UI-020, Q1 and Q2).
 */
export type SceneCloud = 'face' | 'posed' | 'resting';

/** The scene band: lavender, the sun, the hill, Cloud and Toast, and the confetti and postcard slots. */
export function SceneBand({ mood, cloud, confetti = null, postcard = null }: {
  /** The faces' mood; Toast always wears it, and so does the face-only Cloud. */
  mood: 'cheer' | 'idle';
  cloud: SceneCloud;
  /** The confetti, only on a celebrated scene. */
  confetti?: ReactNode;
  /** A postcard top right over the sun, turned a little and shown at about 60pt; empty unless given. */
  postcard?: ReactNode;
}) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <View {...decorative} style={[s.band, { backgroundColor: t.lavender }]}>
      <View style={[s.sun, { backgroundColor: t.sun }]} />
      <Svg {...decorative} width="100%" height={BAND} viewBox={`0 0 312 ${BAND}`} preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
        <Path d="M0 150C60 130 120 140 170 150C220 160 270 150 312 140V168H0Z" fill={t.lavenderSoft} />
      </Svg>
      {postcard !== null && <View style={s.postcard}>{postcard}</View>}
      {cloud === 'posed' ? (
        <View style={s.posed}>
          <Cloud pose="cheer" ink={t.text} size={POSED} outline />
        </View>
      ) : (
        <View style={s.cloud}>
          {cloud === 'resting' ? (
            <Blink active lids={<CloudLids size={CLOUD} />}>
              <Cloud expression="idle" size={CLOUD} outline />
            </Blink>
          ) : (
            <Cloud expression={mood} size={CLOUD} outline />
          )}
        </View>
      )}
      <View style={s.toast}>
        <ToastMascot expression={mood} size={TOAST} />
      </View>
      {confetti !== null && <View style={s.confetti}>{confetti}</View>}
    </View>
  );
}

/** One stat tile: its coin (level star, goal clock, streak check), the number it counts to, its words. */
export interface SceneTile {
  readonly id: string;
  readonly coin: 'xp' | 'time' | 'count';
  readonly to: number;
  readonly format: (value: number) => string;
  readonly word: string;
  /** The count-up's tick; none unless the caller asks for one. */
  readonly tick?: 'both' | 'none';
}

/** The stat tiles on the shared `Tile`, counting up from `tilesAt` once `counting`, or drawn finished when `final`. */
export function SceneTiles({ tiles: items, layout, final, counting, tilesAt = 0 }: {
  tiles: readonly SceneTile[];
  /** `statTileLayout` for these tiles' words at the row's width. */
  layout: StatTileLayout;
  final: boolean;
  counting: boolean;
  tilesAt?: number;
}) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  const coins = statCoins(t);
  const number = [bType.stat24, { color: t.text }];
  const coin = (tile: SceneTile): ReactNode => {
    if (tile.coin === 'xp') return <View style={[s.coin, { backgroundColor: coins.level }]}><StarMark size={COIN_ICON} fill={t.sun} stroke={t.sunDeep} /></View>;
    if (tile.coin === 'time') return <View style={[s.coin, { backgroundColor: coins.goal }]}><Icon name="clock" variant="bulk" size={COIN_ICON} color={t.text} /></View>;
    return <View style={[s.coin, { backgroundColor: coins.streak }]}><Icon name="check" size={COIN_ICON} color={t.text} /></View>;
  };
  const tiles = items.map((tile) => (
    <Tile
      key={tile.id}
      layout={layout}
      lip={t.line}
      label={`${tile.format(tile.to)}, ${tile.word}`}
      coin={coin(tile)}
      number={
        <CountUp
          from={final ? tile.to : 0}
          to={counting || final ? tile.to : 0}
          format={tile.format}
          tick={tile.tick ?? 'none'}
          onSoundTick={countTick}
          label={tile.format(tile.to)}
          textStyle={number}
        />
      }
      word={tile.word}
    />
  ));
  if (tiles.length === 0) return null;
  return final ? (
    <View style={layout === 'rows' ? s.column : s.tiles}>
      {tiles}
    </View>
  ) : (
    <View style={layout === 'rows' ? s.column : s.tiles}>
      <StaggerIn step={STAGGER.tiles} delay={tilesAt} itemStyle={layout === 'rows' ? undefined : s.tileSlot}>
        {tiles}
      </StaggerIn>
    </View>
  );
}

/** One phrase: Hear it, the French, and its mark under it (LEARN-018). */
function PhraseRow({ phrase }: { phrase: EndPhrase }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  const settled = phrase.mark === 'settled';
  const fr = phrase.fr;
  return (
    <View style={[s.phrase, { borderBottomColor: t.line }]}>
      {fr !== null ? (
        <Pressable
          onPress={() => tutorVoice.speak(fr)}
          accessibilityRole="button"
          accessibilityLabel={`Hear it in French: ${fr}`}
          style={({ pressed }) => [s.hear, { backgroundColor: t.inset }, pressed && s.pressed]}
        >
          <EarGlyph size={18} color={t.text} />
        </Pressable>
      ) : (
        <View style={s.hearGap} />
      )}
      <View style={s.grow}>
        {fr !== null && <Text style={[bType.bold15, { color: t.text }]}>{fr}</Text>}
        <View style={s.mark} accessible accessibilityLabel={settled ? SETTLED_LABEL : STILL_SETTLING_LABEL}>
          <View style={[s.dot, { backgroundColor: settled ? t.mint : t.sun }]} />
          <Text style={[bType.bold11, { color: t.muted }]}>{settled ? SETTLED_LABEL : STILL_SETTLING_LABEL}</Text>
        </View>
      </View>
    </View>
  );
}

/**
 * The end's actions, for the screen's footer: the retry (LEARN-018) as the
 * lip primary with Done as a link under it, or Done as the lip primary when
 * there is nothing to retry.
 */
export function EndActions({ retry = null, done }: {
  /** `retryButtonLabel`'s words and the press, or null when nothing is still settling. */
  retry?: { label: string; onPress: () => void } | null;
  done: { label: string; onPress: () => void };
}) {
  const s = useThemedStyles(makeStyles);
  if (retry === null) return <PillButton label={done.label} onPress={done.onPress} lip />;
  return (
    <View style={s.actions}>
      <PillButton label={retry.label} onPress={retry.onPress} lip />
      <View style={s.doneLink}>
        <GhostButton label={done.label} onPress={done.onPress} />
      </View>
    </View>
  );
}

const makeStyles = (_t: B) =>
  StyleSheet.create({
    scene: { gap: space(3.5) },
    band: { height: BAND, ...corner.card, overflow: 'hidden' },
    sun: { position: 'absolute', right: -24, top: -24, width: SUN, height: SUN, borderRadius: SUN / 2 },
    cloud: { position: 'absolute', left: '14%', top: 56 },
    // The cheer box is 22 of 304 units wider on the left and 20 taller on top than the body, so this keeps the body where the face-only Cloud stands, with the raised arms and stars inside the band.
    posed: { position: 'absolute', left: '14%', top: 48, marginLeft: -9 },
    // Top right over the sun, clear of Cloud's stars and Toast's face, its stamp ring inside the band; the 72pt tile drawn at 60.
    postcard: { position: 'absolute', right: 22, top: 12, width: 72, height: 72, transform: [{ rotate: '5deg' }, { scale: 60 / 72 }] },
    toast: { position: 'absolute', left: '58%', top: 82 },
    confetti: { ...StyleSheet.absoluteFill, pointerEvents: 'none' },
    words: { gap: space(0.5) },
    tiles: { flexDirection: 'row', gap: STAT_GAP },
    column: { gap: STAT_GAP + space(1) },
    tileSlot: { flex: 1, minWidth: 0 },
    coin: { width: 32, height: 32, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
    goal: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
    grow: { flex: 1, minWidth: 0 },
    rows: { gap: space(1.5) },
    banked: { flexDirection: 'row', alignItems: 'center', gap: space(2.5) },
    phrase: { flexDirection: 'row', alignItems: 'center', gap: space(2.5), minHeight: HIT + space(1.5), paddingVertical: space(1.5), borderBottomWidth: StyleSheet.hairlineWidth },
    hear: { width: HEAR, height: HEAR, borderRadius: HEAR / 2, alignItems: 'center', justifyContent: 'center' },
    hearGap: { width: HEAR },
    pressed: { opacity: 0.6 },
    mark: { flexDirection: 'row', alignItems: 'center', gap: space(1.5), marginTop: space(0.5) },
    dot: { width: DOT, height: DOT, borderRadius: DOT / 2 },
    actions: { gap: space(0.5) },
    doneLink: { alignItems: 'center' },
  });
