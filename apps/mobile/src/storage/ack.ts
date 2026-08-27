/**
 * What a store is allowed to claim about a write.
 *
 * Every store on this device is a read-modify-write through a promise chain
 * that ends in one `AsyncStorage.setItem`. Until this type existed, all of them
 * caught that call's failure and returned anyway, so `addPhrases` resolving
 * meant "the cache is right" and never "the disk is". That is fine for a deck
 * the learner can rebuild by talking again, and it is not fine for the journal,
 * which deletes the only recoverable copy of a session the moment its writes
 * resolve.
 *
 * So a write now answers, in one word, which of the two happened.
 *
 * **`durable` means exactly this**: the store's own chain computed the merged
 * value and `setItem` for that exact scoped key resolved without throwing.
 * Nothing stronger than that exists on-device. There is no fsync here, no
 * write barrier, and no promise that the bytes survive a battery pull a
 * millisecond later — AsyncStorage does not offer one and this type does not
 * invent one. Read-back verification is deliberately absent too: the read would
 * come out of the same cache the write just filled, so it would prove the cache
 * and nothing about the disk.
 *
 * **`failed` means the platform refused**: storage full, storage unavailable,
 * a quota that moved. The learner's launch is unaffected, because every store
 * updates its in-memory cache before it touches the disk and keeps serving from
 * it. What changes is that nobody downstream is allowed to believe the write
 * landed — most sharply, the journal does not clear and `markDirty` is not
 * raised, because a dirty flag on a failed write would push the previous value
 * to the account as if it were the new one (sync/registry.ts).
 */
export type PersistAck = 'durable' | 'failed';
