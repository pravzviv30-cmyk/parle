/**
 * One daily goal (founder decision D5; README Part 5.C row 4): its name, its
 * size in minutes and a dial filled to that size, as a radio row.
 *
 * "Suggested" is said only on the tier the learner's own answers point at
 * (`planModel.ts` suggestedMinutes), and only as words: nothing is chosen for
 * them, and Continue stays off until they choose.
 */

import { Choice } from '../../components.tsx';
import { IconTile } from '../../icons/IconTile.tsx';
import { tierLabel, type GoalTier } from './planModel.ts';

export function GoalTile({
  tier,
  suggested,
  selected,
  onPress,
  compact = false,
  layout = 'row',
}: {
  tier: GoalTier;
  suggested: boolean;
  selected: boolean;
  onPress: () => void;
  compact?: boolean;
  layout?: 'row' | 'tile';
}) {
  return (
    <Choice
      layout={layout}
      title={`${tier.minutes} min`}
      detail={suggested ? 'Suggested' : undefined}
      tile={<IconTile ground="sun" dial={tier.quarters} size={44} />}
      selected={selected}
      onPress={onPress}
      compact={compact}
      accessibilityLabel={tierLabel(tier, suggested)}
    />
  );
}
