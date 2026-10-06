/**
 * The one map from what an icon means to where it is drawn from.
 *
 * Every key is a semantic name a screen asks for (`<Icon name="speaker" />`),
 * never the source's own name, so swapping a drawing is one line here and no
 * call site moves. `npm run icons` turns this map into
 * `apps/mobile/src/icons/<Pascal>.tsx`, the `ICONS` registry and `IconName`.
 *
 *   source    `iconsax` (the pinned package below, founder decision D11) or
 *             `luvani` (a drawing of our own in `scripts/icons/custom/`).
 *   from      the source's name: an Iconsax manifest id, or a custom file stem.
 *             A Bulk custom lives beside it as `<stem>.bulk.svg`.
 *   variants  `linear` for controls; add `bulk` for tiles, tabs and states.
 *   rotate    degrees about the centre (a bare cross is a turned plus).
 *   translate per variant, onto the 24 box, for a source drawn on a smaller one.
 *   parts     per variant, which top-level elements each named part draws, so
 *             `icons/AnimatedIcon.tsx` can move one part and not the others.
 *   use       where it is used, for docs/design-assets/ICON_SET.md.
 *
 * Sorted by key; `build-icons.mjs` refuses it otherwise. No face anywhere
 * (founder decision D1): people are silhouettes, and the tutor is always the
 * orb, never an icon.
 *
 * Names checked against iconsax@0.1.1's manifest on 2026-10-06. Where the
 * spec's candidate was missing, the renamed id is used: arrow-left-02 (back),
 * arrow-right-01 and -02, arrow-down-02, login-01, logout-01, message-circle,
 * book, sun, star, weight. Three picks were made by looking at the drawings
 * rather than the names: `refresh` is refresh-arrow-01, the two bare arrows,
 * because refresh-left draws them inside a square and would read as a button
 * inside a button; `replay` is repeate-one, the loop with a 1 that ICONS.md's
 * repeat-one drew, because rotate-left turns a picture; and `calendar` replaces
 * the spec's calendar-1, whose drawing prints a date ("31"), and no screen may
 * show a date that is not true.
 */

/** The pinned source package. `build-icons.mjs` refuses any other installed version. */
export const ICONSAX_VERSION = '0.1.1';

/**
 * @typedef {'linear' | 'bulk'} Variant
 * @typedef {{
 *   source: 'iconsax' | 'luvani',
 *   from: string,
 *   variants: Variant[],
 *   rotate?: number,
 *   translate?: Partial<Record<Variant, [number, number]>>,
 *   parts?: Partial<Record<Variant, Record<string, number[]>>>,
 *   use: string,
 * }} IconSpec
 */

const L = /** @type {Variant[]} */ (['linear']);
const LB = /** @type {Variant[]} */ (['linear', 'bulk']);

