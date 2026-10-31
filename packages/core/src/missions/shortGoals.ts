/**
 * Short goal labels for the live room's stamps (UI-014, direction D).
 *
 * The room's goals are brain frame beats, and their English is a full
 * sentence ("Say hello and order a coffee"). The stamps show a short label
 * beside them ("Order a coffee"). The labels live here, in core, keyed by
 * `missionId:beatId`, so there is no wire change and no agent redeploy. A beat
 * with no label falls back to its full sentence on the client.
 *
 * The founder approved all 144 labels exactly as drafted on 2026-10-31
 * (docs/changes/live-room-d-goal-labels.md). The table holds one label per
 * beat of every mission in MISSIONS; shortGoals.test.ts fails when a beat has
 * none, so a new beat cannot ship without an approved label.
 */
export const SHORT_GOALS: Readonly<Record<string, string>> = {
  // Your first coffee
  'mission:premier-cafe:greet-and-order': 'Order a coffee',
  'mission:premier-cafe:say-where': 'Here or to go',
  'mission:premier-cafe:pay': 'Pay for it',
  // Order at a café
  'mission:cafe:greet': 'Trade hellos',
  'mission:cafe:order-drink': 'Order a drink',
  'mission:cafe:order-food': 'Pick something to eat',
  'mission:cafe:pay': 'Pay',
  'mission:cafe:leave': 'Say goodbye',
  // Check into a hotel
  'mission:hotel:arrive': 'Give your booking name',
  'mission:hotel:show-id': 'Hand over your passport',
  'mission:hotel:ask-about-stay': 'Ask about your stay',
  'mission:hotel:take-key': 'Take the key',
  // Buy something at a market
  'mission:marche:greet-and-ask': 'Say what you want',
  'mission:marche:how-much': 'Say how much',
  'mission:marche:pick-the-ones': 'Choose which ones',
  'mission:marche:settle-up': 'Pay for it',
  'mission:marche:sign-off': 'Thank her and go',
  // Ask for directions
  'mission:chemin:say-what-you-need': 'Say what you need',
  'mission:chemin:take-in-the-way': 'Follow the directions',
  'mission:chemin:check-the-way': 'Check how far',
  'mission:chemin:thank-and-go': 'Thank her and go',
  // Talk about your day
  'mission:journee:raconter-sa-journee': 'Tell her your day',
  'mission:journee:donner-un-detail': 'Add one detail',
  'mission:journee:renvoyer-la-question': 'Ask about her day',
  'mission:journee:reagir': 'React to her day',
  'mission:journee:se-quitter': 'Say see you later',
  // Meet friends
  'mission:amis:arrive': 'Say hi',
  'mission:amis:news': 'Swap your news',
  'mission:amis:plans': 'Plan Saturday',
  'mission:amis:toast': 'Raise a glass',
  // Book a table
  'mission:restaurant:ask-for-table': 'Ask for a table',
  'mission:restaurant:say-the-time': 'Say what time',
  'mission:restaurant:give-the-name': 'Give the name',
  'mission:restaurant:confirm-and-go': 'Confirm and go',
  // Get help at a pharmacy
  'mission:pharmacie:say-what-hurts': 'Say what hurts',
  'mission:pharmacie:say-since-when': 'Say since when',
  'mission:pharmacie:ask-how-to-take-it': 'Ask how to take it',
  'mission:pharmacie:pay-and-thank': 'Pay and thank him',
  // Buy a train ticket
  'mission:gare:ask-for-a-ticket': 'Ask for a return',
  'mission:gare:choose-a-train': 'Choose a train',
  'mission:gare:ask-the-platform': 'Ask which platform',
  'mission:gare:pay': 'Pay',
  // Pick up a parcel
  'mission:colis:say-why-you-came': 'Collect a parcel',
  'mission:colis:give-name-and-code': 'Give name and code',
  'mission:colis:show-id': 'Show ID',
  'mission:colis:check-and-go': 'Check it and go',
  // Meet your neighbour
  'mission:voisin:say-you-moved-in': 'Say you moved in',
  'mission:voisin:say-where-from': "Say where you're from",
  'mission:voisin:chat-about-the-area': 'Chat about the area',
  'mission:voisin:ask-for-a-tip': 'Ask for a tip',
  'mission:voisin:say-goodbye': 'Say goodbye',
  // Tell a colleague about your weekend
  'mission:week-end:say-what-you-did': 'Say what you did',
  'mission:week-end:add-a-detail': 'Add a detail',
  'mission:week-end:ask-about-theirs': 'Ask about theirs',
  'mission:week-end:react': 'React',
  'mission:week-end:back-to-work': 'Head back to work',
  // Introduce yourself at work
  'mission:collegues:say-who-and-role': 'Say who you are',
  'mission:collegues:say-what-before': 'Say your last job',
  'mission:collegues:accept-tu': 'Say yes to tu',
  'mission:collegues:ask-a-practical-thing': 'Ask a practical question',
  'mission:collegues:thank-her': 'Thank her',
  // Book an appointment by phone
  'mission:telephone:say-why-calling': "Say why you're calling",
  'mission:telephone:take-or-turn-down-slot': 'Take or refuse a slot',
  'mission:telephone:spell-your-name': 'Spell your name',
  'mission:telephone:repeat-back': 'Repeat it back',
  // See a doctor
  'mission:medecin:say-what-is-wrong': "Say what's wrong",
  'mission:medecin:say-since-when': 'Say since when',
  'mission:medecin:answer-her-questions': 'Answer her questions',
  'mission:medecin:ask-about-treatment': 'Ask about treatment',
  'mission:medecin:thank-her': 'Thank her',
  // Take something back to a shop
  'mission:retour:explain-it-does-not-work': "Say it doesn't work",
  'mission:retour:show-the-receipt': 'Show the receipt',
  'mission:retour:ask-exchange-or-refund': 'Ask to swap or refund',
  'mission:retour:insist-politely': 'Insist politely',
  'mission:retour:leave': 'Leave',
  // View a flat to rent
  'mission:appartement:ask-about-rent': 'Ask about the rent',
  'mission:appartement:ask-about-the-flat': 'Ask about the flat',
  'mission:appartement:ask-when-free': "Ask when it's free",
  'mission:appartement:ask-about-the-file': 'Ask about paperwork',
  'mission:appartement:say-you-are-interested': "Say you're interested",
  // Dinner with your partner's parents
  'mission:belle-famille:arrive-with-a-gift': 'Arrive with a gift',
  'mission:belle-famille:answer-about-yourself': 'Talk about yourself',
  'mission:belle-famille:compliment-the-food': 'Compliment the food',
  'mission:belle-famille:talk-about-plans': 'Talk about your plans',
  'mission:belle-famille:thank-and-leave': 'Thank them and leave',
  // Sign up for a class
  'mission:club:say-what-you-want': 'Name the class',
  'mission:club:ask-the-times': 'Ask the times',
  'mission:club:ask-the-price': 'Ask the price',
  'mission:club:ask-what-to-bring': 'Ask what to bring',
  'mission:club:sign-up': 'Sign up',
  // Open a bank account
  'mission:banque:say-you-want-an-account': 'Ask for an account',
  'mission:banque:say-you-just-moved': 'Say you just moved',
  'mission:banque:ask-what-documents': 'Ask what documents',
  'mission:banque:ask-about-the-card': 'Ask about the card',
  'mission:banque:book-the-next-step': 'Book the next step',
  // Make plans with a friend
  'mission:sortie:suggest-going-out': 'Suggest going out',
  'mission:sortie:turn-down-and-offer': 'Offer another day',
  'mission:sortie:agree-time-and-place': 'Agree time and place',
  'mission:sortie:confirm': 'Confirm',
  // Buy a winter coat in Montréal
  'mission:montreal:say-what-you-look-for': 'Say what you want',
  'mission:montreal:ask-for-your-size': 'Ask for your size',
  'mission:montreal:say-how-it-fits': 'Say how it fits',
  'mission:montreal:ask-the-price': 'Ask the price',
  'mission:montreal:decide': 'Decide',
  // Ask a colleague for help
  'mission:coup-de-main:ask-if-she-has-a-minute': 'Ask for a minute',
  'mission:coup-de-main:explain-what-you-are-trying': 'Explain your task',
  'mission:coup-de-main:ask-her-to-show-you': 'Ask to be shown',
  'mission:coup-de-main:check-you-understood': 'Check you understood',
  'mission:coup-de-main:thank-her': 'Thank her',
  // Your partner's sister's birthday
  'mission:anniversaire:wish-happy-birthday': 'Wish her happy birthday',
  'mission:anniversaire:say-how-you-met': 'Say how you met',
  'mission:anniversaire:chat-with-a-cousin': 'Chat with a cousin',
  'mission:anniversaire:accept-a-second-helping': 'Accept seconds',
  'mission:anniversaire:say-goodbye': 'Say goodbye',
  // Report a leak to your landlord
  'mission:fuite:explain-the-problem': 'Explain the problem',
  'mission:fuite:say-since-when': 'Say since when',
  'mission:fuite:say-what-it-damages': "Say what's damaged",
  'mission:fuite:ask-when-someone-can-come': 'Ask for a visit',
  'mission:fuite:agree-on-a-time': 'Agree on a time',
  // Say what you thought of a film
  'mission:avis:give-your-opinion': 'Give your opinion',
  'mission:avis:say-why': 'Say why',
  'mission:avis:add-a-nuance': 'Add a nuance',
  'mission:avis:agree-or-disagree': 'Agree or disagree',
  'mission:avis:suggest-what-next': 'Suggest the next film',
  // Tell the story of your weekend
  'mission:galere:set-the-scene': 'Set the scene',
  'mission:galere:say-what-happened': 'Say what happened',
  'mission:galere:say-how-you-reacted': 'Say how you reacted',
  'mission:galere:say-how-it-ended': 'Say how it ended',
  'mission:galere:react-to-his-story': 'React to his story',
  // Ask your manager to work from home
  'mission:teletravail:ask-for-a-moment': 'Ask for a moment',
  'mission:teletravail:make-the-request': 'Make the request',
  'mission:teletravail:give-your-reasons': 'Give your reasons',
  'mission:teletravail:answer-her-concern': 'Answer her concern',
  'mission:teletravail:agree-a-next-step': 'Agree a next step',
  // Talk with your partner's grandmother
  'mission:souvenirs:say-where-you-grew-up': 'Say where you grew up',
  'mission:souvenirs:describe-what-it-was-like': 'Describe that time',
  'mission:souvenirs:ask-about-her-youth': 'Ask about her youth',
  'mission:souvenirs:compare-then-and-now': 'Compare then and now',
  'mission:souvenirs:thank-her-for-the-stories': 'Thank her',
  // A short job interview
  'mission:entretien:sum-up-your-background': 'Sum up your background',
  'mission:entretien:say-why-this-job': 'Say why this job',
  'mission:entretien:give-an-example': 'Name a strength',
  'mission:entretien:ask-about-the-role': 'Ask about the role',
  'mission:entretien:close-and-thank': 'Close and thank her',
};

/** The short label for one beat, or null when none is approved yet. */
export function shortGoalLabel(missionId: string, beatId: string, table: Readonly<Record<string, string>> = SHORT_GOALS): string | null {
  const label = table[`${missionId}:${beatId}`];
  return typeof label === 'string' && label.trim().length > 0 ? label : null;
}
