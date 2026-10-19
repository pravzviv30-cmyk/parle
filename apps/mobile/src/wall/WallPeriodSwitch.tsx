import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Press } from '../components.tsx';
import { useMainAppearance } from '../main/MainAppearance.tsx';
import { HIT, space, type } from '../theme.ts';
import { billedPrice, PLAN_MONTHLY, PLAN_WEEKLY, PLAN_YEARLY } from './wallCopy.ts';
import type { WallPlanOffer } from './wallPlans.ts';

/**
 * Billing periods choose actual store products. They never start a purchase,
 * and they only change the billing period: the tier stays as it was.
 *
 * "P2 · Luvani": a 260pt track on `inset`, the chosen segment on `selected`.
 * The surface contract admits no new shadow, so the fill alone lifts it.
 * Each segment keeps the 44pt touch floor, so the track is a little taller
 * than the mock's 44 rather than the targets smaller.
 */
export function WallPeriodSwitch({ offers, name, selected, onSelect, disabled = false }: {
  offers: readonly WallPlanOffer[];
  name: string;
  selected: string | null;
  onSelect: (offer: WallPlanOffer) => void;
  /** Dimmed and still while a purchase is in flight. */
  disabled?: boolean;
}) {
  const { colors } = useMainAppearance();
  const { fontScale } = useWindowDimensions();
  const stacked = fontScale >= 1.75;
  const periods = ['year', 'month', 'week'] as const;
  const ordered = periods.flatMap(period => offers.filter(offer => offer.period === period));
  return <View accessibilityRole="radiogroup" accessibilityLabel="Billing period"
    style={[styles.group, { backgroundColor: colors.inset, opacity: disabled ? 0.5 : 1 }, stacked && styles.stacked]}>
    {ordered.map(offer => {
      const checked = offer.productId === selected;
      const period = offer.period === 'year' ? PLAN_YEARLY : offer.period === 'month' ? PLAN_MONTHLY : PLAN_WEEKLY;
      return <Press key={offer.productId} haptic="selection" accessibilityRole="radio"
        accessibilityState={{ checked }} aria-checked={checked} disabled={disabled}
        accessibilityLabel={[name, period, billedPrice(offer.price, offer.period)].join(', ')}
        onPress={() => onSelect(offer)} frame={stacked ? styles.full : styles.share}
        style={[styles.segment, checked ? { backgroundColor: colors.selected } : null]}>
        <Text style={[styles.label, { color: checked ? colors.text : colors.muted }]}>{period}</Text>
      </Press>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  group: { alignSelf: 'center', width: '100%', maxWidth: 260, flexDirection: 'row', padding: space(1), borderRadius: 22, gap: space(1) },
  stacked: { flexDirection: 'column', borderRadius: 22 },
  share: { flex: 1, minWidth: 0, minHeight: HIT },
  full: { alignSelf: 'stretch', minHeight: HIT },
  segment: { minHeight: HIT, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space(3), paddingVertical: space(2) },
  label: { ...type.bodyStrong, textAlign: 'center', flexShrink: 1 },
});
