import { onboardingC2 as C2 } from '../palette.ts';
export { onboardingC2 as C2 } from '../palette.ts';

export function c2Ground(page: string): string {
  if (page === 'hear-it') return C2.welcome;
  if (page === 'confidence' || page === 'name') return C2.reflection;
  if (page === 'time') return C2.calm;
  if (page === 'plan' || page === 'account-welcome') return C2.violet;
  return C2.reading;
}

export const C2_QUESTION_COPY = {
  reason: { title: 'What brings you\nto French?', detail: 'Choose one reason. You can adjust it later.' },
  'start-level': { title: 'What can you say\nin French?', detail: 'Choose the closest fit. You can change it later.' },
  confidence: { title: 'How would you\nlike to start?', detail: 'This changes the help, not the challenge.' },
  focus: { title: 'What would you\nlike to work on?', detail: 'Choose what matters most. You can change this later.' },
  time: { title: 'How much time\ndo you have?', detail: 'Choose a usual length. You can change it later.' },
} as const;

export const C2_GOALS = {
  trip: { title: 'Travel', detail: 'Feel at home away from home', asset: '61-409-imgMiniatureTravel.svg' },
  food: { title: 'Food & cafés', detail: 'Order something you love', asset: '61-409-imgMiniatureFoodCafes.svg' },
  family: { title: 'Family & friends', detail: 'Make more of your time together', asset: '61-409-imgMiniatureFamilyFriends.svg' },
  moving: { title: 'Moving to France', detail: 'Find your feet in everyday life', asset: '61-409-imgMiniatureMovingToFrance.svg' },
  work: { title: 'Work', detail: 'Join the conversation', asset: '61-409-imgMiniatureWork.svg' },
  because: { title: 'Just for me', detail: 'Follow your curiosity', asset: '61-409-imgMiniatureJustForMe.svg' },
} as const;

export const C2_OPTION_COPY = {
  hesitant: { title: 'Show me an example', detail: 'See a possible reply before I try.' },
  trying: { title: 'Give me a hint if I need it', detail: 'Try first, with help close by.' },
  comfortable: { title: 'Let me try first', detail: 'Keep examples hidden until I ask.' },
  speaking: { title: 'Speaking', detail: 'Find the words and say them' },
  listening: { title: 'Listening', detail: 'Catch more of what you hear' },
  words: { title: 'Useful words', detail: 'Build everyday vocabulary' },
} as const;
