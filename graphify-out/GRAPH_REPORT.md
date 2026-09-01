# Graph Report - forge-phases-status-c74034  (2026-08-30)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 5082 nodes · 11833 edges · 249 communities (196 shown, 53 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 174 edges (avg confidence: 0.7)
- Token cost: 172,090 input · 3,523 output

## Graph Freshness
- Built from commit: `73a079c0`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Entitlement Store
- Topic Curation
- Session Metering And Plans
- Pronunciation Drill Bank
- Sync Engine Core
- Activity History Store
- Brain CLI Playground
- LLM Usage Pricing
- Expo App Config
- Auth Screens And Labels
- Tutor Agent Dependencies
- Safety Policy Corpus
- Dev Boot Plan
- Agent Loop Runner
- Ladder State Machine
- Auth Adapter And Modes
- Authored Learning Path
- TTS Caching Layer
- Illustration Scenes
- Supabase Live Checks
- Drill Generation Prompts
- Brain Package Manifest
- Token Server Manifest
- Playground Package Manifest
- Tutor Voice Playback
- Dev Launcher Script
- Luvani Conversation Orchestrator
- Drill Grading And Fixtures
- Core Package Manifest
- App Agent Protocol
- TypeScript Base Config
- Thinking And Safety Views
- Tutor Turn Handling
- Friends Store Adapter
- Mobile TypeScript Config
- Dependency Audit Manifest
- First Run Disclosure Copy
- Mobile App Dependencies
- Mobile Package Manifest
- Profile Repair Validation
- Mission Completions Store
- Brain TypeScript Config
- Core TypeScript Config
- Playground TypeScript Config
- Token Server TypeScript Config
- Tutor Agent TypeScript Config
- Convo Screen Session Tests
- Mobile NPM Scripts
- Native LiveKit Audio Globals
- Session Journal Recovery
- Environment Preflight
- Drill Exercise Store
- Learner Profile Updates
- Practice Record Gate
- Voice Lifecycle Checks
- Expo Metro Runtime
- Live Session Hook
- Evidence Mastery States
- Age And Profile Upgrade
- Expo Web Browser
- HTTP Security And Deletion
- Secret Scanner
- Review Card View
- Graphify Guard Hook
- Profile And Friends UI
- Async Storage Dependency
- Brain LLM Schemas
- Upstash Live Checks
- Conversation Screen
- Learner Profile Store
- Gate Runner
- Friendly Error Copy
- Known Issues Ledger
- Agent Fleet Frontmatter Checks
- Evidence Contract Gate
- Live Session Context
- Daily Reminder Copy
- Rate Limiting And Leases
- LiveKit React Native WebRTC
- Age Gate Answers
- Speechace Pronunciation Scoring
- React Native Screens
- Database Contract Checks
- Retention Policy Limits
- Supabase JS Client
- UI Theme Primitives
- Lesson Definitions
- Sound Check Store
- Pedagogy Doc
- Live Session Hook Tests
- Live Voice Doc
- Loop And Agents Doc
- Project Documentation
- Testing Doc
- Bug Hunter Agent
- Architecture Doc
- Docs Index
- Conversation Brain Client
- Fix Verification Agent
- Root Navigation
- My French Tab Tests
- Path Row Status Line
- Sync Policy And Live
- French Authenticity Pack
- Deploy Engineer Agent
- Observability Engineer Agent
- Revenue Engineer Agent
- Drill Merge And Scene Controls
- Notification Schedule Scan
- Copy Guilt Ban Checks
- Sample Fixtures And Copy
- Forge Command Doc
- Colour Palette Tokens
- Mobile Copy Tests
- Secure Session Storage
- Drill Screen Tests
- Profile Merge
- API Engineer Agent
- Performance Engineer Agent
- Security Engineer Agent
- Auth Engineer Agent
- Backend Engineer Agent
- Data Engineer Agent
- Frontend Engineer Agent
- Team Roster Doc
- Design Architect Agent
- Scaling Engineer Agent
- Tab Bar Icons
- Release Engineer Agent
- Work Judge Agent
- Review Deck Store
- Pre-commit Hook
- Pre-push Hook
- Git Hook Installer
- Sync Engine Tests
- LiveKit Session Token Grants
- Drill Screen Views
- Device Verification Checklist
- Sync Diagnostics
- Store Binding Tests
- Turn Timing Instrumentation
- Motion And Voice Orb
- Server User Resolver Auth
- Dependency Lockfile CI Contract
- Progress Export And History
- XP And Levels
- Land Command Doc
- Privacy And Safety Docs
- Brain Test Doubles
- Motion Source Tests
- Ledger Entry Rule Test
- Implementation Evidence Doc
- Retired Label Checks
- Learner Story Test Fixtures
- Keyboard Typing Tests
- Activity Sync Policy
- Token Hygiene Checks
- Fresh Device Adoption
- App Root Auth Bootstrap
- Prompt And Turn Queue
- Tutor Brain Doc
- Review Deck Merge
- Join Metadata Test
- Expo Plugins And File Save
- LiveKit Client
- Profile Merge Logic
- Phrasebook Screen
- Onboarding And Tracking
- Supabase Runbook
- Retry Backoff Policy
- Mock Speech Session
- Postgrest Table Client
- Server Config Validation
- Product Orchestrator Agent
- Current State Map
- Risk Register
- Repository Archaeologist Agent
- Data Sync Engineer Spec
- Learning Science Engineer Spec
- Privacy Safety Engineer Spec
- QA Release Engineer Spec
- Tutor Behaviour Engineer Spec
- Voice Platform Engineer Spec
- Server Security Contract Tests
- Recorder Test Helper
- Safety Wiring Tests
- Expo Linking
- Expo Secure Store
- TTS Voice Cache Config
- Core Package Dependency
- React DOM
- React Native Web
- Native Stack Navigator
- Design System Engineer Spec
- Onboarding UX Engineer Spec
- Practice UX Engineer Spec
- Progress Retention Engineer Spec
- Social Systems Engineer Spec
- Learner Story Builder
- Safety Category Taxonomy
- Profile Tab Reminder Tests
- Native Reminder Scheduling
- Typed Door Failure Tests
- Source Text Scan Test
- Phrasebook Mix Offer
- Attempt Audio Cleanup
- Delivery Roadmap Doc
- Failure Classification Copy
- Today Activity Rollup
- Reminder Scheduling Shim
- Topic Scheduling And Merge
- Product Event Analytics
- Zod Contract Schemas
- Turns And Mode Caps
- Auth Adapter Interface
- Disk Fault Test Harness
- Expo Crypto
- LiveKit Expo Plugin
- Reminder Store
- Recap Wait Surface
- Expo Font
- Turn Handling Tuning
- Expo Status Bar
- Delivery Roadmap Checks
- Brain Package Dependency
- Session Start Ownership
- Safety Category Rules
- React Native SVG
- Bottom Tabs Navigator
- Typing Ping Indicator
- Persist Acknowledgement
- Set New Password Screen Test
- Storage Doc Test
- Token Server URL Selection
- React Navigation Core
- Expo Speech
- Reminder Store Tests
- Output Safety Guard
- Fake Room Test Double
- Paper And Ink Design World
- Cache Utility
- Expo SDK

