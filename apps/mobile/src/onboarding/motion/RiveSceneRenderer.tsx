/** Web displays the original vector frame without importing a native runtime. */
import { View } from 'react-native';
import { decorative } from '../../theme.ts';
import { SceneStill, type RiveSceneProps } from './SceneStill.tsx';
export function RiveSceneRenderer({ kind, size }: RiveSceneProps) {
  return <View {...decorative} style={{ width: size, height: size, maxWidth: '100%', alignSelf: 'center', pointerEvents: 'none' }}><SceneStill kind={kind} size={size} /></View>;
}
