import type { SocialSnapshot } from '../friends/socialModel.ts';
import { socialPreview, socialUpdateCount } from '../friends/socialModel.ts';

/** No empty invitations on Home; Friends itself remains available in the dock. */
export function usefulFriends(s: SocialSnapshot | null): string | null {
  if (!s?.settings.enabled) return null;
  const updates = socialUpdateCount(s);
  if (updates > 0) return `${updates} ${updates === 1 ? 'update' : 'updates'} from your circle. Invitations and encouragement are waiting in Friends.`;
  const challenge = s.challenges.find(c => c.status === 'active');
  if (challenge) return `You and ${challenge.partner}: ${challenge.count} of ${challenge.target} conversations together.`;
  if (s.friends.some(f => f.points !== null && f.points > 0)) return socialPreview(s);
  return null;
}

// `usefulPace` left with the "Today, at your pace" card (whole-app Stage 3A):
// the Practice time tile is the one door to the optional target now.
