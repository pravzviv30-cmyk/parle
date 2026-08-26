/**
 * Friends on the device, until there is a server to keep them.
 *
 * Same architecture as drill/store.ts: AsyncStorage under one versioned
 * per-user key, every mutation through one serialized write chain with the key
 * bound at enqueue, and a load-once cache keyed by that same key and dropped on
 * account switch. All decisions are made by the pure reducers in logic.ts; this
 * file only reads, writes and notifies.
 *
 * Not synced. The roster behind it is labelled sample profiles, and pushing
 * those to the account would enshrine fixtures server-side for every device the
 * learner ever signs in on. See sync/policy.ts for the exclusion.
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

function serialized<T>(mutation: (key: string) => Promise<T>): Promise<T> {
  // Bind the account when the work is requested. A sign-out while a background
  // write is queued must never redirect that write into the next account, and
  // this store has a timer in it, so a queued accept can land a whole second
  // after the switch.
  const key = KEY();
  const run = () => mutation(key);
  const next = writeChain.then(run, run);
  writeChain = next.catch(() => {});
  return next;
}

const caches = new Map<string, Promise<FriendsStore>>();

// Per-account truth: drop it the moment the account changes, or the next
// learner would inherit the last learner's friends.
onUserScopeReset(() => {
  caches.clear();
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

async function readStore(key: string): Promise<FriendsStore> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isStore(parsed)) return parsed;
    }
  } catch {
    // A corrupt list is not worth crashing over. Start empty.
  }
  return defaultStore();
}

function loadStoreFor(key: string): Promise<FriendsStore> {
  const cached = caches.get(key);
  if (cached) return cached;
  const pending = readStore(key);
  caches.set(key, pending);
  return pending;
}

function loadStore(): Promise<FriendsStore> {
  return loadStoreFor(KEY());
}

async function saveStore(key: string, store: FriendsStore): Promise<void> {
  // The cache is the truth the moment the write is decided; the disk catches up.
  caches.set(key, Promise.resolve(store));
  try {
    await AsyncStorage.setItem(key, JSON.stringify(store));
  } catch {
    // Storage full or unavailable. The list still works for this launch.
  }
}

/** Run one reducer over the store, persist when it changed, tell the screens. */
function mutate(reduce: (state: FriendsState) => { state: FriendsState; result: FriendsResult }): Promise<FriendsResult> {
  return serialized(async (key) => {
    const store = await loadStoreFor(key);
    const { state, result } = reduce({ friends: store.friends, requests: store.requests });
    if (state.friends !== store.friends || state.requests !== store.requests) {
      await saveStore(key, { version: 1, ...state });
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
