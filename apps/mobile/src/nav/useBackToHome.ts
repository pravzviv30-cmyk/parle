import { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
export function useBackToHome(): () => void {
  const nav = useNavigation<{ canGoBack: () => boolean; goBack: () => void; navigate: (screen: 'Tabs') => void }>();
  return useCallback(() => { if (nav.canGoBack()) nav.goBack(); else nav.navigate('Tabs'); }, [nav]);
}
