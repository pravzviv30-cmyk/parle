/**
 * The friends seam.
 *
 * Same architecture as auth/types.ts and for the same reason: one interface,
 * screens that never know which side of it they are on. Today the only
 * implementation is local and its people are clearly labelled samples
 * (`preview: true`, shown as a Sample chip everywhere they appear); when
 * friend servers arrive, a supabase adapter slots in behind this interface
 * with zero UI change. Every user-visible `message` is a plain warm sentence,
 * never a provider code.
 */

export interface FriendEntry {
  id: string;
  username: string;
  displayName: string | null;
  /** Their XP as last known, or null when nothing is known yet. */
  xp: number | null;
  /** ISO timestamp of when the friendship was made. */
  since: string;
  /** True for sample profiles. The UI labels these honestly. */
  preview: boolean;
}

export interface FriendRequest {
  id: string;
  username: string;
  displayName: string | null;
  direction: 'incoming' | 'outgoing';
  /** ISO timestamp. */
  sentAt: string;
  /** True for sample profiles. */
  preview: boolean;
}

/** Inline-result contract, the same shape auth uses. */
export type FriendsResult = { ok: true; message?: string } | { ok: false; message: string };

export interface FriendsAdapter {
  kind: 'local' | 'supabase';
  getFriends(): Promise<FriendEntry[]>;
  getRequests(): Promise<FriendRequest[]>;
  search(q: string): Promise<{ username: string; displayName: string | null; preview: boolean }[]>;
  sendRequest(username: string): Promise<FriendsResult>;
  acceptRequest(id: string): Promise<FriendsResult>;
  declineRequest(id: string): Promise<FriendsResult>;
  removeFriend(id: string): Promise<FriendsResult>;
  /** Subscribe to any change in friends or requests. Returns unsubscribe. */
  onChange(cb: () => void): () => void;
}
