/** Social UI models and deterministic ranking. The server owns membership. */
export interface SocialPerson { id: string; username: string; name: string; points: number | null; days: number; conversations: number }
export interface SocialRequest { id: string; username: string; name: string; direction: 'incoming' | 'outgoing' }
export interface SocialChallenge { id: string; partner: string; partnerId: string; status: 'pending' | 'active' | 'declined' | 'left'; incoming: boolean; count: number; target: number; expires: string }
export interface SocialNotice { id: string; actor: string; actorId: string; kind: string; body: string; read: boolean; week: string; reactions: string[] }
export interface SocialSettings { enabled: boolean; showScore: boolean; shareMilestones: boolean; requests: boolean; invitations: boolean; completions: boolean; milestones: boolean; results: boolean }
export interface SocialSnapshot {
  self: SocialPerson; friends: SocialPerson[]; requests: SocialRequest[]; challenges: SocialChallenge[];
  notices: SocialNotice[]; blocked: { id: string; name: string }[]; settings: SocialSettings; week: string; resets: string;
}
export const DEFAULT_SOCIAL_SETTINGS: SocialSettings = { enabled: false, showScore: true, shareMilestones: false, requests: true, invitations: true, completions: true, milestones: false, results: false };
export const POINTS_EXPLANATION = 'Learning points come from synced practice activity: producing French and recalling phrases. Each UTC day contributes up to 100 points. Listening, saving, invitations and reactions add no points. Everyone starts a fresh week on Monday at 00:00 UTC; your personal progress stays. This is friendly encouragement, not a verified skill ranking. Offline practice appears after it syncs.';
export function socialUpdateCount(s: SocialSnapshot): number {
  if (!s.settings.enabled) return 0;
  return (s.settings.requests ? s.requests.filter(r => r.direction === 'incoming').length : 0)
    + (s.settings.invitations ? s.challenges.filter(c => c.status === 'pending' && c.incoming).length : 0)
    + s.notices.filter(n => !n.read && (n.kind === 'completion' ? s.settings.completions : n.kind === 'milestone' ? s.settings.milestones : n.kind === 'result' ? s.settings.results : true)).length;
}
export const REACTIONS = ['Bravo!', 'Bien joué!', 'Nicely done'] as const;
export function rankedFriends(people: readonly SocialPerson[]): (SocialPerson & { rank: number })[] {
  const ordered = people.filter(p => p.points !== null).sort((a, b) => b.points! - a.points! || a.username.localeCompare(b.username));
  let rank = 0;
  return ordered.map((p, index) => { if (index === 0 || p.points !== ordered[index - 1]!.points) rank = index + 1; return { ...p, rank }; });
}
export function utcWeek(now: number): { start: number; end: number; key: string } {
  const d = new Date(now); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7);
  return { start: d.getTime(), end: d.getTime() + 7 * 86400000, key: d.toISOString().slice(0, 10) };
}
export function socialPreview(snapshot: SocialSnapshot): string {
  if (!snapshot.settings.enabled) return 'Invite someone you know and make room for French together.';
  if (!snapshot.friends.length) return 'Your circle starts with one friend.';
  const ranked = rankedFriends([snapshot.self, ...snapshot.friends]);
  const mine = ranked.find(p => p.id === snapshot.self.id);
  if (!mine || mine.points === 0) return `${snapshot.friends.length} friends learning alongside you.`;
  const tied = ranked.filter(p => p.rank === mine.rank).length > 1;
  return `You are ${tied ? 'joint ' : ''}${mine.rank === 1 ? 'first' : `ranked ${mine.rank}`} among ${ranked.length} this week.`;
}
