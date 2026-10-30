/**
 * The live room's dock and room menu, direction D (UI-014).
 *
 * `CloudMic` is the microphone drawn as the cloud mascot: its face says what
 * the room is doing (`cloudExpression`), a mint ring behind it moves with the
 * learner's real level while it listens, and the body squishes with that level.
 * It cheers once with two hops when a goal is reached. Under reduced motion
 * only the face changes, because a face is not motion. It makes no sound and
 * no haptic: the room stays silent.
 *
 * `RoomMenu` is the `…` sheet: the rows of `roomMenuRows`, as switches with
 * their existing labels and hints, and "Report this reply". It decides
 * nothing; every press goes back to the room.
 */

import { StyleSheet, Text, View } from 'react-native';

import { Cloud } from '../art/mascots/Cloud.tsx';
import { Press } from '../components.tsx';
import { useB, useThemedStyles, type B } from '../main/bTheme.tsx';
import { LevelRing } from '../motion/LevelRing.tsx';
import { Hop, LevelSquish } from '../motion/MascotMotion.tsx';
import { HIT, bType, decorative } from '../theme.ts';
import { HelpSheet } from './LiveParts.tsx';
import { SwitchKnob } from '../settings/SwitchKnob.tsx';
import type { CloudExpression, RoomMenuRow } from './liveRoomView.ts';
import { useOrbAudio } from './OrbAudio.tsx';

/** The cloud's drawn width, the mint ring's height, and the slot it keeps. */
export const CLOUD = { width: 116, ring: 72, slot: 120 } as const;
/** The cloud's height at `CLOUD.width`, from its drawing's viewBox (120 by 92). */
const CLOUD_HEIGHT = Math.round((CLOUD.width * 92) / 120);

export function CloudMic({ expression, label, accessibilityLabel, disabled, onPress, cheer }: {
  expression: CloudExpression;
  /** "Listening" or "Paused", drawn under the cloud. */
  label: string;
  /** "Pause microphone" or "Open microphone", the room's own names for the mic. */
  accessibilityLabel: string;
  disabled: boolean;
  onPress: () => void;
  /** Changes once per goal reached: the cloud hops twice. */
  cheer: number;
}) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  const audio = useOrbAudio();
  const listening = expression === 'listening';
  return (
    <View style={s.cloudColumn}>
      <Press haptic="none" accessibilityRole="button" accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[s.cloudHit, disabled && s.disabled]}>
        {listening && audio !== null ? (
          <View {...decorative} pointerEvents="none" style={s.cloudRing}>
            <LevelRing level={audio.input} size={CLOUD.ring} color={t.mint} />
          </View>
        ) : null}
        <Hop cue={cheer}>
          <LevelSquish level={audio?.input ?? null} on={listening} height={CLOUD_HEIGHT}>
            <Cloud expression={expression} size={CLOUD.width} outline />
          </LevelSquish>
        </Hop>
      </Press>
      <Text {...decorative} style={[bType.semi13, s.label, { color: t.text }]}>{label}</Text>
    </View>
  );
}

/** The room menu, in the Help sheet's frame. */
export function RoomMenu({ rows, onRow, onClose }: { rows: readonly RoomMenuRow[]; onRow: (row: RoomMenuRow) => void; onClose: () => void }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <HelpSheet title="This conversation" closeLabel="Close room settings" onClose={onClose}>
      <View style={s.menu}>
        {rows.map((row) => row.role === 'switch' ? (
          <Press key={row.kind} haptic="none" accessibilityRole="switch" accessibilityLabel={row.label} accessibilityHint={row.hint}
            accessibilityState={{ checked: row.checked === true }} aria-checked={row.checked === true}
            onPress={() => onRow(row)} style={s.row}>
            <View style={s.rowWords}>
              <Text style={[bType.bold16, { color: t.text }]}>{row.label}</Text>
              {row.hint ? <Text style={[bType.note, { color: t.muted }]}>{row.hint}</Text> : null}
            </View>
            <SwitchKnob value={row.checked === true} />
          </Press>
        ) : (
          <Press key={row.kind} haptic="none" accessibilityRole="button" accessibilityLabel={row.label} onPress={() => onRow(row)} style={s.row}>
            <Text style={[bType.bold16, s.rowWords, { color: t.text }]}>{row.label}</Text>
          </Press>
        ))}
      </View>
    </HelpSheet>
  );
}

function makeStyles(_t: B) {
  return StyleSheet.create({
    cloudColumn: { width: CLOUD.slot, alignItems: 'center', gap: 2 },
    cloudHit: { minWidth: HIT, minHeight: Math.max(HIT, CLOUD_HEIGHT), width: CLOUD.slot, alignItems: 'center', justifyContent: 'flex-end' },
    cloudRing: { position: 'absolute', bottom: 4, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
    label: { textAlign: 'center' },
    disabled: { opacity: 0.55 },
    menu: { gap: 4, paddingBottom: 4 },
    row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
    rowWords: { flex: 1, minWidth: 0, gap: 2 },
  });
}
