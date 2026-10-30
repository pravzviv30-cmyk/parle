# Live room D: short goal labels for review

- Status: **waiting for the founder's approval**. The live room build does not land until every label below is approved (founder, 2026-10-30).
- What these are: the live room shows the current goal next to its stamps. These short labels replace the full goal sentence there. The full sentence stays everywhere else (the screen reader still hears it in full, and the scene preview and recap are unchanged).
- Rules used: at most 24 characters, usually two to four words, plain English, sentence case, no full stop, no dashes. A goal that was already short keeps its own words (marked *same*).
- Source: the goals come from the tutor's mission frames (`packages/brain/src/missions/frames.ts`, 31 missions, 144 goals). After approval they go into `packages/core/src/missions/shortGoals.ts`, keyed by mission and goal.
- How to give changes: reply with the mission and the new wording, for example "hotel / arrive: Say your booking name".

144 goals: 77 keep their own words, 67 are shortened.


## Your first coffee (A0), `premier-cafe`

| Goal id | Full goal today | Short label | |
|---|---|---|---|
| `greet-and-order` | Say hello and order a coffee | **Order a coffee** |  |
| `say-where` | Say whether it is for here or to go | **Here or to go** |  |
| `pay` | Ask how much it is and pay | **Pay for it** |  |

## Order at a café (A0), `cafe`

| Goal id | Full goal today | Short label | |
|---|---|---|---|
| `greet` | Trade hellos | **Trade hellos** | *same* |
| `order-drink` | Order a drink | **Order a drink** | *same* |
| `order-food` | Pick something to eat | **Pick something to eat** | *same* |
| `pay` | Pay | **Pay** | *same* |
| `leave` | Say goodbye and leave | **Say goodbye** |  |

## Check into a hotel (A0), `hotel`

| Goal id | Full goal today | Short label | |
|---|---|---|---|
| `arrive` | Say good evening, say you have a booking, and give the name | **Give your booking name** |  |
| `show-id` | Hand over your passport | **Hand over your passport** | *same* |
| `ask-about-stay` | Ask one practical question about the stay | **Ask about your stay** |  |
| `take-key` | Take the key, say thanks, and find out where the room is | **Take the key** |  |

## Buy something at a market (A1), `marche`

| Goal id | Full goal today | Short label | |
|---|---|---|---|
| `greet-and-ask` | Say hello and say what you are after | **Say what you want** |  |
| `how-much` | Say how much you want | **Say how much** |  |
| `pick-the-ones` | Choose which ones go in the bag | **Choose which ones** |  |
| `settle-up` | Ask what it comes to and pay | **Pay for it** |  |
| `sign-off` | Thank her and take your leave | **Thank her and go** |  |

## Ask for directions (A1), `chemin`

| Goal id | Full goal today | Short label | |
|---|---|---|---|
| `say-what-you-need` | Say what you are looking for | **Say what you need** |  |
| `take-in-the-way` | Take in the directions, and get them again if you need to | **Follow the directions** |  |
| `check-the-way` | Check the way and find out how far it is | **Check how far** |  |
| `thank-and-go` | Thank her and set off | **Thank her and go** |  |

## Talk about your day (A1), `journee`

| Goal id | Full goal today | Short label | |
|---|---|---|---|
| `raconter-sa-journee` | Say how your day went | **Tell her your day** |  |
| `donner-un-detail` | Give one detail about it | **Add one detail** |  |
| `renvoyer-la-question` | Ask her about her day | **Ask about her day** |  |
| `reagir` | React to what she tells you | **React to her day** |  |
| `se-quitter` | Say see you later | **Say see you later** | *same* |

## Meet friends (A1), `amis`

| Goal id | Full goal today | Short label | |
|---|---|---|---|
| `arrive` | Say hi and settle in | **Say hi** |  |
| `news` | Swap news about the week | **Swap your news** |  |
| `plans` | Make a plan for Saturday | **Plan Saturday** |  |
| `toast` | Raise a glass | **Raise a glass** | *same* |

