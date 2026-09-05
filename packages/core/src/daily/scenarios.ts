/**
 * The daily situation pool.
 *
 * Home's second card offers one scene to talk through today, and tapping it
 * opens a live session seeded with that scene. So unlike a mission, a scenario
 * here teaches the agent nothing: it rides the existing `seedTopic` pipe, which
 * carries exactly two strings and no structure at all.
 *
 * That pipe is why this file has a character cap in it. The token server drops
 * a seed topic longer than `MAX_SEED_TOPIC_CHARS` rather than truncating it,
 * and a dropped seed is a tutor that opens on nothing in particular while the
 * card on screen promises a café. `SEED_TOPIC_MAX` mirrors that number and the
 * test refuses any entry that would not survive the trip.
 *
 * A scenario is a situation, not a lesson. It names where the learner is, what
 * they are trying to get done, and the first thing they could say. Everything
 * after that first line is a real conversation, which is the point: the
 * missions are the scaffolded version and they are pinned to the agent's
 * frames, so a scenario is deliberately the loose one.
 *
 * Same content rules as `words.ts`: permanent ids, no digits, no em dash, no
 * filler, and English a learner reads rather than decodes. `place` is a
 * `MissionPlace` because the disc art is already drawn per place, and inventing
 * a second vocabulary of places would mean a second set of illustrations.
 */

import type { MissionPlace } from '../missions/missions.ts';

export interface DailyScenario {
  /** Stable id, e.g. 'situation:cafe-terrace'. Never reused, never renumbered. */
  id: string;
  /** The card's headline, in English. */
  titleEn: string;
  /** The French name of the scene, and the `fr` half of the seed topic. */
  titleFr: string;
  /** Two short sentences: what the learner is doing, and why. The `en` half. */
  bodyEn: string;
  /** The first line the learner could say, in French. */
  openingFr: string;
  /** That line in English. */
  openingEn: string;
  /** Which place this happens in. Picks the disc art. */
  place: MissionPlace;
}

/**
 * The longest a seed topic string may be.
 *
 * Mirrored by hand from `MAX_SEED_TOPIC_CHARS` in
 * `services/token-server/src/tokens.ts`, because core is platform-free and
 * cannot import a server. If that number ever moves, this one moves with it:
 * the server drops an over-long topic silently, so the failure mode is a card
 * that promises a scene and a tutor that never heard of it.
 */
export const SEED_TOPIC_MAX = 120;

