# Luvani · vibrant app and paywalls

[Open the Figma review](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=44-1481).

Completed 9 October 2026: 74 app screens and 56 paywall/billing states. The founder’s latest direction supersedes the older limits on colour cards and repeated purpose lines. The redesigned screens keep Outfit and Luvani’s palette, use joyful editable French scene illustrations, and remove repeated promotional copy. Babbel’s plan clarity and trial reassurance informed the payment layout; the supplied full-slide colour reference informed the app compositions.

## Review the file

| Figma page | What it contains |
|---|---|
| Start here · vibrant app review | A 12-screen overview of the main app and payment surfaces. |
| Play the app · 130 screens | All 130 connected states, six starting journeys and 565 prototype reactions. |
| Whole app · vibrant revision | The 74 editable app screens, organised by journey, with implementation notes outside the UI. |
| Paywall journeys | The 56 editable entry, offer, checkout, entitlement, allowance and aftercare states; shared component library. |
| Layout & motion · device checks | 11 compact, larger, landscape, large-text and Reduced Motion fixtures. |

In “Play the app · 130 screens”, press Present. The six flows are Find your voice, Explore every tab, Live tutor, Choose a speaking plan, Payment recovery and Manage your plan. Four bottom tabs are Home, Speak, Practice and Progress. The labelled profile avatar opens Profile; Settings and Friends are reached there.

The final PDF is `output/pdf/luvani-vibrant-app-and-paywalls-review.pdf`: six introductory/index pages followed by 130 native vector screen pages, with bookmarks. `luvani-app-review.png` is the overview; `welcome-motion.mp4` is the two-second exported welcome entrance.

## Design structure

36 shared component masters and 36 variables support the payment and app screens. The library includes nine original Outfit text styles, a larger hero style and 11 editable illustration masters. Plan rows, buttons and text use Auto Layout, fill width and content height. Decorative artwork is distinct from reading content and yields space first on compact or large-text screens. Main actions stay in the safe-area footer. French examples remain larger than their English gloss.

At default text, the 375 × 812 trial screen fits all three plan choices, their billed prices and allowances, the trial timeline, expiry rule, full post-trial charge, primary action, dismissal, restore, details and legal links. Optional details open their own surface. At larger text or in landscape, body and action regions scroll independently; text is not capped, clipped or reduced merely to fit. The large-text offer fixtures use stacked terms, and the 3× profile fixture uses full-width statistic cards.

Motion uses brief entrances and restrained live voice feedback. Connecting and thinking advance into the tutor turn; Reply enters the learner turn. The 128-minute live balance is a fixture and must be replaced by the verified remaining allowance. Reduced Motion removes decorative movement; real voice motion must follow actual audio state. No artificial loading step is added to onboarding.

## Implemented in the checkout

- `apps/mobile/src/responsiveLayout.ts` centralises usable bounds, compact mode, footer limits and artwork limits. It uses viewport dimensions, actual safe areas and font scale rather than a list of phone names.
- `apps/mobile/src/layout.tsx` supplies that geometry and a live font-scale hook. Footers are bounded, centred and independently scrollable so large text cannot squeeze the body away. Keyboard handling remains in the shared roots.
- `apps/mobile/src/art/flat/Illustration.tsx` preserves artwork aspect ratio and bounds it by usable height and available width.
- `apps/mobile/src/onboarding/firstRun/PlanReveal.tsx` wraps narrow tiles and stacks them at large text instead of splitting words into thin columns.
- Repeated tab purpose subtitles were removed from Speak, Practice, Progress, Profile and Friends.
- The native plan view presents the selected tier’s actual monthly/yearly products and one route to the other tier. Repeated estimates and goal-fit copy were removed. Verified billed prices and billing periods remain beside the action; trial wording is shown only for an eligible store offer.

The complete vibrant screen redesign is the Figma deliverable. This checkout implements its shared responsive foundations and the listed copy/plan-layout changes. It does not claim that all 130 redesigned visuals or integrations have been ported into the native app.

## Verification