## God Nodes (most connected - your core abstractions)
1. `Format` - 298 edges
2. `space()` - 88 edges
3. `LuvaniConversation` - 63 edges
4. `LlmUsage` - 54 edges
5. `paper` - 52 edges
6. `ConvoScreen()` - 42 edges
7. `react` - 40 edges
8. `type` - 39 edges
9. `Rung` - 38 edges
10. `DrillExercise` - 32 edges

## Surprising Connections (you probably didn't know these)
- `A real spoken exchange inside one five-minute session` --rationale_for--> `createSession()`  [INFERRED]
  PRODUCT.md → packages/core/src/session/session.ts
- `Drill mode and the recognition-to-production ramp` --conceptually_related_to--> `bestDrillFor()`  [INFERRED]
  README.md → packages/core/src/phonemes/drills.ts
- `Words-right and sounds-right are separate questions` --rationale_for--> `TurnFeedback`  [INFERRED]
  PRODUCT.md → packages/core/src/session/session.ts
- `The conversation upgrade` --rationale_for--> `ConvoView`  [INFERRED]
  README.md → packages/core/src/protocol/protocol.ts
- `460pt centred web column` --rationale_for--> `App()`  [INFERRED]
  DESIGN.md → apps/mobile/App.tsx

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **The four-rung scaffolding system, from principle to pixel** — product_scaffolding_ladder, product_never_stranded_never_scolded, design_support_colours_cool, packages_core_src_ladder_ladder_applyturn, apps_mobile_src_theme_rungcolor, readme_agent_authoritative [INFERRED 0.85]
- **The trustworthy-pronunciation chain** — product_trustworthy_pronunciation, product_french_only_depth, product_say_one_thing, readme_missing_score_no_penalty, packages_core_src_phonemes_inventory_french_phonemes, packages_core_src_phonemes_drills_drills, packages_core_src_phonemes_scoring_buildreport, services_shared_speechace_scoreutterance [INFERRED 0.85]
- **Unit economics and metering enforcement** — product_metered_minutes, product_cascaded_voice_pipeline, readme_metering_at_token_issuance, readme_tts_warm_cache, readme_risk_cost_per_session, packages_core_src_metering_meter_plans, packages_core_src_metering_meter_estimatesessioncost [INFERRED 0.85]

## Communities (249 total, 53 thin omitted)

### Community 0 - "Entitlement Store"
Cohesion: 0.11
Nodes (9): Entitlement, Plan, DevelopmentEntitlementStore, entitlementFrom(), EntitlementStore, FileEntitlementStore, InMemoryEntitlementStore, SupabaseEntitlementRow (+1 more)

### Community 1 - "Topic Curation"
Cohesion: 0.06
Nodes (44): NewPhrase, applyCuration(), buildCurationRequest(), CuratedTopic, CurationInput, extensionViolations(), INSTRUCTION, keyOf() (+36 more)

### Community 2 - "Session Metering And Plans"
Cohesion: 0.17
Nodes (23): canStartSession(), DEFAULT_COST_MODEL, estimateSessionCost(), Margin, MIN_VIABLE_SESSION_SEC, planMargin(), PLANS, PlanSpec (+15 more)

### Community 3 - "Pronunciation Drill Bank"
Cohesion: 0.14
Nodes (33): bestDrillFor(), BY_ID, Drill, DrillKind, DRILLS, drillsFor(), DrillWord, getDrill() (+25 more)

### Community 4 - "Sync Engine Core"
Cohesion: 0.06
Nodes (59): startSync(), clearIfRunning(), event(), flushDirty(), headers(), outcome(), pull(), queue() (+51 more)

### Community 5 - "Activity History Store"
Cohesion: 0.21
Nodes (16): ActivityKind, adoptActivity(), backfillFrom(), chain, empty(), isEntry(), isStored(), KEY() (+8 more)

### Community 6 - "Brain CLI Playground"
Cohesion: 0.12
Nodes (37): applyNonSpokenInput(), supportViewForAssistance(), defaultModel(), createProfile(), LearnerProfile, main(), pickClient(), Command (+29 more)

### Community 7 - "LLM Usage Pricing"
Cohesion: 0.07
Nodes (39): CoachKind, LearnerTurnInput, carriesFrench(), ParseCapableSdk, addLlmUsage(), billedNothing(), mergedModel(), ZERO_USAGE (+31 more)

### Community 8 - "Expo App Config"
Cohesion: 0.06
Nodes (30): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, package, permissions, predictiveBackGestureEnabled (+22 more)

### Community 9 - "Auth Screens And Labels"
Cohesion: 0.12
Nodes (26): AuthScreen, AuthAction, authButtonLabel(), LABELS, ACTIONS, openingTag(), SCREENS, SRC_DIR (+18 more)

### Community 10 - "Tutor Agent Dependencies"
Cohesion: 0.05
Nodes (37): @livekit/agents, @livekit/agents-plugin-anthropic, @livekit/agents-plugin-deepgram, @livekit/agents-plugin-elevenlabs, @livekit/agents-plugin-openai, @livekit/agents-plugin-silero, dependencies, dotenv (+29 more)

### Community 11 - "Safety Policy Corpus"
Cohesion: 0.05
Nodes (30): recordSafetyDecision(), SafetyRecord, ANSWERS_PATH, APP, callCount(), codeOnly(), CONDUCT_PATH, CONVO_PATH (+22 more)

### Community 12 - "Dev Boot Plan"
Cohesion: 0.12
Nodes (18): AgentSecret, APP_PORT, bootPlan(), BootStep, brainOf(), Env, EnvGap, envGaps() (+10 more)

### Community 13 - "Agent Loop Runner"
Cohesion: 0.07
Nodes (18): ALLOWED_TOOLS, argv, BRANCH, branchNow, current, deadEnds, DRY_RUN, final (+10 more)

### Community 14 - "Ladder State Machine"
Cohesion: 0.10
Nodes (37): Read the exact versioned Expo docs before writing code, No number and no scolding mid-session, contextInput(), applyTurn(), clamp(), directiveFor(), initialState(), INSTRUCTION_BY_RUNG (+29 more)

### Community 15 - "Auth Adapter And Modes"
Cohesion: 0.16
Nodes (14): auth, build(), AuthMode, AuthModeEnvironment, selectAuthMode(), createMockAdapter(), notify(), setSession() (+6 more)

### Community 16 - "Authored Learning Path"
Cohesion: 0.22
Nodes (14): AUTHORED_PATH, AuthoredNode, authoredPhraseKeys(), AuthoredUnit, buildPath(), discussedInWords(), drillableKeys(), GENERATED_PREFIX (+6 more)

### Community 17 - "TTS Caching Layer"
Cohesion: 0.06
Nodes (21): CachedChunkedStream, CachedTTS, defaultMissTransport(), normaliseLine(), ResolvedCachedTTSOptions, FakeChunkedStream, FakeSynthesizeStream, FakeTTS (+13 more)

### Community 18 - "Illustration Scenes"
Cohesion: 0.14
Nodes (38): Frame(), Moving(), Scene(), SceneProps, Stipple(), SpeakBubbles(), HeroCafe(), NobodyYet() (+30 more)

### Community 19 - "Supabase Live Checks"
Cohesion: 0.08
Nodes (32): anonKeyOf(), blockedReport(), CheckOutcome, CheckResult, codeOf(), Environment, expect(), Learner (+24 more)

