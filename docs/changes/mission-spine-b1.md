# Mission spine A2 to B1: twelve new scenes

- Status: built, held for founder review
- Updated: 2026-10-23
- Checkout / starting revision: `~/Developer/StartUps/Luvani-worktrees/mission-spine-b1`, branch `claude/mission-spine-b1` from `main` at 717655fb
- Owner / integrator: Opus orchestrator session (mission spine B1), started from the market-report session
- Existing programme / contract: [mission-spine-a2.md](mission-spine-a2.md) (the template), [beta-launch.md](beta-launch.md)

## Outcome and scope

Main has nineteen missions from A0 to A2. A beta tester with a month, or an annual subscriber, needs months of runway. This change adds twelve: six that fill A2 gaps for the beta cohorts (moving to France or Quebec, a partner's family, work, TCF/TEF-style everyday tasks) and six that open B1. Learners see B1 as "Chatting", the fourth of the five stages Journey already draws.

- Non-goals: no change to the ladder, grading, `isEarned` or the session engine; no change to the order or content of the nineteen existing missions; no new `MissionPlace`, icon or daily scenario; core's lesson-scoped `CefrLevel` is not widened.
- Decisions (founder, 2026-10-22): one Montréal scene (A2 coat shop), every other scene in France; twelve missions, six A2 and six B1.
- Defects: F44 (its verifying test title carries the mission count).

### The twelve missions
(appended after `mission:belle-famille`, A2 first and then B1, each group easiest first)

| # | id | Title / titleEn | Lvl | Place | Who (register) | Beats (goalEn) |
|---|---|---|---|---|---|---|
| 20 | `mission:club` | S'inscrire au club / Sign up for a class | A2 | street | Sophie, the desk at a maison de quartier (courant, vous) | Say what you want to join · Ask about the times · Ask the price · Ask what to bring · Sign up |
| 21 | `mission:banque` | Ouvrir un compte / Open a bank account | A2 | street | Antoine, bank adviser (courant leaning soutenu, vous) | Say you want an account · Say you just moved here · Ask what documents · Ask about the card · Book the next step |
| 22 | `mission:sortie` | On se fait un ciné ? / Make plans with a friend | A2 | friends | Léa, a friend on the phone (familier, tu) | Suggest going out · Turn down a day and offer another · Agree on a time and place · Confirm |
| 23 | `mission:montreal` | Un manteau pour l'hiver / Buy a winter coat in Montréal | A2 | market | Marc-André, a sales assistant in Montréal (courant québécois, vous; light local words such as magasiner, une tuque, c'est correct; no joual) | Say what you are looking for · Ask for your size · Try it on and say how it fits · Ask the price · Decide |
| 24 | `mission:coup-de-main` | Un petit coup de main ? / Ask a colleague for help | A2 | home | Inès, a colleague in the open space (courant, tu) | Ask if she has a minute · Explain what you are trying to do · Ask her to show you · Check you understood · Thank her |
| 25 | `mission:anniversaire` | L'anniversaire de sa sœur / Your partner's sister's birthday | A2 | friends | Chloé, your partner's sister, and a cousin (familier, tu) | Wish her happy birthday · Say how you met your partner · Chat with a cousin · Accept a second helping · Say goodbye |
| 26 | `mission:fuite` | Il y a une fuite / Report a leak to your landlord | B1 | home | Patrick, the landlord, on the phone (courant, vous) | Explain the problem · Say since when and what you tried · Say what it is damaging · Ask when someone can come · Agree on a time |
| 27 | `mission:galere` | Tu vas pas me croire / Tell the story of your weekend | B1 | cafe | Hugo, a friend over a drink (familier, tu) | Set the scene · Say what happened · Say how you reacted · Say how it ended · React to his story |
| 28 | `mission:avis` | Alors, ce film ? / Say what you thought of a film | B1 | cafe | Yasmine, a friend after the cinema (familier, tu) | Give your opinion · Say why · Add a nuance · Agree or disagree politely · Suggest what to see next |
| 29 | `mission:entretien` | L'entretien d'embauche / A short job interview | B1 | home | Claire Lefèvre, recruiter (courant leaning soutenu, vous) | Sum up your background · Say why this job · Give an example of a strength · Ask about the role · Close and thank her |
| 30 | `mission:teletravail` | Demander du télétravail / Ask your manager to work from home | B1 | home | Isabelle, the manager from `collegues`, now on tu (courant, tu) | Ask for a moment · Make the request · Give your reasons · Answer her concern · Agree on a next step |
| 31 | `mission:souvenirs` | Chez la grand-mère / Talk with your partner's grandmother | B1 | friends | Jeannine, your partner's grandmother (she says tu, you say vous) | Say where you grew up · Describe what it was like · Ask about her youth · Compare then and now · Thank her for the stories |

