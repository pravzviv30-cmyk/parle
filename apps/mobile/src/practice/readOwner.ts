/** The account that produced a Practice read must still own it at render and at tap. */
export interface PracticeReadOwner {
  scope: number;
  userId: string | null;
}

export function ownsPracticeRead(
  owner: PracticeReadOwner | null,
  scope: number,
  authUserId: string | null,
  activeUserId: string | null,
): boolean {
  return owner !== null && owner.scope === scope && owner.userId === authUserId && owner.userId === activeUserId;
}
