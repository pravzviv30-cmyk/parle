/**
 * The one mic of the speak family (drill B v2, UI-016; drill-b.md "Screens
 * and states" 5): the caller's `SpeakCircle` inside a `LevelRing` that follows
 * the recorder's real level, and, on speak drills, Cloud listening beside it.
 *
 * Presentation only. The caller keeps its recorder, its circle and the
 * circle's labels; this draws what goes around them.
 *
 * - The ring is drawn only while live and only once the recorder has metered a
 *   real level (`useRecorderLevel`), so no level is made up.
 * - Cloud, in its `listen` pose (a hand to the ear), is drawn only while live,
 *   never on the question; it is part of the mic, not a moment. It squishes to
 *   the same level with `LevelSquish`, and blinks inside it, so the lids scale
 *   with the face. Its limbs take the screen's text colour, so they show in
 *   dark mode. It sits in a slot above the circle, kept at the 77 it had
 *   before poses whether or not it shows, so the mic never moves; Cloud draws
 *   as wide as its posed box allows at that height. Say it aloud's answer
 *   area has the room for 116 wide, which draws the body about as big as the
 *   board's 96. Decorative and untouchable.
 * - Reduced motion: `LevelSquish` holds Cloud still and the ring keeps its
 *   static opacity steps, both inside the primitives.
 */
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Cloud, CloudLids } from '../art/mascots/Cloud.tsx';
import { CLOUD_POSES } from '../art/mascots/mascotPoses.ts';
import { useB } from '../main/bTheme.tsx';
import { LevelRing } from '../motion/LevelRing.tsx';
import { Blink, LevelSquish } from '../motion/MascotMotion.tsx';
import { decorative } from '../theme.ts';
import type { useRecorderLevel } from '../speech/useRecorderLevel.ts';


/** The listening Cloud's box where there is room: its body as big as the board's 96. */
const CLOUD = 116;
/** The slot over the mic, kept while the mic is at rest: the height it had before poses. */
const SLOT = 77;
/** Cloud in that slot, as wide as its posed box allows at that height. */
const SLOT_CLOUD = Math.floor((SLOT * CLOUD_POSES.listen.viewBox.width) / CLOUD_POSES.listen.viewBox.height);

export function SpeakMic({
  live,
  voice,
  size,
  ring,
  cloud = false,
  children,
}: {
  /** The microphone is on. */
  live: boolean;
  /** The recorder's live level (`useRecorderLevel`). */
  voice: ReturnType<typeof useRecorderLevel>;
  /** The circle's diameter, which the ring matches. */
  size: number;
  /** The ring's colour. */
  ring: string;
  /** Cloud listens beside the mic while live (speak drills). */
  cloud?: boolean;
  /** The `SpeakCircle`, with its own labels. */
  children: ReactNode;
}) {
  const mic = (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {live && voice.metered && (
        <View style={st.fill} pointerEvents="none">
          <LevelRing level={voice.level} size={size} color={ring} />
        </View>
      )}
      {children}
    </View>
  );
  if (!cloud) return mic;
  return (
    <View style={st.column}>
      <View {...decorative} pointerEvents="none" style={st.slot}>
        <ListeningCloud live={live} voice={voice} size={SLOT_CLOUD} />
      </View>
      {mic}
    </View>
  );
}

/**
 * Cloud listening, drawn only while `live`, squishing to the heard level and
 * blinking inside the squish so the lids scale with the face. Limbs in the
 * screen's text colour. Say it aloud draws it in its answer area; SpeakMic's
 * slot draws it over the mic for the other speak drills.
 */
export function ListeningCloud({ live, voice, size = CLOUD }: { live: boolean; voice: ReturnType<typeof useRecorderLevel>; size?: number }) {
  const { text } = useB();
  if (!live) return null;
  return (
    <LevelSquish level={voice.metered ? voice.level : null} on={live} height={Math.ceil((size * CLOUD_POSES.listen.viewBox.height) / CLOUD_POSES.listen.viewBox.width)}>
      <Blink active={live} lids={<CloudLids pose="listen" size={size} />}>
        <Cloud pose="listen" size={size} ink={text} />
      </Blink>
    </LevelSquish>
  );
}

const st = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  column: { alignItems: 'center' },
  slot: { height: SLOT, justifyContent: 'flex-end', alignItems: 'center' },
});
