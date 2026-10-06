/**
 * "In context" reels for the audition page: each moment's sound and haptic beats, in order.
 * Drafted from the timelines in docs/come-alive/motion-sound.md section 5 and the master
 * sound and haptic table in docs/come-alive/README.md Part 5A (which caps the end card at six
 * ticks). When celebrate/timelines.ts exists it becomes the source and this file goes.
 * A laptop cannot buzz, so haptic beats are shown as text while the reel plays.
 */

/** @typedef {{ at: number, sound?: string, haptic?: string }} Beat */
/** @typedef {{ title: string, where: string, beats: Beat[] }} Reel */

/** @param {number} from @param {number} count @param {number} every @returns {Beat[]} */
const ticks = (from, count, every) =>
  Array.from({ length: count }, (_, i) => ({ at: from + i * every, sound: 'count-tick', haptic: 'tick()' }));

/** @type {readonly Reel[]} */
export const REELS = [
  {
    title: 'First reply accepted',
    where: 'In place on the first-run recap, after the learner speaks.',
    beats: [{ at: 120, sound: 'correct', haptic: 'celebrate()' }],
  },
  {
    title: 'Drill: right, then nearly',
    where: 'A right answer, then a typo on the next card.',
    beats: [{ at: 0, sound: 'correct', haptic: 'arrived()' }, { at: 1200, sound: 'nearly', haptic: 'soft()' }],
  },
  {
    title: 'Practice complete',
    where: 'The end card, in place: XP counting up, then the goal ring closing.',
    beats: [
      { at: 0, sound: 'whoosh' },
      { at: 120, sound: 'complete', haptic: 'celebrate()' },
      ...ticks(560, 6, 90),
      { at: 1950, haptic: 'thump()' },
    ],
  },
  {
    title: 'Streak extended',
    where: 'After leaving the end card, the flame lights and the number turns over.',
    beats: [{ at: 0, sound: 'streak', haptic: 'thump()' }, { at: 420, haptic: 'arrived()' }, { at: 700, haptic: 'tick()' }],
  },
  {
    title: 'Streak milestone',
    where: 'Days 7, 30, 100 and 365: the flame, then the medal ring closes.',
    beats: [{ at: 0, sound: 'streak', haptic: 'thump()' }, { at: 1150, sound: 'badge', haptic: 'celebrate()' }],
  },
  {
    title: 'Daily goal met',
    where: 'The goal ring fills and closes.',
    beats: [{ at: 0, haptic: 'tick()' }, { at: 650, sound: 'complete', haptic: 'arrived()' }],
  },
  {
    title: 'All three quests done',
    where: 'The end card of the practice that finished the third daily quest: one quiet line, "All three quests done today."',
    beats: [
      { at: 120, sound: 'complete', haptic: 'celebrate()' },
      { at: 1500, sound: 'quest' },
    ],
  },
  {
    title: 'Level up',
    where: 'The bar fills and the new level arrives.',
    beats: [{ at: 200, sound: 'levelup', haptic: 'celebrate()' }],
  },
  {
    title: 'Badge earned',
    where: 'The medal drops and its ribbon unrolls.',
    beats: [{ at: 350, sound: 'badge', haptic: 'arrived()' }],
  },
  {
    title: 'Purchase confirmed',
    where: 'Only after the store confirms the plan.',
    beats: [
      { at: 0, sound: 'save', haptic: 'arrived()' },
      { at: 420, sound: 'complete', haptic: 'celebrate()' },
      ...ticks(420, 6, 90),
    ],
  },
  {
    title: 'Phrase saved, plan ready, a chip lands',
    where: 'Saving a phrase; the plan page arriving after setup; a chip landing.',
    beats: [{ at: 0, sound: 'save', haptic: 'arrived()' }, { at: 900, sound: 'select', haptic: 'tapSettled()' }, { at: 1500, sound: 'tap' }],
  },
];