## Book a table (A1), `restaurant`

| Goal id | Full goal today | Short label | |
|---|---|---|---|
| `ask-for-table` | Ask for a table for two tonight | **Ask for a table** |  |
| `say-the-time` | Say what time | **Say what time** | *same* |
| `give-the-name` | Give the name | **Give the name** | *same* |
| `confirm-and-go` | Confirm and say goodbye | **Confirm and go** |  |

## Get help at a pharmacy (A1), `pharmacie`

| Goal id | Full goal today | Short label | |
|---|---|---|---|
| `say-what-hurts` | Say what hurts | **Say what hurts** | *same* |
| `say-since-when` | Say since when | **Say since when** | *same* |
| `ask-how-to-take-it` | Ask how to take it | **Ask how to take it** | *same* |
| `pay-and-thank` | Pay and thank him | **Pay and thank him** | *same* |

## Buy a train ticket (A1), `gare`

| Goal id | Full goal today | Short label | |
|---|---|---|---|
| `ask-for-a-ticket` | Ask for a return ticket | **Ask for a return** |  |
| `choose-a-train` | Choose a train | **Choose a train** | *same* |
| `ask-the-platform` | Ask which platform | **Ask which platform** | *same* |
| `pay` | Pay | **Pay** | *same* |

## Pick up a parcel (A1), `colis`

| Goal id | Full goal today | Short label | |
|---|---|---|---|
| `say-why-you-came` | Say you are collecting a parcel | **Collect a parcel** |  |
| `give-name-and-code` | Give the name and code | **Give name and code** |  |
| `show-id` | Show ID | **Show ID** | *same* |
| `check-and-go` | Check it and go | **Check it and go** | *same* |

## Meet your neighbour (A1), `voisin`

| Goal id | Full goal today | Short label | |
|---|---|---|---|
| `say-you-moved-in` | Say you just moved in | **Say you moved in** |  |
| `say-where-from` | Say where you are from | **Say where you're from** |  |
| `chat-about-the-area` | Chat about the area | **Chat about the area** | *same* |
| `ask-for-a-tip` | Ask for a tip | **Ask for a tip** | *same* |
| `say-goodbye` | Say goodbye | **Say goodbye** | *same* |

## Tell a colleague about your weekend (A2), `week-end`

| Goal id | Full goal today | Short label | |
|---|---|---|---|
| `say-what-you-did` | Say what you did | **Say what you did** | *same* |
| `add-a-detail` | Add a detail | **Add a detail** | *same* |
| `ask-about-theirs` | Ask about theirs | **Ask about theirs** | *same* |
| `react` | React | **React** | *same* |
| `back-to-work` | Head back to work | **Head back to work** | *same* |

## Introduce yourself at work (A2), `collegues`

| Goal id | Full goal today | Short label | |
|---|---|---|---|
| `say-who-and-role` | Say who you are and your role | **Say who you are** |  |
| `say-what-before` | Say what you did before | **Say your last job** |  |
| `accept-tu` | Accept the offer of tu | **Say yes to tu** |  |
| `ask-a-practical-thing` | Ask one practical thing | **Ask a practical question** |  |
| `thank-her` | Thank her | **Thank her** | *same* |

## Book an appointment by phone (A2), `telephone`

| Goal id | Full goal today | Short label | |
|---|---|---|---|
| `say-why-calling` | Say why you are calling | **Say why you're calling** |  |
| `take-or-turn-down-slot` | Take or turn down a slot | **Take or refuse a slot** |  |
| `spell-your-name` | Spell your name | **Spell your name** | *same* |
| `repeat-back` | Repeat the date and time back | **Repeat it back** |  |

## See a doctor (A2), `medecin`

| Goal id | Full goal today | Short label | |
|---|---|---|---|
| `say-what-is-wrong` | Say what the trouble is | **Say what's wrong** |  |
| `say-since-when` | Say since when | **Say since when** | *same* |
| `answer-her-questions` | Answer her questions | **Answer her questions** | *same* |
| `ask-about-treatment` | Ask about the treatment | **Ask about treatment** |  |
| `thank-her` | Thank her | **Thank her** | *same* |