### Community 20 - "Drill Generation Prompts"
Cohesion: 0.09
Nodes (22): AppropriateReplyZ, BASE, BestSentenceZ, buildDrillGenerationRequest(), DrillGenerationInput, FillBlankZ, GeneratedExerciseZ, INSTRUCTION (+14 more)

### Community 21 - "Brain Package Manifest"
Cohesion: 0.07
Nodes (26): @anthropic-ai/sdk, dependencies, @anthropic-ai/sdk, @luvani/core, zod, description, devDependencies, @types/node (+18 more)

### Community 22 - "Token Server Manifest"
Cohesion: 0.08
Nodes (24): jose, livekit-server-sdk, dependencies, dotenv, jose, livekit-server-sdk, @luvani/core, devDependencies (+16 more)

### Community 23 - "Playground Package Manifest"
Cohesion: 0.08
Nodes (25): dependencies, dotenv, @luvani/brain, @luvani/core, description, devDependencies, @types/node, typescript (+17 more)

### Community 24 - "Tutor Voice Playback"
Cohesion: 0.43
Nodes (6): available(), frenchVoice(), loadVoices(), speak(), speakLines(), withTimeout()

### Community 25 - "Dev Launcher Script"
Cohesion: 0.20
Nodes (18): AGENT_ENV_FILE, children, COLOURS, die(), hasClaudeCli(), launch(), main(), probe() (+10 more)

### Community 26 - "Luvani Conversation Orchestrator"
Cohesion: 0.11
Nodes (8): LuvaniConversation, postSessionDeadlineMs(), strictnessOf(), sttLanguageFor(), inMissionScene(), stubSwitchableSession(), withDeadline(), sessionAlreadyReported()

### Community 27 - "Drill Grading And Fixtures"
Cohesion: 0.06
Nodes (73): check(), checkDrill(), DRILL_FIXTURES, acceptedFor(), DrillVerdict, gradeAnswer(), gradeFreeText(), GradeResult (+65 more)

### Community 28 - "Core Package Manifest"
Cohesion: 0.10
Nodes (19): devDependencies, @types/node, typescript, exports, ./ladder, ./lessons, ./metering, ./phonemes (+11 more)

### Community 29 - "App Agent Protocol"
Cohesion: 0.07
Nodes (36): asTheAgentReadsIt(), asTheAppReadsIt(), CLIENT_TAGS, ClientMessage, ConvoCoachItem, ConvoSpeakerLine, ConvoView, decodeAs() (+28 more)

### Community 30 - "TypeScript Base Config"
Cohesion: 0.10
Nodes (19): DOM, ES2023, compilerOptions, allowImportingTsExtensions, esModuleInterop, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, isolatedModules (+11 more)

### Community 31 - "Thinking And Safety Views"
Cohesion: 0.11
Nodes (18): thinkingAfter(), Seen, switchWorld(), CLOSE_HINT, CLOSE_LABEL, DISMISS_HINT, DISMISS_LABEL, SafetyDecision (+10 more)

### Community 32 - "Tutor Turn Handling"
Cohesion: 0.19
Nodes (3): currentPrompt(), LuvaniTutor, rescueOnce()

### Community 33 - "Friends Store Adapter"
Cohesion: 0.08
Nodes (40): build(), caches, createLocalAdapter(), defaultStore(), FriendsStore, isStore(), KEY(), listeners (+32 more)

### Community 34 - "Mobile TypeScript Config"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, noEmit, noUncheckedIndexedAccess, strict, types, exclude, extends (+8 more)

### Community 35 - "Dependency Audit Manifest"
Cohesion: 0.05
Nodes (38): advisories, auditFailsAbove, note, reviewed, description, engines, node, name (+30 more)

### Community 36 - "First Run Disclosure Copy"
Cohesion: 0.08
Nodes (29): FIRST_RUN_COPY, FIRST_RUN_SURFACES, FirstRunSurface, MEET_AI, MEET_MIC, MEET_MORE, MEET_PILL, MEET_PRIVACY (+21 more)

### Community 37 - "Mobile App Dependencies"
Cohesion: 0.12
Nodes (17): dependencies, expo-audio, expo-file-system, expo-notifications, expo-sharing, @livekit/react-native, react, react-native (+9 more)

### Community 38 - "Mobile Package Manifest"
Cohesion: 0.17
Nodes (11): devDependencies, @types/node, @types/react, typescript, @types/node, typescript, main, name (+3 more)

### Community 39 - "Profile Repair Validation"
Cohesion: 0.70
Nodes (5): isRecord(), repairProfile(), sayableText(), validOpener(), validRememberedFacts()

### Community 40 - "Mission Completions Store"
Cohesion: 0.09
Nodes (44): source, adoptMissionCompletions(), COMPLETIONS_PER_MISSION, isCompletion(), KEY(), MissionCompletion, persistedCompletions(), readCompletions() (+36 more)

### Community 41 - "Brain TypeScript Config"
Cohesion: 0.25
Nodes (7): compilerOptions, types, extends, include, node, src/**/*.ts, ../../tsconfig.base.json

### Community 42 - "Core TypeScript Config"
Cohesion: 0.25
Nodes (7): compilerOptions, types, extends, include, node, src/**/*.ts, ../../tsconfig.base.json

### Community 43 - "Playground TypeScript Config"
Cohesion: 0.25
Nodes (7): compilerOptions, types, extends, include, node, src/**/*.ts, ../../tsconfig.base.json

### Community 44 - "Token Server TypeScript Config"
Cohesion: 0.25
Nodes (7): compilerOptions, types, extends, include, node, src/**/*.ts, ../../tsconfig.base.json

### Community 45 - "Tutor Agent TypeScript Config"
Cohesion: 0.25
Nodes (7): compilerOptions, types, extends, include, node, src/**/*.ts, ../../tsconfig.base.json

### Community 46 - "Convo Screen Session Tests"
Cohesion: 0.16
Nodes (11): DiskFaults, drill(), earlyExitBatch(), journalledSession(), NOW, ordinaryBatch(), phrase(), PRACTICE (+3 more)

### Community 47 - "Mobile NPM Scripts"
Cohesion: 0.25
Nodes (8): scripts, android, export:web, ios, start, test, typecheck, web

### Community 49 - "Session Journal Recovery"
Cohesion: 0.10
Nodes (46): acknowledged(), bankLesson(), bankPractice(), clearAt(), clearJournal(), journalDrills(), journalPractice(), journalRecap() (+38 more)

### Community 50 - "Environment Preflight"
Cohesion: 0.14
Nodes (20): tutorLLM(), frameDeadlineMs(), turnDeadlineMs(), Brain, BRAIN_KEY, Env, FetchLike, missingRequired() (+12 more)

### Community 51 - "Drill Exercise Store"
Cohesion: 0.17
Nodes (22): mergeExerciseBank(), adoptDrillBank(), caches, defaultStore(), DrillStore, getMicSuppressedUntil(), hasGeneratedExercises(), isExercise() (+14 more)

### Community 52 - "Learner Profile Updates"
Cohesion: 0.08
Nodes (41): SessionRecap, coachedForms(), LearnerSnapshot, normalizeErrorTag(), applyExtractionToProfile(), applyTurnToProfile(), bandIndex(), coachedThisTurn() (+33 more)

