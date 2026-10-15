import type { TutorVoiceKey } from '@luvani/core';
import { View } from 'react-native';
import { C2_MANIFEST, c2AssetSize, c2Scene, type C2Goal, type C2Layer, type C2SceneDefinition } from '../art/flat/c2SceneAssets.ts';
import { decorative } from '../theme.ts';
import { c } from './boldRhythm.ts';
import { C2Artwork } from './motion/C2Scene.tsx';

function singleAsset(asset: C2Layer['asset'], motion: Pick<C2Layer, 'bob' | 'sway'> = {}): C2SceneDefinition {
  const { width, height } = c2AssetSize(asset);
  return { width, height, layers: [{ asset, x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, ...motion }] };
}
const goals = Object.fromEntries(Object.entries(C2_MANIFEST.goals).map(([key, asset]) => [key, singleAsset(asset as C2Layer['asset'])])) as Record<C2Goal, C2SceneDefinition>;
// Stable definitions keep each portrait's clock through selection and playback.
// At 44–56 points this lifts the art by 1.1–1.4 points without moving its slot.
const portraitMotion = { bob: -1.25, sway: 0.8 } as const;
const tutors = Object.fromEntries(Object.entries(C2_MANIFEST.tutors).map(([key, asset]) => [key, singleAsset(asset as C2Layer['asset'], portraitMotion)])) as Record<TutorVoiceKey, C2SceneDefinition>;
const goalGround: Record<C2Goal, string> = { trip: c.sage, food: c.butter, family: c.peach, moving: c.lavender, work: c.peach, because: c.sage };

export function C2GoalArt({ goal, size }: { goal: C2Goal; size: number }) {
  return <View {...decorative} style={{ width: size, height: size, backgroundColor: goalGround[goal], borderRadius: size / 4, overflow: 'hidden' }}><C2Artwork scene={goals[goal]} width={size} animated={false} /></View>;
}
export function C2TutorPortrait({ voice, size }: { voice: TutorVoiceKey; size: number }) {
  return <C2Artwork scene={tutors[voice]} width={size} />;
}
export function C2BrandLockup({ animated = true, width = 270, active = true }: { animated?: boolean; width?: number; active?: boolean }) {
  return <C2Artwork scene={C2_MANIFEST.brand as C2SceneDefinition} width={width} animated={animated} active={active} spin />;
}
export function C2Flame({ size = 58, active = true }: { size?: number; active?: boolean }) {
  return <C2Artwork scene={c2Scene('home-flame')} width={size} active={active} />;
}
export function C2ProudCloud({ width = 191.52, active = true }: { width?: number; active?: boolean }) {
  return <C2Artwork scene={c2Scene('summary')} width={width} active={active} />;
}
export function C2StreakArt({ width = 342, dayCount = 1, active = true }: { width?: number; dayCount?: number; active?: boolean }) {
  return <C2Artwork scene={c2Scene('streak')} width={width} dayCount={dayCount} active={active} />;
}
