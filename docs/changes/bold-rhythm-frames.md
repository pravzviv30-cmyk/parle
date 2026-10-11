# C · Bold rhythm frame map

All 60 numbered frames map to existing component state, not 60 routes. “Automated”
means tests ran; it does not mean the corresponding real provider/device scenario
was manually exercised. Screenshot fidelity has not been certified for all frames.
Detailed design context was retrieved for 00–53; the Figma tool limit blocked
54–59 and most additional motion calls. Those six have page text/state mapping.

| Frame | Figma node | Existing owner | Evidence / remaining check |
|---|---|---|---|
| 00 / Launch | `7:1812` | App / launch | Browser + automated |
| 01 / Welcome | `5:873` | PreAccountOnboarding / welcome | Browser + automated |
| 02 / Goals · empty | `7:1828` | PreAccountOnboarding / questions | Browser + automated |
| 03 / Goals · chosen | `5:917` | PreAccountOnboarding / questions | Browser + automated |
| 04 / Interests | `7:1864` | PreAccountOnboarding / questions | Browser + automated |
| 05 / French level | `7:1894` | PreAccountOnboarding / questions | Browser + automated |
| 06 / Speaking confidence | `7:1924` | PreAccountOnboarding / questions | Browser + automated |
| 07 / Practice focus | `7:1977` | PreAccountOnboarding / questions | Browser + automated |
| 08 / Daily duration | `7:2033` | PreAccountOnboarding / questions | Browser + automated |
| 09 / Your French plan | `7:2066` | PersonalPlan / plan editor | Browser + automated |
| 10 / Tutor · browse | `8:2230` | TutorSelection / voice preview controller | Browser + automated |
| 11 / Tutor · chosen | `5:953` | TutorSelection / voice preview controller | Browser + automated |
| 12 / Tutor · playing | `8:2287` | TutorSelection / voice preview controller | Browser + automated |
| 13 / Tutor · paused | `8:2345` | TutorSelection / voice preview controller | Browser + automated |
| 14 / Tutor · preview failed | `8:2403` | TutorSelection / voice preview controller | Automated; failure UI needs forced playback fault |
| 15 / Before practice · unchecked | `8:2461` | PreAccountOnboarding / consent, privacy, age | Automated; disclosure browser checked |
| 16 / Before practice · ready | `8:2498` | PreAccountOnboarding / consent, privacy, age | Automated; disclosure browser checked |
| 17 / Privacy details | `8:2535` | PreAccountOnboarding / consent, privacy, age | Automated; disclosure browser checked |
| 18 / Age restriction | `8:2560` | PreAccountOnboarding / consent, privacy, age | Automated; disclosure browser checked |
| 19 / Microphone permission | `8:2604` | FirstLivePractice / existing live session | Automated state/lifecycle checks; real service/device pending |
| 20 / Microphone denied | `8:2632` | FirstLivePractice / existing live session | Automated state/lifecycle checks; real service/device pending |
| 21 / Live · connecting | `8:4186` | FirstLivePractice / existing live session | Automated state/lifecycle checks; real service/device pending |
| 22 / Live · listening | `5:1007` | FirstLivePractice / existing live session | Automated state/lifecycle checks; real service/device pending |
| 23 / Live · processing | `8:4214` | FirstLivePractice / existing live session | Automated state/lifecycle checks; real service/device pending |
| 24 / Live · speaking | `8:4246` | FirstLivePractice / existing live session | Automated state/lifecycle checks; real service/device pending |
| 25 / Live · typing | `8:4277` | FirstLivePractice / existing live session | Automated state/lifecycle checks; real service/device pending |
| 26 / Live · transcript | `8:4312` | FirstLivePractice / existing live session | Automated state/lifecycle checks; real service/device pending |
| 27 / Live · reconnecting | `8:4345` | FirstLivePractice / existing live session | Automated state/lifecycle checks; real service/device pending |
| 28 / Live · connection failed | `8:4375` | FirstLivePractice / existing live session | Automated state/lifecycle checks; real service/device pending |
| 29 / End session | `8:4405` | FirstLivePractice / existing live session | Automated state/lifecycle checks; real service/device pending |
| 30 / Completion celebration | `8:4453` | FirstSessionResult / authoritative outcome | Synthetic preview + automated; real session pending |
| 31 / Achievements · first reveal | `8:4501` | FirstSessionResult / authoritative outcome | Synthetic preview + automated; real session pending |
| 32 / Achievements · complete | `5:1037` | FirstSessionResult / authoritative outcome | Synthetic preview + automated; real session pending |
| 33 / Save your progress | `8:5751` | FirstSessionResult / authoritative outcome | Synthetic preview + automated; real session pending |
| 34 / Create account | `5:1090` | SignUpScreen / existing auth adapter | Synthetic failure/verification/resend checked; real auth pending |
| 35 / Create account · keyboard | `8:5805` | SignUpScreen / existing auth adapter | Web keyboard checked; native pending |
| 36 / Create account · validation | `8:5848` | SignUpScreen / existing auth adapter | Synthetic failure/verification/resend checked; real auth pending |
| 37 / Create account · submitting | `8:5882` | SignUpScreen / existing auth adapter | Synthetic failure/verification/resend checked; real auth pending |
| 38 / Create account · recovery | `8:5915` | SignUpScreen / existing auth adapter | Synthetic failure/verification/resend checked; real auth pending |
| 39 / Verify email | `8:5951` | SignUpScreen / existing auth adapter | Synthetic failure/verification/resend checked; real auth pending |
| 40 / Verification · resend | `8:5999` | SignUpScreen / existing auth adapter | Synthetic failure/verification/resend checked; real auth pending |
| 41 / Sign in | `8:6047` | SignInScreen / SetNewPasswordScreen | Automated + preview; real email/provider pending |
| 42 / Reset password | `8:6074` | SignInScreen / SetNewPasswordScreen | Automated + preview; real email/provider pending |
| 43 / Reset · email sent | `8:6094` | SignInScreen / SetNewPasswordScreen | Automated + preview; real email/provider pending |
| 44 / Existing account · handoff | `8:7186` | GuestAccountHandoff / adoption | Automated adoption/retry; real account pending |
| 45 / Progress · saving | `8:7210` | GuestAccountHandoff / adoption | Automated adoption/retry; real account pending |
| 46 / Progress · save failed | `8:7259` | GuestAccountHandoff / adoption | Automated adoption/retry; real account pending |
| 47 / Welcome transition | `8:7308` | AccountWelcome / durable receipt | Automated; real full arrival pending |
| 48 / Homepage · first arrival | `8:7329` | HomeTab / MissionHero | Automated; real full arrival pending |
| 49 / First streak | `8:7380` | HomeArrival / StreakCelebrationScreen | Automated; real full arrival pending |
| 50 / Homepage · settled | `8:7411` | HomeTab / MissionHero | Automated; real full arrival pending |
| 51 / Homepage · loading | `8:7462` | HomeTab / MissionHero | Automated; real full arrival pending |
| 52 / Homepage · offline | `8:8571` | HomeTab / MissionHero | Automated; real full arrival pending |
| 53 / Homepage · no earned data | `8:8594` | HomeTab / MissionHero | Automated; real full arrival pending |
| 54 / Resume your plan | `8:8645` | AuthFlow / resume | Automated; persisted resume device check pending; Figma design-context quota blocked |
| 55 / Large text · choice | `8:8695` | BoldChoice / scrolling layout | Layout supports scaling; OS large-text check pending; Figma design-context quota blocked |
| 56 / Compact phone · account | `8:8730` | SignUpScreen / scroll + keyboard owner | 320 × 568 browser verified; native keyboard pending; Figma design-context quota blocked |
| 57 / Reminder · time | `8:8762` | HomeArrival / existing ReminderAsk | Automated existing reminder contract; device permission pending; Figma design-context quota blocked |
| 58 / Reminder · denied | `8:8815` | HomeArrival / existing ReminderAsk | Automated existing reminder contract; device permission pending; Figma design-context quota blocked |
| 59 / Practice ended · no streak | `8:8868` | FirstSessionResult / interrupted outcome | Synthetic incomplete outcome + automated; Figma design-context quota blocked |

## Deliberate adaptations

- The later user requests override C's tutor strip and orb: remove the separate
  Voice preview block, colour the six tutor cards, and use a fluid gradient sphere.
- Artwork loops continuously while active; presses, navigation, progress and
  earned confetti follow their corresponding event without resetting the screen.
- Save-your-progress, verification and reset-sent frames are states of existing
  result/form components, not additional routes. Provider buttons follow official
  branding. No fake keyboard, system bar, transcript or achievement ships.
- Reminder states reuse the existing device permission/time sheet. Home loading,
  offline and empty content retain the app's truthful data/recovery owners.

See [the change plan](bold-rhythm.md) for the release boundary and configuration.
