import { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import { backOrTabs, type LeavingNav } from './leave.ts';
/** Back when there is a screen behind this one, else the tabs with this screen closed (F775, `leave.ts`). */
export function useBackToHome(): () => void {
  const nav = useNavigation<LeavingNav>();
  return useCallback(() => backOrTabs(nav), [nav]);
}
