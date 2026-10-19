import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Press } from '../components.tsx';
import { useMainAppearance } from '../main/MainAppearance.tsx';
import { HIT, radius, space, type } from '../theme.ts';
import { billedPrice, PLAN_MONTHLY, PLAN_WEEKLY, PLAN_YEARLY } from './wallCopy.ts';
import type { WallPlanOffer } from './wallPlans.ts';

/** Billing periods choose actual store products. They never start a purchase. */
export function WallPeriodSwitch({ offers, name, selected, onSelect }: {
  offers: readonly WallPlanOffer[];
  name: string;
  selected: string | null;
  onSelect: (offer: WallPlanOffer) => void;
}) {
  const { colors, mode } = useMainAppearance();
  const { fontScale } = useWindowDimensions();
  const stacked = fontScale >= 1.75;
  const periods = ['year', 'month', 'week'] as const;
  const ordered = periods.flatMap(period => offers.filter(offer => offer.period === period));
  return <View accessibilityRole="radiogroup" accessibilityLabel="Billing period"
    style={[styles.group, { backgroundColor: colors.inset }, stacked && styles.stacked]}>
    {ordered.map(offer => {
      const checked = offer.productId === selected;
      const period = offer.period === 'year' ? PLAN_YEARLY : offer.period === 'month' ? PLAN_MONTHLY : PLAN_WEEKLY;
      return <Press key={offer.productId} haptic="selection" accessibilityRole="radio"
        accessibilityState={{ checked }} aria-checked={checked}
        accessibilityLabel={[name, period, billedPrice(offer.price, offer.period)].join(', ')}
        onPress={() => onSelect(offer)} frame={stacked ? styles.full : styles.share}
        style={[styles.segment, { backgroundColor: checked ? mode === 'dark' ? colors.text : colors.surface : colors.inset }]}>
        <Text style={[type.bodyStrong, styles.label, { color: checked && mode === 'dark' ? colors.background : colors.text }]}>{period}</Text>
      </Press>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  group: { alignSelf: 'center', width: '100%', maxWidth: 260, flexDirection: 'row', padding: space(1), borderRadius: radius.pill, gap: space(1) },
  stacked: { flexDirection: 'column', borderRadius: radius.control },
  share: { flex: 1, minWidth: 0, minHeight: HIT },
  full: { alignSelf: 'stretch', minHeight: HIT },
  segment: { minHeight: HIT, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space(3), paddingVertical: space(2.5) },
  label: { textAlign: 'center', flexShrink: 1 },
});
