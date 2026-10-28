import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { sensitiveMemoryCategory, type SensitiveMemoryCategory } from './memoryScreen.ts';

// Leaks the screen must catch: English, French, accentless French and code-switched.
const LEAKS: ReadonlyArray<[string, SensitiveMemoryCategory]> = [
  ['Was diagnosed with cancer last year', 'health'],
  ['Takes medication for anxiety', 'health'],
  ['Is pregnant and due in May', 'health'],
  ['Has a doctor appointment on Friday', 'health'],
  ['Sees a therapist every week', 'health'],
  ['Talks about their mental health', 'health'],
  ['my diabète is getting better', 'health'],
  ['Est enceinte de six mois', 'health'],
  ['Sort de l’hôpital', 'health'],
  ['a une maladie chronique', 'health'],
  ['va chez le psy le mardi', 'health'],
  ['suit une therapie', 'health'],
  ['depression since the winter', 'health'],
  ['Est séropositif au VIH', 'health'],
  ['She had an abortion', 'health'],
  ['Elle a fait une IVG', 'health'],
  ['a fait une fausse couche', 'health'],
  ['had a miscarriage', 'health'],
  ['He is bipolar', 'health'],
  ['Il est bipolaire', 'health'],
  ['is schizophrenic', 'health'],
  ['takes antidepressants', 'health'],
  ['Elle est sous antidepresseurs', 'health'],
  ['He thought about suicide', 'health'],
  ['a des idees suicidaires', 'health'],
  ['Il prend de la drogue', 'health'],
  ['uses cocaine', 'health'],
  ['does drugs on weekends', 'health'],
  ['Elle a ses regles', 'health'],
  ['He has covid', 'health'],
  ['Is in debt after the move', 'finances'],
  ['Il est fauche', 'finances'],
  ['He is broke', 'finances'],
  ['Elle gagne 3000 euros par mois', 'finances'],
  ['earns 50k a year', 'finances'],
  ['makes $4000 a month', 'finances'],
  ['paid 1200€ rent', 'finances'],
  ['They have no money', 'finances'],
  ['n a pas d argent', 'finances'],
  ['Earns a salary of 3000 a month', 'finances'],
  ['Has a mortgage on the flat', 'finances'],
  ['mon salaire est trop bas', 'finances'],
  ['a des dettes', 'finances'],
  ['a un decouvert a la banque', 'finances'],
  ['Took out a crédit immobilier', 'finances'],
  ['Is on chômage since March', 'finances'],
  ['mes revenus ont baissé', 'finances'],
  ['son revenu est faible', 'finances'],
  ['a un revenu mensuel de 2000', 'finances'],
  ['ses revenus annuels', 'finances'],
  ['une famille à faibles revenus', 'finances'],
  ['cherche un revenu fixe', 'finances'],
  ['je suis gay', 'intimate'],
  ['Is going through a divorce', 'intimate'],
  ['Uses Tinder in Paris', 'intimate'],
  ['Elle est lesbienne', 'intimate'],
  ['their sex life', 'intimate'],
  ['a vie sexuelle compliquee', 'intimate'],
  ['Had a breakup in June', 'intimate'],
  ['They broke up last spring', 'intimate'],
  ['est divorcée depuis 2020', 'intimate'],
  ['Votes for the left-wing party', 'beliefs'],
  ['Est de droite', 'beliefs'],
  ['vote à gauche', 'beliefs'],
  ['Goes to church on Sundays', 'beliefs'],
  ['Is a practising Muslim', 'beliefs'],
  ['Va à la mosquée le vendredi', 'beliefs'],
  ['Est catholique pratiquant', 'beliefs'],
  ['Fasts during Ramadan', 'beliefs'],
  ['Cares about the election', 'beliefs'],
  ['ne croit pas en Dieu', 'beliefs'],
  ['est athee', 'beliefs'],
  ['Is a member of a parti politique', 'beliefs'],
  ['supports Le Pen', 'beliefs'],
  ['likes Macron', 'beliefs'],
  ['vote Melenchon', 'beliefs'],
  ['fan de Zemmour', 'beliefs'],
  ['soutient le RN', 'beliefs'],
  ['milite à LFI', 'beliefs'],
  ['hates Trump', 'beliefs'],
  ['Biden fan', 'beliefs'],
  ['likes Harris', 'beliefs'],
  ['supports Labour', 'beliefs'],
  ['the Tories', 'beliefs'],
  ['Elle est croyante', 'beliefs'],
  ['He is a believer', 'beliefs'],
  ['their faith matters', 'beliefs'],
  ['Il est pratiquant', 'beliefs'],
  ['Il est homo', 'intimate'],
  ['his girlfriend left him', 'intimate'],
  ['Sa copine l a quittee', 'intimate'],
  ['son copain l\u2019a quitté', 'intimate'],
  ['Their password is soleil42', 'secret'],
  ['Son code de carte est 4821', 'secret'],
  ['forgot the card code', 'secret'],
  ['est sans papiers', 'secret'],
  ['is undocumented', 'secret'],
  ['has a criminal record', 'secret'],
  ['a un casier judiciaire', 'secret'],
  ['spent a year in prison', 'secret'],
  ['was in jail', 'secret'],
  ['a fini en garde a vue', 'secret'],
  ['mot de passe is chaton', 'secret'],
  ['Le code PIN est 1234', 'secret'],
  ['IBAN FR76 3000 6000 0112 3456 7890 189', 'secret'],
  ['Lives at 12 rue de la Paix', 'secret'],
  ['Lives at 221B Baker Street', 'secret'],
  ['Habite au 3 bis avenue Foch', 'secret'],
  ['Phone 06 12 34 56 78', 'secret'],
  ['Call +33 6 12 34 56 78', 'secret'],
  ['Email x@y.fr', 'secret'],
  ['account number 12345678', 'secret'],
  ['numero de carte 4970 1012 3456 7890', 'secret'],
];

