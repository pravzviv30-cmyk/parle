/** A stored view belongs to the account whose read produced it. */
export type OwnedReadStatus = 'loading' | 'ready' | 'unread';

export function ownedReadStatus(
  status: OwnedReadStatus,
  readOwner: number,
  readyOwner: number | null,
  currentOwner: number,
): OwnedReadStatus {
  if (readOwner !== currentOwner) return 'loading';
  if (status === 'ready' && readyOwner !== currentOwner) return 'loading';
  return status;
}