### Community 53 - "Practice Record Gate"
Cohesion: 0.09
Nodes (20): Entry, EVIDENCE, EXTERNAL, FILES, flat(), LEDGER, NEVER_TRUE, outstandingBlockers() (+12 more)

### Community 54 - "Voice Lifecycle Checks"
Cohesion: 0.07
Nodes (63): CostModel, Check, checkAgentSecret(), checkConcurrentStart(), checkDepartureClosesRoom(), checkExactlyOnceDebit(), checkHardStop(), checkInsecureUrlRefused() (+55 more)

### Community 56 - "Live Session Hook"
Cohesion: 0.20
Nodes (15): authHeaders(), ensureAudioSession(), ensureLiveKitGlobals(), releaseAudioSession(), afterDismiss(), OPENING_TAGS, opensSession(), tagsFor() (+7 more)

### Community 57 - "Evidence Mastery States"
Cohesion: 0.12
Nodes (37): holdFor(), addEvidence(), CardPresentation, count(), EVIDENCE_STATES, evidenceOf(), EvidenceState, evidenceStateOf() (+29 more)

### Community 58 - "Age And Profile Upgrade"
Cohesion: 0.21
Nodes (11): ageConfirmedFromDob(), ageOn(), AgeStopCandidate, MIN_AGE, TODAY, storedGoal(), storedStop(), NOW (+3 more)

### Community 60 - "HTTP Security And Deletion"
Cohesion: 0.10
Nodes (30): adminHeaders(), deleteSupabaseUser(), signedInRecently(), agentDebitAllowed(), applyHttpSecurity(), createOriginPolicy(), DEVELOPMENT_ORIGINS, originAllowed() (+22 more)

### Community 61 - "Secret Scanner"
Cohesion: 0.11
Nodes (33): ALLOW_MARKER, BINARY_EXTENSIONS, BUNDLE_DIRECTORIES, bundleFiles(), Finding, formatFinding(), git(), isCamelCaseName() (+25 more)

### Community 62 - "Review Card View"
Cohesion: 0.11
Nodes (21): AttemptKind, CARD_START, CardAnswer, cardView, faces(), frenchSide(), hearable(), INTRODUCTION_TAG (+13 more)

### Community 63 - "Graphify Guard Hook"
Cohesion: 0.29
Nodes (4): GRAPH, ROOT, ROUTING, SOURCE_EXTS

### Community 64 - "Profile And Friends UI"
Cohesion: 0.14
Nodes (21): Ctx, useProfile(), friends, AddFriendsScreen(), Hit, RowStatus, sheet, st (+13 more)

### Community 66 - "Brain LLM Schemas"
Cohesion: 0.04
Nodes (85): MemoryExtractionSchema, ScenarioFrameSchema, TurnSchema, MemoryExtraction, ScenarioFrame, TutorTurn, Curation, CurationSchema (+77 more)

### Community 67 - "Upstash Live Checks"
Cohesion: 0.15
Nodes (24): RATE_LIMITS, blockedReport(), CheckResult, CheckStatus, expect(), freePort(), Instance, isHashedSegment() (+16 more)

### Community 68 - "Conversation Screen"
Cohesion: 0.06
Nodes (54): ConvoScreen(), practiceBatch(), st, CONNECTING_STAGES, CONNECTING_TICK_MS, ConnectingStage, connectingTick(), connectingView (+46 more)

### Community 69 - "Learner Profile Store"
Cohesion: 0.09
Nodes (34): ProfileGate(), ProfileValue, learner(), adoptProfile(), completeProfile(), confirmedFrom(), createStoredProfile(), KEY() (+26 more)

### Community 70 - "Gate Runner"
Cohesion: 0.08
Nodes (18): AGENT_MODELS, agentFiles, args, asJson, auditOnly, bless, counts, entries (+10 more)

### Community 71 - "Friendly Error Copy"
Cohesion: 0.13
Nodes (14): deletionFailure(), friendly(), GENERIC_FAILURE, GOOGLE_START_FAILED, passwordProse(), ProviderFailure, REPO_ROOT, weakPassword() (+6 more)

### Community 72 - "Known Issues Ledger"
Cohesion: 0.01
Nodes (298): A1 — A spoken answer has to match the script exactly, A2 — An empty transcript is graded as a wrong answer, A3 — A freeze at the top rung still asks the learner to invent French, A4 — A rescue can skip the beat the learner froze on, A5 — Two different opening-rung formulas, A6 — A focus point vanishes when the worst sound has no drill, A7 — A v2 snapshot with no memory crashes the worker, B0 — LuvaniTutor cannot be tested at all (+290 more)

### Community 73 - "Agent Fleet Frontmatter Checks"
Cohesion: 0.20
Nodes (11): AgentFrontmatter, agentProblems(), FRONTMATTER_FIELDS, frontmatterBlock(), parseAgentFrontmatter(), pinnedAgents(), READ_ONLY_AGENTS, routedAgents() (+3 more)

### Community 74 - "Evidence Contract Gate"
Cohesion: 0.06
Nodes (34): classify(), evidence, EVIDENCE_PATH, evidenceFlat, FLOORS_PATH, GateRun, ledger, LEDGER_PATH (+26 more)

### Community 75 - "Live Session Context"
Cohesion: 0.05
Nodes (81): Ctx, LiveValue, useLive(), TodayRow(), CHOOSER_HEADLINE, CHOOSER_SUB, ChooserCard, ChooserInput (+73 more)

### Community 76 - "Daily Reminder Copy"
Cohesion: 0.13
Nodes (16): EARLY_EVENING, REMINDER_BODY, REMINDER_COPY, REMINDER_EXPLAIN, REMINDER_OFF, REMINDER_TIME_SUB, REMINDER_TIME_TITLE, REMINDER_TIMES (+8 more)

### Community 77 - "Rate Limiting And Leases"
Cohesion: 0.07
Nodes (19): CONSUME_SCRIPT, Counter, createRateLimiter(), createSessionLeaseStore(), FetchLike, MemoryRateLimiter, MemorySessionLeaseStore, RateLimitDecision (+11 more)

### Community 79 - "Age Gate Answers"
Cohesion: 0.09
Nodes (28): REPORTED_BY_PAGE, UNION, AGE_QUESTION, AGE_REFUSAL, AGE_RETURN_SUB, AGE_RETURN_TITLE, AGE_SUB, answersFrom() (+20 more)

### Community 80 - "Speechace Pronunciation Scoring"
Cohesion: 0.18
Nodes (9): A missing score is never an invented penalty, ALIASES, FRENCH_IPA, toInventoryIpa(), parseSpeechace(), ScoreFetch, ScoreRequest, scoreUtterance() (+1 more)

### Community 82 - "Database Contract Checks"
Cohesion: 0.08
Nodes (30): and3(), branchTaken(), claimOutcome(), CreatedObject, createdObjects(), debitFixMigration, effectiveBody(), effectiveClaimTrialBody() (+22 more)

### Community 83 - "Retention Policy Limits"
Cohesion: 0.07
Nodes (15): ACTIVITY_KEEP_DAYS, MAX_COMPLETIONS_PER_MISSION, MAX_HISTORY_SESSIONS, MAX_SOUND_CHECKS, SYNC_EXCLUSIONS, adoptedNamespaces(), BASE, blobFor() (+7 more)

