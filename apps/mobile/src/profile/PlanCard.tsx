/**
 * The tutor-time card on the Subscription screen (P2 · Luvani, 2026-10-19).
 *
 * It used to be the whole plan group on Settings and read the server itself.
 * The read is `settings/usePlanStatus.ts` now, shared by Profile's plan row,
 * Settings' plan row and the Subscription screen, so this file only draws what
 * it is handed and decides nothing.
 *
 * ## Words, not a meter (F377, F541)
 *
 * The supplied design drew "n of m min left" over a filled track and a refresh
 * date. `purchases/planStatus.ts` folds the seconds into one of three bands and
 * refuses a date because both read as a countdown, so the card says the band
 * in words and the period as a distance. There is no track: a bar filled from
 * a band would be a quantity this phone invented.
 */

import { StyleSheet, Text, View } from 'react-native';

import { useSettingsColors } from '../settings/SettingsAppearance.tsx';
import { radius, space, type } from '../theme.ts';
import { TUTOR_TIME_TITLE } from '../settings/profileView.ts';
import { planSentence } from '../purchases/planStatus.ts';

export function PlanCard({ band, period }: { band: string; period: string }) {
  const colors = useSettingsColors();
  return (
    <View style={[st.card, { backgroundColor: colors.surface }]} accessible accessibilityLabel={`${TUTOR_TIME_TITLE}. ${planSentence(band, period)}`}>
      <Text style={[type.bodyStrong, { color: colors.text }]}>{TUTOR_TIME_TITLE}</Text>
      <Text style={[type.body, { color: colors.muted }]}>{band}</Text>
      <Text style={[type.small, { color: colors.muted }]}>{period}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  card: { borderRadius: radius.tile, padding: space(4), gap: space(1), marginTop: space(6) },
});
