/** Web and native error fallback: the same authored vector frame, without playback. */
import { SvgXml } from 'react-native-svg';
import { decorative } from '../../theme.ts';
import { RIVE_STILLS } from '../../art/flat/onboardingRiveStills.ts';
import type { SceneKind } from './OnboardingScenes.tsx';

export type RiveSceneProps = { kind: SceneKind; size: number; active: boolean };
export function SceneStill({ kind, size }: Pick<RiveSceneProps, 'kind' | 'size'>) {
  return <SvgXml {...decorative} xml={RIVE_STILLS[kind]} width={size} height={size} />;
}
