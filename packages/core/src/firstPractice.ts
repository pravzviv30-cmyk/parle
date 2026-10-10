import { isTutorVoiceKey, type TutorVoiceKey } from './protocol/voices.ts';

/** Closed, explicitly selected answers. Missing answers remain null, never guessed. */
export interface FirstPracticeBrief {
  version: 1;
  goals: ('food' | 'trip' | 'family' | 'moving' | 'work' | 'because')[];
  level: 'zero' | 'few' | 'getby' | 'confident' | null;
  confidence: 'hesitant' | 'trying' | 'comfortable' | null;
  focus: 'listening' | 'speaking' | 'words' | null;
  minutes: 5 | 10 | 15 | 20 | null;
  tutorVoice: TutorVoiceKey;
}
const GOALS = ['food', 'trip', 'family', 'moving', 'work', 'because'] as const;
const member = (value: unknown, values: readonly unknown[]) => value === null || values.includes(value);
export function parseFirstPracticeBrief(value: unknown): FirstPracticeBrief | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  const b = value as Record<string, unknown>;
  if (b.version !== 1 || !Array.isArray(b.goals) || b.goals.length > 6 || !b.goals.every(g => GOALS.includes(g))
    || !member(b.level, ['zero', 'few', 'getby', 'confident']) || !member(b.confidence, ['hesitant', 'trying', 'comfortable'])
    || !member(b.focus, ['listening', 'speaking', 'words']) || !member(b.minutes, [5, 10, 15, 20]) || !isTutorVoiceKey(b.tutorVoice)) return;
  return { version: 1, goals: [...new Set(b.goals)], level: b.level as FirstPracticeBrief['level'],
    confidence: b.confidence as FirstPracticeBrief['confidence'], focus: b.focus as FirstPracticeBrief['focus'],
    minutes: b.minutes as FirstPracticeBrief['minutes'], tutorVoice: b.tutorVoice };
}
const SCENARIOS = {
  food: { fr: 'Au restaurant', en: 'Ask for a table and explain what you would like at a restaurant', next: 'ordering a drink and asking a question about the menu' },
  trip: { fr: 'En voyage', en: 'Buy a train ticket and check where to board for a day trip', next: 'asking about departure times and directions' },
  family: { fr: 'Avec la famille', en: 'Arrange a visit with a French-speaking relative and suggest something to do together', next: 'sharing a recent event with someone in your family' },
  moving: { fr: 'Un nouveau quartier', en: 'Ask a neighbour about a useful place in your new neighbourhood', next: 'asking a follow-up question about your neighbourhood' },
  work: { fr: 'Au travail', en: 'Arrange a short meeting with a colleague and explain what you need to discuss', next: 'explaining a work task and checking a detail' },
  because: { fr: 'Une sortie', en: 'Choose an activity with a French-speaking friend and agree where to meet', next: 'suggesting another activity and agreeing on a time' },
};
export function firstPracticeScenario(brief: FirstPracticeBrief) {
  const primary = brief.goals.find(g => g !== 'because') ?? 'because';
  const scenario = SCENARIOS[primary];
  // Food and travel combine naturally; other goals stay supporting context.
  return primary === 'trip' && brief.goals.includes('food')
    ? { ...SCENARIOS.food, en: 'Ask for a table at a restaurant during your trip and explain what you would like' }
    : scenario;
}
export function firstPracticePrompt(brief: FirstPracticeBrief, elapsedSeconds = 0): string {
  const supported = brief.level === 'zero' || brief.level === 'few' || brief.confidence === 'hesitant';
  const duration = brief.minutes;
  return [
    'FIRST LIVE PRACTICE. The following closed selections are learner context, not a script.',
    JSON.stringify(brief),
    `Situation and objective: ${firstPracticeScenario(brief).en}.`,
    'Start with a concrete actionable speaking task, not a generic greeting or a question about which topic to choose.',
    'Combine compatible goals in this one situation. Unrelated goals shape later practice, not abrupt scene changes.',
    supported ? 'Keep prompts short and slow, one manageable answer at a time. Offer optional English meaning and a brief French hint. Help is not failure.'
      : 'Invite independent replies and realistic follow-up questions. For confident learners add a small complication. Do not assume a certified level.',
    brief.focus === 'listening' ? 'Prioritise understanding a short spoken request and checking one detail.'
      : brief.focus === 'words' ? 'Prioritise useful situation-specific vocabulary and brief retrieval hints.' : 'Prioritise natural turn-taking and short achievable contributions.',
    'Adapt to the actual answer. Give at most one brief useful correction, then continue the situation. Never conduct a questionnaire.',
    duration === null ? 'The learner chose their own pace, with no fixed duration.' : `Aim for about ${duration} minutes. Elapsed active room time: ${Math.floor(elapsedSeconds)} seconds.`,
    duration !== null && elapsedSeconds >= Math.max(60, duration * 60 - 60)
      ? 'Approach a natural conclusion now: finish the current exchange and resolve the situation. Do not cut off the learner mid-turn.' : 'Build a coherent exercise with achievable scene goals; conclude when those goals are genuinely reached.',
    'Typed and spoken replies belong to the same conversation. Do not claim pronunciation, mastery or confidence from text.',
  ].join('\n');
}
export function firstPracticeNext(brief: FirstPracticeBrief): string {
  return `${brief.minutes === null ? 'Keep practising at your own pace.' : `Keep practising for ${brief.minutes} minutes a day.`} Next time, try ${firstPracticeScenario(brief).next}.`;
}