Spine order inside B1 (2026-10-23, after the learning-science review): fuite, avis, galere, teletravail, souvenirs, entretien. The numbers in the table are the authoring order; on the spine, avis is 27, galere 28, teletravail 29, souvenirs 30 and entretien 31.

How the scenes connect: `banque` and `fuite` follow `appartement`; `sortie` plans the film `avis` discusses; `entretien` leads to `teletravail` with the same Isabelle as `collegues`; `anniversaire` and `souvenirs` widen `belle-famille`. The B1 scenes carry the B1 grammar: imparfait with passé composé (galere, souvenirs), opinion and justification (avis), the polite conditional (teletravail, entretien), and explaining a problem (fuite).

Each frame follows the A2 authoring rules exactly:
- 2 to 5 beats with goalEn; 6 to 8 register-labelled goalPhrases (`frWritten` only when speech bends spelling); 4 phraseKeys, none already drilled; 2 to 3 referencePhrases (one of the phraseKeys, at least four syllables, `frWritten` null, no names, numbers or cities).
- openingNarration and openingLine; openingSupport (fullLine differs from openingLine, three options, a hintEn with no French); three cultureNotes; registerGuidance of 100 to 140 words.
- A 5-narration, 3-line opening deck, which gives 15 openings.
- English passes `copyViolations`: no "wrong", no praise in winEn, unique first three and last two words, no em dashes, no digits outside quoted French.
- Learner lines are gender-neutral where French allows.

## Approach and decisions
- **`MissionLevel = CefrLevel | 'B1'`**, exported from `packages/core/src/missions/missions.ts`. `Mission.cefr`, `SpineView.level`, `REACH`/`CEFR_RANK` in `spine.ts` and the mobile level surfaces use it. Core's `CefrLevel` stays lesson-scoped (A0–A2), as `packages/brain/src/types.ts:4` promises, so scripted lessons are untouched.
- `spineFrom` reaches `'B1'` once every A0, A1 and A2 scene is earned. `REACH` becomes A2→B1, B1→B1, so `nextScene` can pick a goal's B1 scene for an A2 learner. Onboarding's `goalReachScenes` (A0/A1 only) is unchanged.
- **Stage word:** `MISSION_LEVELS = ['A0','A1','A2','B1']` and `MISSION_STAGE.B1 = 'Chatting'` in `apps/mobile/src/scenes/scenePreview.ts`, which every surface groups by: Speak, Missions, Notebook, Journey, Then and now, scene preview and first scene. `stageIndexOf('B1')` is 3 on Journey, and `STAGES` is unchanged. A DECISIONS.md note goes beside UI-007's Everyday entry.
- **Goal ordering (`GOAL_SCENES` in `spine.ts`):**
  - moving: appartement, banque, medecin, voisin, colis, pharmacie, telephone, retour, club, montreal, fuite
  - family: belle-famille, anniversaire, amis, journee, week-end, souvenirs, galere
  - work: collegues, telephone, coup-de-main, week-end, journee, entretien, teletravail
  - trip and food are unchanged; 'because' still walks the spine.
