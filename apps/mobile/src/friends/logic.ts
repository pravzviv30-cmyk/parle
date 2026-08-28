/**
 * Friends, as pure state transitions.
 *
 * Everything the local adapter decides lives here with no I/O attached, so the
 * rules can be tested under plain node and the adapter stays a thin storage
 * shell. Ids are derived from usernames rather than drawn from randomness for
 * the same reason: a reducer that returns the same state for the same input is
 * one a test can pin down completely.
 *
 * The sample roster also lives here. Six French-flavoured profiles, every one
 * carrying `preview: true` so no surface can show them without their Sample
 * label — the demo flow works end to end and never once pretends to be real.
 */

import type { FriendEntry, FriendRequest, FriendsResult } from './types.ts';

export interface FriendsState {
  friends: FriendEntry[];
  requests: FriendRequest[];
}

export const emptyState = (): FriendsState => ({ friends: [], requests: [] });

// ─────────────────────────────────────────────────────────── names and folding

/** Case- and diacritic-insensitive comparison form: 'Théo' → 'theo'. */
export function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * What a typed string is worth as a username: folded, lowercased, stripped to
 * the characters usernames are made of. Empty when nothing usable remains.
 */
export function asUsername(q: string): string {
  return fold(q.trim()).replace(/[^a-z0-9._-]/g, '');
}

/**
 * The username a learner starts with: the first word of their name as a
 * lowercase slug ('parler' when the name gives nothing to work with), then a
 * four-digit discriminator derived deterministically from the seed — the same
 * account always lands on the same handle, e.g. 'camille.4821'.
 */
export function defaultUsername(name: string | null, seed: string): string {
  const slug =
    fold((name ?? '').split(' ')[0] ?? '')
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 16) || 'parler';
  // djb2 over the seed, folded into 1000-9999 so the discriminator is always
  // exactly four digits and never starts with zero.
  let h = 5381;
  for (let i = 0; i < seed.length; i++) h = (h * 33 + seed.charCodeAt(i)) >>> 0;
  return `${slug}.${1000 + (h % 9000)}`;
}

// ────────────────────────────────────────────────────────────── sample roster

export interface RosterUser {
  username: string;
  displayName: string | null;
  /** Small honest numbers, so a sample board looks lived-in but never grand. */
  xp: number;
  preview: true;
}

export const SAMPLE_ROSTER: readonly RosterUser[] = [
  { username: 'camille.paris', displayName: 'Camille', xp: 620, preview: true },
  { username: 'theo.lyon', displayName: 'Théo', xp: 480, preview: true },
  { username: 'amelie.b', displayName: 'Amélie', xp: 350, preview: true },
  { username: 'marc.dubois', displayName: 'Marc', xp: 210, preview: true },
  { username: 'juliette.n', displayName: 'Juliette', xp: 130, preview: true },
  { username: 'hugo.petit', displayName: 'Hugo', xp: 75, preview: true },
];

/** The roster user this username names, or null. Folded comparison. */
export function findRosterUser(username: string): RosterUser | null {
  const target = fold(username.trim());
  return SAMPLE_ROSTER.find((u) => fold(u.username) === target) ?? null;
}

/** Substring search over username and display name, case and accents ignored. */
export function searchRoster(q: string): RosterUser[] {
  const needle = fold(q.trim());
  if (needle === '') return [];
  return SAMPLE_ROSTER.filter(
    (u) => fold(u.username).includes(needle) || (u.displayName !== null && fold(u.displayName).includes(needle)),
  );
}

/**
 * What the result area says when a search turns up nobody.
 *
 * There were two of these and only one was written down. The screen decided the
 * zero-result card by asking whether `asUsername(q)` was non-empty, which is a
 * good question with a bad silent answer: a query of "!!!" or an emoji slugs
 * away to nothing, matches no sample name, and left the learner looking at a
 * completely blank space under a search box they had just typed into.
 *
 * So both answers live here. The ordinary one is unchanged, and the screen
 * still owns its copy: this only says which card, and which name to echo.
 */
export type SearchMiss =
  /** Nobody by that name, but the name is one a username could be. */
  | { kind: 'invite'; username: string }
  /** Nothing typed could be a username at all, so there is nothing to offer. */
  | { kind: 'unusable'; headline: string; body: string };

/**
 * The line for a query no username could ever match.
 *
 * It reports the rule rather than the mistake. "Invalid" tells a learner they
 * did something wrong; this tells them what will work, which is the only part
 * of it they can act on. The list is the exact set `asUsername` keeps.
 */
