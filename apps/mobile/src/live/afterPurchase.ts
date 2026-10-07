/** Resume only the refused route still immediately behind this account's wall. */
export interface ResumeRoute { key: string; name: string; params?: object }
export function afterPurchase(input: {
  granted: boolean; canStart: boolean; ownsAccount: boolean;
  resumeRouteKey?: string; wallKey: string;
  state: { index: number; routes: readonly ResumeRoute[] };
}): { index: number; routes: ({ key?: string; name: string; params?: object })[] } | null {
  const { state } = input;
  if (!input.granted || !input.canStart || !input.ownsAccount || !input.resumeRouteKey) return null;
  if (state.index !== state.routes.length - 1 || state.routes[state.index]?.key !== input.wallKey) return null;
  const origin = state.routes[state.index - 1];
  if (!origin || origin.key !== input.resumeRouteKey || !['Convo', 'Lesson'].includes(origin.name)) return null;
  // Drop both the refused instance and the wall. A fresh route key remounts the
  // existing session lifecycle with exactly its original mission/mode/context.
  return { index: state.index - 1, routes: [...state.routes.slice(0, -2), { name: origin.name, params: origin.params }] };
}
