import { View } from 'react-native';
import { decorative } from '../theme.ts';
import { useReduceMotion } from '../motion.ts';
import { useAppActive, useOrbAudio } from '../live/OrbAudio.tsx';
import { orbLayers } from '../tutor/orbLayers.ts';
import { OrbPulse } from '../tutor/OrbPulse.tsx';
import type { OrbState } from '../tutor/VoiceOrb.tsx';
import { BoldScene } from './motion/BoldScene.tsx';

/** The existing room owns state and measured levels; Rive owns C's drawing. */
export function BoldVoiceOrb({ state, size = 232, active = true }: { state: OrbState; size?: number; active?: boolean }) {
  const audio = useOrbAudio();
  const foreground = useAppActive();
  const reduced = useReduceMotion();
  const layers = orbLayers({ state, room: audio?.room ?? null, reduced, paused: !active || !foreground });
  const kind = state === 'idle' ? 'ready' : state;
  const input = layers.ring && audio !== null;
  const output = layers.bars === 'live' && audio !== null;
  return <View {...decorative} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
    <OrbPulse level={input ? audio.input : output ? audio.output : null} on={input || output}>
      <BoldScene kind={`orb-${kind}`} width={size} active={active && foreground} />
    </OrbPulse>
  </View>;
}