export const SEARCH_UNUSABLE = {
  headline: 'Nothing here matches that.',
  body: 'Usernames are made of letters, numbers, dots, dashes and underscores.',
} as const;

/**
 * What to show under a search, given what was typed and which usernames came
 * back. Null means the results speak for themselves, or the box is empty and
 * the screen has its own opening card for that.
 */
export function searchMiss(q: string, hits: readonly string[]): SearchMiss | null {
  if (q.trim() === '') return null;
  const username = asUsername(q);
  if (username === '') {
    // A query can slug to nothing and still match a display name, because the
    // roster search folds accents rather than stripping them. Those hits are
    // the answer; there is nothing missing to explain.
    return hits.length > 0 ? null : { kind: 'unusable', ...SEARCH_UNUSABLE };
  }
  if (hits.some((h) => fold(h) === username)) return null;
  return { kind: 'invite', username };
}

// ──────────────────────────────────────────────────────────────────── reducers

export interface RequestInput {
  username: string;
  displayName: string | null;
  preview: boolean;
}

const sameName = (a: string, b: string) => fold(a) === fold(b);

/**
 * Ask to be friends. Rejects your own username and existing friends, and a
 * second ask for the same person changes nothing — pressing Add twice is not
 * an error, it is impatience, and impatience is answered kindly.
 */
export function withRequest(
  state: FriendsState,
  input: RequestInput,
  selfUsername: string | null,
  now = Date.now(),
): { state: FriendsState; result: FriendsResult } {
  const username = input.username.trim();
  if (selfUsername !== null && sameName(username, selfUsername)) {
    return { state, result: { ok: false, message: 'That username is yours. You are already on your own board.' } };
  }
  const friend = state.friends.find((f) => sameName(f.username, username));
  if (friend) {
    const who = friend.displayName ?? friend.username;
    return { state, result: { ok: false, message: `You and ${who} are already friends.` } };
  }
  const existing = state.requests.find((r) => sameName(r.username, username));
  if (existing) {
    const message =
      existing.direction === 'incoming'
        ? 'They asked you first. Say yes to their request and you are friends.'
        : 'You already asked them. That request is still waiting.';
    return { state, result: { ok: true, message } };
  }
  const request: FriendRequest = {
    id: `req:${fold(username)}`,
    username,
    displayName: input.displayName,
    direction: 'outgoing',
    sentAt: new Date(now).toISOString(),
    preview: input.preview,
  };
  return {
    state: { ...state, requests: [...state.requests, request] },
    result: {
      ok: true,
      message: input.preview ? 'Request sent.' : 'Saved. It will be sent for real when friend servers arrive.',
    },
  };
}

/** A request said yes to becomes a friend, keeping its Sample label. */
export function withAccepted(
  state: FriendsState,
  requestId: string,
  now = Date.now(),
): { state: FriendsState; result: FriendsResult } {
  const request = state.requests.find((r) => r.id === requestId);
  if (!request) {
    return { state, result: { ok: false, message: 'That request is not here any more.' } };
  }
  const friend: FriendEntry = {
    id: `friend:${fold(request.username)}`,
    username: request.username,
    displayName: request.displayName,
    // Sample friends bring their roster score; anyone else starts unknown.
    xp: findRosterUser(request.username)?.xp ?? null,
    since: new Date(now).toISOString(),
    preview: request.preview,
  };
  return {
    state: {
      friends: [...state.friends, friend],
      requests: state.requests.filter((r) => r.id !== requestId),
    },
    result: { ok: true },
  };
}

/** A request said no to simply leaves. No grudge is stored anywhere. */
export function withDeclined(state: FriendsState, requestId: string): { state: FriendsState; result: FriendsResult } {
  if (!state.requests.some((r) => r.id === requestId)) {
    return { state, result: { ok: false, message: 'That request is not here any more.' } };
  }
  return {
    state: { ...state, requests: state.requests.filter((r) => r.id !== requestId) },
    result: { ok: true },
  };
}

/** Unfriending removes the row and nothing else. */
export function withoutFriend(state: FriendsState, friendId: string): { state: FriendsState; result: FriendsResult } {
  if (!state.friends.some((f) => f.id === friendId)) {
    return { state, result: { ok: false, message: 'They are not on your list any more.' } };
  }
  return {
    state: { ...state, friends: state.friends.filter((f) => f.id !== friendId) },
    result: { ok: true },
  };
}
