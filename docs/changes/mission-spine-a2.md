# Mission spine A1 to A2: twelve new scenes

- Status: built, held for founder review
- Updated: 2026-10-22
- Checkout / starting revision: `~/Developer/StartUps/Luvani-worktrees/mission-spine-a2`, branch `claude/mission-spine-a2` from `main` at 495d8d75
- Owner / integrator: Opus orchestrator session (mission spine), started from the beta-launch session
- Existing programme / contract: [beta-launch.md](beta-launch.md) (the closed beta this runway is for)

## Outcome and scope

Today the spine has seven missions and stops at A1: premier-café, café and hotel at A0, then market, directions, your day and meet friends at A1. A beta tester with a month, or an annual subscriber, runs out of path in days. This change adds twelve authored missions for English-speaking adults heading to France, taking the spine from A1 into A2. A learner sees nineteen scenes in Speak, Missions and Journey. The new A2 ones are grouped under the stage word "Everyday".

- Existing seam: `MISSIONS` and `SCENE_SPINE` in `packages/core/src/missions/`, `MISSION_FRAMES` and `MISSION_OPENING_DECKS` in `packages/brain/src/missions/frames.ts`, held together by `agreement.test.ts`. Phrases are drilled through `AUTHORED_PATH` and `DRILL_FIXTURES`. Art is `SCENE_ILLUSTRATION` and `POSTCARD` in `apps/mobile`.
- Context: [PRODUCT.md](../../PRODUCT.md), [docs/PEDAGOGY.md](../PEDAGOGY.md), `packages/brain/src/authenticity/fr.ts` (register table), `packages/brain/src/copy.ts` (English copy rules).
- Non-goals:
  - No change to the ladder, grading, `isEarned` or the session engine.
  - No change to the order or content of the seven existing missions.
  - No new `MissionPlace`, icon or daily scenario.
  - No final postcard art. (F865 later drew it, on `claude/mission-postcards`.)
- Risks:
  - **Deploy order.** The tutor agent must ship before the app, because an agent that does not know a mission id falls back to the ordinary topic question (`services/tutor-agent/src/convo.ts` `validMissionId`).
  - **Drill bank size.** About 96 new fixtures would overflow the 160-exercise device bank, so the cap rises (T4).
  - **Existing installs.** A device that already has a drill bank would never get the new missions' drills, so the store gains a merge for them (T4).
- Decisions (founder, 2026-10-22):
  1. **A2 is added properly.** `Mission.cefr` widens to `CefrLevel`, and `SpineView.level` gains `'A2'` once every A0 and A1 mission is earned. Learner surfaces name A2 "Everyday", the third stage word UI-004 already lists.
  2. **Each new scene gets its own flat place drawing**, authored in `docs/design-assets/ILLUSTRATIONS.md`. Postcards reused existing drawings as placeholders at first; F865 replaced them with a postcard per mission on `claude/mission-postcards`.
  3. **The six existing places are reused**, following the daily-scenario pool: health and transport are `street`, shops are `market`, home and work are `home`. The "one place per mission" test becomes "one drawing per mission", which `scenes.test.ts` already enforces. Postcards are now keyed by mission, so a place no longer has to mean one situation.
- Defects: F44 (its verifying test changes from "seven front doors" to the new count).

### The twelve missions

They are appended after `mission:amis`, A1 first and then A2, each group in order of difficulty. The existing seven keep their order, so onboarding's first three scenes and the welcome path do not move.

