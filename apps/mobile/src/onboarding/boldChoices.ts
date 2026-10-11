import type { Interest, PreAccountPage } from './preAccountDraft.ts';
export const INTERESTS: readonly { key: Interest; title: string; detail: string }[] = [
  { key: 'food', title: 'Food & cafés', detail: 'A coffee, a market, a good meal' },
  { key: 'travel', title: 'Travel & places', detail: 'Near and far' },
  { key: 'music', title: 'Music & films', detail: 'The things you keep coming back to' },
  { key: 'everyday', title: 'Everyday life', detail: 'Little moments, real conversations' },
];
export const BOLD_QUESTIONS: Partial<Record<PreAccountPage, { title: string; detail: string }>> = {
  reason: { title: 'What brings you\nto French?', detail: 'Choose the reason that feels most like you.' },
  interests: { title: 'What do you love\ntalking about?', detail: 'Choose a few. Your tutor will follow your interests.' },
  'start-level': { title: 'Where is your\nFrench today?', detail: 'No test. We’ll meet you where you are.' },
  confidence: { title: 'How does speaking\nFrench feel?', detail: 'There’s room to pause, try and try again.' },
  focus: { title: 'What would you\nlike to practise?', detail: 'We’ll build your first conversation around it.' },
  time: { title: 'A little time\nfor your French.', detail: 'How much would you like to practise each day?' },
};
export const BOLD_GOALS = [
  { key: 'trip', title: 'Travel', detail: 'Feel at home away from home' },
  { key: 'food', title: 'Food & cafés', detail: 'Order something you love' },
  { key: 'family', title: 'Family & friends', detail: 'Make more of your time together' },
  { key: 'moving', title: 'Moving to France', detail: 'Find your feet in everyday life' },
  { key: 'work', title: 'Work', detail: 'Join the conversation' },
  { key: 'because', title: 'Just for me', detail: 'Follow your curiosity' },
] as const;
