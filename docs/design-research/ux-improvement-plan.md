# UX improvement plan

## Recommended journey

Startup mark → vivid first French moment → optional personal goal/level/time choices → concise plan → appropriate age/processing consent and microphone primer → meaningful practice → earned recap → optional reminder/account saving → Home. The existing detailed onboarding frames remain the reference for these decisions; the new B welcome sets the visual direction. Keep skip/back routes where already allowed. Never fabricate tutor feedback or show an earned win before real completion.

Home leads with one relevant conversation. Speak selects voice/situation without starting audio automatically. Live tutoring keeps the cloud orb, current state, phrase/translation and three separate Pause/Help/Type controls. Practice prioritises saved phrases, pronunciation and returning conversations. Progress shows actual earned phrases and milestones. Friends stays optional behind Profile; Settings prioritises account, reminders, data and subscription tasks.

## Change register

| ID | Change | Level | Acceptance |
|---|---|---|---|
| UX01 | Full-colour onboarding scene; shorter headline/copy | Evolve | First useful action visible; account login secondary; no repeated logo |
| UX02 | Personal goal, level and time affect the next scene/plan | Evolve | Choices are editable and survive Back/restart; no fake personalisation |
| UX03 | One primary Home action, compact progress evidence | Evolve | Start/continue is visible without scrolling at default phone sizes |
| UX04 | Consistent tutor state and separate live controls | Refine | Listening/speaking/thinking/paused/error agree with real state; leave ends room |
| UX05 | Compact paywall plus Weekly | Reimagine | Three durations, allowance and renewal terms visible; trial only when eligible Yearly |
| UX06 | Actionable recovery without resetting effort | Refine | Draft/selected period survives offline, store cancellation, retry and failed loads |
| UX07 | Colourful milestones, calm settings | Refine | No empty congratulations or invented scores; data controls remain discoverable |
| UX08 | Adaptive shared screen shell | Evolve | Safe areas, keyboard, long strings, large fonts, compact heights and wide layouts pass |
| UX09 | Optional social paths and transparent memory | Refine | No automatic invitations/contact upload; edit/forget/report remain explicit |

## Motion specification

UI transitions: 180–240ms ease-out, interruptible. Selection: immediate state, subtle 120ms emphasis. Celebration: one brief event after verified completion; no endless confetti. Orb: slow cloud drift, modest scale/opacity changes driven by session phase; speech intensity only if based on actual audio. Offscreen/background stops animation. Reduce Motion uses static orb and opacity-only transitions. Never animate price into illegibility or delay a close button.

Existing cloud-orb motion was rendered and sampled in the preceding work (`artifacts/orb-onboarding-2026-10-09/cloud-orb-motion.mp4`). The new static boards reuse that orb component. That earlier render is not proof of every new screen’s animation or of native GPU performance.

## Comprehension review before implementation release

Ask representative learners to identify the primary action, selected plan, charge today, renewal charge/date, allowance reset and cancellation route without guidance. Include someone using large text and someone who cannot speak aloud. Record errors and task completion time. Aesthetic approval alone does not prove comprehension or conversion.
