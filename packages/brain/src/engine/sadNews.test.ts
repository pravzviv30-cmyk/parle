import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { sharesSadNews } from './sadNews.ts';

describe('sharesSadNews — VOICE-015', () => {
  test('matches sad news from their own life, in English and French', () => {
    for (const line of [
      'My mother died last month.',
      'Ma mère est morte le mois dernier.',
      'Mon père est décédé en mars.',
      'My grandmother passed away this week.',
      'Mon chien est mort hier.',
      'My dad has cancer.',
      "Ma sœur est malade, elle est à l'hôpital.",
      'I just found out my friend has cancer.',
      "J'ai perdu mon grand-père, je suis triste.",
      'Since my wife died I miss her every day.',
      'My parents died when I was young.',
      'I got some sad news today.',
      'On a eu une mauvaise nouvelle hier.',
      'MON PERE EST DECEDE.',
      'We lost our cat this week.',
      'I lost my dad in the spring.',
      'My grandad is in hospital, he is very ill.',
    ]) assert.equal(sharesSadNews(line), true, line);
  });

  test('leaves ordinary scene lines and idioms alone', () => {
    for (const line of [
      'Je meurs de faim, on mange ?',
      "C'est à mourir de rire.",
      'Le café est mort de rire.',
      "Je voudrais un café, s'il vous plaît.",
      'Ce travail va me tuer.',
      'Sur place, merci.',
      'I would like a croissant.',
      'I lost my keys on the metro.',
    ]) assert.equal(sharesSadNews(line), false, line);
  });
});
