/** Authored supplementary vocabulary. Articles are part of the learning item.
 * Each section supplies a grammatical context; existing scene examples take
 * precedence in the pack builder. No translation or generation runs in-app. */
export const WORD_SECTIONS: readonly { fr: string; en: string; tier: 1 | 2 | 3; items: string }[] = [
  { tier: 1, fr: 'Je cherche {fr}.', en: 'I am looking for {en}.', items: `
un stylo|a pen
un crayon|a pencil
une gomme|an eraser
une règle|a ruler
un cahier|a notebook
un classeur|a ring binder
une feuille|a sheet of paper
une enveloppe|an envelope
un timbre|a stamp
un carnet|a small notebook
un feutre|a felt-tip pen
un surligneur|a highlighter
une agrafeuse|a stapler
un trombone|a paper clip
une calculatrice|a calculator
un dossier|a folder
un agenda|a diary
un calendrier|a calendar
un dictionnaire|a dictionary
un manuel|a textbook
un livre|a book
un roman|a novel
une bande dessinée|a comic book
un journal|a newspaper
une revue|a magazine
une carte postale|a postcard
une affiche|a poster
une étiquette|a label
un autocollant|a sticker
une ficelle|a piece of string
du ruban adhésif|some adhesive tape
des ciseaux|some scissors
de la colle|some glue
une boîte|a box
un sac|a bag
un sac à dos|a backpack
une valise|a suitcase
un portefeuille|a wallet
un porte-monnaie|a coin purse
un porte-clés|a key ring
un parapluie|an umbrella
une lampe|a lamp
une ampoule|a light bulb
une rallonge|an extension cable
une multiprise|a power strip
un adaptateur|an adapter
un chargeur|a charger
un câble|a cable
une batterie|a battery
une pile|a small battery
un écran|a screen
un clavier|a keyboard
une souris|a computer mouse
une imprimante|a printer
un ordinateur|a computer
une tablette|a tablet
un téléphone|a telephone
un casque|a headset
des écouteurs|some earphones
un haut-parleur|a loudspeaker
une télécommande|a remote control
un appareil photo|a camera
un trépied|a tripod
une clé USB|a USB drive
un disque dur|a hard drive
un micro|a microphone
un miroir|a mirror
une brosse|a brush
un peigne|a comb
une serviette|a towel
un drap|a sheet
une couverture|a blanket
un oreiller|a pillow
une taie|a pillowcase
une couette|a duvet
un coussin|a cushion
un tapis|a rug
un rideau|a curtain
une nappe|a tablecloth
un torchon|a tea towel
une éponge|a sponge
un balai|a broom
une pelle|a dustpan
une serpillière|a mop cloth
un seau|a bucket
un aspirateur|a vacuum cleaner
une poubelle|a rubbish bin
un cintre|a hanger
une pince à linge|a clothes peg
un fer à repasser|an iron
un sèche-cheveux|a hair dryer
un rasoir|a razor
une brosse à dents|a toothbrush
du dentifrice|some toothpaste
du savon|some soap
du shampoing|some shampoo
du gel douche|some shower gel
de la crème solaire|some sunscreen
un mouchoir|a tissue
du papier toilette|some toilet paper
une assiette|a plate
un bol|a bowl
une tasse|a cup
un verre|a glass
une carafe|a jug
une bouteille|a bottle
un bocal|a jar
une casserole|a saucepan
une poêle|a frying pan
un couvercle|a lid
une passoire|a colander
une louche|a ladle
une spatule|a spatula
un fouet|a whisk
un éplucheur|a peeler
une râpe|a grater
un couteau|a knife
une fourchette|a fork
une cuillère|a spoon
un ouvre-boîte|a tin opener
un tire-bouchon|a corkscrew
une planche à découper|a chopping board
une bouilloire|a kettle
une cafetière|a coffee maker
un grille-pain|a toaster
un mixeur|a blender
une balance|a scale
un tablier|an apron
un plateau|a tray
un saladier|a salad bowl
un moule|a baking tin
un entonnoir|a funnel
une gourde|a reusable water bottle
une glacière|a cool box
une boîte à outils|a toolbox
un marteau|a hammer
un tournevis|a screwdriver
une vis|a screw
un clou|a nail
une perceuse|a drill
une scie|a saw
une pince|a pair of pliers
un mètre|a tape measure
un niveau|a spirit level
une échelle|a ladder
un escabeau|a stepladder
un cadenas|a padlock
une serrure|a lock
une clé|a key
un pneu|a tyre
une pompe|a pump
une roue|a wheel
un casque de vélo|a cycling helmet
une sonnette|a bell
un antivol|a bicycle lock
un siège|a seat
une chaise|a chair
un fauteuil|an armchair
un canapé|a sofa
une table|a table
une étagère|a shelf
une armoire|a wardrobe
une commode|a chest of drawers
un meuble|a piece of furniture
un lit|a bed
un matelas|a mattress
un bureau|a desk
un banc|a bench
un tabouret|a stool
une horloge|a clock
un réveil|an alarm clock
une montre|a watch
une bague|a ring
un collier|a necklace
un bracelet|a bracelet
une broche|a brooch
une ceinture|a belt
une écharpe|a scarf
un bonnet|a woolly hat
un chapeau|a hat
une casquette|a cap
des gants|some gloves
des chaussettes|some socks
des chaussures|some shoes
des bottes|some boots
des baskets|some trainers
des sandales|some sandals
des chaussons|some slippers
un pantalon|a pair of trousers
un jean|a pair of jeans
un short|a pair of shorts
une jupe|a skirt
une robe|a dress
une chemise|a shirt
un chemisier|a blouse
un tee-shirt|a T-shirt
un pull|a jumper
un gilet|a cardigan
une veste|a jacket
un manteau|a coat
un imperméable|a raincoat
un costume|a suit
un maillot de bain|a swimsuit
un pyjama|a pair of pyjamas
un uniforme|a uniform
une cravate|a tie
une capuche|a hood
une fermeture éclair|a zip
un bouton|a button
une aiguille|a needle
du fil|some thread
du tissu|some fabric
de la laine|some wool
du coton|some cotton
de la soie|some silk
du lin|some linen
du cuir|some leather
une tente|a tent
un sac de couchage|a sleeping bag
une lampe torche|a torch
une boussole|a compass
une carte routière|a road map
des jumelles|some binoculars
un ballon|a ball
une raquette|a racket
une corde à sauter|a skipping rope
un tapis de yoga|a yoga mat
une guitare|a guitar
un violon|a violin
une flûte|a flute
un piano|a piano
un tambour|a drum
un pinceau|a paintbrush
une toile|a canvas
une palette|a palette
un chevalet|an easel
une peluche|a soft toy
une poupée|a doll
un puzzle|a jigsaw puzzle
un jeu de cartes|a pack of cards
un dé|a die
une bougie|a candle
un vase|a vase
un cadre|a picture frame
un album|an album
un bouquet|a bouquet
une plante|a plant
un pot|a pot
un arrosoir|a watering can
un râteau|a rake
une tondeuse|a lawnmower
un tuyau|a hose
des graines|some seeds
du terreau|some potting compost
un sécateur|a pair of secateurs
une brouette|a wheelbarrow
un thermomètre|a thermometer
un pansement|a plaster
une compresse|a dressing
une béquille|a crutch
une trousse|a pencil case
une trousse de secours|a first-aid kit
des lunettes|some glasses
des lunettes de soleil|some sunglasses
une ordonnance|a prescription
une attestation|a certificate
un justificatif|a supporting document
un formulaire|a form
une photocopie|a photocopy
un reçu|a receipt
une facture|an invoice
un devis|a quotation
un contrat|a contract
un passeport|a passport
un permis de conduire|a driving licence
une carte d'identité|an identity card
un billet|a ticket
un abonnement|a subscription
un plan|a map
une adresse|an address
un numéro de téléphone|a phone number
une borne|a terminal
un distributeur|a cash machine
un guichet|a service counter
un arrêt de bus|a bus stop
une station-service|a petrol station
une pharmacie|a pharmacy
une librairie|a bookshop
une papeterie|a stationery shop
une quincaillerie|a hardware shop
une boulangerie|a bakery
une pâtisserie|a pastry shop
une boucherie|a butcher's shop
une poissonnerie|a fishmonger's shop
une fromagerie|a cheese shop
une épicerie|a grocery shop
une laverie|a laundrette
un pressing|a dry cleaner's
un cordonnier|a shoe repairer
un coiffeur|a hairdresser
un tailleur|a tailor
un garage|a garage
un parking|a car park
un hôtel|a hotel
une auberge|an inn
un camping|a campsite
un hébergement|some accommodation
une chambre|a room
un logement|somewhere to live
un appartement|a flat
une maison|a house
un studio|a studio flat
une colocation|a shared flat
un locataire|a tenant
un propriétaire|a property owner
un colocataire|a flatmate
un médecin|a doctor
un dentiste|a dentist
un infirmier|a nurse
un kinésithérapeute|a physiotherapist
un vétérinaire|a vet
un plombier|a plumber
un électricien|an electrician
un menuisier|a carpenter
un maçon|a bricklayer
un traducteur|a translator
un interprète|an interpreter
un comptable|an accountant
un avocat|a lawyer
un notaire|a notary
un architecte|an architect
un ingénieur|an engineer
un professeur|a teacher
un chercheur|a researcher
un stagiaire|an intern
un apprenti|an apprentice
un bénévole|a volunteer
un guide|a guide
un gardien|a caretaker
un livreur|a delivery person
un serveur|a waiter
un cuisinier|a cook
un pâtissier|a pastry chef
un boulanger|a baker
un agriculteur|a farmer
un jardinier|a gardener
un photographe|a photographer
un musicien|a musician
un dessinateur|an illustrator
un réalisateur|a film director
un journaliste|a journalist
un éditeur|a publisher
un libraire|a bookseller
un conseiller|an adviser
un accompagnateur|an accompanying guide
un interlocuteur|a contact person
un remplaçant|a replacement
un partenaire|a partner
un associé|a business partner
un fournisseur|a supplier
un prestataire|a service provider
un employeur|an employer
un emploi|a job
un stage|an internship
une formation|a training course
une solution|a solution
une explication|an explanation
une réponse|an answer
une information|a piece of information
un renseignement|some information
un conseil|some advice
une recommandation|a recommendation
une idée|an idea
une occasion|an opportunity
une alternative|an alternative
un compromis|a compromise
un accord|an agreement
une preuve|a piece of evidence
un indice|a clue
un exemple|an example
une référence|a reference
un modèle|a model
une méthode|a method
une recette|a recipe
un itinéraire|a route
un raccourci|a shortcut
un repère|a landmark
une issue|a way out
un passage|a passage
un accès|an access point
une entrée|an entrance
une sortie|an exit
un escalier|a staircase
un ascenseur|a lift
un couloir|a corridor
une porte|a door
une fenêtre|a window
une terrasse|a terrace
un balcon|a balcony
un jardin|a garden
une cour|a courtyard
une cave|a cellar
un grenier|an attic
une cuisine|a kitchen
une salle de bains|a bathroom
une salle d'attente|a waiting room
une salle de réunion|a meeting room
une salle de spectacle|a performance venue
un vestiaire|a cloakroom
une consigne|a luggage locker
un comptoir|a counter
un rayon|a shop department
une caisse|a checkout
un atelier|a workshop
un entrepôt|a warehouse
un laboratoire|a laboratory
un chantier|a building site
un terrain|a plot of land
une piste|a track
un sentier|a path
un quai|a platform
un pont|a bridge
un tunnel|a tunnel
un rond-point|a roundabout
un carrefour|a crossroads
un passage piéton|a pedestrian crossing
un trottoir|a pavement
une ruelle|a narrow street
une impasse|a dead-end street
une avenue|an avenue
un boulevard|a boulevard
une place|a square
un parc|a park
une aire de jeux|a playground
une piscine|a swimming pool
un gymnase|a sports hall
un stade|a stadium
une bibliothèque|a library
un musée|a museum
une galerie|a gallery
un théâtre|a theatre
un cinéma|a cinema
une mairie|a town hall
un commissariat|a police station
un tribunal|a courthouse
un consulat|a consulate
une ambassade|an embassy
une école|a school
un collège|a middle school
un lycée|an upper secondary school
une université|a university
une crèche|a nursery
un hôpital|a hospital
une clinique|a clinic
un dispensaire|a health centre
un refuge|a shelter
une fontaine|a fountain
un point d'eau|a water point
un banc public|a park bench
une boîte aux lettres|a letter box
un panneau|a sign
une borne de recharge|a charging station
un abri|a shelter from the weather
un emplacement|a pitch
un endroit calme|a quiet place
un coin d'ombre|a shady spot
une connexion|a connection
un réseau|a network
un mot de passe|a password
un identifiant|a login name
un fichier|a file
un document|a document
une pièce jointe|an attachment
un lien|a link
un onglet|a tab
un navigateur|a browser
un moteur de recherche|a search engine
une application|an app
un logiciel|a piece of software
une mise à jour|an update
une sauvegarde|a backup
une capture d'écran|a screenshot
une notification|a notification
un réglage|a setting
une traduction|a translation
une définition|a definition
un synonyme|a synonym
une prononciation|a pronunciation
un accent|an accent
un enregistrement|a recording
un sous-titre|a subtitle
un épisode|an episode
une émission|a programme
un documentaire|a documentary
un reportage|a news report
une chanson|a song
une mélodie|a melody
une partition|a musical score
un refrain|a chorus
un couplet|a verse
un spectacle|a show
un concert|a concert
une exposition|an exhibition
une conférence|a talk
un débat|a debate
une rencontre|a meeting
une visite guidée|a guided tour
une balade|a stroll
une randonnée|a hike
une excursion|an excursion
un séjour|a stay
un voyage|a journey
un trajet|a trip
un vol|a flight
une correspondance|a connecting service
une réservation|a reservation
une confirmation|a confirmation
une annulation|a cancellation
un remboursement|a refund
une réduction|a discount
une promotion|a special offer
une garantie|a guarantee
une assurance|an insurance policy
une assistance|some assistance
une livraison|a delivery
un colis|a parcel
un emballage|some packaging
une commande|an order
un échantillon|a sample
une taille|a size
une pointure|a shoe size
une couleur|a colour
une nuance|a shade
un motif|a pattern
une texture|a texture
une matière|a material
un format|a format
une version|a version
une édition|an edition
une collection|a collection
une série|a series
une paire|a pair
un ensemble|a set
un lot|a batch
une pièce de rechange|a spare part
un mode d'emploi|an instruction manual
une notice|an instruction leaflet
un schéma|a diagram
un croquis|a sketch
un dessin|a drawing
une photo|a photo
une image|an image
une illustration|an illustration
un portrait|a portrait
un paysage|a landscape
une sculpture|a sculpture
une gravure|an engraving
une maquette|a scale model
un souvenir|a souvenir
un cadeau|a gift
une surprise|a surprise
une invitation|an invitation
un faire-part|an announcement card
une récompense|a reward
un diplôme|a diploma
une médaille|a medal
un trophée|a trophy
un certificat|a certificate
une autorisation|an authorisation
une procuration|a power of attorney
une signature|a signature
un cachet|an official stamp
une copie|a copy
un original|an original
une version papier|a paper version
une version numérique|a digital version
un code postal|a postcode
un nom de famille|a surname
un prénom|a first name
une date|a date
un horaire|a timetable
un créneau|a time slot
un rendez-vous|an appointment
une disponibilité|an available slot
un délai|a time allowance
une échéance|a deadline
une priorité|a priority
un objectif|an objective
une étape|a stage
un bilan|a review
un compte rendu|a report
un résumé|a summary
une synthèse|an overview
un aperçu|a preview
une introduction|an introduction
une conclusion|a conclusion
un chapitre|a chapter
un paragraphe|a paragraph
une phrase|a sentence
une expression|an expression
un terme|a term
un mot|a word
une syllabe|a syllable
une voyelle|a vowel
une consonne|a consonant
une liaison|a linking sound
une intonation|an intonation
un rythme|a rhythm
une pause|a pause
un silence|a silence
une hésitation|a hesitation
une reformulation|a rephrasing
une précision|a clarification
une correction|a correction
une vérification|a check
une comparaison|a comparison
une distinction|a distinction
une différence|a difference
une ressemblance|a resemblance
une exception|an exception
une règle générale|a general rule
une habitude|a habit
une routine|a routine
une astuce|a useful tip
une technique|a technique
un exercice|an exercise
une activité|an activity
une séance|a session
un cours|a class
une leçon|a lesson
une évaluation|an assessment
un niveau|a level
une compétence|a skill
une capacité|an ability
une expérience|an experience
un progrès|an improvement
un résultat|a result
une réussite|a success
une amélioration|an improvement
une découverte|a discovery
une nouveauté|something new
une possibilité|a possibility
une perspective|a prospect
une approche|an approach
une stratégie|a strategy
un projet|a project
une proposition|a proposal
une initiative|an initiative
une démarche|a procedure
une procédure|a procedure
une formalité|a formality
une inscription|a registration
une adhésion|a membership
une candidature|an application
un entretien|an interview
une présentation|a presentation
une démonstration|a demonstration
une explication détaillée|a detailed explanation
un témoignage|a testimony
une opinion|an opinion
un avis|an opinion
un point de vue|a point of view
un argument|an argument
une objection|an objection
une justification|a justification
une raison|a reason
une cause|a cause
une conséquence|a consequence
un effet|an effect
une influence|an influence
un lien logique|a logical connection
une hypothèse|a hypothesis
une certitude|a certainty
un doute|a doubt
une question|a question
un sujet|a subject
un thème|a theme
un contexte|a context
une situation|a situation
un détail|a detail
un élément|an element
une partie|a part
un aspect|an aspect
une caractéristique|a characteristic
une particularité|a particularity
une qualité|a quality
un avantage|an advantage
un inconvénient|a disadvantage
une limite|a limit
une condition|a condition
un critère|a criterion
une exigence|a requirement
une contrainte|a constraint
une obligation|an obligation
un engagement|a commitment
une promesse|a promise
une intention|an intention
une décision|a decision
un choix|a choice
une préférence|a preference
un besoin|a need
une envie|a desire
un souhait|a wish
un espoir|a hope
une attente|an expectation
une ambition|an ambition
un défi|a challenge
un encouragement|some encouragement
un soutien|some support
une aide|some help
une collaboration|a collaboration
une coopération|some cooperation
un échange|an exchange
un partage|an act of sharing
une discussion|a discussion
une conversation|a conversation
un dialogue|a dialogue
un contact|a contact
une relation|a relationship
une amitié|a friendship
une entente|an understanding
une complicité|a close connection
une confiance|a sense of trust
une reconnaissance|some recognition
une attention|some attention
une considération|some consideration
une expédition|an expedition
une traversée|a crossing
une escale|a stopover
une halte|a stop
un détour|a detour
une bifurcation|a fork in the road
une intersection|an intersection
une déviation|a diversion
une pente|a slope
une montée|an uphill stretch
une descente|a downhill stretch
un sommet|a summit
une vallée|a valley
une colline|a hill
une montagne|a mountain
une forêt|a forest
un bois|a wood
un champ|a field
une prairie|a meadow
une clairière|a clearing
une rive|a riverbank
un ruisseau|a stream
une rivière|a river
un fleuve|a river flowing to the sea
un lac|a lake
un étang|a pond
une cascade|a waterfall
une source|a spring
une plage|a beach
une crique|a cove
une baie|a bay
une falaise|a cliff
une île|an island
une presqu'île|a peninsula
un cap|a headland
un port|a harbour
un phare|a lighthouse
une digue|a sea wall
une jetée|a pier
une dune|a dune
un rocher|a rock
un galet|a pebble
un coquillage|a seashell
une grotte|a cave
un volcan|a volcano
un glacier|a glacier
un plateau rocheux|a rocky plateau
une réserve naturelle|a nature reserve
un parc national|a national park
un observatoire|an observatory
un belvédère|a viewpoint
une aire de repos|a rest area
un point de vue panoramique|a panoramic viewpoint
un village|a village
un hameau|a hamlet
un quartier|a neighbourhood
un arrondissement|a city district
une commune|a municipality
une région|a region
un département|a French administrative department
une frontière|a border
un poste de douane|a customs post
un poste de secours|a first-aid station
un centre d'accueil|a reception centre
une salle polyvalente|a community hall
une maison de quartier|a neighbourhood centre
un centre culturel|a cultural centre
un centre de loisirs|a leisure centre
une médiathèque|a multimedia library
une ludothèque|a toy library
un conservatoire|a music school
une salle de répétition|a rehearsal room
un studio d'enregistrement|a recording studio
un cinéma en plein air|an outdoor cinema
une fête de quartier|a neighbourhood party
une brocante|a second-hand fair
un vide-grenier|a car boot sale
un marché couvert|a covered market
un marché aux puces|a flea market
une foire|a fair
un salon|a trade fair
un festival|a festival
une projection|a screening
une représentation|a performance
une répétition|a rehearsal
une audition|an audition
un vernissage|an exhibition opening
une dédicace|a book signing
une conférence de presse|a press conference
une table ronde|a panel discussion
un séminaire|a seminar
un atelier pratique|a practical workshop
une journée portes ouvertes|an open day
un cours du soir|an evening class
un cours particulier|a private lesson
un cours collectif|a group class
une séance d'essai|a trial session
un groupe de conversation|a conversation group
un correspondant|a pen pal
un binôme|a working partner
un groupe d'étude|a study group
une équipe|a team
une association|an association
un club|a club
un collectif|a collective
une communauté|a community
un réseau d'entraide|a mutual support network
une permanence|a drop-in service
un accueil|a reception desk
un secrétariat|a secretarial office
un standard|a switchboard
un service client|a customer service department
un service après-vente|an after-sales service
un service de livraison|a delivery service
un service de garde|an out-of-hours service
une garderie|a childcare facility
une halte-garderie|a drop-in nursery
une assistante maternelle|a childminder
un accompagnement|some guidance
une orientation|some direction
une médiation|some mediation
une consultation|a consultation
une permanence téléphonique|a telephone helpline
une ligne d'assistance|a support line
une borne d'information|an information terminal
un office de tourisme|a tourist office
un bureau de poste|a post office
une agence bancaire|a bank branch
une agence immobilière|an estate agency
une agence de voyages|a travel agency
une agence de location|a rental agency
une salle de sport|a gym
un terrain de tennis|a tennis court
un terrain de basket|a basketball court
une piste cyclable|a cycle lane
une piste de danse|a dance floor
une patinoire|an ice rink
un bowling|a bowling alley
un manège|a carousel
une aire de pique-nique|a picnic area
un barbecue|a barbecue
un parasol|a beach umbrella
un transat|a deckchair
un hamac|a hammock
un canoë|a canoe
un kayak|a kayak
une pagaie|a paddle
un gilet de sauvetage|a life jacket
une bouée|a lifebuoy
un bateau|a boat
un voilier|a sailing boat
un ferry|a ferry
un vélo|a bicycle
une trottinette|a scooter
une moto|a motorbike
une voiture|a car
une camionnette|a van
un camion|a lorry
un autocar|a coach
un tramway|a tram
un téléphérique|a cable car
un funiculaire|a funicular railway
un télésiège|a chairlift
un train|a train
un wagon|a railway carriage
une locomotive|a locomotive
un compartiment|a compartment
une couchette|a sleeping berth
une place assise|a seat
un porte-bagages|a luggage rack
une soute|a luggage hold
un chariot|a trolley
une poussette|a pushchair
un fauteuil roulant|a wheelchair
une rampe|a ramp
une poignée|a handle
une main courante|a handrail
un interphone|an intercom
un digicode|a door entry keypad
un badge|an access badge
une carte d'accès|an access card
un détecteur de fumée|a smoke detector
un extincteur|a fire extinguisher
une alarme|an alarm
une prise|a power socket
un interrupteur|a switch
un fusible|a fuse
un compteur|a meter
un radiateur|a radiator
un ventilateur|a fan
un climatiseur|an air conditioner
un chauffe-eau|a water heater
un robinet|a tap
un évier|a kitchen sink
un lavabo|a washbasin
une baignoire|a bath
une douche|a shower
un pommeau de douche|a shower head
un bouchon|a plug
un joint|a seal
une fuite|a leak
une réparation|a repair
un dépannage|a repair service
un entretien annuel|an annual service
une révision|a service inspection
un diagnostic|a diagnosis
un contrôle|an inspection
une inspection|an inspection
une intervention|a service visit
un technicien|a technician
une pièce détachée|a spare component
un remplacement|a replacement
une installation|an installation
un branchement|a connection
un raccordement|a utility connection
un raccord|a connector
un flexible|a flexible hose
un filtre|a filter
un embout|an attachment
un support|a stand
une fixation|a fastener
un crochet|a hook
une charnière|a hinge
une roulette|a castor
un patin|a furniture pad
une visseuse|an electric screwdriver
une clé à molette|an adjustable spanner
une clé Allen|an Allen key
un boulon|a bolt
un écrou|a nut
une rondelle|a washer
une cheville|a wall plug
une truelle|a trowel
du papier de verre|some sandpaper
de la peinture|some paint
du vernis|some varnish
un rouleau|a roller
un bac à peinture|a paint tray
une bâche|a protective sheet
un escabeau pliant|a folding stepladder
une protection|some protection
des lunettes de protection|some safety goggles
des gants de travail|some work gloves
un masque|a mask
un chiffon|a cloth
un produit nettoyant|a cleaning product
un détergent|a detergent
un désinfectant|a disinfectant
du vinaigre blanc|some white vinegar
du bicarbonate|some bicarbonate of soda
une brosse à récurer|a scrubbing brush
une raclette|a squeegee
un plumeau|a feather duster
un étendoir|a clothes airer
un panier à linge|a laundry basket
un filet de lavage|a laundry bag
une housse|a cover
un protège-matelas|a mattress protector
une alèse|a mattress pad
une housse de couette|a duvet cover
un drap-housse|a fitted sheet
un couvre-lit|a bedspread
un plaid|a throw
un traversin|a bolster
un sommier|a bed base
une table de chevet|a bedside table
une lampe de chevet|a bedside lamp
une veilleuse|a night light
un abat-jour|a lampshade
un plafonnier|a ceiling light
une applique|a wall light
un lampadaire|a floor lamp
une guirlande|a garland
une guirlande lumineuse|a string of lights
un photophore|a candle holder
un bougeoir|a candlestick
une lanterne|a lantern
un briquet|a lighter
des allumettes|some matches
un cendrier|an ashtray
un dessous-de-verre|a coaster
un set de table|a placemat
une serviette de table|a napkin
un rond de serviette|a napkin ring
une corbeille|a basket
un sucrier|a sugar bowl
une salière|a salt shaker
un moulin à poivre|a pepper mill
une huilière|an oil cruet
un beurrier|a butter dish
une saucière|a gravy boat
un coquetier|an egg cup
une théière|a teapot
une tisanière|an infuser mug
une boule à thé|a tea infuser
un filtre à café|a coffee filter
une dosette|a coffee pod
une capsule|a capsule
un thermos|a vacuum flask
un presse-agrumes|a citrus juicer
un presse-ail|a garlic press
un casse-noix|a nutcracker
un rouleau à pâtisserie|a rolling pin
un emporte-pièce|a pastry cutter
une poche à douille|a piping bag
un pinceau de cuisine|a pastry brush
une maryse|a flexible spatula
une écumoire|a skimmer
une mandoline|a mandoline slicer
une essoreuse à salade|a salad spinner
une cocotte|a casserole pot
un autocuiseur|a pressure cooker
un faitout|a large cooking pot
une sauteuse|a sauté pan
une crêpière|a pancake pan
un wok|a wok
une grille|a rack
une plaque de cuisson|a hob
un four|an oven
un micro-ondes|a microwave
un réfrigérateur|a refrigerator
un congélateur|a freezer
un lave-vaisselle|a dishwasher
un lave-linge|a washing machine
un sèche-linge|a tumble dryer
une hotte|an extractor hood
un minuteur|a kitchen timer
une manique|an oven glove
un dessous-de-plat|a trivet
un plat à gratin|an oven dish
un moule à tarte|a tart tin
un moule à cake|a loaf tin
un moule à muffins|a muffin tin
du papier cuisson|some baking paper
du papier aluminium|some aluminium foil
du film alimentaire|some cling film
un sac de congélation|a freezer bag
une boîte hermétique|an airtight container
une barquette|a small food tray
un sachet|a small bag
un emballage réutilisable|a reusable wrapper
une lunch box|a lunch box
un panier-repas|a packed lunch
un pique-nique|a picnic
un repas végétarien|a vegetarian meal
un plat du jour|a dish of the day
un menu enfant|a children's menu
un menu dégustation|a tasting menu
une carte des vins|a wine list
une carte des desserts|a dessert menu
une addition|a bill
un terminal de paiement|a card machine
un ticket de caisse|a till receipt
une note de frais|an expense claim
un avoir|a credit note
un bon d'achat|a voucher
une carte cadeau|a gift card
une carte de fidélité|a loyalty card
un programme de fidélité|a loyalty programme
une carte de membre|a membership card
une attestation d'assurance|an insurance certificate
un relevé bancaire|a bank statement
un relevé d'identité bancaire|a bank details document
un chéquier|a chequebook
un virement|a bank transfer
un prélèvement|a direct debit
un versement|a payment
un acompte|a deposit
une caution|a security deposit
une quittance|a payment receipt
une quittance de loyer|a rent receipt
un bail|a tenancy agreement
un état des lieux|a property condition report
un préavis|a notice period
une attestation de domicile|a proof of address
une fiche de paie|a payslip
un bulletin de salaire|a salary slip
un contrat de travail|an employment contract
une lettre de motivation|a cover letter
un curriculum vitae|a CV
un certificat médical|a medical certificate
un carnet de santé|a health record
une carte Vitale|a French health insurance card
une mutuelle|a supplementary health insurance plan
un numéro de dossier|a case reference number
un numéro de suivi|a tracking number
un accusé de réception|an acknowledgement of receipt
une lettre recommandée|a registered letter
un bordereau|a form accompanying a shipment
une étiquette de retour|a return label
un point relais|a parcel collection point
un retrait en magasin|an in-store collection
une livraison à domicile|a home delivery
une livraison express|an express delivery
un créneau de livraison|a delivery slot
un suivi de commande|an order tracking service
une confirmation de commande|an order confirmation
un bon de livraison|a delivery note
un bon de commande|an order form
un service de montage|an assembly service
un service de réparation|a repair service
une extension de garantie|an extended warranty
un échange standard|a like-for-like replacement
une solution de remplacement|a replacement solution
une aide technique|a technical aid
un accessoire|an accessory
un équipement|a piece of equipment
un appareil|a device
un ustensile|a utensil
un outil|a tool
un instrument|an instrument
un objet|an object
un article|an item
un produit|a product
une marchandise|an item of merchandise
une fourniture|a supply item
un matériau|a building material
une ressource|a resource
un complément|a supplement
une option|an option
une fonctionnalité|a feature
un paramètre|a parameter
une préférence de langue|a language preference
une langue d'affichage|a display language
une traduction française|a French translation
une version bilingue|a bilingual version
un guide de conversation|a phrasebook
un guide pratique|a practical guide
un guide audio|an audio guide
un livre audio|an audiobook
un balado|a podcast
un abonnement numérique|a digital subscription
une archive|an archive
un historique|a history log
un favori|a favourite
un signet|a bookmark
une liste de lecture|a playlist
une sélection|a selection
une suggestion|a suggestion
une ressource gratuite|a free resource
un contenu téléchargeable|downloadable content
un accès hors ligne|offline access
une copie de secours|a backup copy
un fichier audio|an audio file
un fichier texte|a text file
une piste audio|an audio track
un extrait|an excerpt
un échantillon sonore|an audio sample
une transcription|a transcription
une fiche de vocabulaire|a vocabulary sheet
une fiche de révision|a revision sheet
un carnet de notes|a notebook
un carnet de voyage|a travel journal
un journal de bord|a logbook
un tableau de bord|a dashboard
un emploi du temps|a schedule
une liste de tâches|a task list
un rappel|a reminder
un repère visuel|a visual cue
un aide-mémoire|a memory aid
un moyen mnémotechnique|a mnemonic
un exercice d'écoute|a listening exercise
un exercice oral|a speaking exercise
un exercice écrit|a written exercise
un jeu de rôle|a role play
une mise en situation|a practical scenario
un échange linguistique|a language exchange
une immersion|an immersion experience
un séjour linguistique|a language study stay
un partenaire linguistique|a language partner
un tuteur|a tutor
une tutrice|a female tutor
un mentor|a mentor
une mentor|a female mentor
un apprenant|a learner
une apprenante|a female learner
un auditeur|a listener
une auditrice|a female listener
un participant|a participant
une participante|a female participant
un débutant|a beginner
une débutante|a female beginner
un amateur|an enthusiast
une amatrice|a female enthusiast
un passionné|an enthusiast
une passionnée|a female enthusiast
un spécialiste|a specialist
une spécialiste|a female specialist
un expert|an expert
une experte|a female expert
un animateur|a group leader
une animatrice|a female group leader
un organisateur|an organiser
une organisatrice|a female organiser
un responsable|a person in charge
une responsable|a woman in charge
un coordinateur|a coordinator
une coordinatrice|a female coordinator
un représentant|a representative
une représentante|a female representative
un délégué|a delegate
une déléguée|a female delegate
un adhérent|a member
une adhérente|a female member
un membre|a member
une adhérente bénévole|a volunteer member
un invité|a guest
une invitée|a female guest
un visiteur|a visitor
une visiteuse|a female visitor
un voyageur|a traveller
une voyageuse|a female traveller
un passager|a passenger
une passagère|a female passenger
un touriste|a tourist
une touriste|a female tourist
un résident|a resident
une résidente|a female resident
un habitant|an inhabitant
une habitante|a female inhabitant
un voisin|a neighbour
une voisine|a female neighbour
un collègue|a colleague
une collègue|a female colleague
un camarade|a classmate
une camarade|a female classmate
un copain|a friend
une copine|a female friend
un ami|a friend
une amie|a female friend
un proche|someone close
une connaissance|an acquaintance
un témoin|a witness
un contact local|a local contact
` },
];