## Take something back to a shop (A2), `retour`

| Goal id | Full goal today | Short label | |
|---|---|---|---|
| `explain-it-does-not-work` | Explain it does not work | **Say it doesn't work** |  |
| `show-the-receipt` | Show the receipt | **Show the receipt** | *same* |
| `ask-exchange-or-refund` | Ask for an exchange or refund | **Ask to swap or refund** |  |
| `insist-politely` | Insist politely | **Insist politely** | *same* |
| `leave` | Leave | **Leave** | *same* |

## View a flat to rent (A2), `appartement`

| Goal id | Full goal today | Short label | |
|---|---|---|---|
| `ask-about-rent` | Ask about the rent | **Ask about the rent** | *same* |
| `ask-about-the-flat` | Ask about the flat | **Ask about the flat** | *same* |
| `ask-when-free` | Ask when it is free | **Ask when it's free** |  |
| `ask-about-the-file` | Ask what the file needs | **Ask about paperwork** |  |
| `say-you-are-interested` | Say you are interested | **Say you're interested** |  |

## Dinner with your partner's parents (A2), `belle-famille`

| Goal id | Full goal today | Short label | |
|---|---|---|---|
| `arrive-with-a-gift` | Arrive with a gift | **Arrive with a gift** | *same* |
| `answer-about-yourself` | Answer questions about yourself | **Talk about yourself** |  |
| `compliment-the-food` | Compliment the food | **Compliment the food** | *same* |
| `talk-about-plans` | Talk about your plans | **Talk about your plans** | *same* |
| `thank-and-leave` | Thank them and leave | **Thank them and leave** | *same* |

## Sign up for a class (A2), `club`

| Goal id | Full goal today | Short label | |
|---|---|---|---|
| `say-what-you-want` | Say what you want to join | **Name the class** |  |
| `ask-the-times` | Ask about the times | **Ask the times** |  |
| `ask-the-price` | Ask the price | **Ask the price** | *same* |
| `ask-what-to-bring` | Ask what to bring | **Ask what to bring** | *same* |
| `sign-up` | Sign up | **Sign up** | *same* |

## Open a bank account (A2), `banque`

| Goal id | Full goal today | Short label | |
|---|---|---|---|
| `say-you-want-an-account` | Say you want an account | **Ask for an account** |  |
| `say-you-just-moved` | Say you just moved here | **Say you just moved** |  |
| `ask-what-documents` | Ask what documents | **Ask what documents** | *same* |
| `ask-about-the-card` | Ask about the card | **Ask about the card** | *same* |
| `book-the-next-step` | Book the next step | **Book the next step** | *same* |

## Make plans with a friend (A2), `sortie`

| Goal id | Full goal today | Short label | |
|---|---|---|---|
| `suggest-going-out` | Suggest going out | **Suggest going out** | *same* |
| `turn-down-and-offer` | Turn down a day and offer another | **Offer another day** |  |
| `agree-time-and-place` | Agree on a time and place | **Agree time and place** |  |
| `confirm` | Confirm | **Confirm** | *same* |

## Buy a winter coat in Montréal (A2), `montreal`

| Goal id | Full goal today | Short label | |
|---|---|---|---|
| `say-what-you-look-for` | Say what you are looking for | **Say what you want** |  |
| `ask-for-your-size` | Ask for your size | **Ask for your size** | *same* |
| `say-how-it-fits` | Try it on and say how it fits | **Say how it fits** |  |
| `ask-the-price` | Ask the price | **Ask the price** | *same* |
| `decide` | Decide | **Decide** | *same* |

## Ask a colleague for help (A2), `coup-de-main`

