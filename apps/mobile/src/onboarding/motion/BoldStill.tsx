import type { C2SceneKind } from '../../art/flat/c2SceneAssets.ts';
import { C2Scene } from './C2Scene.tsx';
export type BoldSceneProps = { kind: C2SceneKind; width: number; active?: boolean };
export function BoldStill({ kind, width }: BoldSceneProps) {
  return <C2Scene kind={kind} width={width} animated={false} />;
}
