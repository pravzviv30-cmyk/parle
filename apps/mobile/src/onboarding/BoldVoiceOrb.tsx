import { View } from 'react-native';
import { decorative } from '../theme.ts';
import { useReduceMotion } from '../motion.ts';
import { useAppActive, useOrbAudio } from '../live/OrbAudio.tsx';
import { orbLayers } from '../tutor/orbLayers.ts';
import { OrbPulse } from '../tutor/OrbPulse.tsx';
import type { OrbState } from '../tutor/VoiceOrb.tsx';
import { C2Scene } from './motion/C2Scene.tsx';

/** C2's blue sphere retains the room's state and measured voice response. */
export function BoldVoiceOrb({ state, size = 112, active = true }: { state: OrbState; size?: number; active?: boolean }) {
  const audio = useOrbAudio();
  const foreground = useAppActive();
  const reduced = useReduceMotion();
  const layers = orbLayers({ state, room: audio?.room ?? null, reduced, paused: !active || !foreground });
  const input = layers.ring && audio !== null;
  const output = layers.bars === 'live' && audio !== null;
  const kind = size <= 64 ? 'orb-64' : size <= 88 ? 'orb-88' : 'orb-112';
  return <View {...decorative} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
    <OrbPulse level={input ? audio.input : output ? audio.output : null} on={input || output}>
      <C2Scene kind={kind} width={size} active={active && foreground} animated={!input && !output} />
    </OrbPulse>
  </View>;
}
