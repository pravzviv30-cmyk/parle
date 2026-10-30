/**
 * The top half of the live room, direction D (UI-014): the goal stamps under
 * the title and the tutor's portrait with its live level rings.
 *
 * Both sit on the brand blue in both themes. Pure presentation: the rules are
 * in liveRoomView.ts (`goalStamps`, `freshGoals`, `ringMode`), every colour is a
 * `useB()` token, and the movement is the motion primitives' (`LevelRing`,
 * `PopIn`, and the orb's own `OrbDashedRing` and `OrbBreathe`). Nothing here
 * makes a sound or a haptic: the room stays silent.
 */

import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import type { TutorVoiceKey } from '@luvani/core';

import { BArt } from '../art/BArt.tsx';
import { TickGlyph } from '../explore/ExploreParts.tsx';
import { useB, useThemedStyles, type B } from '../main/bTheme.tsx';
import { LevelRing } from '../motion/LevelRing.tsx';
import { PopIn } from '../motion/MascotMotion.tsx';
import { bType, decorative } from '../theme.ts';
import { OrbBreathe, OrbDashedRing } from '../tutor/OrbPortraitMotion.tsx';
import { TutorPortrait } from '../tutor/TutorPortrait.tsx';
import { tickAnnouncement } from '../tutor/taskTicks.ts';
import type { OrbState } from '../tutor/VoiceOrb.tsx';
import { freshGoals, goalStamps, goalStrip, ringMode } from './liveRoomView.ts';
import { useAppActive, useOrbAudio } from './OrbAudio.tsx';

type Goal = { id: string; goalEn: string; achieved: boolean; goalShortEn?: string };

/** The stamps, 26pt and 6pt apart, then the current goal's label. One accessible element. */
export function GoalStamps({ goals }: { goals: readonly Goal[] }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  const view = goalStamps(goals);
  // A goal reached while the stamps are on screen is said once, in its own
  // words (tutor/taskTicks.ts), and its stamp lands once. Goals already done
  // at first sight are neither.
  const look = useRef<ReadonlySet<string> | null>(null);
  const said = useRef(new Set<string>());
  const [landed, setLanded] = useState<ReadonlySet<string>>(new Set());
  const signature = goals.map((goal) => `${goal.id}:${goal.achieved ? 1 : 0}`).join('|');
  useEffect(() => {
    if (goals.length === 0) return;
    const next = freshGoals(look.current, goals);
    look.current = next.firstLook;
    const unsaid = next.fresh.filter((id) => !said.current.has(id));
    if (unsaid.length === 0) return;
    for (const id of unsaid) said.current.add(id);
    setLanded(new Set(next.fresh));
    const labels = goalStrip(goals).filter((chip) => unsaid.includes(chip.id)).map((chip) => chip.label);
    const line = tickAnnouncement(labels);
    if (line !== null) AccessibilityInfo.announceForAccessibility(line);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
  if (view.stamps.length === 0) return null;
  return (
    <View style={s.stamps} accessible accessibilityRole="text" accessibilityLabel={view.spoken}>
      {view.stamps.map((stamp) => (
        <PopIn key={stamp.id} play={stamp.state === 'done' && landed.has(stamp.id)}>
          {stamp.state === 'done'
            ? <View style={[s.stamp, s.done]}><TickGlyph size={13} color={t.onMint} /></View>
            : stamp.state === 'current'
              ? <View style={[s.stamp, s.current]}><Text style={[bType.eyebrow, { color: t.onSun }]}>{stamp.n}</Text></View>
              : <View style={[s.stamp, s.todo]}><Text style={[bType.bold12, { color: t.onBrandSoft }]}>{stamp.n}</Text></View>}
        </PopIn>
      ))}
      {view.currentLabel ? <Text {...decorative} style={[bType.bold14, s.label, { color: t.onBrand }]}>{view.currentLabel}</Text> : null}
    </View>
  );
}

/** The portrait at 112pt (72 when compact), its live rings, and the tutor's name. */
export const PORTRAIT = { full: 112, compact: 72, gap: 8 } as const;

export function PortraitStage({ state, voice, name, active, compact }: {
  state: OrbState;
  voice?: TutorVoiceKey;
  name: string;
  /** The room is the screen in front of the learner. */
  active: boolean;
  /** Typing, the keyboard open, or the largest text: the smaller portrait. */
  compact: boolean;
}) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  const audio = useOrbAudio();
  const foreground = useAppActive();
  const mode = ringMode({ state, inputLive: audio?.room.inputLive ?? false, outputLive: audio?.room.outputLive ?? false });
  const size = compact ? PORTRAIT.compact : PORTRAIT.full;
  const moving = active && foreground;
  // The rings follow the real level of whoever holds the floor; no room, no rings.
  const level = audio === null ? null : mode === 'tutor' ? audio.output : mode === 'learner' ? audio.input : null;
  const ring = mode === 'learner' ? t.mint : t.sun;
  return (
    <View style={s.stage}>
      <View {...decorative} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        {level !== null ? <View style={StyleSheet.absoluteFill}><LevelRing level={level} size={size} color={ring} /></View> : null}
        {mode === 'thinking' ? <OrbDashedRing size={size + 16} color={t.sun} active={moving} /> : null}
        <OrbBreathe active={moving && mode === 'tutor'}>
          {voice
            ? <TutorPortrait voice={voice} size={size} ring={mode === 'idle' ? t.onBrand : ring} />
            : <BArt name="tutor-orb" width={size} height={size} style={{ borderRadius: size / 2, overflow: 'hidden' }} />}
        </OrbBreathe>
      </View>
      <Text {...decorative} style={[bType.bold15, { color: t.onBrand }]}>{name}</Text>
    </View>
  );
}

function makeStyles(t: B) {
  return StyleSheet.create({
    stamps: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', columnGap: 6, rowGap: 6, marginTop: 14 },
    stamp: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
    done: { backgroundColor: t.mint },
    current: { backgroundColor: t.sun },
    todo: { borderWidth: 2, borderColor: t.onBrandSoft },
    label: { marginLeft: 6, flexShrink: 1, textAlign: 'center' },
    stage: { alignItems: 'center', justifyContent: 'center', gap: PORTRAIT.gap },
  });
}
