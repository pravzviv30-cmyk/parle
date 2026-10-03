/** Failed deletion stays tracked, so account changes can retry it. */
export function temporaryExports(remove: (uri: string) => Promise<void>, alarm: () => void, leftovers: () => Promise<string[]> = async () => []) {
  const active = new Set<string>();
  const discard = async (uri: string) => {
    active.add(uri);
    try { await remove(uri); active.delete(uri); }
    catch (error) { alarm(); throw error; }
  };
  return {
    track: (uri: string) => { active.add(uri); },
    discard,
    reset: async (legacy: string[] = []) => {
      for (const uri of await leftovers()) active.add(uri);
      for (const uri of legacy) active.add(uri);
      const removed = await Promise.allSettled([...active].map(discard));
      const refused = removed.find(result => result.status === 'rejected');
      if (refused?.status === 'rejected') throw refused.reason;
    },
  };
}


/** Only this helper's temporary files and its retired fixed-name export. */
export function isTemporaryExportName(name: string): boolean {
  return name === 'luvani-account-data.json' || /^luvani-export-[0-9]+-[0-9]+-[a-zA-Z0-9._-]+$/.test(name);
}

/** Start recovery eagerly; a refused sweep can be retried without restarting. */
export function exportRecovery(clean: () => Promise<void>): () => Promise<void> {
  let pending = clean();
  void pending.catch(() => {});
  return () => {
    const observed = pending;
    return observed.catch(() => {
      if (pending === observed) pending = clean();
      return pending;
    });
  };
}
