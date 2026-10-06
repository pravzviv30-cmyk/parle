/**
 * Whether the app is in the foreground, watched. The game art moves only while
 * it is: a flicker asked for behind a backgrounded app never starts, and one
 * that is running stops when the app leaves.
 *
 * No engine here, only React and AppState.
 */

import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

export function useForeground(): boolean {
  const [awake, setAwake] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => setAwake(next === 'active'));
    return () => subscription.remove();
  }, []);
  return awake;
}
