import type { PracticePreferences } from '../profile/practicePreferences.ts';

/** Presentation choices only. They never award or change assessed ability. */
export function learningSuggestions(preferences: PracticePreferences, earnedTier: 1 | 2 | 3 = 1) {
  const { level, confidence, focus } = preferences;
  const fresh = level === 'zero' || level === 'few';
  const fluent = level === 'confident';
  const support = confidence === 'hesitant'
    ? 'Ask for an example whenever you need one.'
    : confidence === 'comfortable' ? 'Try in French first. Ask for help whenever you want it.'
    : 'Take your time. Hints and writing are always available.';
  const ideas = fresh ? [
    { title: level === 'zero' ? 'Order something you like' : 'Make a simple plan', detail: 'A short exchange, with help close by.', fr: level === 'zero' ? 'Au café' : 'Un petit projet', en: level === 'zero' ? 'Order at a café with me using short French replies.' : 'Help me make a simple plan with a few French words.' },
    { title: 'Tell me about yourself', detail: 'Start with a few things you enjoy.', fr: 'Ce que j’aime', en: 'Help me talk about what I enjoy with short French replies.' },
  ] : fluent ? [
    { title: 'Tell a story worth sharing', detail: 'Add the details, explain a reaction and answer follow-up questions.', fr: 'Une histoire à raconter', en: 'Explore a story in French with detail, nuance and natural follow-up questions.' },
    { title: 'Make your case', detail: 'Compare two ideas and explain what would change your mind.', fr: 'À mon avis', en: 'Discuss an opinion in French. Explore trade-offs and a different view with nuance.' },
  ] : [
    { title: 'Tell me about your day', detail: 'Explain what happened and follow the conversation wherever it goes.', fr: 'Ma journée', en: 'Discuss my day in French. Ask why things happened and help me connect the details.' },
    { title: 'Make plans with a friend', detail: 'Compare options and agree on a time and place.', fr: 'Une sortie entre amis', en: 'Make plans in French. Compare options, then agree on an activity, time and place.' },
  ];
  const supportCue = confidence === 'hesitant' ? 'Offer an example.' : confidence === 'comfortable' ? 'Let me try first.' : 'Hints if I ask.';
  const levelCue = level === 'zero' ? 'Starting French; short replies.' : level === 'few' ? 'A few words; short exchanges.' : level === 'getby' ? 'I get by; connect my ideas.' : level === 'confident' ? 'Confident speaker; explore nuance.' : '';
  const focusCue = focus === 'listening' ? 'Help me hear French.' : focus === 'words' ? 'Useful words in context.' : focus === 'speaking' ? 'Help me speak.' : '';
  return {
    fresh, fluent, support,
    ideas: ideas.map(idea => ({ ...idea, en: `${idea.en} ${supportCue}` })),
    freeSeed: level === null && confidence === null && focus === null ? undefined : {
      fr: 'Une conversation libre',
      en: ['Talk about anything.', levelCue, supportCue, focusCue].filter(Boolean).join(' '),
    },
    homeBody: fresh ? 'Start with a short exchange. Your tutor will help you find the words.' : fluent ? 'Bring a story, an opinion or something you want to say more naturally.' : 'Talk about your day, your plans or anything on your mind.',
    collection: fluent ? { title: 'Stories & opinions', body: 'Explain a choice. Tell the whole story. Find a more natural way to say it.' } : { title: 'Plans & stories', body: fresh ? 'Make a simple plan. Share a small moment. Build a conversation at your pace.' : 'Make a plan. Share a moment. Find a conversation worth having.' },
    focusTitle: focus === 'listening' ? 'Hear it, then try it' : focus === 'words' ? 'Words you can use today' : 'Try saying it your way',
    focusDetail: focus === 'listening' ? 'Hear a recorded reply, then practise the line.' : focus === 'words' ? 'Read a useful phrase, then put it into a reply.' : 'Take a useful line into your next conversation.',
    // Existing catalogue tiers are a pitch, never a CEFR certificate. Search
    // remains complete; only the default order changes with the stated level.
    preferredTier: Math.max(earnedTier, fluent ? 3 : level === 'getby' ? 2 : 1) as 1 | 2 | 3,
  };
}
