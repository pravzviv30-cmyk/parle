import { C2_MANIFEST, c2Scene, type C2SceneDefinition } from '../art/flat/c2SceneAssets.ts';
import { C2Artwork } from './motion/C2Scene.tsx';

export function C2BrandLockup({ animated = true, width = 270, active = true }: { animated?: boolean; width?: number; active?: boolean }) {
  return <C2Artwork scene={C2_MANIFEST.brand as C2SceneDefinition} width={width} animated={animated} active={active} spin />;
}
export function C2Flame({ size = 58, active = true }: { size?: number; active?: boolean }) {
  return <C2Artwork scene={c2Scene('home-flame')} width={size} active={active} />;
}
export function C2StreakArt({ width = 342, dayCount = 1, active = true }: { width?: number; dayCount?: number; active?: boolean }) {
  return <C2Artwork scene={c2Scene('streak')} width={width} dayCount={dayCount} active={active} />;
}