- Mobile TypeScript passes. The full mobile suite passes: 2,600 tests, zero failures. After removing obsolete plan-view props/styles, 109 affected plan/trial/surface-contract checks also pass.
- Geometry checks cover ten sizes from 320 × 568 through 440 × 956, landscape 812 × 375 and a 700 × 720 unfamiliar viewport, each at 1×, 1.5×, 2× and 3× text scales.
- Figma’s 375 × 812 Home, Practice, Settings and trial fixtures fit at default text. The 430 × 932 fixtures, 390 × 844 large-text fixtures, landscape fixtures and still welcome fixture were inspected. Large-text terms and progress cards were reflowed after visual review.
- The actual onboarding web preview was inspected at 375 × 812, 430 × 932 and 812 × 375: no horizontal overflow, and the primary action stayed within the viewport. Temporary viewport overrides were reset.
- Browser prototype checks verified monthly selection updates the price/action, Terms → Back preserves that selection, Home → Practice → Profile → Settings → Privacy works, and live connection → tutor turn → learner turn works.
- All 130 prototype roots have the expected phone dimensions and Outfit text; the saved audit reports no missing destinations, self-navigation links or placeholder text. The welcome MP4 was reviewed frame by frame. The PDF cover, index and native screen pages were rendered and inspected.

Physical iPhone testing, VoiceOver, native Dynamic Type/keyboard checks and real store/audio/permission integration acceptance are still required before release. Unknown future devices are handled through adaptive geometry; this is not a claim of certification against unreleased hardware.

## Billing and real-data boundary

All Figma prices, dates, balances, identities and earned results are design fixtures. The report proposes Weekly $5.49 / 45 live minutes per seven days, Monthly $19 / 180 per month, Yearly $199.99 / 180 refreshed monthly, and Max $29 / 300 per month. Its eligible annual trial grants 45 live minutes once. The annual saving is the rounded comparison against twelve $19 payments; no fictional discount anchor or customer claim is used.

The existing native catalogue has Starter and Max (`regular`) with monthly/yearly products. It has no configured weekly product, and its current trial allowances differ from the research proposal. The code continues to use store prices, verified eligibility and server catalogue allowances; it does not substitute these fixture numbers into billing.

Store confirmation is followed by verified access, pending is distinct from payment failure, restore precedes repurchase on a new installation, renewal cancellation preserves access until verified expiry, grace preserves active access, and retry/revoked states explain paused access. Trial reminders claim success only after permission and scheduling are confirmed. Unused allowance expires without rollover; plan changes use the actual store’s effective timing and carry forward used time as appropriate.

Store sheets, authentication, real audio/microphone access, notification permission/scheduling, sharing and account actions are explicit handoffs. The Figma prototype performs no real financial transaction, permission grant or destructive account action. Existing prompt limits and entitlement semantics remain implementation constraints; the user’s visual override does not change real-data truth.

## Coverage

| Journey family | States |
|---|---:|
| Onboarding | 10 |
| Home | 4 |
| Speak | 9 |
| Live tutor | 9 |
| Practice | 10 |
| Progress | 5 |
| Recap | 3 |
| Profile | 2 |
| Settings | 7 |
| Friends | 9 |
| Account | 6 |
| Entry points | 7 |
| Offer choices | 10 |
| Checkout and recovery | 12 |
| Confirmed access | 5 |
| Allowance boundaries | 3 |
| Plan and subscription | 12 |
| Details and aftercare | 7 |

## Screen index

PDF page numbers refer to the packaged 136-page review. Each screen link opens its connected Figma state; source identifiers are preserved in `prototype-source.json`, `app-compiled-state.json` and `figma-state.json`.