### Community 85 - "UI Theme Primitives"
Cohesion: 0.07
Nodes (74): ArrowRight(), Card(), EarGlyph(), GhostButton(), HelpGlyph(), Label(), LineBullet(), MicGlyph() (+66 more)

### Community 86 - "Lesson Definitions"
Cohesion: 0.14
Nodes (24): Chrome is plain English, French only where it is content, CAFE_LESSON, BY_ID, getLesson(), LESSONS, AcceptanceMatch, AcceptanceRoute, candidatesFor() (+16 more)

### Community 87 - "Sound Check Store"
Cohesion: 0.29
Nodes (13): adoptSoundChecks(), isEvidence(), isKind(), KEY(), loadSoundChecks(), persisted(), read(), recordSoundCheck() (+5 more)

### Community 88 - "Pedagogy Doc"
Cohesion: 0.20
Nodes (9): One focus, one drill, The four rungs, The invariants, The pedagogy, The rescue, Two independent axes, What counts as a right answer, What counts as learned (+1 more)

### Community 89 - "Live Session Hook Tests"
Cohesion: 0.06
Nodes (33): ABANDON, asJs(), AsyncFunction, AUDIO_BLOCKS, deliver(), DISMISS, EVERY_FAILURE, fragment() (+25 more)

### Community 90 - "Live Voice Doc"
Cohesion: 0.25
Nodes (7): Audio, and what may be claimed about it, Serialisation, The four modes, The live path, The route, The wire, When it fails

### Community 91 - "Loop And Agents Doc"
Cohesion: 0.29
Nodes (7): Giving it a goal, Running it, The agents, The bar, The loop, The other half: building something new, Verifying UI work

### Community 92 - "Project Documentation"
Cohesion: 0.08
Nodes (20): Known issues — the goal file, Onboarding — everything before the first French word, The files, The shape now, What changed, and why each one, What is measured here, and what is not, What it looked like before, Who never sees any of this (+12 more)

### Community 93 - "Testing Doc"
Cohesion: 0.29
Nodes (6): Never, Running, Testing, The rule that matters most, What is not covered, Writing

### Community 94 - "Bug Hunter Agent"
Cohesion: 0.33
Nodes (5): House style, How you work, Product invariants — a change that breaks one of these is a bug, however green, What counts as a finding, What you must never do

### Community 95 - "Architecture Doc"
Cohesion: 0.40
Nodes (5): Architecture, Mock or live, No build step, Two paths, one ladder, Who owns what

### Community 97 - "Conversation Brain Client"
Cohesion: 0.04
Nodes (52): missionFrame(), ActivitySpend, asSentence(), BRAIN_ACTIVITIES, BrainActivity, brainClient(), cacheHitRate(), chargedInput() (+44 more)

### Community 100 - "Root Navigation"
Cohesion: 0.13
Nodes (14): asRung(), DrillRoute(), LazyConvoScreen, LazyLiveSessionScreen, LessonRoute(), SoundCheckRoute(), st, Stack (+6 more)

### Community 101 - "My French Tab Tests"
Cohesion: 0.17
Nodes (11): between(), FLAT, literals(), markTag(), SCREEN, SITUATIONS, spoken(), SRC (+3 more)

### Community 102 - "Path Row Status Line"
Cohesion: 0.14
Nodes (16): PathNodeRow(), st, MOMENT_ANSWER_MS, momentAnswer(), statusLine(), offersTalkAgain(), seedTopicFor(), TALK_AGAIN (+8 more)

### Community 103 - "Sync Policy And Live"
Cohesion: 0.07
Nodes (32): SyncEngine, createSyncPolicy(), dirtySettled(), resetSyncRegistry(), anonKeyOf(), blockedReport(), CheckOutcome, CheckResult (+24 more)

### Community 104 - "French Authenticity Pack"
Cohesion: 0.14
Nodes (19): FR_PACK, renderAuthenticityPack(), AuthenticityPack, ContrastPair, Filler, RegisterDef, SlangEntry, ClaudeCliRun (+11 more)

### Community 105 - "Deploy Engineer Agent"
Cohesion: 0.22
Nodes (8): How you work, Product invariants — a change that breaks one of these is wrong, however green, Ship the smallest real thing, Start by being honest about where this is, The order this has to happen in, What you must never do, When there is nothing to deploy to, say so, Your territory

### Community 106 - "Observability Engineer Agent"
Cohesion: 0.22
Nodes (8): How you work, Product invariants — a change that breaks one of these is wrong, however green, The line you do not cross, The seam to cut, when the time comes, What exists, and what does not, What you must never do, When there is no seam yet, say so, Your territory

### Community 107 - "Revenue Engineer Agent"
Cohesion: 0.20
Nodes (9): Copy about money is still learner copy, Handoff contract, How you work, Product invariants — a change that breaks one of these is wrong, however green, The rule enforcement lives at, What already exists, What you must never do, Where a purchase lands (+1 more)

### Community 108 - "Drill Merge And Scene Controls"
Cohesion: 0.16
Nodes (10): MAX_DRILL_EXERCISES, hasSayableSupportLine(), ReplayLine, sceneControls, controls(), fullLine, hint, none (+2 more)

### Community 109 - "Notification Schedule Scan"
Cohesion: 0.17
Nodes (17): badgeRequestsIn(), channelLiteral(), exportedNames(), HERE, importsIn(), NATIVE, notificationImporters(), objectLiteralAt() (+9 more)

### Community 110 - "Copy Guilt Ban Checks"
Cohesion: 0.15
Nodes (11): BANNED_IN_COPY, guiltIn(), normalise(), ONCE_BANNED, APP_JSON, AppConfig, bracedAfter(), config (+3 more)

### Community 111 - "Sample Fixtures And Copy"
Cohesion: 0.03
Nodes (108): sampleCoachItem(), sampleSupport(), sampleTurn(), Assessment, CoachItem, SpeakerLine, SupportMaterial, SupportView (+100 more)

### Community 112 - "Forge Command Doc"
Cohesion: 0.22
Nodes (9): /forge, Looping it, Not wired yet: the unattended loop, The contract, The gate watches the wiring too, Watch for judge drift, Who actually builds it, Why the judge's findings go in the ledger (+1 more)

### Community 113 - "Colour Palette Tokens"
Cohesion: 0.15
Nodes (15): accents, HASHED, ink, Paper, PaperName, ALL, CARRIED, channels() (+7 more)

### Community 115 - "Secure Session Storage"
Cohesion: 0.22
Nodes (10): chunkKey(), KeyValueStorage, metaKey(), parseMeta(), readSecure(), removeAllGenerations(), removeGeneration(), StoredMeta (+2 more)

### Community 116 - "Drill Screen Tests"
Cohesion: 0.10
Nodes (21): SignedInRoot(), asTheScreenSends(), card(), installDisk(), nextUid(), NOW, withDeck(), AttemptAudioSweepResult (+13 more)

### Community 117 - "Profile Merge"
Cohesion: 0.16
Nodes (28): mergeProfile(), ANSWER_FIELD_SET, canonical(), compareEvidence(), compareStrings(), coreSlice(), DEVICE_FIELD_SET, finish() (+20 more)