| # | id | Title / titleEn | Level | Place | Who (register) | Beats (goalEn) | canDoEn / earnedEn |
|---|---|---|---|---|---|---|---|
| 8 | `mission:restaurant` | Une table pour ce soir / Book a table | A1 | cafe | Hélène, bistro owner at the door at five (courant, vous) | Ask for a table for two tonight · Say what time · Give the name · Confirm and say goodbye | Book a table for tonight / You can book a table |
| 9 | `mission:pharmacie` | À la pharmacie / Get help at a pharmacy | A1 | street | Thomas, pharmacist (courant, vous) | Say what hurts · Say since when · Ask how to take it · Pay and thank | Ask a pharmacist for help / You can get help at a pharmacy |
| 10 | `mission:gare` | Au guichet de la gare / Buy a train ticket | A1 | street | Julien, ticket desk (courant, vous) | Ask for a return ticket · Choose a train · Ask which platform · Pay | Buy a ticket and find your train / You can buy a train ticket |
| 11 | `mission:colis` | Au point relais / Pick up a parcel | A1 | market | Sandrine, tabac-presse counter (courant, vous) | Say you are collecting a parcel · Give the name and code · Show ID · Check it and go | Collect a parcel at the counter / You can pick up a parcel |
| 12 | `mission:voisin` | Sur le palier / Meet your neighbour | A1 | home | Monique, retired neighbour (courant, vous) | Say you just moved in · Say where you are from · Chat about the area · Ask for a tip · Say goodbye | Introduce yourself to a neighbour / You can chat with a neighbour |
| 13 | `mission:week-end` | Alors, ce week-end ? / Tell a colleague about your weekend | A2 | friends | Lucas, colleague at the coffee machine on Monday (familier, tu) | Say what you did · Add a detail · Ask about theirs · React · Back to work | Say what you did at the weekend / You can talk about your weekend |
| 14 | `mission:collegues` | Le premier jour / Introduce yourself at work | A2 | home | Isabelle, team manager (courant, vous then the offer of tu) | Say who you are and your role · Say what you did before · Accept the offer of tu · Ask one practical thing · Thank her | Introduce yourself at work / You can introduce yourself at work |
| 15 | `mission:telephone` | Prendre rendez-vous / Book an appointment by phone | A2 | home | Nathalie, practice secretary (courant leaning soutenu, vous) | Say why you are calling · Take or turn down a slot · Spell your name · Repeat the date and time back | Book an appointment by phone / You can book an appointment by phone |
| 16 | `mission:medecin` | Chez le médecin / See a doctor | A2 | street | Dr Benali (courant, vous) | Say what the trouble is · Say since when · Answer her questions · Ask about the treatment · Thank her | Explain your symptoms to a doctor / You can explain your symptoms to a doctor (the planned "Explain what is wrong" fails the copy rule on "wrong") |
| 17 | `mission:retour` | Rapporter un article / Take something back to a shop | A2 | market | Mehdi, sales assistant (courant, vous) | Explain it does not work · Show the receipt · Ask for an exchange or refund · Insist politely · Leave | Return something that does not work / You can return something to a shop |
| 18 | `mission:appartement` | Visiter un appartement / View a flat to rent | A2 | home | Céline, letting agent (courant, vous) | Ask about the rent · Ask about the flat · Ask when it is free · Ask what the file needs · Say you are interested | Ask the right questions about a flat / You can ask about a flat to rent |
| 19 | `mission:belle-famille` | Dîner chez ses parents / Dinner with your partner's parents | A2 | friends | Françoise and Bernard (courant, vous) | Arrive with a gift · Answer questions about yourself · Compliment the food · Talk about your plans · Thank them and leave | Have dinner with your partner's family / You can have dinner with your partner's family |

How the scenes connect: the station picks up where `chemin` leaves the learner, looking for the gare. The phone call books the appointment the doctor scene then keeps.

**Authoring rules.** These come from the existing frames and the tests that hold them.

Frame shape:
- 2 to 5 kebab-case beats.
- 6 to 8 register-labelled goalPhrases. `frWritten` is non-null only when speech bends the spelling (`Y a…`, `T'as fait quoi`, a dropped ne).
- 4 phraseKeys per mission.
- 2 to 3 referencePhrases. Each must be one of the phraseKeys, have at least four syllables and `frWritten === null`, and carry no name or placeholder.
- openingNarration and openingLine.
- openingSupport: a fullLine that differs from the openingLine, three options, and a hintEn with no French.
- Three cultureNotes.
- A registerGuidance paragraph of roughly 100 to 140 words. It states tu or vous and what the character never does.
- An opening deck of five narrations and three lines, which gives 15 openings.