| PDF page | Figma key | Screen |
|---:|---|---|
| 7 | [onboard-welcome](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-1480) | Find your voice. |
| 8 | [onboard-goal](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-1558) | What brings you here? |
| 9 | [onboard-level](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-1689) | Where shall we start? |
| 10 | [onboard-voice](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-1756) | Meet your AI tutor. |
| 11 | [onboard-scene](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-1866) | One coffee. In French. |
| 12 | [onboard-age](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-1955) | Before we start. |
| 13 | [age-refusal](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-1995) | Thanks for stopping by. |
| 14 | [onboard-privacy](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-2042) | You’re in control. |
| 15 | [onboard-mic](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-2114) | Your first French line. |
| 16 | [onboard-save](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-2162) | Keep this moment. |
| 17 | [app-home](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-2242) | Bonjour, Alex. |
| 18 | [home-first](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-2384) | Bonjour. |
| 19 | [home-offline](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-2528) | A little French, anywhere. |
| 20 | [home-loading](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-2630) | Bonjour. |
| 21 | [app-tutor](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-2711) | Let’s talk. |
| 22 | [tutor-voices](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-2833) | Choose your voice. |
| 23 | [tutor-memory](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-3002) | What your tutor remembers. |
| 24 | [memory-removed](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-3041) | Memory removed. |
| 25 | [scenes](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-3082) | Where shall we go? |
| 26 | [scene-cafe](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-3339) | One coffee. In French. |
| 27 | [scene-hotel](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-3416) | Your room is waiting. |
| 28 | [scene-market](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-3499) | Make it your market. |
| 29 | [scene-directions](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-3610) | Find your way. |
| 30 | [live-connecting](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-3671) | Getting ready. |
| 31 | [live-listen](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-3740) | Listen. |
| 32 | [live-speak](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-3820) | Your turn. |
| 33 | [live-thinking](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-3904) | One moment. |
| 34 | [live-paused](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-3973) | Take your time. |
| 35 | [live-help](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-4051) | A little help. |
| 36 | [live-type](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-4101) | Type your reply. |
| 37 | [leave-live](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-4134) | Leave this conversation? |
| 38 | [live-failed](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-4158) | Connection interrupted. |
| 39 | [practice-home](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-4200) | Make it feel natural. |
| 40 | [practice-phrase](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-4330) | One line. Yours. |
| 41 | [practice-shadow](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-4406) | Hear. Say. Compare. |
| 42 | [practice-recorded](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-4453) | That was your French. |
| 43 | [practice-sound](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-4534) | Find your French “u”. |
| 44 | [sound-result](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-4579) | Your sound check. |
| 45 | [practice-review](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-4643) | Your words, again. |
| 46 | [review-card](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-4690) | Say it in French. |
| 47 | [practice-conversations](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-4765) | Keep the conversation. |
| 48 | [conversation-saved](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-4800) | At the café. |
| 49 | [progress-home](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-4839) | Look at your French. |
| 50 | [progress-empty](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-5007) | It starts with one line. |
| 51 | [week-wrap](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-5126) | Your week. In French. |
| 52 | [postcard](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-5220) | Coffee, confidently. |
| 53 | [postcards](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-5304) | Places your French can take you. |
| 54 | [recap-line](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-5435) | You said it. |
| 55 | [recap-earned](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-5509) | One coffee. All yours. |
| 56 | [recap-next](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-5593) | Let’s take it further. |
| 57 | [profile](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-5675) | Alex. |
| 58 | [profile-edit](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-5756) | Make it yours. |
| 59 | [settings-main](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-5783) | Settings. |
| 60 | [settings-notifications](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-5863) | A nudge, your way. |
| 61 | [settings-time](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-5931) | When suits you? |
| 62 | [settings-sound](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-5972) | Sound & feel. |
| 63 | [settings-privacy](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-6019) | Your learning. Your choice. |
| 64 | [settings-account](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-6090) | Your account. |
| 65 | [delete-account](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-6142) | Delete your account? |
| 66 | [friends-home](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-6168) | French, together. |
| 67 | [friends-empty](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-6256) | Bring your people. |
| 68 | [friends-requests](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-6318) | A new face. |
| 69 | [friends-invite](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-6353) | A little French together. |
| 70 | [friends-find](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=35-6418) | Find your friend. |
| 71 | [friend-detail](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-1480) | Sam. |
| 72 | [friends-privacy](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-1542) | Choose what you share. |
| 73 | [friend-report](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-1576) | You’re in control. |
| 74 | [report-review](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-1611) | Report a concern. |
| 75 | [sign-in](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-1639) | Welcome back. |
| 76 | [sign-up](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-1682) | Keep your French. |
| 77 | [password-reset](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-1730) | A fresh start. |
| 78 | [reset-sent](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-1753) | Check your email. |
| 79 | [policy](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-3327) | Privacy policy. |
| 80 | [terms](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-3418) | Terms of service. |
| 81 | [first-recap](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-3440) | First conversation · invitation |
| 82 | [home](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-3476) | Home · optional invitation |
| 83 | [later-recap](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-3547) | Later recap · next situation |
| 84 | [locked](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-3583) | Locked situation · before live work |
| 85 | [welcome-empty](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-3618) | Welcome time · exhausted |
| 86 | [free-settings](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-3657) | Settings · welcome sample |
| 87 | [reinstall](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-3709) | New device · restore first |
| 88 | [yearly-trial](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-3763) | Yearly · eligible seven-day trial |
| 89 | [monthly](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-3864) | Monthly · paid immediately |
| 90 | [weekly](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-3955) | Weekly · paid immediately |
| 91 | [yearly-paid](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-4047) | Yearly · trial ineligible |
| 92 | [yearly-unknown](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-4138) | Yearly · eligibility unknown |
| 93 | [unselected](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-4230) | Generic See plans · explicit choice |
| 94 | [max](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-4317) | More speaking time · Max monthly |
| 95 | [return](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-4391) | Former subscriber · return offer |
| 96 | [two-offer](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-4482) | Experiment A · weekly and yearly |
| 97 | [partial-offers](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-4574) | Yearly unavailable · remaining offers |
| 98 | [offers-loading](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-4658) | Offers · loading |
| 99 | [offers-unavailable](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-4699) | Offers · unavailable |
| 100 | [store-opening](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-4744) | Checkout · opening native confirmation |
| 101 | [confirming](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-4782) | Store success · verifying access |
| 102 | [pending](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-4826) | Purchase · pending approval |
| 103 | [checkout-cancelled](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-4871) | Checkout cancelled · keep selection |
| 104 | [payment-failed](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-4964) | Payment failed · retry selected offer |
| 105 | [slow-verify](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-5056) | Verification · delayed |
| 106 | [restore-found](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-5100) | Restore · confirmed access |
| 107 | [restore-none](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-5144) | Restore · no purchase found |
| 108 | [restore-linked](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-5182) | Restore · another Luvani account |
| 109 | [restore-offline](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-5220) | Restore · connection unavailable |
| 110 | [success-trial](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-5258) | Trial · verified usable access |
| 111 | [success-weekly](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-5306) | Weekly · verified usable access |
| 112 | [success-monthly](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-5347) | Monthly · verified usable access |
| 113 | [success-yearly](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-5388) | Yearly · verified usable access |
| 114 | [success-max](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-5430) | Max · verified usable access |
| 115 | [paid-empty](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-5471) | Starter · allowance exhausted |
| 116 | [trial-empty](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-5513) | Trial · allowance exhausted |
| 117 | [max-empty](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-5551) | Max · allowance exhausted |
| 118 | [manage-trial](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-5586) | Settings · active yearly trial |
| 119 | [manage-weekly](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-5638) | Settings · active Starter Weekly |
| 120 | [manage-monthly](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-5690) | Settings · active Starter Monthly |
| 121 | [manage-yearly](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-5742) | Settings · active Starter Yearly |
| 122 | [manage-max](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-5794) | Settings · active Max Monthly |
| 123 | [cancelled-paid](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-5846) | Settings · renewal off, access active |
| 124 | [cancelled-trial](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-5898) | Settings · cancelled trial, access active |
| 125 | [grace](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-5950) | Settings · billing grace, access active |
| 126 | [retry](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-5995) | Settings · billing retry, access paused |
| 127 | [lapsed](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-6037) | Settings · verified expiry |
| 128 | [revoked](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-6079) | Settings · refunded or revoked |
| 129 | [status-unknown](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-6121) | Settings · status unavailable |
| 130 | [change-scheduled](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-6163) | Plan change · deferred effective date |
| 131 | [change-review](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-6201) | Plan change · store terms review |
| 132 | [reminder-scheduled](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-6238) | Trial reminder · scheduling confirmed |
| 133 | [reminder-denied](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-6275) | Trial reminder · permission denied |
| 134 | [reminder-off](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-6313) | Trial reminder · unavailable or off |
| 135 | [metering](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-6351) | Speaking time · explanation and example week |
| 136 | [billing-reminder](https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=38-6413) | Day-five reminder · factual billing notice |
