import { SvgXml } from 'react-native-svg';
import { decorative } from '../../theme.ts';
import { BOLD_SCENES, type BoldSceneKind } from '../../art/flat/boldSceneAssets.ts';
export type BoldSceneProps = { kind: BoldSceneKind; width: number; active?: boolean };
export function BoldStill({ kind, width }: BoldSceneProps) {
  return <SvgXml {...decorative} xml={BOLD_SCENES[kind]} width={width} height={width * (kind.startsWith('orb-') ? 1 : 320 / 350)} />;
}
