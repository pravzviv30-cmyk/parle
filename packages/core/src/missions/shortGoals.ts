/**
 * Short goal labels for the live room's stamps (UI-014, direction D).
 *
 * The room's goals are brain frame beats, and their English is a full
 * sentence ("Say hello and order a coffee"). The stamps show a short label
 * beside them ("Order a coffee"). The labels live here, in core, keyed by
 * `missionId:beatId`, so there is no wire change and no agent redeploy. A beat
 * with no label falls back to its full sentence on the client.
 *
 * The table ships empty: the founder approves every label before it fills.
 */
export const SHORT_GOALS: Readonly<Record<string, string>> = {};

/** The short label for one beat, or null when none is approved yet. */
export function shortGoalLabel(missionId: string, beatId: string, table: Readonly<Record<string, string>> = SHORT_GOALS): string | null {
  const label = table[`${missionId}:${beatId}`];
  return typeof label === 'string' && label.trim().length > 0 ? label : null;
}
