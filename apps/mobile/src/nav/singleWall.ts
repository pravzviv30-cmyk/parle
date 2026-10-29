/**
 * The wall is one screen, never a stack of them (F931). React Navigation's
 * `getId` makes a navigate or a push to the wall return to the open one: Terms
 * and Privacy opened from it go back to it, and a web Back with no history
 * record (handled as a fresh navigate to `/plans`) never pushes a second.
 */
export const singleWallId = (): string => 'wall';