### Community 118 - "API Engineer Agent"
Cohesion: 0.25
Nodes (7): How you work, Product invariants — a change that breaks one of these is wrong, however green, The LLM layer, The rule that matters most, The shape of the API, What you must never do, Your territory

### Community 119 - "Performance Engineer Agent"
Cohesion: 0.25
Nodes (7): How the TTS cache actually works, How you work, Product invariants — a change that breaks one of these is wrong, however green, Prompt caching, The number, What you must never do, Your territory

### Community 120 - "Security Engineer Agent"
Cohesion: 0.22
Nodes (8): Handoff contract, How you work, Product invariants — a change that breaks one of these is wrong, however green, The habits already in the code, which you should extend, What is actually true today, unvarnished, What you must never do, When dispatched by /ship, Your territory

### Community 121 - "Auth Engineer Agent"
Cohesion: 0.29
Nodes (6): How you work, Product invariants — a change that breaks one of these is wrong, however green, The seam, and why it is shaped this way, The server side, What you must never do, Your territory

### Community 122 - "Backend Engineer Agent"
Cohesion: 0.29
Nodes (6): How you work, Product invariants — a change that breaks one of these is wrong, however green, Running it locally, What this stack does not have, What you must never do, Your territory

### Community 123 - "Data Engineer Agent"
Cohesion: 0.29
Nodes (6): How you work, Product invariants — a change that breaks one of these is wrong, however green, What is actually true today, What you must never do, When a database is proposed, Your territory

### Community 124 - "Frontend Engineer Agent"
Cohesion: 0.29
Nodes (6): How you work, Product invariants — a change that breaks one of these is wrong, however green, The constraints that are not negotiable, The one thing that catches everyone out, What you must never do, Your territory

### Community 125 - "Team Roster Doc"
Cohesion: 0.29
Nodes (7): Calling them, Territory is the point, The gate defends the fleet, The independent reviewers, The team, Three of them are ahead of the code, Who owns what

### Community 126 - "Design Architect Agent"
Cohesion: 0.33
Nodes (5): Orienting yourself, The ledger format is parsed, not read, The question you are actually answering, What you must never do, Your output — the contract

### Community 127 - "Scaling Engineer Agent"
Cohesion: 0.33
Nodes (5): Default answer, The checks, What genuinely blocks a second instance today, What you must never do, Your output

### Community 128 - "Tab Bar Icons"
Cohesion: 0.18
Nodes (14): HomeIcon(), MyFrenchIcon(), PracticeIcon(), ProfileIcon(), TabIconProps, TutorIcon(), announceTab(), ICONS (+6 more)

### Community 129 - "Release Engineer Agent"
Cohesion: 0.40
Nodes (4): The bar, The checks, What you must never do, Your output

### Community 130 - "Work Judge Agent"
Cohesion: 0.40
Nodes (4): The bar for sending work back, The checks, You may not grow the job, Your output

### Community 131 - "Review Deck Store"
Cohesion: 0.21
Nodes (19): addFromSummary(), addPhrases(), adoptDeck(), caches, CardGrade, foldConvoUses(), gradeCard(), gradeCards() (+11 more)

### Community 138 - "Sync Engine Tests"
Cohesion: 0.11
Nodes (18): Card, deckPolicy, engineFor(), FakeRow, FoldCall, foldingStore(), keyFor(), manualScheduler() (+10 more)

### Community 139 - "LiveKit Session Token Grants"
Cohesion: 0.20
Nodes (14): developmentEntitlementsEnabled(), GrantResult, grantSession(), ROOM_LIFECYCLE, roomNameFor(), SeedTopic, SessionGrant, SessionMode (+6 more)

### Community 140 - "Drill Screen Views"
Cohesion: 0.10
Nodes (29): fitDisplay(), loadDrillBank(), AppropriateReplyView(), BestSentenceView(), DrillScreen(), ds, FillBlankView(), kindTag() (+21 more)

### Community 141 - "Device Verification Checklist"
Cohesion: 0.06
Nodes (33): Android, Before you start, D0 — the build is on the Supabase adapter, D10 — deletion demands a recent Google reauthentication, D11 — a failed local wipe is reported honestly, D12 — no bearer token in logs, in AsyncStorage, or in the bundle, D13 — two accounts on one device never see each other's learning, D14 — the installation signal survives deletion (+25 more)

### Community 142 - "Sync Diagnostics"
Cohesion: 0.11
Nodes (26): ALARM_CODES, ALARM_STATUSES, counter(), createSyncDiagnostics(), elapsed(), record(), formatSyncDiagnostic(), isSyncAlarm() (+18 more)

### Community 143 - "Store Binding Tests"
Cohesion: 0.09
Nodes (12): landingOf(), localProfile, nextUid(), phraseKeysOnDisk(), profileAfterConvo, QUEUED_WRITES, QueuedWrite, recap (+4 more)

### Community 144 - "Turn Timing Instrumentation"
Cohesion: 0.24
Nodes (11): TokenMeta, createTurnTiming(), formatTiming(), formatVendorMetrics(), mark(), SEGMENTS, TimingStage, TurnTiming (+3 more)

### Community 145 - "Motion And Voice Orb"
Cohesion: 0.16
Nodes (15): MissionWin(), SETTLE_MS, settleIn(), useReduceMotion(), orb, Line(), Recast(), st (+7 more)

### Community 146 - "Server User Resolver Auth"
Cohesion: 0.25
Nodes (5): createUserResolver(), ResolvedUser, SIGN_IN_REQUIRED, UserResolver, VerifierConfig

### Community 147 - "Dependency Lockfile CI Contract"
Cohesion: 0.14
Nodes (13): accepted, AdvisoryDecision, dependencyClosure(), fixed, lock, LockEntry, Lockfile, manifest (+5 more)

### Community 148 - "Progress Export And History"
Cohesion: 0.26
Nodes (12): buildEntries(), csvField(), ExportEntry, toAnkiTsv(), toCsv(), buildReport(), buildTrends(), mean() (+4 more)

### Community 149 - "XP And Levels"
Cohesion: 0.25
Nodes (17): clamp(), ConversationEvidence, conversationXp(), DAILY_XP_CAP, DatedXp, DrillEvidence, drillXp(), LessonEvidence (+9 more)

### Community 150 - "Land Command Doc"
Cohesion: 0.25
Nodes (7): 1. Who else is in this tree, 2. Where you are standing, 3. The gate, 4. The shape of the branch, 5. Deciding, 6. Landing, 7. Say what happened

### Community 151 - "Privacy And Safety Docs"
Cohesion: 0.11
Nodes (18): An under-13 stop is remembered on this device, Analytics: consent, opt-out and retention, Antifraud identifiers: purpose, retention and disclosure, Deletion and export, Disclosure at first run, Escalation and what Luvani is not, Known limits of a deterministic net, Not true yet (+10 more)

### Community 152 - "Brain Test Doubles"
Cohesion: 0.11
Nodes (6): DeadBrain, HeldAnalystBrain, HeldFrameBrain, MeteredBrain, SlowBrain, SlowFrameBrain

### Community 153 - "Motion Source Tests"
Cohesion: 0.33
Nodes (3): FILES, SRC, stripComments()

