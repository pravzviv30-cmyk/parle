/**
 * Your fixes (B0 route stub, 2026-10-20). A placeholder so the route, its web
 * address and the wiring contract exist before a later step fills it from the
 * B-Fixes artboard. It reads nothing and decides nothing: no capabilities, no
 * continue arc, no lock.
 */

import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScrollScreen, ScreenHeader } from '../layout.tsx';
import type { RootStackParamList } from '../nav/types.ts';

export const FIXES_TITLE = 'Your fixes';

export function FixesScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <ScrollScreen
      header={<ScreenHeader back={{ onPress: () => (nav.canGoBack() ? nav.goBack() : nav.navigate('Tabs')) }} title={FIXES_TITLE} />}
    >
      {null}
    </ScrollScreen>
  );
}
