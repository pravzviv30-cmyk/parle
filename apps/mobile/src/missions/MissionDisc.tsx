import type { MissionPlace } from '@luvani/core';
import { TintDisc } from '../components.tsx';
import { MissionArt } from './MissionArt.tsx';
import { missionTint } from './missionTint.ts';

/**
 * A situation's drawing on its tinted paper, drawn one way everywhere.
 *
 * The scene is still: a disc is a mark of place, not a stage, and the motion
 * vocabulary is one loop per screen. The art is drawn at roughly seven tenths
 * of the disc so its 4:3 frame sits inside the circle with paper around it.
 */
export function MissionDisc({ place, size = 64 }: { place: MissionPlace; size?: number }) {
  return (
    <TintDisc tint={missionTint(place)} size={size}>
      <MissionArt place={place} width={Math.round(size * 0.72)} paused />
    </TintDisc>
  );
}