### Community 154 - "Ledger Entry Rule Test"
Cohesion: 0.29
Nodes (5): GROUNDS, HERE, LEDGER, REPO, RULE_TEST

### Community 155 - "Implementation Evidence Doc"
Cohesion: 0.13
Nodes (14): Applying the schema to whatever project ships, Credential state, measured 2026-08-25, Current focused verification, Current landing snapshot, Failed-room billing: the P0 the phase found, then closed, Feature matrix, Found and fixed during Phase 1, Historical Phase 1 baseline (+6 more)

### Community 156 - "Retired Label Checks"
Cohesion: 0.40
Nodes (5): KEPT, labelsInSource(), RETIRED, sourceFiles(), SRC

### Community 157 - "Learner Story Test Fixtures"
Cohesion: 0.21
Nodes (15): at(), everySentenceProduced(), goodWeek(), NOON, randomPast(), randomWeek(), rng(), session() (+7 more)

### Community 159 - "Activity Sync Policy"
Cohesion: 0.12
Nodes (41): stableStringify(), ACTIVITY_KINDS, ActivityEntryish, arrayOf(), compareExercises(), compareText(), envelopeOf(), exerciseIdentity() (+33 more)

### Community 160 - "Token Hygiene Checks"
Cohesion: 0.22
Nodes (8): authSources(), callArguments(), loggingCalls(), PLAINTEXT_WRITERS, REPO_ROOT, Source, sources, withoutComments()

### Community 161 - "Fresh Device Adoption"
Cohesion: 0.17
Nodes (11): adoptBeforeReady(), adoptedAnything(), FAILED, FRESH_DEVICE_BUDGET_MS, FreshStart, FreshStartKind, FreshStartOptions, settled() (+3 more)

### Community 162 - "App Root Auth Bootstrap"
Cohesion: 0.14
Nodes (13): App(), Gate(), st, startAccountSync(), LiveProvider(), AuthFlow(), installationId(), AuthProvider() (+5 more)

### Community 163 - "Prompt And Turn Queue"
Cohesion: 0.08
Nodes (18): TEXT_SILENCE_MS, baseInstructions(), buildPrompt(), turnInstructions(), TurnQueue, forgetReportedSessions(), Publisher, REPLAYED_SESSION_MESSAGE (+10 more)

### Community 164 - "Tutor Brain Doc"
Cohesion: 0.33
Nodes (5): Acceptance checks, Cost envelope, Product contract, Provider decision, The free-form tutor brain

### Community 165 - "Review Deck Merge"
Cohesion: 0.30
Nodes (13): canonical(), CARD_KINDS, counted(), countersOf(), deckOf(), gradesApplied(), higherCounts(), isFiniteNumber() (+5 more)

### Community 167 - "Expo Plugins And File Save"
Cohesion: 0.22
Nodes (7): plugins, expo-font, expo-notifications, expo-secure-store, expo-sharing, expo-web-browser, @livekit/react-native-expo-plugin

### Community 169 - "Profile Merge Logic"
Cohesion: 0.14
Nodes (12): MergedStoredProfile, PROFILE_ANSWER_FIELDS, ProfileMergeDeps, brain(), deps, GOALS, ISO, MOTIVES (+4 more)

### Community 170 - "Phrasebook Screen"
Cohesion: 0.21
Nodes (9): papers, Hold, LESSONS_GROUP, Phrase, Phrasebook, PhraseGroup, HOLD_LABEL, PhrasebookScreen() (+1 more)

### Community 171 - "Onboarding And Tracking"
Cohesion: 0.14
Nodes (17): ProductEvent, trackProductEvent(), AgeGateScreen(), st, AGE_CONFIRM, AGE_DENY, ageGate, pageBefore() (+9 more)

### Community 172 - "Supabase Runbook"
Cohesion: 0.25
Nodes (7): Apply, Backup, Restore, Rollback, Rollback evidence, Supabase runbook, When something goes wrong

### Community 173 - "Retry Backoff Policy"
Cohesion: 0.16
Nodes (7): Backoff, BACKOFF_BASE_MS, BACKOFF_CAP_MS, backoffCeiling(), backoffDelay(), BackoffOptions, createBackoff()

### Community 174 - "Mock Speech Session"
Cohesion: 0.08
Nodes (46): LiveSession, ANGLOPHONE_WEAKNESS, CARRIER, carrierWord(), estimateDurationSec(), jitter(), LearnerProfile, mockObservations() (+38 more)

### Community 176 - "Server Config Validation"
Cohesion: 0.53
Nodes (4): exactHttpsOrigin(), productionConfigurationProblems(), secureUrl(), ServerEnvironment

### Community 177 - "Product Orchestrator Agent"
Cohesion: 0.40
Nodes (4): Boundaries and escalation, Completion, Decision rights, Handoff contract

### Community 178 - "Current State Map"
Cohesion: 0.40
Nodes (4): Current-state map, Replacement/dependency graph, Runtime path, Sources of truth

### Community 179 - "Risk Register"
Cohesion: 0.29
Nodes (6): Abandoned rooms: a risk this register overstated, Failed-room billing: a control this register claimed, lost, and rebuilt, Phase 4 practice: one risk closed, three accepted, one question left open, Phase 5 tutor: two repairs, and six risks kept open on purpose, Risk register, Trial farming: theoretical no longer

### Community 180 - "Repository Archaeologist Agent"
Cohesion: 0.50
Nodes (3): Boundaries and escalation, Handoff contract, Output

### Community 192 - "TTS Voice Cache Config"
Cohesion: 0.16
Nodes (13): CONVO_LINES, CachedTTSOptions, buildTTS(), DEFAULT_CACHE_DIR, LANGUAGE_CODE, MODEL, PROBE_LINE, SETTINGS_FINGERPRINT (+5 more)

### Community 203 - "Learner Story Builder"
Cohesion: 0.27
Nodes (11): DAYS_IN_THE_STORY, hasStory(), localDaysInTheStory(), MAX_STORY_SENTENCES, mostlyUnaided(), NOTHING, soundThatLanded(), storyFrom() (+3 more)

### Community 204 - "Safety Category Taxonomy"
Cohesion: 0.06
Nodes (32): AGE_STANDS_ALONE, APPROACH_DIRECT, APPROACH_REQUEST, DANGEROUS, DANGEROUS_OBJECT, DEPENDENCY, GUARDIAN_SECRECY, HATE_ATROCITY (+24 more)

### Community 205 - "Profile Tab Reminder Tests"
Cohesion: 0.18
Nodes (7): REMINDER_REFUSED, REMINDER_ROW, REMINDERS_AVAILABLE, bodyOf(), braceBlockAfter(), HANDLERS, TAB

### Community 206 - "Native Reminder Scheduling"
Cohesion: 0.23
Nodes (10): reminderContent, ReminderPermission, ReminderTimeId, askReminderPermission(), ensureReminderChannel(), permissionOf(), reminderPermission(), REMINDERS_AVAILABLE (+2 more)

### Community 207 - "Typed Door Failure Tests"
Cohesion: 0.20
Nodes (5): convo, errorView, EVERY_FAILURE, hook, lesson