/** @type {Record<string, IconSpec>} */
export const ICON_CONFIG = {
  add: { source: 'iconsax', from: 'add', variants: L, use: 'PlusGlyph; add a phrase' },
  alert: { source: 'iconsax', from: 'danger', variants: L, use: "AlertGlyph, beside a field's error line" },
  back: { source: 'iconsax', from: 'arrow-left-02', variants: L, use: 'ChevronLeft; the round back button' },
  bell: { source: 'iconsax', from: 'notification', variants: LB, use: 'reminders' },
  'bell-ring': { source: 'iconsax', from: 'notification-bing', variants: LB, use: 'a reminder set (AnimatedIcon bell-ring)' },
  book: { source: 'iconsax', from: 'book', variants: LB, use: 'DocumentGlyph rows; the daily collection, phrasebook' },
  bookmark: { source: 'iconsax', from: 'bookmark', variants: LB, use: 'BookmarkGlyph; keep a phrase (AnimatedIcon bookmark-fill)' },
  'bubble-empty': { source: 'iconsax', from: 'message-circle', variants: LB, use: 'start level: nothing yet' },
  'bubble-line': { source: 'iconsax', from: 'message-text', variants: LB, use: 'start level: a few words' },
  bubbles: { source: 'iconsax', from: 'messages-2', variants: LB, use: 'start level: getting by' },
  cafe: { source: 'iconsax', from: 'coffee', variants: LB, use: 'PlaceGlyph cafe' },
  calendar: { source: 'iconsax', from: 'calendar', variants: LB, use: 'the week' },
  'calendar-tick': { source: 'iconsax', from: 'calendar-tick', variants: LB, use: 'a goal met' },
  card: { source: 'iconsax', from: 'card', variants: L, use: 'Settings: subscription' },
  cards: { source: 'iconsax', from: 'note-2', variants: LB, use: 'CardsGlyph; the review deck' },
  chat: { source: 'iconsax', from: 'messages-2', variants: LB, use: 'ChatGlyph; conversations, talk freely' },
  check: { source: 'luvani', from: 'check', variants: L, use: "CheckGlyph; the chosen option's tick" },
  'chevron-down': { source: 'iconsax', from: 'arrow-down-02', variants: L, use: 'ChevronDownGlyph; More and Less' },
  'chevron-right': { source: 'iconsax', from: 'arrow-right-02', variants: L, use: 'ChevronRight; the end of a row that opens' },
  clock: { source: 'iconsax', from: 'clock', variants: LB, use: 'ClockGlyph; change time' },
  close: { source: 'iconsax', from: 'add', variants: L, rotate: 45, use: 'CloseGlyph; sheets, stories, clear search' },
  cloud: { source: 'iconsax', from: 'cloud', variants: LB, use: 'account saved (AnimatedIcon cloud-check)' },
  'cloud-add': { source: 'iconsax', from: 'cloud-add', variants: LB, use: 'save progress' },
  'cloud-off': { source: 'iconsax', from: 'cloud-cross', variants: LB, use: 'offline' },
  coffee: { source: 'iconsax', from: 'coffee', variants: LB, use: 'CoffeeCupGlyph; the coffee drink choice' },
  crown: { source: 'iconsax', from: 'crown-1', variants: LB, use: 'Max plan, level' },
  cup: { source: 'iconsax', from: 'cup', variants: LB, use: 'milestones' },
  document: { source: 'iconsax', from: 'document-text', variants: L, use: 'conversation text' },
  download: { source: 'iconsax', from: 'document-download', variants: L, use: 'save conversation text, export' },
  edit: { source: 'iconsax', from: 'edit-2', variants: L, use: 'change plan, edit goal, change voice' },
  evening: { source: 'iconsax', from: 'cloud-sunny', variants: LB, use: 'reminder time: early evening' },
  exploring: { source: 'iconsax', from: 'discover', variants: LB, use: 'reason: exploring' },
  eye: { source: 'iconsax', from: 'eye', variants: L, use: 'try it from memory, then reveal' },
  family: { source: 'iconsax', from: 'heart', variants: LB, use: 'reason: family' },
  flag: { source: 'iconsax', from: 'flag-2', variants: LB, use: 'TargetGlyph; goal rows' },
  flame: {
    source: 'iconsax',
    from: 'fire',
    variants: LB,
    parts: { bulk: { flame: [0], sparks: [1, 2, 3, 4, 5] } },
    use: 'FlameGlyph; the streak (AnimatedIcon flame-flicker)',
  },
  food: { source: 'iconsax', from: 'reserve', variants: LB, use: 'reason: food' },
  forward: { source: 'iconsax', from: 'arrow-right-01', variants: L, use: 'ArrowRight; next' },
  freeze: { source: 'iconsax', from: 'snowflake', variants: LB, use: 'streak freeze (paid)' },
  'friends-place': { source: 'iconsax', from: 'people', variants: LB, use: 'PlaceGlyph friends' },
  gift: { source: 'iconsax', from: 'gift', variants: LB, use: 'the quest chest' },
  headphones: { source: 'iconsax', from: 'headphone', variants: LB, use: 'hear, say and compare; walk mode' },
  help: { source: 'iconsax', from: 'message-question', variants: L, use: 'HelpGlyph; Help me out' },
  hint: { source: 'iconsax', from: 'lamp-charge', variants: L, use: 'drill help' },
  home: { source: 'iconsax', from: 'home-2', variants: LB, use: 'HomeIcon, the Home tab' },
  'home-place': { source: 'iconsax', from: 'house-2', variants: LB, use: 'PlaceGlyph home' },
  hotel: { source: 'iconsax', from: 'building-4', variants: LB, use: 'PlaceGlyph hotel' },
  info: { source: 'iconsax', from: 'info-circle', variants: L, use: 'InfoGlyph; details, about' },
  keyboard: { source: 'iconsax', from: 'keyboard', variants: L, use: 'KeyboardGlyph; type instead' },
  lock: { source: 'iconsax', from: 'lock', variants: LB, use: 'LockGlyph; plans (AnimatedIcon lock-open)' },
  login: { source: 'iconsax', from: 'login-01', variants: L, use: 'sign in' },
  logout: { source: 'iconsax', from: 'logout-01', variants: L, use: 'Settings: sign out' },
  lunch: { source: 'iconsax', from: 'sun', variants: LB, use: 'reminder time: lunchtime' },
  map: { source: 'iconsax', from: 'map-1', variants: L, use: 'choose a scene or situation' },
  market: { source: 'iconsax', from: 'shop', variants: LB, use: 'PlaceGlyph market' },
  medal: { source: 'iconsax', from: 'medal-star', variants: LB, use: 'badges' },
  microphone: { source: 'iconsax', from: 'microphone-2', variants: LB, use: 'MicGlyph and the Speak tab; record (AnimatedIcon mic-pulse)' },
  'microphone-off': { source: 'iconsax', from: 'microphone-slash', variants: L, use: 'MicOffGlyph' },
  mobile: {
    source: 'iconsax',
    from: 'mobile',
    variants: L,
    // The Linear source is drawn edge to edge on a 16 by 20 box; this puts the
    // phone where Iconsax's own Bulk mobile sits, 4 to 20 across, 2 to 22 down.
    translate: { linear: [4, 2] },
    use: 'Settings: haptics',
  },
  moment: { source: 'iconsax', from: 'timer-pause', variants: L, use: 'give me a moment' },
  more: { source: 'iconsax', from: 'more', variants: L, use: 'friend options' },
  morning: { source: 'iconsax', from: 'sun-fog', variants: LB, use: 'reminder time: morning' },
  mouth: { source: 'luvani', from: 'mouth', variants: L, use: 'MouthGlyph; sound practice' },
  moving: { source: 'iconsax', from: 'truck-fast', variants: LB, use: 'reason: moving' },
  music: { source: 'iconsax', from: 'music', variants: L, use: 'Settings: sound effects' },
  night: { source: 'iconsax', from: 'moon', variants: LB, use: 'reminder time: before bed' },
  pause: { source: 'iconsax', from: 'pause', variants: LB, use: 'pause' },
  play: { source: 'iconsax', from: 'play', variants: LB, use: 'PlayGlyph' },
  postcard: { source: 'iconsax', from: 'gallery', variants: LB, use: 'PostcardGlyph; place postcards' },
  practice: { source: 'iconsax', from: 'weight', variants: LB, use: 'PracticeIcon, the Practice tab' },
  privacy: { source: 'iconsax', from: 'shield-tick', variants: L, use: 'Settings: privacy' },
  // The spec's `path`: renamed because an icon called path would export `Path`
  // over the react-native-svg element every generated file imports.
  progress: { source: 'iconsax', from: 'routing-2', variants: LB, use: 'MyFrenchIcon, the Progress tab; the scene path' },
  quests: {
    source: 'iconsax',
    from: 'task-square',
    variants: LB,
    // The Bulk source is drawn on a 20 by 21 box with its square at y 0.97;
    // this puts that square where the Linear one sits, 2 to 22 on both axes.
    translate: { bulk: [2, 1.029] },
    use: 'daily quests',
  },
  quote: { source: 'iconsax', from: 'quote-up', variants: LB, use: 'QuoteGlyph; your phrases' },
  refresh: { source: 'iconsax', from: 'refresh-arrow-01', variants: L, use: 'every error retry (AnimatedIcon refresh-spin)' },
  repair: { source: 'iconsax', from: 'refresh-circle', variants: LB, use: 'streak repair (paid)' },
  replay: { source: 'iconsax', from: 'repeate-one', variants: L, use: 'ReplayGlyph; retry this line, say it again' },
  search: { source: 'iconsax', from: 'search-normal', variants: L, use: 'SearchGlyph' },
  settings: { source: 'iconsax', from: 'setting-2', variants: L, use: 'SettingsGlyph; the Profile header' },
  share: { source: 'iconsax', from: 'share', variants: L, use: 'ShareGlyph; share a postcard or an invite' },
  sort: { source: 'iconsax', from: 'sort', variants: L, use: 'newest conversations' },
  speaker: {
    source: 'iconsax',
    from: 'volume-high',
    variants: LB,
    parts: {
      linear: { body: [0], arc1: [1], arc2: [2] },
      bulk: { body: [2, 3], arc1: [0], arc2: [1] },
    },
    use: 'EarGlyph and SpeakerGlyph; every Hear control (AnimatedIcon speaker-waves)',
  },
  'speaker-off': { source: 'iconsax', from: 'volume-slash', variants: L, use: "I can't listen now" },
  'speaker-slow': { source: 'luvani', from: 'speaker-slow', variants: L, use: 'SpeakerSlowGlyph; simpler, play slowly' },
  sprout: { source: 'luvani', from: 'sprout', variants: L, use: 'SproutGlyph, kept until its retirement (F602, F605)' },
  star: { source: 'iconsax', from: 'star', variants: LB, use: 'XP (AnimatedIcon star-pop)' },
  stop: { source: 'iconsax', from: 'stop', variants: LB, use: 'stop' },
  street: { source: 'iconsax', from: 'location', variants: LB, use: 'PlaceGlyph street' },
  tea: { source: 'luvani', from: 'tea', variants: LB, use: 'the tea drink choice' },
  'tick-circle': {
    source: 'iconsax',
    from: 'tick-circle',
    variants: LB,
    parts: { bulk: { disc: [0], tick: [1] } },
    use: 'BadgeGlyph; done, accept, I said it (AnimatedIcon check-draw)',
  },
  translate: { source: 'iconsax', from: 'translate', variants: L, use: 'in English' },
  trip: { source: 'iconsax', from: 'airplane', variants: LB, use: 'reason: a trip' },
  unlock: {
    source: 'iconsax',
    from: 'unlock',
    variants: LB,
    parts: { bulk: { body: [0, 1], shackle: [2] } },
    use: 'a confirmed plan (AnimatedIcon lock-open)',
  },
  user: { source: 'iconsax', from: 'profile-circle', variants: LB, use: 'ProfileIcon; Settings: account' },
  'user-add': { source: 'iconsax', from: 'user-add', variants: LB, use: 'invite a friend' },
  users: { source: 'iconsax', from: 'people', variants: LB, use: 'FriendsIcon' },
  waveform: { source: 'iconsax', from: 'sound', variants: LB, use: 'WaveformGlyph; your sounds' },
  work: { source: 'iconsax', from: 'briefcase', variants: LB, use: 'reason: work' },
};
