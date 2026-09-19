/** Only one daily recording can play at once, even across library cards. */
let current: { pause: () => void } | null = null;
export function ownsDailyPlayback(player: { pause: () => void }): boolean { return current === player; }
export function claimDailyPlayback(player: { pause: () => void }): void {
  if (current !== player) { try { current?.pause(); } catch { /* Released native player. */ } }
  current = player;
}
export function releaseDailyPlayback(player: { pause: () => void }): void {
  try { player.pause(); } catch { /* Already released on unmount. */ }
  if (current === player) current = null;
}