### Community 209 - "Phrasebook Mix Offer"
Cohesion: 0.14
Nodes (19): card(), days(), NOW, topic(), MIX_OFFER, offersMix(), sittingTitle(), CAFE (+11 more)

### Community 211 - "Delivery Roadmap Doc"
Cohesion: 0.22
Nodes (8): Delivery roadmap, Phase 4 execution order, and what was built against it, Phase 5: what the exit criterion means, and where it stands, Phase 6: what the exit criterion means, and where it stands, Phase boundary: Phase 3 landed, Phase 4 branched from it, then Phase 4 landed too, What each noun means, What Phase 4 did not verify, What Phase 6 did not verify

### Community 213 - "Failure Classification Copy"
Cohesion: 0.09
Nodes (26): AUDIO_ONLY, classifyFailure(), classifyPipelineError(), COPY, KIND_FAILURE, KIND_NOTICE, LiveFailure, micApiUnavailable() (+18 more)

### Community 214 - "Today Activity Rollup"
Cohesion: 0.29
Nodes (6): ActivityEntry, hasToday(), NOTHING, SITTINGS_IN_A_DAY, NOON, todayFrom()

### Community 215 - "Reminder Scheduling Shim"
Cohesion: 0.43
Nodes (6): askReminderPermission(), cancelReminder(), reminderPermission(), ScheduleOutcome, scheduleReminder(), ProfileTab()

### Community 216 - "Topic Scheduling And Merge"
Cohesion: 0.42
Nodes (6): MAX_DISCUSSED_DATES, MAX_STORED_TOPICS, mergeTopics(), STAGGER_DUE_NOW, staggerNewCards(), topicId()

### Community 217 - "Product Event Analytics"
Cohesion: 0.39
Nodes (6): exactKeys(), insertProductEvent(), missionId(), nonNegativeCount(), parseProductEvent(), ProductEvent

### Community 218 - "Zod Contract Schemas"
Cohesion: 0.13
Nodes (20): AssessmentZ, CefrBandZ, CoachItemZ, CoachKindZ, MemoryFactZ, NewPhraseZ, OptionZ, PhraseZ (+12 more)

### Community 219 - "Turns And Mode Caps"
Cohesion: 0.19
Nodes (16): MAX_TURNS, pushTurn(), TurnLine, ANYTHING_GOES, capsFor(), ChoosingOrb, ChoosingState, LiveMode (+8 more)

### Community 221 - "Disk Fault Test Harness"
Cohesion: 0.50
Nodes (3): DiskFaults, installDisk(), relaunch()

### Community 224 - "Reminder Store"
Cohesion: 0.31
Nodes (10): reminderTime, StoredReminder, KEY(), loadReminder(), presetOf(), read(), saveReminder(), serialized() (+2 more)

### Community 225 - "Recap Wait Surface"
Cohesion: 0.33
Nodes (7): LEAVE_LABEL, RECAP_COMING, RECAP_COMING_NOTE, recapWait(), RecapWaitState, RecapWaitSurface, convo

### Community 227 - "Turn Handling Tuning"
Cohesion: 0.29
Nodes (6): ENDPOINTING_MIN_DELAY_MS, INTERRUPTION_MIN_DURATION_MS, INTERRUPTION_MIN_WORDS, SessionMode, TurnHandling, turnHandlingFor()

### Community 229 - "Delivery Roadmap Checks"
Cohesion: 0.06
Nodes (27): blockingIn(), CHOOSING_VIEW_PATH, choosingView, criteriaFor(), declares(), implementationClauses(), KNOWN_ISSUES_PATH, LedgerEntry (+19 more)

### Community 231 - "Session Start Ownership"
Cohesion: 0.16
Nodes (17): nextStart(), NO_START, standDown, StartHolds, startStillOwns(), asJs(), AsyncFunction, fragment() (+9 more)

### Community 232 - "Safety Category Rules"
Cohesion: 0.14
Nodes (14): MinorSexualRule, OutputRule, SAFETY_CATEGORIES, SafetyCategory, CategoryCorpus, CORPUS, everyLine(), FALSE_POSITIVES (+6 more)

### Community 235 - "Typing Ping Indicator"
Cohesion: 0.25
Nodes (5): convo, screen, view, shouldPingTyping(), TYPING_PING_MS

### Community 236 - "Persist Acknowledgement"
Cohesion: 0.14
Nodes (15): PersistAck, AcknowledgingStore, STORES, dirtyStamp(), SyncNamespace, adoptTopics(), KEY(), mergeSessionTopics() (+7 more)

### Community 238 - "Storage Doc Test"
Cohesion: 0.22
Nodes (4): AGENT, CONVO, DOC, REPO

### Community 239 - "Token Server URL Selection"
Cohesion: 0.38
Nodes (4): selectTokenServerUrl(), SRC, TOKEN_SERVER, TokenServerEnvironment

### Community 243 - "Reminder Store Tests"
Cohesion: 0.29
Nodes (3): DEFAULT_REMINDER_TIME, reminderRow, USER_KEY_SUFFIXES

### Community 244 - "Output Safety Guard"
Cohesion: 0.25
Nodes (8): forms(), has(), loosen(), minorSexualRulesFor(), MinorSexualSignals, normalise(), outputGuard(), safetyDecision

### Community 246 - "Paper And Ink Design World"
Cohesion: 0.40
Nodes (5): Paper colour token set, Paper & Ink design world, Everything spoken must also be readable, Absent evidence must not be fabricated, Drill mode and the recognition-to-production ramp

## Knowledge Gaps
- **1710 isolated node(s):** `CurationCheckId`, `CurationProblem`, `CurationScore`, `CurationSummary`, `Environment` (+1705 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **53 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Rung` connect `Mock Speech Session` to `Tutor Turn Handling`, `Conversation Brain Client`, `Prompt And Turn Queue`, `Root Navigation`, `Conversation Screen`, `Brain CLI Playground`, `Live Session Context`, `Ladder State Machine`, `Sample Fixtures And Copy`, `Turn Timing Instrumentation`, `Learner Profile Updates`, `UI Theme Primitives`, `Lesson Definitions`, `Live Session Hook`, `Luvani Conversation Orchestrator`, `App Agent Protocol`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Why does `DrillExercise` connect `Drill Grading And Fixtures` to `Conversation Screen`, `Drill Merge And Scene Controls`, `Drill Screen Views`, `Convo Screen Session Tests`, `Mock Speech Session`, `Persist Acknowledgement`, `Session Journal Recovery`, `Store Binding Tests`, `Drill Exercise Store`, `Drill Screen Tests`, `Drill Generation Prompts`, `Authored Learning Path`, `Live Session Hook`, `App Agent Protocol`, `Activity Sync Policy`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Why does `startSync()` connect `Sync Engine Core` to `App Root Auth Bootstrap`, `Sync Policy And Live`, `Retry Backoff Policy`, `Sync Engine Tests`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **What connects `CurationCheckId`, `CurationProblem`, `CurationScore` to the rest of the system?**
  _1710 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Entitlement Store` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._
- **Should `Topic Curation` be split into smaller, more focused modules?**
  _Cohesion score 0.06265664160401002 - nodes in this community are weakly interconnected._
- **Should `Pronunciation Drill Bank` be split into smaller, more focused modules?**
  _Cohesion score 0.13902439024390245 - nodes in this community are weakly interconnected._