- **Free-text goal words (`MISSION_WORDS`, `apps/mobile/src/goals/next.ts`):** one hand-authored list per new mission, with precision over recall. Examples: "bank account", "job interview", "work from home", "landlord", "leak", "montreal", "quebec", "winter coat", "birthday", "grandmother". No bare words that have a second meaning. No mission claims "TCF" or "TEF", because none is an exam scene.
- **Explore topics:** club culture, banque admin, sortie out, montreal shops, coup-de-main work, anniversaire friends, fuite home, galere friends, avis culture, entretien work, teletravail work, souvenirs friends.
- **Art:** 12 `place-*` and 12 `postcard-*` drawings are authored in `docs/design-assets/ILLUSTRATIONS.md` and generated with `node scripts/illustrations.mjs`. The registry goes from 53 to 77. They reuse the six places (founder rule from A2).
- **Drill bank:** 96 new fixtures (two per phraseKey; repeat-this needs a noMicTwin). `MAX_DRILL_EXERCISES` goes from 256 to 384, so the `fixturesMissing.test.ts` headroom guard (fixtures + 48 ≤ cap) stays intact and unweakened. The full bank at the cap is measured against the 512 KB sync envelope, and the measurement is recorded.
- **Deploy order** (unchanged rule): ship the tutor agent before the app (`services/tutor-agent/src/convo.ts` `validMissionId`).
- **Jev:** no product LLM call changes, so no Jev product rules apply. Jev is used only as the advisory dev-time copy check.

## Tasks in dependency order
(worktree `~/Developer/StartUps/Luvani-worktrees/mission-spine-b1`, branch `claude/mission-spine-b1` from main 717655fb)

| ID | Outcome | Owner (model per CLAUDE.md) | Depends | Files |
|---|---|---|---|---|
| T0 | Worktree, `npm ci`, write `docs/changes/mission-spine-b1.md` (table above, rules, risks, task list, log) | orchestrator | none | the change doc |
| T1 | `MissionLevel`, spine B1 level, REACH/CEFR_RANK, tests | implementer-opus-low | T0 | `packages/core/src/missions/{missions,spine,index}.ts`, spine/missions tests |
| T2 | Drawings: 24 drawings generated and registered, counts and DESIGN.md | design-system-engineer | T0 | ILLUSTRATIONS.md, `apps/mobile/src/art/flat/*`, registry.test, surfaceContract count lines, DESIGN.md |
| T3 | Drill cap 384, envelope size measured | practice-ux-engineer | T0 | `apps/mobile/src/drill/merge.ts`, its comment and tests |
| T4 | Chatting stage on every mission level surface | frontend-engineer | T1 | scenePreview, journeyView, notebook, speakView, speakTabView, MissionsScreen, thenNowView, their tests, DECISIONS.md note |
| T5A | Six A2 missions end to end, plus their GOAL_SCENES, MISSION_WORDS and topic entries | implementer-opus-low | T1 | missions.ts, spine.ts, path.ts, fixtures.ts, frames.ts, exploreCatalogue.ts, goals/next.ts, their tests |
| T5B | Six B1 missions, same files | implementer-opus-low | T5A | same as T5A |
| T6 | `SCENE_ILLUSTRATION` and `POSTCARD` for all twelve | frontend-engineer | T2, T5B | `art/flat/scenes.ts`, scenes.test, `recap/postcardArt.ts` |
| T7 | Read-only French review, in parallel: register (including Quebec) by tutor-behaviour-engineer, CEFR level fit (A2 vs B1) by learning-science-engineer; then implementer-opus-low applies the fixes | specialists, then implementer-opus-low | T5B | frames and catalogue only (a phraseKey change goes in missions.ts, path.ts and fixtures.ts together) |
| T8 | Jev copy check, docs, gate, bless, evidence, commit, review page, handoff | orchestrator | all | PRODUCT.md (31 scenes, A0 to B1), DESIGN.md, KNOWN_ISSUES F44 and the F570/F599 titles that carry counts, IMPLEMENTATION_EVIDENCE.md snapshot, gate.floors.json |

T1, T2 and T3 run at once (disjoint files). T4 runs beside T5A. Each subagent brief names the absolute worktree path, the allowed files and the focused tests, and says to fix any doc its change makes wrong. Every brief says to run only that agent's own tests while the others are mid-edit.

