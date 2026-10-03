import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import type { WalkObserver } from './lifecycle.ts';
interface AudioLifecycle {
  ready(): boolean;
  epoch(): number;
  addListener(name: 'onInterruption', callback: () => void): { remove(): void };
}
const module = Platform.OS === 'ios' ? requireOptionalNativeModule<AudioLifecycle>('LuvaniAudioLifecycle') : null;
/** New mode stays dark pending backend and physical lock/call proof. */
export const WALK_AVAILABLE = process.env.EXPO_PUBLIC_LUVANI_WALK_MODE === '1' && module !== null;
export function walkObserver(): WalkObserver | null {
  if (!WALK_AVAILABLE || !module) return null;
  const epoch = module.epoch();
  return { ready: () => module.ready() && module.epoch() === epoch, subscribe: callback => { const listener = module.addListener('onInterruption', callback); return () => listener.remove(); } };
}
