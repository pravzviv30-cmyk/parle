import { seedTopicOf, type DailyScenario } from '@luvani/core';

export interface ProgressRow {
  id: string;
  kind: 'phrases' | 'sounds' | 'conversations' | 'goal' | 'saved';
  title: string;
  detail: string;
  seedTopic?: ReturnType<typeof seedTopicOf>;
}

/** Doors count saved material. An empty account is never dressed as achievement. */
export function progressRows(input: {
  phrases: number;
  sounds: boolean;
  conversations: number;
  goals: readonly { goal: string; line: string | null }[];
  saved: readonly { scenario: DailyScenario }[];
}): ProgressRow[] {
  const rows: ProgressRow[] = [];
  if (input.phrases > 0) rows.push({ id: 'phrases', kind: 'phrases', title: 'Your phrases', detail: `${input.phrases} ${input.phrases === 1 ? 'phrase' : 'phrases'} kept` });
  if (input.sounds) rows.push({ id: 'sounds', kind: 'sounds', title: 'Your sounds', detail: 'Return to your measured sound checks' });
  if (input.conversations > 0) rows.push({ id: 'conversations', kind: 'conversations', title: 'Your conversations', detail: `${input.conversations} ${input.conversations === 1 ? 'conversation' : 'conversations'} kept` });
  for (const goal of input.goals) rows.push({ id: `goal:${goal.goal}`, kind: 'goal', title: goal.goal, detail: goal.line ?? 'Choose your next scene' });
  for (const { scenario } of input.saved) rows.push({ id: `saved:${scenario.id}`, kind: 'saved', title: scenario.titleFr, detail: scenario.titleEn, seedTopic: seedTopicOf(scenario) });
  return rows;
}
