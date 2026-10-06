/**
 * The bottom-nav icons, from the generated set (come alive, founder decision
 * D11): each one is `<Icon name=... />`, Linear when its tab is not selected
 * and Bulk when it is (`focused`). The bar colours them, brand blue selected
 * and soft ink not, with no chartreuse and no wash, and there is no dot under
 * the selected tab: the drawing and the word carry it. `TabGlyph.tsx` pops the
 * selected one once.
 *
 * The names survive from revamp B so no caller moved; each is now a delegate
 * to the one icon that means the same thing: home, practice (the dumbbell),
 * progress (a route from a start dot), user and users. ProfileIcon and FriendsIcon have
 * no tab today and are kept for the screens that may ask for them.
 *
 * Speak is not drawn here. The tab and the control are the same microphone on
 * purpose, so `TutorIcon` is `MicGlyph` re-exported, the way `glyphs.tsx`
 * re-exports the ear as the speaker: two drawings of one idea drift apart the
 * first time one of them is nudged.
 */

import { Icon } from '../icons/Icon.tsx';
import { paper } from '../theme.ts';

export interface TabIconProps {
  size?: number;
  color?: string;
  /** The selected tab: drawn Bulk. */
  focused?: boolean;
}

/** Speak: the same microphone as the control. */
export { MicGlyph as TutorIcon } from '../components.tsx';

export function HomeIcon({ size = 24, color = paper.ink, focused = false }: TabIconProps) {
  return <Icon name="home" variant={focused ? 'bulk' : 'linear'} size={size} color={color} />;
}

export function PracticeIcon({ size = 24, color = paper.ink, focused = false }: TabIconProps) {
  return <Icon name="practice" variant={focused ? 'bulk' : 'linear'} size={size} color={color} />;
}

/** The Progress tab, which is still the MyFrench route. */
export function MyFrenchIcon({ size = 24, color = paper.ink, focused = false }: TabIconProps) {
  return <Icon name="progress" variant={focused ? 'bulk' : 'linear'} size={size} color={color} />;
}

export function ProfileIcon({ size = 24, color = paper.ink, focused = false }: TabIconProps) {
  return <Icon name="user" variant={focused ? 'bulk' : 'linear'} size={size} color={color} />;
}

export function FriendsIcon({ size = 24, color = paper.ink, focused = false }: TabIconProps) {
  return <Icon name="users" variant={focused ? 'bulk' : 'linear'} size={size} color={color} />;
}
