/** Own a temporary export from its first byte until the share sheet returns. */
export async function temporaryTextShare(effects: {
  available: () => Promise<boolean>;
  current: () => boolean;
  write: () => Promise<void>;
  share: () => Promise<void>;
  remove: () => Promise<void>;
}): Promise<void> {
  if (!await effects.available()) throw new Error('Sharing is unavailable');
  if (!effects.current()) throw new Error('Account changed');
  try {
    await effects.write();
    if (!effects.current()) throw new Error('Account changed');
    await effects.share();
    if (!effects.current()) throw new Error('Account changed');
  } finally {
    // A partial write, rejected share or account switch still owns cleanup.
    await effects.remove();
  }
}