| Goal id | Full goal today | Short label | |
|---|---|---|---|
| `ask-if-she-has-a-minute` | Ask if she has a minute | **Ask for a minute** |  |
| `explain-what-you-are-trying` | Explain what you are trying to do | **Explain your task** |  |
| `ask-her-to-show-you` | Ask her to show you | **Ask to be shown** |  |
| `check-you-understood` | Check you understood | **Check you understood** | *same* |
| `thank-her` | Thank her | **Thank her** | *same* |

## Your partner's sister's birthday (A2), `anniversaire`

| Goal id | Full goal today | Short label | |
|---|---|---|---|
| `wish-happy-birthday` | Wish her happy birthday | **Wish her happy birthday** | *same* |
| `say-how-you-met` | Say how you met your partner | **Say how you met** |  |
| `chat-with-a-cousin` | Chat with a cousin | **Chat with a cousin** | *same* |
| `accept-a-second-helping` | Accept a second helping | **Accept seconds** |  |
| `say-goodbye` | Say goodbye | **Say goodbye** | *same* |

## Report a leak to your landlord (B1), `fuite`

| Goal id | Full goal today | Short label | |
|---|---|---|---|
| `explain-the-problem` | Explain the problem | **Explain the problem** | *same* |
| `say-since-when` | Say since when and what you tried | **Say since when** |  |
| `say-what-it-damages` | Say what it is damaging | **Say what's damaged** |  |
| `ask-when-someone-can-come` | Ask when someone can come | **Ask for a visit** |  |
| `agree-on-a-time` | Agree on a time | **Agree on a time** | *same* |

## Say what you thought of a film (B1), `avis`

| Goal id | Full goal today | Short label | |
|---|---|---|---|
| `give-your-opinion` | Give your opinion | **Give your opinion** | *same* |
| `say-why` | Say why | **Say why** | *same* |
| `add-a-nuance` | Add a nuance | **Add a nuance** | *same* |
| `agree-or-disagree` | Agree or disagree politely | **Agree or disagree** |  |
| `suggest-what-next` | Suggest what to see next | **Suggest the next film** |  |

## Tell the story of your weekend (B1), `galere`

| Goal id | Full goal today | Short label | |
|---|---|---|---|
| `set-the-scene` | Set the scene | **Set the scene** | *same* |
| `say-what-happened` | Say what happened | **Say what happened** | *same* |
| `say-how-you-reacted` | Say how you reacted | **Say how you reacted** | *same* |
| `say-how-it-ended` | Say how it ended | **Say how it ended** | *same* |
| `react-to-his-story` | React to his story | **React to his story** | *same* |

## Ask your manager to work from home (B1), `teletravail`

| Goal id | Full goal today | Short label | |
|---|---|---|---|
| `ask-for-a-moment` | Ask for a moment | **Ask for a moment** | *same* |
| `make-the-request` | Make the request | **Make the request** | *same* |
| `give-your-reasons` | Give your reasons | **Give your reasons** | *same* |
| `answer-her-concern` | Answer her concern | **Answer her concern** | *same* |
| `agree-a-next-step` | Agree on a next step | **Agree a next step** |  |

## Talk with your partner's grandmother (B1), `souvenirs`

| Goal id | Full goal today | Short label | |
|---|---|---|---|
| `say-where-you-grew-up` | Say where you grew up | **Say where you grew up** | *same* |
| `describe-what-it-was-like` | Describe what it was like | **Describe that time** |  |
| `ask-about-her-youth` | Ask about her youth | **Ask about her youth** | *same* |
| `compare-then-and-now` | Compare then and now | **Compare then and now** | *same* |
| `thank-her-for-the-stories` | Thank her for the stories | **Thank her** |  |

## A short job interview (B1), `entretien`

| Goal id | Full goal today | Short label | |
|---|---|---|---|
| `sum-up-your-background` | Sum up your background | **Sum up your background** | *same* |
| `say-why-this-job` | Say why this job | **Say why this job** | *same* |
| `give-an-example` | Give an example of a strength | **Name a strength** |  |
| `ask-about-the-role` | Ask about the role | **Ask about the role** | *same* |
| `close-and-thank` | Close and thank her | **Close and thank her** | *same* |
