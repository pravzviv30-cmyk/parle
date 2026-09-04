import type { ConversationPack } from '@luvani/core';

/** Server order is newest first; a stable total order stops a redraw from jumping. */
export function orderedConversationPacks(packs: readonly ConversationPack[]): ConversationPack[] {
  const byId = new Map<string, ConversationPack>();
  for (const pack of packs) byId.set(pack.id, pack);
  return [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
}

/** The calm home surface only needs a ready pack with something to revisit. */
export function latestReadyPack(packs: readonly ConversationPack[]): ConversationPack | null {
  return orderedConversationPacks(packs).find((pack) => pack.state === 'ready' && pack.keyPhrases.length > 0) ?? null;
}
