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
 * - Cloud (`listening`) is drawn only while live: Cloud appears at moments,
 *   never on the question. It squishes to the same level with `LevelSquish`.
 *   It sits in a slot above the circle that is kept whether or not it shows,
 *   so the mic never moves when it comes and goes (the board draws it at
 *   96 wide over the mic). Decorative and untouchable.
 * - Reduced motion: `LevelSquish` holds Cloud still and the ring keeps its
 *   static opacity steps, both inside the primitives.
 */
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Cloud } from '../art/mascots/Cloud.tsx';
import { LevelRing } from '../motion/LevelRing.tsx';
import { LevelSquish } from '../motion/MascotMotion.tsx';
import { decorative } from '../theme.ts';
import type { useRecorderLevel } from '../speech/useRecorderLevel.ts';

/** Cloud over a live mic, as wide as the board draws it. */
const CLOUD = 96;
/** The slot Cloud sits in, kept while the mic is at rest. */
const CLOUD_SLOT = Math.round(CLOUD * 0.7) + 10;

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
        {live && (
          <LevelSquish level={voice.metered ? voice.level : null} on={live} height={CLOUD * 0.7}>
            <Cloud expression="listening" size={CLOUD} />
          </LevelSquish>
        )}
      </View>
      {mic}
    </View>
  );
}

const st = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  column: { alignItems: 'center' },
  slot: { height: CLOUD_SLOT, justifyContent: 'flex-end', alignItems: 'center' },
});