Acceptance for every task: the owning workspace's tests pass (`npm test -w @luvani/core|brain|mobile`), `agreement.test.ts` covers all 31 missions, the all-workspace typecheck is clean, and `npm run gate` is green with floors held or raised through `gate:bless`.

## Risks
- **Conflict risk with live branches:** `claude/goal-edit` (goals), `claude/mission-scoring` (missions) and the cut-the-cost session. If one lands first, rebase on main before landing. This branch is not landed here.
- **Quebec register drift:** the review agent checks it explicitly. Fallback: standard French with a Montréal setting and culture notes only.
- **B1 scenes on a beginner engine:** the opening support and ladder still apply. The review checks that each B1 scene's phrases are reachable with help.

## Execution log

| Date / task | Attempt and changed paths | Check / result | Next action or blocker |
|---|---|---|---|
| 2026-10-22 / T0 | Worktree and branch created from main 717655fb, `npm ci`, this proposal written | `npm ci` clean | T1, T2, T3 in parallel |
| 2026-10-22 / T1 | `MissionLevel = CefrLevel \| 'B1'` in missions.ts and exported; `Mission.cefr`, `SpineView.level`, REACH (A2 to B1) and CEFR_RANK on it; `spineFrom` gives B1 once every A0, A1 and A2 scene is earned | core 936/936; mobile typecheck shows five surfaces still typed CefrLevel, which T4 fixes | T4 |
| 2026-10-22 / T3 | `MAX_DRILL_EXERCISES` 256 to 384 in `apps/mobile/src/drill/merge.ts`. 182 fixtures today, about 278 after this change, which leaves about 106 generated slots; headroom guard unchanged. The drill store syncs in its own envelope: 361 bytes per fixture on average, a full 384 bank about 136 KB (27% of 512 KB), 230 KB worst case | drill and sync tests 98/98 | recheck the guard after T5B |
| 2026-10-22 / restart | The app restarted mid-run. T1 and T3 had finished; T2 had written nothing and was re-briefed | none | T2, T4, T5A in parallel |
| 2026-10-23 / T2, T4, T5A | A second restart stopped all three; their partial work was intact and complete. T2: 24 drawings in ILLUSTRATIONS.md, generated and registered, registry 53 to 77, DESIGN.md counts. T4: `MISSION_LEVELS` and `MISSION_STAGE` carry B1 as Chatting; journeyView, notebook, speakView, speakTabView, MissionsScreen, FirstSceneScreen on `MissionLevel`; DECISIONS.md UI-007 note. T5A: six A2 missions in every file, GOAL_SCENES, MISSION_WORDS, topics. The orchestrator wired the six A2 drawings and postcards | core 984/984, brain 498/498, typecheck clean; mobile 3542/3547, with the five failures all art wiring waiting on the B1 scenes; contact sheet of all 24 drawings checked by eye | checkpoint e2144744; T5B |
| 2026-10-23 / T5B | Six B1 missions in every file, `cefr: 'B1'`; GOAL_SCENES (moving ends on fuite, family on souvenirs then galere, work on entretien then teletravail); MISSION_WORDS with next.test cases; art wired; counts 31 in missions, scenes and postcard tests; F44 renamed to thirty-one. "Tea with my grandmother" and "Work from home" moved from the must-stay-starter goals to matched goals | core 1035/1035, brain 498/498 (agreement.test over 31), mobile 3547/3547, typecheck clean, DRILL_FIXTURES 278 (+48 headroom = 326 of 384) | checkpoint 10f1c153; T7 |
| 2026-10-23 / T7 A2 | Read-only reviews of the six A2 missions. tutor-behaviour-engineer: 7 must-fix (banque opener and win line, sortie culture note and setting, montreal tax note, coup-de-main opener), Quebec register confirmed plausible with no joual. learning-science-engineer: no re-levelling; three phraseKey swaps for better retrieval targets (club trial class, sortie availability, anniversaire depuis), honest can-do lines for banque and coup-de-main | read-only | fixes by implementer-opus-low |
| 2026-10-23 / T7 A2 fixes | Applied: club key to "On peut faire un cours d'essai ?", sortie key to "T'es libre samedi soir ?", anniversaire key to "On est ensemble depuis deux ans" (each across missions.ts, path.ts, fixtures.ts and the frame); banque can-do "Ask to open a bank account" and its win line; coup-de-main can-do names checking you followed; montreal tax note ("almost fifteen cents to every dollar", since "percent" trips the score rule) and opener; sortie setting; Explore says "Guided activity." | core 1035/1035, brain 498/498, mobile 3547/3547, typecheck clean | checkpoint c263f6b2 |
| 2026-10-23 / T7 B1 | Read-only reviews of the six B1 missions. learning-science-engineer: none re-levelled; nine listen-type and repeat drills credited answers that skip the target structure (et là, finalement, à mon avis, tout à fait, j'aimerais savoir, the conditional serais); entretien earned line overclaimed; avis key was A2. tutor-behaviour-engineer: tu/vous right everywhere including the souvenirs asymmetry; four must-fix (two missing written forms, the salary and période d'essai culture notes); setting and narration drift in fuite, avis, teletravail, souvenirs | read-only | fixes |
| 2026-10-23 / T7 B1 fixes | Applied all: accepted answers keep the target structure; avis key to "C'était pas mal, par contre c'était un peu long" with a par contre drill; entretien earned line "You can talk about yourself in a short job interview"; culture notes; settings and deck narrations aligned; `line()` takes an optional frWritten. Club back to three reference phrases. Skipped one item with nowhere to go (an accepted variant for a goalPhrase no drill uses) | core 1035/1035, brain 498/498, mobile 3547/3547, typecheck clean, DRILL_FIXTURES 278 | merge main, gate |
| 2026-10-23 / T8 | Main 6326f51b merged in cleanly (7c69fb0c). Jev copy check on the twelve missions' English (advisory): warm and free of scolding or praise 0.81, short and plain 0.57 (A2 batch 0.74; the B1 culture notes run longer); no em dashes. PRODUCT.md (thirty-one scenes, A0 to B1). `npm run gate:bless` raised core 936 to 1036 and mobile 3558 to 3559 | `npm run gate` green, 6,270 tests; recorded in IMPLEMENTATION_EVIDENCE.md | founder review page, handoff |
| 2026-10-23 / B1 order | On branch `claude/b1-spine-order` from main 3acc25b5: the six B1 scenes reordered by difficulty to fuite, avis, galere, teletravail, souvenirs, entretien, in `SCENE_SPINE`, `MISSIONS` and `AUTHORED_PATH` together; spine.test pins it. A pure move: both files hold the same lines as before | core 1036/1036, mobile 3568/3568, typecheck clean; `npm run gate` green at 6,305 with floors unchanged | founder review |

## Integrated verification and handoff

- Focused checks: core 1036, brain 498 (agreement.test over all 31 missions: schema, 15 openings each, copy rules, engine walk-through to `missionDone`), mobile 3559, all-workspace typecheck clean. DRILL_FIXTURES 278, plus 48 headroom = 326 of the 384 cap.
- Full gate: `npm run gate` green on 2026-10-23, 6,270 tests, floors raised with `gate:bless`.
- French: register (tutor-behaviour-engineer) and level (learning-science-engineer) reviews of both batches, all must-fix items applied. No mission was re-levelled.
- Art: the 24 drawings rendered headless and checked by eye. No dev-build screenshot of the Chatting group yet.
- Deploy order: ship the tutor agent before the app, or a new mission id opens as the ordinary topic question.
- Landing disposition: HOLD for founder review of the French and the drawings (review page), then /land.
- Follow-ups noted, not done here: Speak's path card says "Then B1, 6 more scenes" with the CEFR code (it already did for A1 and A2), opening-deck lines and support options have no frWritten field for spoken spellings, listen-type drills accept reworded answers in general (a grading decision), and the spine order inside B1 (done on `claude/b1-spine-order`).
