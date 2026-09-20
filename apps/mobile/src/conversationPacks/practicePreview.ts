/** Development-only story data. Never inserted into a learner's stores. */
import { buildConversationPack } from '@luvani/core';

export const PRACTICE_PREVIEW = buildConversationPack({
  id: 'preview', sessionId: 'preview', learnerId: 'design-preview', createdAt: '2026-09-20T12:00:00Z',
  title: { fr: 'Un matin au café', en: 'A morning at the café' },
  summary: 'A sample conversation about ordering breakfast.',
  keyPhrases: [
    { fr: 'Je voudrais un café.', en: 'I would like a coffee.', frWritten: null },
    { fr: 'Sur place, merci.', en: 'For here, thanks.', frWritten: null },
    { fr: 'Vous avez des croissants ?', en: 'Do you have croissants?', frWritten: null },
    { fr: 'Ça fait combien ?', en: 'How much is it?', frWritten: null },
  ],
});