Learner lines:
- Gender-neutral wherever French allows.
- No phrase key an existing mission already drills.

English copy:
- `winEn` describes and never praises, and no other mission shares its first three or last two words.
- Narration English avoids café, bonjour, merci, voilà and s'il vous plaît, and its first three words are unique.
- No em dashes, and no digits outside quoted French.

## Screens and states

- **Speak, Missions, Notebook, Journey, Then and now:** an A2 group named "Everyday" follows Starter and Basics.
- **Scene preview and first-scene stage word:** an A2 mission reads Everyday, never Basics.
- **Home and Explore:** new missions appear through the existing projections, with their own drawing and topic.
- **Recap:** new missions first showed a placeholder postcard (the nearest existing place's). F865 gave every mission a postcard of its own on `claude/mission-postcards`.
- No new loading, empty, error or offline states. Every surface already handles a mission it has not seen through `getMission`.

## Tasks in dependency order

| ID | Outcome | Owner | Depends on | Allowed files | Status |
|---|---|---|---|---|---|
| T1A | Five A1 missions authored end to end, cefr widened, spine level A2 | implementer-opus-low | none | `packages/core/src/missions/*`, `packages/core/src/path/path.ts`, `packages/core/src/drill/fixtures.ts`, `packages/brain/src/missions/frames.ts`, `apps/mobile/src/main/exploreCatalogue.ts`, their tests | done |
| T1B | Seven A2 missions authored end to end | implementer-opus-low | T1A | same as T1A | done |
| T2 | Twelve new place drawings generated into the registry | design-system-engineer | none | `docs/design-assets/ILLUSTRATIONS.md`, `apps/mobile/src/art/flat/place-*.tsx`, `apps/mobile/src/art/flat/index.ts`, `apps/mobile/src/art/registry.test.ts`, the place-drawing count lines in `apps/mobile/src/surfaceContract.test.ts`, `DESIGN.md` | done |
| T3 | A2 shown as Everyday on every learner surface | frontend-engineer | none (codes against `CefrLevel`) | listed mobile level surfaces and their tests, `DECISIONS.md` UI-007 | done |
| T4 | Drill bank room for the new fixtures, new fixtures reach existing installs | practice-ux-engineer | none | `apps/mobile/src/drill/merge.ts`, `apps/mobile/src/drill/store.ts`, their tests | done |
| T5 | Each new scene draws its own place, placeholder postcards (replaced by F865) | frontend-engineer | T1B, T2 | `apps/mobile/src/art/flat/scenes.ts`, `scenes.test.ts`, `apps/mobile/src/recap/postcardArt.ts` | done |
| T6 | French reviewed and fixes applied | tutor-behaviour-engineer (read-only), then implementer-opus-low | T1B | frames and core catalogue only | done |
| T7 | Copy check, docs, gate, commit, handoff | orchestrator | all | `PRODUCT.md`, `docs/KNOWN_ISSUES.md`, this file, `scripts/gate.floors.json` | done |

Acceptance for every task:

- `npm test -w @luvani/core` passes for core and catalogue changes.
- `npm test -w @luvani/brain` passes for frames. `agreement.test.ts` must show schema parsing, 15 openings, copy rules and an engine walk-through to `missionDone` for every mission.
- `npm test -w @luvani/mobile` and the mobile typecheck pass for app changes.
- `npm run gate` is green, with floors held or raised.

## Execution log

| Date / task | Attempt and changed paths | Check / result | Next action or blocker |
|---|---|---|---|
| 2026-10-22 / T0 | Worktree and branch created, `npm ci`, this proposal written | `npm ci` clean | T1A, T2, T3, T4 in parallel |
| 2026-10-22 / T1A | Five A1 missions in missions.ts, spine.ts, path.ts, fixtures.ts, frames.ts, exploreCatalogue.ts; cefr widened to `CefrLevel`; spine level reaches A2 | core 870/870, brain 488/488, core and brain typecheck clean | T1B |
| 2026-10-22 / T2 | Twelve place drawings in ILLUSTRATIONS.md, generated into `art/flat/`, registry 29 to 41, DESIGN.md "nineteen place drawings" | generator idempotent (0 files on rerun); registry.test passes; headless render checked by the orchestrator | T5 |
| 2026-10-22 / T3 | `MISSION_LEVELS` and `stageOf` in scenePreview.ts carry A2 as Everyday on Missions, Speak, Notebook, Journey, scene preview, first scene; `game/sources.ts` A0-done check fixed for A2 learners; UI-007 note | touched files 161/162, the one failure was the unwired art | T5 |
| 2026-10-22 / T4 | `MAX_DRILL_EXERCISES` 160 to 256 with a headroom guard; `fixturesMissingFrom` gives a stored bank the new missions' drills; sync envelope (512 KB) checked, no change needed | drill tests 31/31 | none |
| 2026-10-22 / T1B | Seven A2 missions in the same files. The medecin can-do became "Explain your symptoms to a doctor" because the copy rule rejects "wrong" | core 927/927, brain 488/488 | T5, T6 |
| 2026-10-22 / T5 | `SCENE_ILLUSTRATION` and placeholder `POSTCARD` entries; scenes.test counts 19; goals tie test narrowed to café and apéro; Speak path test made stricter for A2 | mobile 3460/3460, all-workspace typecheck clean | T6 fixes |
| 2026-10-22 / T6 | tutor-behaviour-engineer read-only review: 3 must-fix, 10 nice-to-have, 11 of 12 author doubts confirmed natural. Applied: Sud not Bretagne, j'emménage, carte Vitale note, receipt note, lift narration, tu-only accepted answer, la docteure, voie not quai, "Tenez, c'est pour vous", neutral opener for Monique, ordinal dropped from voisin references. Kept: "D'accord, on se tutoie", "C'est un train direct ?" | core 927/927, brain 488/488 | T7 |
| 2026-10-22 / T7 | Jev copy check on the twelve missions' English (advisory): tone 3.12 of 4, praise-free 0.95, plain 0.74; no em dashes. PRODUCT.md, F44, F570/F599 test titles, new F864 and F865 | first gate red only on F570/F599 naming the old registry test title; fixed; `npm run gate` green, 6017 tests | commit, handoff |
| 2026-10-22 / F865 | Twelve postcard drawings authored and generated; `POSTCARD` gives each of the nineteen missions its own; `postcardArt.test.ts` added (failed on the placeholder map first) | postcardArt.test passes; registry count 53 in registry.test and surfaceContract.test; mobile 3461/3461, all-workspace typecheck clean | none |

## Integrated verification and handoff

- Focused checks: core 927/927, brain 488/488 (agreement.test over all 19 missions: schema, 15 openings each, copy rules, engine walk-through to `missionDone`), mobile 3460/3460, all-workspace typecheck clean.
- Full gate: `npm run gate` green on 2026-10-22, 6017 tests (core 927, brain 488, tutor-agent 659, token-server 457, playground 26, mobile 3460); floors raised with `npm run gate:bless`.
- UI / device checks: the twelve drawings were rendered headless and checked by eye. No dev-build screenshot of the Everyday group yet.
- Documentation and decisions: PRODUCT.md (nineteen scenes, A0 to A2), DECISIONS.md UI-007 (Everyday), DESIGN.md (nineteen place drawings), KNOWN_ISSUES.md F44, F570, F599, new F864 (goal matching per place) and F865 (placeholder postcards, since fixed).
- Deploy order: ship the tutor agent before the app, or a new mission id opens as the ordinary topic question.
- Landing disposition: HOLD for founder review of the French and the drawings, then /land.
- Next task: founder review of the French and the drawings; then /land. F864 (per-mission goal words, `claude/goal-words-per-mission`) and F865 (postcards, `claude/mission-postcards`) are closed and merged into this branch. A dev-build look at Speak and Missions with an A2 learner is still open.
