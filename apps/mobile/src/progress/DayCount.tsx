import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../auth/useAuth.tsx';
import { scopeGeneration } from '../storage/scope.ts';
import { paper, space, type } from '../theme.ts';
import { loadActiveDays } from './activity.ts';
import { IconAction } from '../components.tsx';
import { lifetimeDayLine, weeklyDayLine } from './dayCount.ts';

/**
 * Read the account's durable dates on focus; a failed read claims nothing.
 * A re-read for the same account keeps the line on screen until the new count
 * lands (F768), so a tab coming back into focus never blinks its count away.
 */
export function DayCount({ weekly = false }: { weekly?: boolean }) {
  const { user } = useAuth();
  const [value, setValue] = useState<{ owner: number; line: string | null } | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useFocusEffect(useCallback(() => {
    let cancelled = false;
    const owner = scopeGeneration();
    setValue((held) => (held !== null && held.owner === owner ? held : null));
    setFailed(false);
    void loadActiveDays().then(days => {
      if (!cancelled && owner === scopeGeneration()) {
        setValue({ owner, line: weekly ? weeklyDayLine(days, Date.now()) : lifetimeDayLine(days) });
      }
    }).catch(() => { if (!cancelled && owner === scopeGeneration()) setFailed(true); });
    return () => { cancelled = true; };
  }, [user?.id, weekly, attempt]));
  if (failed) return <View style={{ marginTop: space(4) }}><Text style={[type.small, { color: paper.ink }]}>Practice days could not be read just now.</Text><IconAction layout="inline" icon="refresh" label="Try loading practice days" onPress={() => setAttempt((n) => n + 1)} /></View>;
  if (value === null || value.owner !== scopeGeneration() || value.line === null) return null;
  return <Text style={[type.small, { color: paper.ink, marginTop: space(4) }]}>{value.line}</Text>;
}
