/**
 * @luvani/core — the shared brain.
 *
 * Everything here is pure and platform-free, so the same logic runs in the Expo
 * app, in the tutor agent, and in tests. Nothing in this package touches a
 * network, a microphone, or an API key.
 */

export * from './phonemes/index.ts';
export * from './ladder/index.ts';
export * from './lessons/index.ts';
export * from './session/index.ts';
export * from './metering/index.ts';
export * from './protocol/index.ts';
export * from './progress/index.ts';
export * from './levels/index.ts';
export * from './review/index.ts';
export * from './drill/index.ts';
export * from './topics/index.ts';
export * from './path/index.ts';
export * from './missions/index.ts';
export * from './daily/index.ts';
export * from './conversationPacks.ts';
export * from './tutorBrief.ts';
export * from './auth/recent.ts';
export * from './conversationText.ts';
export * from './phraseAudio.ts';
export { readMissionTasks, type MissionTasks } from './missions/tasks.ts';
export * from './sessionSettlement.ts';
export * from './canDoEvidence.ts';

export * from './correctionReason.ts';

export * from './onboarding.ts';

export * from './streak/index.ts';
export * from './goal/index.ts';
export * from './quests/index.ts';
export * from './badges/index.ts';
export { recognitionPhrases, repairRecognizedFrench } from './speech/recognitionRepair.ts';

export { parseFirstPracticeBrief, firstPracticeScenario, firstPracticePrompt, firstPracticeNext, type FirstPracticeBrief } from './firstPractice.ts';
