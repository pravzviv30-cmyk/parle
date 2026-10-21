/**
 * The scene is complete, said once, in place (come alive, core loop 2.8).
 *
 * The card sits where the support card would have been, so the screen keeps
 * its shape, and it carries the mission's own sentence about what the learner
 * did: a fact they can check, never praise, no score and no number. Above it
 * the kicker names the moment ("Scene complete") and the scene's own drawing
 * rises in on the scene's blue, a mint glow opening behind it, and a burst of
 * confetti leaves the card's top edge. The beats are `SCENE_WON_BEATS`.
 *
 * One primary action. "Keep talking" is the pill because the session is still
 * running underneath the card and carrying on is the cheaper of the two
 * decisions to get wrong; the line under it says plainly that it uses minutes,
 * so continuing is chosen and never assumed. Leaving is the ghost, and the
 * header's end control still works, as it must in any metered room. Both work
 * from the first frame: nothing here holds a tap.
 *
 * Silent and still to the touch: no sound and no haptic, because a live room
 * holds the learner's ears (decision D8); the fanfare waits for the recap.
 * Reduce Motion shows the card in place at once, with no glow and no confetti,
 * watched live. A card that mounts again for the same scene (a reconnect under
 * it) is drawn in place too. On a short screen or at a large text size the
 * drawing stays out, so the two doors never leave the screen.
 */

import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';

import type { IllustrationName } from '../art/flat/index.ts';
import { Illustration } from '../art/flat/Illustration.tsx';
import { claimInPlace } from '../celebrate/queue.ts';
import { useLatch } from '../celebrate/useTimeline.ts';
import { Card, GhostButton, PillButton, fitDisplay } from '../components.tsx';
import { useReduceMotion } from '../motion.ts';
import { Burst } from '../motion/Burst.tsx';
import { DiscBloom } from '../motion/DiscBloom.tsx';
import { useAnswered } from '../motion/landing.ts';
import { Enter } from '../motion/layout.tsx';
import { DUR } from '../motion/tokens.ts';
import { scopeGeneration } from '../storage/scope.ts';
import { colour, radius, space, type } from '../theme.ts';
import { SCENE_WON_BEATS, SCENE_WON_BURST, type WinCard } from './missionWin.ts';
import { useB } from '../main/bTheme.tsx';

/** The drawing's height on the card. Small: the card shares the room with the thread. */
const ART_HEIGHT = 110;
/** Below this window height, or from this text size, the drawing stays out. */
const ART_MIN_WINDOW = 700;
const ART_MAX_FONT_SCALE = 1.3;

export function MissionWin({
  card,
  art,
  momentKey,
  onKeep,
  onFinish,
}: {
  card: WinCard;
  /** The scene's place drawing, or null. */
  art: IllustrationName | null;
  /** The session and scene this card belongs to, so it plays once. */
  momentKey: string;
  onKeep: () => void;
  onFinish: () => void;
}) {
  const t = useB();
  const answered = useAnswered(useReduceMotion(true));
  const reduced = answered === true;
  const [first] = useState(() => claimInPlace(`${scopeGeneration()}:scene-won:${momentKey}`));
  // Once in place, always in place: turning Reduce Motion off never replays it.
  const final = useLatch(reduced || !first);
  const play = !final;
  const { height, fontScale } = useWindowDimensions();
  const showArt = art !== null && height >= ART_MIN_WINDOW && fontScale < ART_MAX_FONT_SCALE;

  const [width, setWidth] = useState(0);
  const measure = (event: LayoutChangeEvent) => setWidth(Math.round(event.nativeEvent.layout.width));
  const [burst, setBurst] = useState(false);
  useEffect(() => {
    if (answered === null || final) return undefined;
    const timer = setTimeout(() => setBurst(true), SCENE_WON_BEATS.burst);
    return () => clearTimeout(timer);
  }, [answered, final]);

  return (
    <View style={st.win} onLayout={measure}>
      <Enter from="down" distance={24} play={play}>
        <Card>
          <Enter delay={SCENE_WON_BEATS.kicker} play={play}>
            <Text style={[type.label, { color: t.text }]}>{card.kicker}</Text>
          </Enter>
          {showArt ? (
            // The scene's place on its own blue, as the scene is drawn
            // wherever it is chosen: the drawings are made for a colour
            // ground, and their white parts vanish on the white card.
            <View style={st.place}>
              {play ? (
                <View style={st.glow}>
                  <DiscBloom color={t.mint} radius={ART_HEIGHT * 0.75} />
                </View>
              ) : null}
              <Enter delay={SCENE_WON_BEATS.art} distance={20} scaleFrom={0.9} duration={DUR.slow} play={play}>
                <Illustration name={art} fit="small" style={st.drawing} />
              </Enter>
            </View>
          ) : null}
          <Enter delay={SCENE_WON_BEATS.line} play={play}>
            <Text accessibilityLiveRegion="polite" style={[fitDisplay(card.line), { color: t.text, textAlign: 'left', marginTop: space(2) }]}>
              {card.line}
            </Text>
          </Enter>
          <View style={st.winPrimary}>
            <PillButton label={card.keepLabel} onPress={onKeep} />
          </View>
          <Text style={[type.small, { color: t.muted, textAlign: 'left', marginTop: space(2) }]}>{card.keepSub}</Text>
          <View style={st.winSecondary}>
            <GhostButton label={card.finishLabel} onPress={onFinish} />
          </View>
        </Card>
      </Enter>
      {burst && play && width > 0 ? (
        <View style={st.confetti}>
          <Burst seed={momentKey} origin={{ x: width / 2, y: 0 }} count={SCENE_WON_BURST} />
        </View>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  // The completion card sits where the support card would have been, so the
  // screen keeps its shape and the win does not shove the thread off the top.
  win: { paddingBottom: space(3) },
  // The mint glow opens behind the drawing, on the place's blue, and passes.
  glow: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' },
  // The confetti leaves the card's top edge and flies over the thread above it.
  confetti: { ...StyleSheet.absoluteFill, pointerEvents: 'none' },
  place: {
    marginTop: space(2),
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space(2),
    backgroundColor: colour.blue,
    borderRadius: radius.tile,
    overflow: 'hidden',
  },
  // The place drawings share one 350 by 220 box, drawn here at ART_HEIGHT.
  drawing: { width: Math.round((ART_HEIGHT * 350) / 220), height: ART_HEIGHT },
  winPrimary: { marginTop: space(5), alignSelf: 'stretch' },
  winSecondary: { marginTop: space(3), alignItems: 'flex-start' },
});