// Ordinary context the policy welcomes; must stay null.
const BENIGN: readonly string[] = [
  "Practising French with their partner's family in Lyon", // memoryPolicy.ts: PERSONAL_MEMORY_RULE, "An ordinary goal such as practising French with a partner's family in Lyon is eligible"
  'Learning pharmacy vocabulary for work', // memoryPolicy.ts: PERSONAL_MEMORY_RULE, "A general goal such as learning pharmacy vocabulary is eligible"
  'Has a job interview on Tuesday', // memoryPolicy.ts: PERSONAL_MEMORY_RULE, "learning goals ... ordinary family or travel context"
  'Loves cooking', // memoryPolicy.ts: PERSONAL_MEMORY_RULE, "everyday interests"
  'Trip to Montréal in May', // memoryPolicy.ts: PERSONAL_MEMORY_RULE, "travel context"
  'tourner à droite', // ordinary directions, not politics
  'un café en terrasse', // memoryPolicy.ts: PERSONAL_MEMORY_CONDUCT, "practising prices at a café"
  'Prefers short sessions in the morning', // memoryPolicy.ts: PERSONAL_MEMORY_RULE, "practice preferences"
  'Wants to order at a restaurant',
  'Is visiting Paris with their sister', // memoryPolicy.ts: PERSONAL_MEMORY_RULE, "ordinary family ... context"
  'Works as a teacher',
  'Plays the guitar',
  'next month',
  'Tuesday',
  // Near misses.
  'La boulangerie est à gauche',
  'the café on the left',
  'Booked a 2-person table',
  'Moving to Lyon in 2027',
  'Has 3 kids',
  'Struggles with the liaison in "les amis"',
  'Je vous en prie',
  "I'll be in Nice on the 14th",
  'Wants to get better at reading French novels',
  'Visiting from 12 to 15 June',
  'Je range mes affaires',
  'Loves the 5th arrondissement',
  'Takes line 14 to work',
  'Café at 10:30 every day',
  // "revenu" as the participle of revenir is a trip, not income.
  'Il est revenu de Lyon',
  'Ils sont revenus de vacances',
  'Est revenue du Japon',
  'Wants to see the Louvre with friends',
  'left Paris in June',
  'Prefers the brown bread',
  'Learning to count to 100',
  'Turns left at the station',
];

describe('sensitiveMemoryCategory', () => {
  for (const [text, category] of LEAKS) {
    test(`catches ${category}: ${text}`, () => {
      assert.equal(sensitiveMemoryCategory(text), category);
    });
  }
  for (const text of BENIGN) {
    test(`lets through: ${text}`, () => {
      assert.equal(sensitiveMemoryCategory(text), null);
    });
  }
  test('null and empty are clean', () => {
    assert.equal(sensitiveMemoryCategory(null), null);
    assert.equal(sensitiveMemoryCategory(''), null);
  });
});