export const DAILY_SCENARIOS: readonly DailyScenario[] = [
  // The café. Where most first conversations in France actually happen, and
  // where the same four exchanges repeat all day.
  {
    id: 'situation:cafe-terrace',
    titleEn: 'A seat on the terrace',
    titleFr: 'Une place en terrasse',
    bodyEn: 'The terrace is full and you would rather sit outside. You ask the waiter for one seat.',
    openingFr: 'Bonjour, il y a une place en terrasse ?',
    openingEn: 'Hello, is there a seat on the terrace?',
    place: 'cafe',
  },
  {
    id: 'situation:cafe-first-coffee',
    titleEn: 'Your first coffee of the day',
    titleFr: 'Le premier café',
    bodyEn: 'You are standing at the counter before work. You order a coffee and pay for it.',
    openingFr: "Bonjour, un café, s'il vous plaît.",
    openingEn: 'Hello, a coffee, please.',
    place: 'cafe',
  },
  {
    id: 'situation:cafe-bill',
    titleEn: 'Asking for the bill',
    titleFr: "Demander l'addition",
    bodyEn: 'You have finished and the waiter is busy. You catch his eye and ask to pay.',
    openingFr: "Excusez-moi, l'addition, s'il vous plaît.",
    openingEn: 'Excuse me, the bill, please.',
    place: 'cafe',
  },
  {
    id: 'situation:cafe-bakery-counter',
    titleEn: 'At the bakery counter',
    titleFr: 'Au comptoir de la boulangerie',
    bodyEn: 'The queue is long and it moves fast. You order bread and answer one quick question.',
    openingFr: "Bonjour, une baguette, s'il vous plaît.",
    openingEn: 'Hello, a baguette, please.',
    place: 'cafe',
  },
  {
    id: 'situation:cafe-menu-question',
    titleEn: 'A dish you cannot place',
    titleFr: 'Un plat sur la carte',
    bodyEn: 'One line on the menu means nothing to you. You ask the waiter what is in it.',
    openingFr: "Excusez-moi, c'est quoi, le plat du jour ?",
    openingEn: 'Excuse me, what is the dish of the day?',
    place: 'cafe',
  },
  {
    id: 'situation:cafe-water',
    titleEn: 'A jug of water',
    titleFr: "Une carafe d'eau",
    bodyEn: 'You are thirsty and the bottles are expensive. You ask for tap water instead.',
    openingFr: "Une carafe d'eau, s'il vous plaît.",
    openingEn: 'A jug of tap water, please.',
    place: 'cafe',
  },
  {
    id: 'situation:cafe-take-away',
    titleEn: 'Eating in or taking away',
    titleFr: 'Sur place ou à emporter',
    bodyEn: 'You are in a hurry and the counter asks the usual question. You answer it.',
    openingFr: "À emporter, s'il vous plaît.",
    openingEn: 'To take away, please.',
    place: 'cafe',
  },
  {
    id: 'situation:cafe-wrong-order',
    titleEn: 'The wrong drink arrives',
    titleFr: "Ce n'est pas ma commande",
    bodyEn: 'A tea lands on your table and you ordered coffee. You say so, kindly.',
    openingFr: "Pardon, j'avais commandé un café.",
    openingEn: 'Sorry, I had ordered a coffee.',
    place: 'cafe',
  },
  {
    id: 'situation:cafe-sharing-table',
    titleEn: 'Sharing a table',
    titleFr: 'Partager une table',
    bodyEn: 'Every table is taken except one with a stranger at it. You ask to sit down.',
    openingFr: 'Bonjour, la place est libre ?',
    openingEn: 'Hello, is this seat free?',
    place: 'cafe',
  },
  {
    id: 'situation:cafe-paying-card',
    titleEn: 'Paying by card',
    titleFr: 'Payer par carte',
    bodyEn: 'You have no cash and a very small bill. You check whether the card is fine.',
    openingFr: 'Je peux payer par carte ?',
    openingEn: 'May I pay by card?',
    place: 'cafe',
  },
  {
    id: 'situation:cafe-evening-drink',
    titleEn: 'A drink after work',
    titleFr: 'Un verre après le travail',
    bodyEn: 'You meet a colleague and the bar is loud. You order for both of you.',
    openingFr: "Deux verres de vin rouge, s'il vous plaît.",
    openingEn: 'Two glasses of red wine, please.',
    place: 'cafe',
  },

  // The market and the shops. Short exchanges, a lot of numbers, and a seller
  // who will happily talk if you start.
  {
    id: 'situation:market-apples',
    titleEn: 'A kilo of apples',
    titleFr: 'Un kilo de pommes',
    bodyEn: 'The stall is busy and the seller is quick. You ask for a kilo and pay.',
    openingFr: "Bonjour, un kilo de pommes, s'il vous plaît.",
    openingEn: 'Hello, a kilo of apples, please.',
    place: 'market',
  },
  {
    id: 'situation:market-cheese',
    titleEn: 'Choosing a cheese',
    titleFr: 'Choisir un fromage',
    bodyEn: 'You want cheese for tonight and there are thirty of them. You ask for advice.',
    openingFr: 'Bonjour, je cherche un fromage pour ce soir.',
    openingEn: 'Hello, I am looking for a cheese for this evening.',
    place: 'market',
  },
  {
    id: 'situation:market-price',
    titleEn: 'Asking the price',
    titleFr: 'Demander le prix',
    bodyEn: 'Nothing on this stall has a label on it. You point and ask what it costs.',
    openingFr: "C'est combien, s'il vous plaît ?",
    openingEn: 'How much is it, please?',
    place: 'market',
  },
  {
    id: 'situation:market-bag',
    titleEn: 'You have no bag',
    titleFr: "Je n'ai pas de sac",
    bodyEn: 'Your hands are full at the till. You ask whether you can have a bag.',
    openingFr: 'Est-ce que je peux avoir un sac ?',
    openingEn: 'May I have a bag?',
    place: 'market',
  },
  {
    id: 'situation:market-taste',
    titleEn: 'A taste before you buy',
    titleFr: "Goûter avant d'acheter",
    bodyEn: 'The seller offers you a sliver of cheese. You take it and say what you think.',
    openingFr: 'Je peux goûter ?',
    openingEn: 'May I taste it?',
    place: 'market',
  },
  {
    id: 'situation:market-half',
    titleEn: 'Half of that is plenty',
    titleFr: 'La moitié, ça suffit',
    bodyEn: 'The seller reaches for far more than you need. You ask for half of it.',
    openingFr: 'La moitié, ça suffit, merci.',
    openingEn: 'Half is enough, thank you.',
    place: 'market',
  },
  {
    id: 'situation:market-strawberries',
    titleEn: 'The first strawberries',
    titleFr: 'Les premières fraises',
    bodyEn: 'The fruit at the front looks good and the price is high. You buy a small basket.',
    openingFr: "Une petite barquette de fraises, s'il vous plaît.",
    openingEn: 'A small basket of strawberries, please.',
    place: 'market',
  },
  {
    id: 'situation:market-change',
    titleEn: 'Waiting for your change',
    titleFr: 'Attendre la monnaie',
    bodyEn: 'You paid with a large note and the seller turned away. You ask politely.',
    openingFr: "Excusez-moi, la monnaie, s'il vous plaît.",
    openingEn: 'Excuse me, my change, please.',
    place: 'market',
  },
  {
    id: 'situation:market-last-stall',
    titleEn: 'The last stall of the morning',
    titleFr: 'Le dernier étal du matin',
    bodyEn: 'The market is packing up around you. You buy the last thing on your list.',
    openingFr: 'Bonjour, il vous reste des tomates ?',
    openingEn: 'Hello, do you have any tomatoes left?',
    place: 'market',
  },
  {
    id: 'situation:market-pharmacy',
    titleEn: 'At the pharmacy',
    titleFr: 'À la pharmacie',
    bodyEn: 'You have a sore throat and no idea what to buy. You describe it and listen.',
    openingFr: "Bonjour, j'ai mal à la gorge.",
    openingEn: 'Hello, I have a sore throat.',
    place: 'market',
  },
  {
    id: 'situation:market-butcher',
    titleEn: 'At the butcher',
    titleFr: 'Chez le boucher',
    bodyEn: 'You are cooking for friends tonight. You ask for chicken and say how much.',
    openingFr: "Bonjour, un poulet, s'il vous plaît.",
    openingEn: 'Hello, a chicken, please.',
    place: 'market',
  },
  {
    id: 'situation:market-supermarket-till',
    titleEn: 'At the supermarket till',
    titleFr: 'À la caisse du supermarché',
    bodyEn: 'The queue is long and the cashier asks two questions. You answer both.',
    openingFr: 'Bonjour, par carte, merci.',
    openingEn: 'Hello, by card, thank you.',
    place: 'market',
  },

  // The street, the métro and the station. Short questions to strangers, which
  // is the hardest thing a beginner does and the most useful.
  {
    id: 'situation:street-metro-ticket',
    titleEn: 'Buying a métro ticket',
    titleFr: 'Acheter un ticket de métro',
    bodyEn: 'The machine is in French and the queue is long. You ask at the window instead.',
    openingFr: "Bonjour, un ticket, s'il vous plaît.",
    openingEn: 'Hello, one ticket, please.',
    place: 'street',
  },
  {
    id: 'situation:street-which-line',
    titleEn: 'Which line goes there',
    titleFr: 'Quelle ligne y va',
    bodyEn: 'You are in a big station and the map is a knot. You ask a member of staff.',
    openingFr: 'Excusez-moi, quelle ligne va à Bastille ?',
    openingEn: 'Excuse me, which line goes to Bastille?',
    place: 'street',
  },
  {
    id: 'situation:street-wrong-direction',
    titleEn: 'Checking you are on the right side',
    titleFr: 'Le bon sens',
    bodyEn: 'You are on the platform and the signs are unclear. You check with someone waiting.',
    openingFr: 'Pardon, ce train va bien à Nation ?',
    openingEn: 'Sorry, does this train go to Nation?',
    place: 'street',
  },
  {
    id: 'situation:street-asking-directions',
    titleEn: 'Asking the way',
    titleFr: 'Demander le chemin',
    bodyEn: 'The street you want is not on your map. You stop someone and ask.',
    openingFr: 'Excusez-moi, où est la rue de Rivoli ?',
    openingEn: 'Excuse me, where is rue de Rivoli?',
    place: 'street',
  },
  {
    id: 'situation:street-museum',
    titleEn: 'Finding the museum',
    titleFr: 'Trouver le musée',
    bodyEn: 'You are nearly at the museum and cannot see it. You ask a passer by.',
    openingFr: "Excusez-moi, le musée est loin d'ici ?",
    openingEn: 'Excuse me, is the museum far from here?',
    place: 'street',
  },
  {
    id: 'situation:street-taxi',
    titleEn: 'Taking a taxi',
    titleFr: 'Prendre un taxi',
    bodyEn: 'It is raining and you have a train to catch. You give the driver the address.',
    openingFr: "Bonjour, à la gare de Lyon, s'il vous plaît.",
    openingEn: 'Hello, to gare de Lyon, please.',
    place: 'street',
  },
  {
    id: 'situation:street-train-late',
    titleEn: 'The train is running late',
    titleFr: 'Le train a du retard',
    bodyEn: 'The board says your train is late and says nothing else. You ask at the desk.',
    openingFr: 'Bonjour, le train pour Lille a du retard ?',
    openingEn: 'Hello, is the train to Lille running late?',
    place: 'street',
  },
  {
    id: 'situation:street-platform',
    titleEn: 'Which platform',
    titleFr: 'Quel quai',
    bodyEn: 'Your train leaves soon and the platform is not up yet. You ask.',
    openingFr: "Excusez-moi, c'est quel quai pour Rouen ?",
    openingEn: 'Excuse me, which platform is it for Rouen?',
    place: 'street',
  },
  {
    id: 'situation:street-exit',
    titleEn: 'Finding the right way out',
    titleFr: 'Trouver la bonne sortie',
    bodyEn: 'The station has six exits and you want one street. You ask which one.',
    openingFr: 'Excusez-moi, quelle sortie pour la rue Monge ?',
    openingEn: 'Excuse me, which exit is it for rue Monge?',
    place: 'street',
  },
  {
    id: 'situation:street-bag-on-the-train',
    titleEn: 'A bag left on the train',
    titleFr: 'Un sac oublié dans le train',
    bodyEn: 'You get off and your bag is still on the seat. You tell the staff at once.',
    openingFr: "Bonjour, j'ai oublié mon sac dans le train.",
    openingEn: 'Hello, I left my bag on the train.',
    place: 'street',
  },
  {
    id: 'situation:street-bus',
    titleEn: 'Catching the bus',
    titleFr: 'Prendre le bus',
    bodyEn: 'The stop serves two lines and has no map. You ask the driver before you get on.',
    openingFr: 'Bonjour, ce bus va au marché ?',
    openingEn: 'Hello, does this bus go to the market?',
    place: 'street',
  },
  {
    id: 'situation:street-an-hour-to-spare',
    titleEn: 'An hour to spare',
    titleFr: 'Une heure devant soi',
    bodyEn: 'Your train is not for an hour and the station is dull. You ask what is worth seeing.',
    openingFr: "Excusez-moi, il y a quoi à voir près d'ici ?",
    openingEn: 'Excuse me, what is there to see near here?',
    place: 'street',
  },

  // The hotel desk. One person, patient, and used to being asked things twice.
  {
    id: 'situation:hotel-check-in',
    titleEn: 'Arriving at the hotel',
    titleFr: "L'arrivée à l'hôtel",
    bodyEn: 'You arrive with a booking and a heavy bag. You give your name and take the key.',
    openingFr: "Bonjour, j'ai une réservation au nom de Martin.",
    openingEn: 'Hello, I have a booking in the name of Martin.',
    place: 'hotel',
  },
  {
    id: 'situation:hotel-late-arrival',
    titleEn: 'Arriving late',
    titleFr: 'Une arrivée tardive',
    bodyEn: 'Your train is late and the desk shuts at ten. You call ahead to say so.',
    openingFr: 'Bonjour, je vais arriver après dix heures.',
    openingEn: 'Hello, I am going to arrive after ten.',
    place: 'hotel',
  },
  {
    id: 'situation:hotel-quieter-room',
    titleEn: 'A quieter room',
    titleFr: 'Une chambre plus calme',
    bodyEn: 'Your room is over the street and it is loud. You ask for another one.',
    openingFr: "Est-ce qu'il y a une chambre plus calme ?",
    openingEn: 'Is there a quieter room?',
    place: 'hotel',
  },
  {
    id: 'situation:hotel-morning-meal',
    titleEn: 'What time the morning meal starts',
    titleFr: 'Le petit déjeuner',
    bodyEn: 'You are leaving early tomorrow. You ask what time the morning meal starts.',
    openingFr: 'Le petit déjeuner est à quelle heure ?',
    openingEn: 'What time is the morning meal?',
    place: 'hotel',
  },
  {
    id: 'situation:hotel-leaving-the-key',
    titleEn: 'Leaving the key',
    titleFr: 'Laisser la clé',
    bodyEn: 'You are going out for the evening. You leave the key and ask about the door.',
    openingFr: "Bonsoir, je laisse la clé, s'il vous plaît.",
    openingEn: 'Good evening, I am leaving the key, please.',
    place: 'hotel',
  },
  {
    id: 'situation:hotel-internet-code',
    titleEn: 'The internet code',
    titleFr: 'Le code internet',
    bodyEn: 'You have one message to send and no signal. You ask for the code.',
    openingFr: "Bonjour, quel est le code internet, s'il vous plaît ?",
    openingEn: 'Hello, what is the internet code, please?',
    place: 'hotel',
  },
  {
    id: 'situation:hotel-luggage',
    titleEn: 'Leaving your bags for the day',
    titleFr: 'Laisser les bagages',
    bodyEn: 'Your room goes at eleven and your train is at six. You ask to leave the bags.',
    openingFr: "Je peux laisser mes bagages jusqu'à ce soir ?",
    openingEn: 'May I leave my bags until this evening?',
    place: 'hotel',
  },
  {
    id: 'situation:hotel-extra-night',
    titleEn: 'One more night',
    titleFr: 'Une nuit de plus',
    bodyEn: 'You want to stay one more night. You ask whether a room is free.',
    openingFr: 'Bonjour, je peux rester une nuit de plus ?',
    openingEn: 'Hello, may I stay one more night?',
    place: 'hotel',
  },
  {
    id: 'situation:hotel-where-to-eat',
    titleEn: 'Where to eat nearby',
    titleFr: "Un restaurant près de l'hôtel",
    bodyEn: 'You are hungry and the street looks quiet. You ask the desk where to eat.',
    openingFr: "Vous connaissez un bon restaurant près d'ici ?",
    openingEn: 'Do you know a good restaurant near here?',
    place: 'hotel',
  },
  {
    id: 'situation:hotel-cold-room',
    titleEn: 'The room is cold',
    titleFr: 'La chambre est froide',
    bodyEn: 'The radiator is cold and the night will be too. You call the front desk.',
    openingFr: 'Bonsoir, il fait froid dans ma chambre.',
    openingEn: 'Good evening, it is cold in my room.',
    place: 'hotel',
  },
  {
    id: 'situation:hotel-check-out',
    titleEn: 'Leaving in the morning',
    titleFr: 'Le départ',
    bodyEn: 'You are on your way out and the bill is ready. You pay and say goodbye.',
    openingFr: 'Bonjour, je pars ce matin, je peux régler ?',
    openingEn: 'Hello, I am leaving this morning, may I settle up?',
    place: 'hotel',
  },
  {
    id: 'situation:hotel-taxi-request',
    titleEn: 'Asking the desk for a taxi',
    titleFr: 'Commander un taxi',
    bodyEn: 'Your train goes in an hour and the street is empty. You ask them to call one.',
    openingFr: 'Bonjour, vous pouvez appeler un taxi ?',
    openingEn: 'Hello, can you call a taxi?',
    place: 'hotel',
  },

  // Friends. Nobody is being paid to be patient here, which is exactly the
  // practice a learner needs before it happens for real.
  {
    id: 'situation:friends-first-meeting',
    titleEn: 'Meeting someone new',
    titleFr: 'Une nouvelle rencontre',
    bodyEn: 'A friend introduces you to someone at a party. You give your name and ask theirs.',
    openingFr: "Salut, moi c'est Alex. Et toi ?",
    openingEn: 'Hi, I am Alex. And you?',
    place: 'friends',
  },
  {
    id: 'situation:friends-where-from',
    titleEn: 'Where you are from',
    titleFr: "D'où tu viens",
    bodyEn: 'Someone asks where you are from and waits. You answer and ask them back.',
    openingFr: 'Je viens de Londres, et toi ?',
    openingEn: 'I come from London, and you?',
    place: 'friends',
  },
  {
    id: 'situation:friends-catch-up',
    titleEn: 'Seeing a friend after months',
    titleFr: 'Ça fait longtemps',
    bodyEn: 'You have not seen this friend since the spring. You ask how they have been.',
    openingFr: 'Salut ! Ça fait longtemps. Ça va ?',
    openingEn: 'Hi! It has been a long time. How are you?',
    place: 'friends',
  },
  {
    id: 'situation:friends-plans-tonight',
    titleEn: 'Making a plan for tonight',
    titleFr: 'Un plan pour ce soir',
    bodyEn: 'You are both free this evening. You suggest a film and a time.',
    openingFr: 'On va au cinéma ce soir ?',
    openingEn: 'Shall we go to the cinema this evening?',
    place: 'friends',
  },
  {
    id: 'situation:friends-invite',
    titleEn: 'Inviting someone over',
    titleFr: "Inviter quelqu'un",
    bodyEn: 'You are cooking on Saturday and want company. You invite a friend.',
    openingFr: 'Tu es libre samedi soir ?',
    openingEn: 'Are you free on Saturday evening?',
    place: 'friends',
  },
  {
    id: 'situation:friends-running-late',
    titleEn: 'Running late',
    titleFr: 'Un peu en retard',
    bodyEn: 'You are stuck underground and expected in ten minutes. You send word.',
    openingFr: "Je suis en retard, j'arrive dans dix minutes.",
    openingEn: 'I am running late, I will be there in ten minutes.',
    place: 'friends',
  },
  {
    id: 'situation:friends-birthday',
    titleEn: 'A birthday drink',
    titleFr: "Un verre d'anniversaire",
    bodyEn: "It is a friend's birthday and the group is loud. You wish them well and order.",
    openingFr: 'Bon anniversaire ! Tu bois quoi ?',
    openingEn: 'Happy birthday! What are you drinking?',
    place: 'friends',
  },
  {
    id: 'situation:friends-what-you-do',
    titleEn: 'What you do for work',
    titleFr: 'Ton travail',
    bodyEn: 'The person next to you asks what you do. You answer and ask them back.',
    openingFr: 'Je travaille dans un bureau, et toi ?',
    openingEn: 'I work in an office, and you?',
    place: 'friends',
  },
  {
    id: 'situation:friends-film-talk',
    titleEn: 'Talking about a film',
    titleFr: "Parler d'un film",
    bodyEn: 'You both saw the same film last week. You say what you thought of it.',
    openingFr: "J'ai bien aimé le film, et toi ?",
    openingEn: 'I liked the film, and you?',
    place: 'friends',
  },
  {
    id: 'situation:friends-leaving-a-party',
    titleEn: 'Leaving a party',
    titleFr: "Partir d'une soirée",
    bodyEn: 'It is late and you have an early start. You thank the host and go.',
    openingFr: 'Merci pour la soirée, je vais y aller.',
    openingEn: 'Thank you for the evening, I am going to go.',
    place: 'friends',
  },
  {
    id: 'situation:friends-weekend',
    titleEn: 'The weekend just gone',
    titleFr: 'Ton week-end',
    bodyEn: 'A colleague asks about your weekend. You answer in three sentences.',
    openingFr: "J'ai passé un bon week-end, et toi ?",
    openingEn: 'I had a good weekend, and you?',
    place: 'friends',
  },
  {
    id: 'situation:friends-language-swap',
    titleEn: 'A language swap',
    titleFr: 'Un échange de langues',
    bodyEn: 'You meet someone who wants to practise English. You agree how to split the hour.',
    openingFr: 'Salut, on parle français en premier ?',
    openingEn: 'Hi, shall we speak French first?',
    place: 'friends',
  },

  // Home. Someone else's kitchen, and the small courtesies that go with it.
  {
    id: 'situation:home-dinner-guest',
    titleEn: "Dinner at a friend's home",
    titleFr: 'Un dîner chez des amis',
    bodyEn: 'You arrive with a bottle and a small gift. You greet the host at the door.',
    openingFr: "Bonsoir, merci de l'invitation.",
    openingEn: 'Good evening, thank you for the invitation.',
    place: 'home',
  },
  {
    id: 'situation:home-compliment-the-food',
    titleEn: 'Saying the food is good',
    titleFr: 'Un compliment sur le repas',
    bodyEn: 'The main dish arrives and it is very good. You say so before you eat more.',
    openingFr: "C'est délicieux, merci.",
    openingEn: 'It is delicious, thank you.',
    place: 'home',
  },
  {
    id: 'situation:home-second-helping',
    titleEn: 'A second helping',
    titleFr: 'Se resservir',
    bodyEn: 'The host offers you more and you want some. You accept and say how much.',
    openingFr: "Oui, un peu, s'il vous plaît.",
    openingEn: 'Yes, a little, please.',
    place: 'home',
  },
  {
    id: 'situation:home-turning-down-a-dish',
    titleEn: 'Turning down a dish',
    titleFr: 'Refuser un plat',
    bodyEn: 'One dish has something you cannot eat. You say no kindly and explain.',
    openingFr: 'Non merci, je ne mange pas de poisson.',
    openingEn: 'No thank you, I never eat fish.',
    place: 'home',
  },
  {
    id: 'situation:home-helping-in-the-kitchen',
    titleEn: 'Helping in the kitchen',
    titleFr: 'Aider à la cuisine',
    bodyEn: 'Everyone is busy and you want to help. You offer, and you take a job.',
    openingFr: 'Je peux aider ?',
    openingEn: 'Can I help?',
    place: 'home',
  },
  {
    id: 'situation:home-meeting-the-family',
    titleEn: 'Meeting the family',
    titleFr: 'Rencontrer la famille',
    bodyEn: "You meet your friend's parents for the first time. You greet each of them.",
    openingFr: 'Bonjour madame, enchanté.',
    openingEn: 'Hello madam, pleased to meet you.',
    place: 'home',
  },
  {
    id: 'situation:home-neighbour',
    titleEn: 'A neighbour at the door',
    titleFr: 'Un voisin à la porte',
    bodyEn: 'Your neighbour knocks about the bins downstairs. You listen and answer.',
    openingFr: "Bonjour, oui, c'est moi.",
    openingEn: 'Hello, yes, that is me.',
    place: 'home',
  },
  {
    id: 'situation:home-phone-call',
    titleEn: 'A short phone call',
    titleFr: 'Un coup de téléphone',
    bodyEn: 'Someone calls and you catch about one word in five. You ask them to slow down.',
    openingFr: 'Pardon, pouvez-vous parler plus lentement ?',
    openingEn: 'Sorry, can you speak more slowly?',
    place: 'home',
  },
  {
    id: 'situation:home-a-parcel',
    titleEn: 'A parcel arrives',
    titleFr: 'Un colis',
    bodyEn: 'The courier is at the door with a parcel and a form. You sign for it.',
    openingFr: "Bonjour, oui, c'est pour moi.",
    openingEn: 'Hello, yes, that is for me.',
    place: 'home',
  },
  {
    id: 'situation:home-what-time-dinner',
    titleEn: 'What time dinner is',
    titleFr: 'Le dîner est à quelle heure',
    bodyEn: 'You are staying with a family for a week. You ask when the evening meal is.',
    openingFr: 'Le dîner est à quelle heure ?',
    openingEn: 'What time is dinner?',
    place: 'home',
  },
  {
    id: 'situation:home-tea-or-coffee',
    titleEn: 'Tea or coffee',
    titleFr: 'Thé ou café',
    bodyEn: 'Your host asks what you would like after the meal. You choose and thank them.',
    openingFr: "Un café, s'il vous plaît.",
    openingEn: 'A coffee, please.',
    place: 'home',
  },
  {
    id: 'situation:home-thanking-your-host',
    titleEn: 'Thanking your host',
    titleFr: 'Remercier les hôtes',
    bodyEn: 'The evening is over and your coat is on. You thank them properly.',
    openingFr: 'Merci beaucoup pour ce soir.',
    openingEn: 'Thank you very much for this evening.',
    place: 'home',
  },
];

/**
 * The two strings the tutor is opened with.
 *
 * The French name of the scene and the English description of what the learner
 * is doing, which is exactly what `seedTopic` carries: no beats, no phrases and
 * no frame. A scenario is a subject to talk about, and the agent decides the
 * conversation the same way it does when a learner picks a topic in Practice.
 */
export function seedTopicOf(s: DailyScenario): { fr: string; en: string } {
  return { fr: s.titleFr, en: s.bodyEn };
}
