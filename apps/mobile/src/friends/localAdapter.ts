/**
 * Friends on the device, until there is a server to keep them.
 *
 * Same architecture as drill/store.ts: AsyncStorage under one versioned
 * per-user key, every mutation through one serialized write chain, a
 * load-once cache dropped on account switch. All decisions are made by the
 * pure reducers in logic.ts; this file only reads, writes and notifies.
 *
 * The one piece of theatre: a request to a sample user is auto-accepted about
 * a second later, as if the sample friend said yes — that is what lets the
 * whole flow (search, ask, accept, board) be walked end to end with no
 * backend. A request to anyone else stays honestly pending, and its copy says
 * it will go out for real when friend servers arrive.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { activeUserId, onUserScopeReset, userKey } from '../storage/scope.ts';
import { loadProfile } from '../profile/store.ts';
import type { FriendEntry, FriendRequest, FriendsAdapter, FriendsResult } from './types.ts';
import {
  emptyState,
  findRosterUser,
  searchRoster,
  withAccepted,
  withDeclined,
  withRequest,
  withoutFriend,
  type FriendsState,
} from './logic.ts';

/** Resolved per call: the active account can change between calls. */
const KEY = () => userKey('friends');

/** How long a sample friend thinks before saying yes. */
const SAMPLE_ACCEPT_MS = 800;

interface FriendsStore {
  version: 1;
  friends: FriendEntry[];
  requests: FriendRequest[];
}

const defaultStore = (): FriendsStore => ({ version: 1, friends: [], requests: [] });

/** Same shape as drill/store.ts and for the same reason: see that file. */
let writeChain: Promise<unknown> = Promise.resolve();

function serialized<T>(mutation: () => Promise<T>): Promise<T> {
  const next = writeChain.then(mutation, mutation);
  writeChain = next.catch(() => {});
  return next;
}

let cache: Promise<FriendsStore> | null = null;

// Per-account truth: drop it the moment the account changes, or the next
// learner would inherit the last learner's friends.
onUserScopeReset(() => {
  cache = null;
});

const listeners = new Set<() => void>();

function notify(): void {
  for (const cb of listeners) cb();
}

function isStore(value: unknown): value is FriendsStore {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { version?: unknown }).version === 1 &&
    Array.isArray((value as { friends?: unknown }).friends) &&
    Array.isArray((value as { requests?: unknown }).requests)
  );
}

async function readStore(): Promise<FriendsStore> {
  try {
    const raw = await AsyncStorage.getItem(KEY());
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isStore(parsed)) return parsed;
    }
  } catch {
    // A corrupt list is not worth crashing over. Start empty.
  }
  return defaultStore();
}

function loadStore(): Promise<FriendsStore> {
  cache ??= readStore();
  return cache;
}

async function saveStore(store: FriendsStore): Promise<void> {
  // The cache is the truth the moment the write is decided; the disk catches up.
  cache = Promise.resolve(store);
  try {
    await AsyncStorage.setItem(KEY(), JSON.stringify(store));
  } catch {
    // Storage full or unavailable. The list still works for this launch.
  }
}

/** Run one reducer over the store, persist when it changed, tell the screens. */
function mutate(reduce: (state: FriendsState) => { state: FriendsState; result: FriendsResult }): Promise<FriendsResult> {
  return serialized(async () => {
    const store = await loadStore();
    const { state, result } = reduce({ friends: store.friends, requests: store.requests });
    if (state.friends !== store.friends || state.requests !== store.requests) {
      await saveStore({ version: 1, ...state });
      notify();
    }
    return result;
  });
}

/** Say yes on the sample friend's behalf, unless the account changed under us. */
function scheduleSampleAccept(requestId: string): void {
  const uid = activeUserId();
  setTimeout(() => {
    if (uid === null || uid !== activeUserId()) return;
    void mutate((state) => withAccepted(state, requestId));
  }, SAMPLE_ACCEPT_MS);
}

export function createLocalAdapter(): FriendsAdapter {
  return {
    kind: 'local',

    async getFriends(): Promise<FriendEntry[]> {
      return (await loadStore()).friends;
    },

    async getRequests(): Promise<FriendRequest[]> {
      return (await loadStore()).requests;
    },

    // Never the network: the roster is the whole searchable world for now.
    search(q: string) {
      return Promise.resolve(searchRoster(q).map(({ username, displayName, preview }) => ({ username, displayName, preview })));
    },

    async sendRequest(username: string): Promise<FriendsResult> {
      // Self-adds are rejected against the profile's claimed username.
      const profile = await loadProfile().catch(() => null);
      const self = profile?.username ?? null;
      const roster = findRosterUser(username);
      const input = roster
        ? { username: roster.username, displayName: roster.displayName, preview: true }
        : { username, displayName: null, preview: false };
      let sentId: string | null = null;
      const result = await mutate((state) => {
        const before = state.requests.length;
        const next = withRequest(state, input, self);
        sentId = next.state.requests.length > before ? (next.state.requests[before]?.id ?? null) : null;
        return next;
      });
      // The demo flow completes itself: a sample friend always says yes.
      if (roster && sentId !== null) scheduleSampleAccept(sentId);
      return result;
    },

    acceptRequest(id: string): Promise<FriendsResult> {
      return mutate((state) => withAccepted(state, id));
    },

    declineRequest(id: string): Promise<FriendsResult> {
      return mutate((state) => withDeclined(state, id));
    },

    removeFriend(id: string): Promise<FriendsResult> {
      return mutate((state) => withoutFriend(state, id));
    },

    onChange(cb: () => void): () => void {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
  };
}
