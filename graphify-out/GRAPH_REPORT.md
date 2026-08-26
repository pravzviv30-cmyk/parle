# Graph Report - Parle  (2026-08-26)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 4049 nodes · 9646 edges · 219 communities (170 shown, 49 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 159 edges (avg confidence: 0.7)
- Token cost: 172,861 input · 3,181 output

## Graph Freshness
- Built from commit: `95137649`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Entitlement Store
- Drill Copy and Grading Tests
- Metering and Plans
- Attempt Scoring and Drills
- Sync Engine Core
- Activity Log Store
- OpenAI Responses Brain Client
- Playground Chat Commands
- Expo App Config
- Mobile App Bootstrap
- Tutor Agent Dependencies
- Safety Content Filters
- Dev Boot Plan
- Agent Loop Runner
- Difficulty Ladder
- Auth Adapters and OAuth
- Authored Learning Path
- TTS Audio Cache
- Illustration Scenes
- Supabase Live Checks
- Topic Curation
- Brain Package Manifest
- Token Server Manifest
- Brain Playground Manifest
- Mock Speech Session
- Sync Policy and Identity
- Conversation Orchestration
- Anthropic Brain Client
- Core Package Manifest
- Live Failure Classification
- TypeScript Base Config
- Copy Style Rules
- LiveKit Tutor Agent
- Friends Store Adapter
- Mobile TypeScript Config
- Root Package Manifest
- Learner Profile Model
- Mobile Dependencies
- Mobile Package Manifest
- Auth Screens And Validation
- Tutor Intro and Coach Marks
- Brain TSConfig
- Core TSConfig
- Brain Playground TSConfig
- Token Server TSConfig
- Tutor Agent TSConfig
- Live and Profile Providers
- Mobile NPM Scripts
- Native LiveKit Globals
- Session Journal Recovery
- Environment Preflight Checks
- Drill Bank Store
- Brain Client Contracts
- Drill Screen Views
- Voice Lifecycle Security Checks
- Metro Runtime Dependency
- Expo Sharing Dependency
- Expo Speech Dependency
- OpenAI Compatible HTTP Client
- Expo Web Browser Dependency
- Account Deletion and Agent Auth
- Secret Scanning
- Turn Log and Mic Mode
- Graphify Guard Hook
- React Native Dependency
- Async Storage Dependency
- Brain Schemas and Samples
- Upstash Rate Limit Checks
- Conversation Screen and Motion
- Drill Exercise Bank Merge
- Release Gate Script
- Review Deck Cards
- Live Session Bug Ledger
- Agent Fleet Pinning
- Evidence Contract Ledger
- Product Analytics and Today Row
- Auth Adapter Interface
- Rate Limiting and Leases
- LiveKit WebRTC Dependency
- Onboarding Questions Copy
- Pronunciation Scoring
- React Native Screens Dependency
- Database Contract Tests
- Sync Policy Constants
- Supabase Client Dependency
- Auth Screens and Context
- Lesson Definitions
- Sound Check Model
- Pedagogy Doc
- Drill Validation
- Live Voice Doc
- Loop And Forge Overview
- State And Storage Doc
- Testing Doc
- Bug Hunter Agent
- Playground Architecture Doc
- Documentation Index
- Brain Client Activity Metering
- Fix Verifier Agent
- Scenario and Turn Prompts
- Profile Gate and Age Check
- Path Node Status Line
- Live Sync Policy Engine
- Scene Replay Controls
- Deploy Engineer Agent
- Observability Engineer Agent
- Revenue Engineer Agent
- App Agent Protocol
- LiveKit React Native Dependency
- Safe Area Context Dependency
- Conversation State Machine
- Forge Command Doc
- Colour Palette Tokens
- Mobile Copy Test
- Secure Session Storage
- French Authenticity Pack
- Learner Profile Merge
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
- Pre-Commit Hook
- Pre-Push Hook
- Git Hook Installer
- Dev Launcher Script
- LiveKit Session Tokens
- Token Server URL Selection
- Account Security Evidence
- Sync Diagnostics and Alarms
- Store Binding Tests
- Turn Timing Instrumentation
- LLM Usage Pricing
- Server User Resolution
- CI Dependency Contract
- Tutor Prompt Building
- Daily Activity and Levels
- Land Command Doc
- Privacy And Safety Doc
- Brain Test Doubles
- Motion Vocabulary Test
- Deletion Ledger Test
- Implementation Evidence Doc
- Retired Labels Test
- Device Verification Runbook
- Keyboard Taps Test
- Phrasebook Cards
- Token Hygiene Test
- Fresh Device Adoption
- Mission Completion Store
- Surface Contract Test
- Tutor Brain Doc
- Expo Audio Dependency
- Join Metadata Test
- Agent Voice Config
- LiveKit Client SDK
- React Library
- HTTP Security And CORS
- Turn Handling Thresholds
- Supabase Runbook
- Sync Retry Backoff
- Session Grading and Feedback
- Postgrest Table Client
- Server Config Validation
- Product Orchestrator Agent
- Current State Map
- Risk Register
- Repository Archaeologist Agent
- Data Sync Engineer Agent
- Learning Science Engineer Agent
- Privacy Safety Engineer Agent
- QA Release Engineer Agent
- Tutor Behaviour Engineer Agent
- Voice Platform Engineer Agent
- Server Security Contract Test
- Test Recorder Helper
- Safety Wiring Test
- Expo Linking
- Expo Secure Store
- LiveKit Expo Plugin
- Parle Core Package
- React DOM
- React Native Web
- React Navigation Native Stack
- Design System Engineer Agent
- Onboarding UX Engineer Agent
- Practice UX Engineer Agent
- Progress Retention Engineer Agent
- Social Systems Engineer Agent
- Coach Surfacing Policy
- Session Recap Assembly
- Mock Auth Adapter
- Memory Fact Extraction Prompt
- Turn Queue
- Source Text Test
- Session Topic Mix
- Live Session Screen
- Sync Engine Tests
- Sync Adopter Registry
- Project Principles And Constraints
- Per-User Storage Scoping
- Session Progress History Store
- Tutor Access Gate
- Drill Answer Grading
- Expo File System

## God Nodes (most connected - your core abstractions)
1. `Format` - 161 edges
2. `space()` - 86 edges
3. `ParleConversation` - 55 edges
4. `LlmUsage` - 54 edges
5. `paper` - 51 edges
6. `react` - 39 edges
7. `type` - 38 edges
8. `MockLlmClient` - 31 edges
9. `Rung` - 30 edges
10. `userKey()` - 29 edges

## Surprising Connections (you probably didn't know these)
- `A real spoken exchange inside one five-minute session` --rationale_for--> `createSession()`  [INFERRED]
  PRODUCT.md → packages/core/src/session/session.ts
- `Drill mode and the recognition-to-production ramp` --conceptually_related_to--> `bestDrillFor()`  [INFERRED]
  README.md → packages/core/src/phonemes/drills.ts
- `Chrome is plain English, French only where it is content` --rationale_for--> `CAFE_LESSON`  [INFERRED]
  DESIGN.md → packages/core/src/lessons/cafe.ts
- `Words-right and sounds-right are separate questions` --rationale_for--> `TurnFeedback`  [INFERRED]
  PRODUCT.md → packages/core/src/session/session.ts
- `Words-right and sounds-right are separate questions` --rationale_for--> `grade()`  [INFERRED]
  PRODUCT.md → packages/core/src/session/session.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **The four-rung scaffolding system, from principle to pixel** — product_scaffolding_ladder, product_never_stranded_never_scolded, design_support_colours_cool, packages_core_src_ladder_ladder_applyturn, apps_mobile_src_theme_rungcolor, readme_agent_authoritative [INFERRED 0.85]
- **The trustworthy-pronunciation chain** — product_trustworthy_pronunciation, product_french_only_depth, product_say_one_thing, readme_missing_score_no_penalty, packages_core_src_phonemes_inventory_french_phonemes, packages_core_src_phonemes_drills_drills, packages_core_src_phonemes_scoring_buildreport, services_shared_speechace_scoreutterance [INFERRED 0.85]
- **Unit economics and metering enforcement** — product_metered_minutes, product_cascaded_voice_pipeline, readme_metering_at_token_issuance, readme_tts_warm_cache, readme_risk_cost_per_session, packages_core_src_metering_meter_plans, packages_core_src_metering_meter_estimatesessioncost [INFERRED 0.85]

## Communities (219 total, 49 thin omitted)

### Community 0 - "Entitlement Store"
Cohesion: 0.11
Nodes (9): Entitlement, Plan, DevelopmentEntitlementStore, entitlementFrom(), EntitlementStore, FileEntitlementStore, InMemoryEntitlementStore, SupabaseEntitlementRow (+1 more)

### Community 1 - "Drill Copy and Grading Tests"
Cohesion: 0.10
Nodes (42): check(), checkDrill(), DRILL_FIXTURES, DrillVerdict, typed(), withOptions(), answerCurrent(), AnsweredExercise (+34 more)

### Community 2 - "Metering and Plans"
Cohesion: 0.17
Nodes (23): canStartSession(), DEFAULT_COST_MODEL, estimateSessionCost(), Margin, MIN_VIABLE_SESSION_SEC, planMargin(), PLANS, PlanSpec (+15 more)

### Community 3 - "Attempt Scoring and Drills"
Cohesion: 0.09
Nodes (49): AttemptScore, bestDrillFor(), BY_ID, Drill, DrillKind, DRILLS, drillsFor(), DrillWord (+41 more)

### Community 4 - "Sync Engine Core"
Cohesion: 0.07
Nodes (53): startSync(), clearIfRunning(), event(), flushDirty(), headers(), outcome(), pull(), queue() (+45 more)

### Community 5 - "Activity Log Store"
Cohesion: 0.19
Nodes (18): ActivityKind, adoptActivity(), backfillFrom(), chain, earnedXp(), empty(), isEntry(), isStored() (+10 more)

### Community 6 - "OpenAI Responses Brain Client"
Cohesion: 0.10
Nodes (32): AnthropicBrainConfig, ClaudeCliConfig, cacheKeyFor(), ContractSchema, DEFAULT_OPENAI_TURN_MODEL, FetchResponse, FORMAT_NAME, inputMessages() (+24 more)

### Community 7 - "Playground Chat Commands"
Cohesion: 0.14
Nodes (31): SessionRecap, applyNonSpokenInput(), supportViewForAssistance(), main(), pickClient(), Command, COMMAND_HELP, parseCommand() (+23 more)

### Community 8 - "Expo App Config"
Cohesion: 0.07
Nodes (29): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, package, permissions, predictiveBackGestureEnabled (+21 more)

### Community 9 - "Mobile App Bootstrap"
Cohesion: 0.11
Nodes (20): App(), Gate(), st, startAccountSync(), LiveProvider(), auth, authHeaders(), build() (+12 more)

### Community 10 - "Tutor Agent Dependencies"
Cohesion: 0.05
Nodes (37): @livekit/agents, @livekit/agents-plugin-anthropic, @livekit/agents-plugin-deepgram, @livekit/agents-plugin-elevenlabs, @livekit/agents-plugin-openai, @livekit/agents-plugin-silero, dependencies, dotenv (+29 more)

### Community 11 - "Safety Content Filters"
Cohesion: 0.05
Nodes (37): DANGEROUS, DEPENDENCY, forms(), GROOMING_APPROACH, GROOMING_SECRECY, has(), HATE_OR_HARASSMENT, HOMOGLYPH_RE (+29 more)

### Community 12 - "Dev Boot Plan"
Cohesion: 0.12
Nodes (18): AgentSecret, APP_PORT, bootPlan(), BootStep, brainOf(), Env, EnvGap, envGaps() (+10 more)

### Community 13 - "Agent Loop Runner"
Cohesion: 0.07
Nodes (18): ALLOWED_TOOLS, argv, BRANCH, branchNow, current, deadEnds, DRY_RUN, final (+10 more)

### Community 14 - "Difficulty Ladder"
Cohesion: 0.14
Nodes (27): Chrome is plain English, French only where it is content, No number and no scolding mid-session, applyTurn(), clamp(), directiveFor(), initialState(), INSTRUCTION_BY_RUNG, LadderState (+19 more)

### Community 15 - "Auth Adapters and OAuth"
Cohesion: 0.13
Nodes (12): plugins, startGoogleSignIn(), createSecureSessionStorage(), createSupabaseAdapter(), AuthResult, AuthUser, AuthContextValue, expo-font (+4 more)

### Community 16 - "Authored Learning Path"
Cohesion: 0.19
Nodes (15): AUTHORED_PATH, AuthoredNode, authoredPhraseKeys(), AuthoredUnit, buildPath(), discussedInWords(), drillableKeys(), GENERATED_PREFIX (+7 more)

### Community 17 - "TTS Audio Cache"
Cohesion: 0.06
Nodes (22): CachedChunkedStream, CachedTTS, CachedTTSOptions, defaultMissTransport(), normaliseLine(), ResolvedCachedTTSOptions, FakeChunkedStream, FakeSynthesizeStream (+14 more)

### Community 18 - "Illustration Scenes"
Cohesion: 0.14
Nodes (39): Frame(), Moving(), Scene(), SceneProps, Stipple(), SpeakBubbles(), HeroCafe(), NobodyYet() (+31 more)

### Community 19 - "Supabase Live Checks"
Cohesion: 0.08
Nodes (32): anonKeyOf(), blockedReport(), CheckOutcome, CheckResult, codeOf(), Environment, expect(), Learner (+24 more)

### Community 20 - "Topic Curation"
Cohesion: 0.06
Nodes (36): NewPhrase, applyCuration(), buildCurationRequest(), CuratedTopic, CurationInput, CurationSchema, INSTRUCTION, keyOf() (+28 more)

### Community 21 - "Brain Package Manifest"
Cohesion: 0.07
Nodes (26): @anthropic-ai/sdk, dependencies, @anthropic-ai/sdk, @parle/core, zod, description, devDependencies, @types/node (+18 more)

### Community 22 - "Token Server Manifest"
Cohesion: 0.08
Nodes (24): jose, livekit-server-sdk, dependencies, dotenv, jose, livekit-server-sdk, @parle/core, devDependencies (+16 more)

### Community 23 - "Brain Playground Manifest"
Cohesion: 0.08
Nodes (24): dependencies, dotenv, @parle/brain, @parle/core, description, devDependencies, @types/node, typescript (+16 more)

### Community 24 - "Mock Speech Session"
Cohesion: 0.16
Nodes (17): ANGLOPHONE_WEAKNESS, CARRIER, carrierWord(), estimateDurationSec(), jitter(), LearnerProfile, mockObservations(), Phase (+9 more)

### Community 25 - "Sync Policy and Identity"
Cohesion: 0.11
Nodes (43): stableStringify(), ACTIVITY_KINDS, ActivityEntryish, arrayOf(), compareExercises(), compareText(), envelopeOf(), exerciseIdentity() (+35 more)

### Community 26 - "Conversation Orchestration"
Cohesion: 0.10
Nodes (14): LearnerTurnInput, blocks(), blocks(), buildSystemBlocks(), ParleConversation, postSessionDeadlineMs(), sttLanguageFor(), withDeadline() (+6 more)

### Community 27 - "Anthropic Brain Client"
Cohesion: 0.30
Nodes (6): AnthropicBrainClient, outputConfig(), parse(), toProviderMessages(), usageOf(), ModelRoute

### Community 28 - "Core Package Manifest"
Cohesion: 0.10
Nodes (19): devDependencies, @types/node, typescript, exports, ./ladder, ./lessons, ./metering, ./phonemes (+11 more)

### Community 29 - "Live Failure Classification"
Cohesion: 0.13
Nodes (21): classifyFailure(), COPY, LiveFailure, micApiUnavailable(), EVERY_FAILURE, TokenServerError, ensureAudioSession(), ensureLiveKitGlobals() (+13 more)

### Community 30 - "TypeScript Base Config"
Cohesion: 0.10
Nodes (19): DOM, ES2023, compilerOptions, allowImportingTsExtensions, esModuleInterop, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, isolatedModules (+11 more)

### Community 31 - "Copy Style Rules"
Cohesion: 0.10
Nodes (26): ANGLICISM, BLOCKING_ERROR, BY_KIND, coachFallbackLine(), CopyRule, copyViolations(), EM_DASH_RE, ENGLISH_HAND_BACK (+18 more)

### Community 32 - "LiveKit Tutor Agent"
Cohesion: 0.25
Nodes (3): currentPrompt(), ParleTutor, rescueOnce()

### Community 33 - "Friends Store Adapter"
Cohesion: 0.08
Nodes (37): build(), caches, createLocalAdapter(), defaultStore(), FriendsStore, isStore(), KEY(), listeners (+29 more)

### Community 34 - "Mobile TypeScript Config"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, noEmit, noUncheckedIndexedAccess, strict, types, exclude, extends (+8 more)

### Community 35 - "Root Package Manifest"
Cohesion: 0.05
Nodes (38): advisories, auditFailsAbove, note, reviewed, description, engines, node, name (+30 more)

### Community 36 - "Learner Profile Model"
Cohesion: 0.15
Nodes (24): applyExtractionToProfile(), bandIndex(), createProfile(), EVIDENCE_WINDOW, finishSession(), isRecord(), LearnerProfile, learnerSnapshotFrom() (+16 more)

### Community 37 - "Mobile Dependencies"
Cohesion: 0.12
Nodes (17): dependencies, expo, expo-crypto, expo-font, expo-status-bar, @parle/brain, react-native-svg, @react-navigation/bottom-tabs (+9 more)

### Community 38 - "Mobile Package Manifest"
Cohesion: 0.17
Nodes (11): devDependencies, @types/node, @types/react, typescript, @types/node, typescript, main, name (+3 more)

### Community 39 - "Auth Screens And Validation"
Cohesion: 0.24
Nodes (9): AuthScreen, SetNewPasswordScreen(), st, SignInScreen(), SignUpScreen(), looksLikeEmail(), PASSWORD_MIN, passwordTooShort() (+1 more)

### Community 40 - "Tutor Intro and Coach Marks"
Cohesion: 0.28
Nodes (15): userKey(), markDirty(), adoptCoachMarks(), adoptTutorIntro(), COACH_MARKS_KEY(), hasSeenTutorIntro(), idsOf(), loadSeenCoachMarks() (+7 more)

### Community 41 - "Brain TSConfig"
Cohesion: 0.25
Nodes (7): compilerOptions, types, extends, include, node, src/**/*.ts, ../../tsconfig.base.json

### Community 42 - "Core TSConfig"
Cohesion: 0.25
Nodes (7): compilerOptions, types, extends, include, node, src/**/*.ts, ../../tsconfig.base.json

### Community 43 - "Brain Playground TSConfig"
Cohesion: 0.25
Nodes (7): compilerOptions, types, extends, include, node, src/**/*.ts, ../../tsconfig.base.json

### Community 44 - "Token Server TSConfig"
Cohesion: 0.25
Nodes (7): compilerOptions, types, extends, include, node, src/**/*.ts, ../../tsconfig.base.json

### Community 45 - "Tutor Agent TSConfig"
Cohesion: 0.25
Nodes (7): compilerOptions, types, extends, include, node, src/**/*.ts, ../../tsconfig.base.json

### Community 46 - "Live and Profile Providers"
Cohesion: 0.09
Nodes (30): Ctx, LiveValue, useLive(), useProfile(), useAuth(), loadDrillBank(), AddFriendsScreen(), defaultUsername() (+22 more)

### Community 47 - "Mobile NPM Scripts"
Cohesion: 0.25
Nodes (8): scripts, android, export:web, ios, start, test, typecheck, web

### Community 49 - "Session Journal Recovery"
Cohesion: 0.14
Nodes (25): clearAt(), clearJournal(), journalDrills(), journalRecap(), KEY(), readJournal(), recoverJournal(), serialized() (+17 more)

### Community 50 - "Environment Preflight Checks"
Cohesion: 0.14
Nodes (20): tutorLLM(), frameDeadlineMs(), turnDeadlineMs(), Brain, BRAIN_KEY, Env, FetchLike, missingRequired() (+12 more)

### Community 51 - "Drill Bank Store"
Cohesion: 0.18
Nodes (21): adoptDrillBank(), caches, defaultStore(), DrillStore, getMicSuppressedUntil(), hasGeneratedExercises(), isExercise(), isMicSuppressed() (+13 more)

### Community 52 - "Brain Client Contracts"
Cohesion: 0.10
Nodes (31): MemoryExtraction, ScenarioFrame, TutorTurn, Curation, DrillBatch, ClaudeCliBrainClient, ClaudeCliRun, CliEnvelope (+23 more)

### Community 53 - "Drill Screen Views"
Cohesion: 0.12
Nodes (28): fitDisplay(), OptionCard(), AppropriateReplyView(), BestSentenceView(), DrillScreen(), ds, FillBlankView(), kindTag() (+20 more)

### Community 54 - "Voice Lifecycle Security Checks"
Cohesion: 0.07
Nodes (63): CostModel, Check, checkAgentSecret(), checkConcurrentStart(), checkDepartureClosesRoom(), checkExactlyOnceDebit(), checkHardStop(), checkInsecureUrlRefused() (+55 more)

### Community 58 - "OpenAI Compatible HTTP Client"
Cohesion: 0.17
Nodes (12): FetchLike, realSleep(), RETRY_AFTER_CAP_MS, RETRY_AFTER_FALLBACK_MS, retryAfterMs(), SleepLike, ChatCompletion, ContractSchema (+4 more)

### Community 60 - "Account Deletion and Agent Auth"
Cohesion: 0.10
Nodes (29): adminHeaders(), deleteSupabaseUser(), signedInRecently(), agentDebitAllowed(), exactKeys(), insertProductEvent(), missionId(), nonNegativeCount() (+21 more)

### Community 61 - "Secret Scanning"
Cohesion: 0.11
Nodes (32): ALLOW_MARKER, BINARY_EXTENSIONS, BUNDLE_DIRECTORIES, bundleFiles(), Finding, formatFinding(), git(), isCodeReference() (+24 more)

### Community 62 - "Turn Log and Mic Mode"
Cohesion: 0.22
Nodes (13): MAX_TURNS, pushTurn(), TurnLine, ANYTHING_GOES, ChoosingOrb, ChoosingState, choosingView, LiveMode (+5 more)

### Community 63 - "Graphify Guard Hook"
Cohesion: 0.29
Nodes (4): GRAPH, ROOT, ROUTING, SOURCE_EXTS

### Community 66 - "Brain Schemas and Samples"
Cohesion: 0.05
Nodes (47): sampleCoachItem(), sampleSupport(), sampleTurn(), AssessmentZ, CefrBandZ, CoachItemZ, CoachKindZ, MemoryExtractionSchema (+39 more)

### Community 67 - "Upstash Rate Limit Checks"
Cohesion: 0.15
Nodes (24): RATE_LIMITS, blockedReport(), CheckResult, CheckStatus, expect(), freePort(), Instance, isHashedSegment() (+16 more)

### Community 68 - "Conversation Screen and Motion"
Cohesion: 0.07
Nodes (41): ConvoScreen(), MissionWin(), st, SETTLE_MS, settleIn(), useReduceMotion(), SplashScreen(), orb (+33 more)

### Community 70 - "Release Gate Script"
Cohesion: 0.08
Nodes (18): AGENT_MODELS, agentFiles, args, asJson, auditOnly, bless, counts, entries (+10 more)

### Community 71 - "Review Deck Cards"
Cohesion: 0.15
Nodes (25): mergeReview(), buildCardsFromSummary(), canonical(), CARD_KINDS, deckOf(), gradesApplied(), isFiniteNumber(), isReviewCard() (+17 more)

### Community 72 - "Live Session Bug Ledger"
Cohesion: 0.01
Nodes (161): A1 — A spoken answer has to match the script exactly, A2 — An empty transcript is graded as a wrong answer, A3 — A freeze at the top rung still asks the learner to invent French, A4 — A rescue can skip the beat the learner froze on, A5 — Two different opening-rung formulas, A6 — A focus point vanishes when the worst sound has no drill, A7 — A v2 snapshot with no memory crashes the worker, B0 — ParleTutor cannot be tested at all (+153 more)

### Community 73 - "Agent Fleet Pinning"
Cohesion: 0.20
Nodes (11): AgentFrontmatter, agentProblems(), FRONTMATTER_FIELDS, frontmatterBlock(), parseAgentFrontmatter(), pinnedAgents(), READ_ONLY_AGENTS, routedAgents() (+3 more)

### Community 74 - "Evidence Contract Ledger"
Cohesion: 0.08
Nodes (28): classify(), evidence, EVIDENCE_PATH, evidenceFlat, FLOORS_PATH, ledger, LEDGER_PATH, LedgerEntry (+20 more)

### Community 75 - "Product Analytics and Today Row"
Cohesion: 0.08
Nodes (55): ProductEvent, trackProductEvent(), Stat(), st, TodayRow(), CHOOSER_HEADLINE, CHOOSER_SUB, ChooserCard (+47 more)

### Community 77 - "Rate Limiting and Leases"
Cohesion: 0.07
Nodes (17): CONSUME_SCRIPT, Counter, createRateLimiter(), createSessionLeaseStore(), FetchLike, MemoryRateLimiter, MemorySessionLeaseStore, RateLimitDecision (+9 more)

### Community 79 - "Onboarding Questions Copy"
Cohesion: 0.14
Nodes (24): AGE_CONFIRM, AGE_DENY, AGE_QUESTION, AGE_REFUSAL, AGE_SUB, ageGate, answersFrom(), MOTIVATIONS (+16 more)

### Community 80 - "Pronunciation Scoring"
Cohesion: 0.17
Nodes (10): Trustworthy pronunciation needs a reference text, A missing score is never an invented penalty, ALIASES, FRENCH_IPA, toInventoryIpa(), parseSpeechace(), ScoreFetch, ScoreRequest (+2 more)

### Community 82 - "Database Contract Tests"
Cohesion: 0.09
Nodes (27): and3(), branchTaken(), claimOutcome(), CreatedObject, createdObjects(), debitFixMigration, effectiveBody(), effectiveClaimTrialBody() (+19 more)

### Community 83 - "Sync Policy Constants"
Cohesion: 0.07
Nodes (16): ACTIVITY_KEEP_DAYS, MAX_COMPLETIONS_PER_MISSION, MAX_HISTORY_SESSIONS, MAX_SOUND_CHECKS, SYNC_EXCLUSIONS, SYNC_POLICIES, adoptedNamespaces(), BASE (+8 more)

### Community 85 - "Auth Screens and Context"
Cohesion: 0.07
Nodes (74): st, st, AuthContext, AuthStatus, st, ArrowRight(), Card(), ChevronLeft() (+66 more)

### Community 86 - "Lesson Definitions"
Cohesion: 0.15
Nodes (23): CAFE_LESSON, BY_ID, getLesson(), LESSONS, AcceptanceMatch, AcceptanceRoute, candidatesFor(), CefrLevel (+15 more)

### Community 87 - "Sound Check Model"
Cohesion: 0.17
Nodes (20): nextSoundCheckReference(), SELF_GUIDED, soundCheckDecision, SoundCheckEvidence, SoundCheckKind, emptyReport, adoptSoundChecks(), isEvidence() (+12 more)

### Community 88 - "Pedagogy Doc"
Cohesion: 0.22
Nodes (8): One focus, one drill, The four rungs, The invariants, The pedagogy, The rescue, Two independent axes, What counts as a right answer, Where the next session opens

### Community 89 - "Drill Validation"
Cohesion: 0.15
Nodes (21): checkAccepted(), checkDistinct(), englishGlosses(), expectedDifficulty(), inRange(), LabelledString, learnerVisibleStrings(), ALL_GOOD (+13 more)

### Community 90 - "Live Voice Doc"
Cohesion: 0.25
Nodes (7): Audio, and what may be claimed about it, Serialisation, The four modes, The live path, The route, The wire, When it fails

### Community 91 - "Loop And Forge Overview"
Cohesion: 0.29
Nodes (7): Giving it a goal, Running it, The agents, The bar, The loop, The other half: building something new, Verifying UI work

### Community 92 - "State And Storage Doc"
Cohesion: 0.22
Nodes (8): On the device, Server side, Sessions and progress, State and storage, The brain's learner model, The pre-recap window, The round trip, and where it broke, The sync contract

### Community 93 - "Testing Doc"
Cohesion: 0.29
Nodes (6): Never, Running, Testing, The rule that matters most, What is not covered, Writing

### Community 94 - "Bug Hunter Agent"
Cohesion: 0.33
Nodes (5): House style, How you work, Product invariants — a change that breaks one of these is a bug, however green, What counts as a finding, What you must never do

### Community 95 - "Playground Architecture Doc"
Cohesion: 0.40
Nodes (5): Architecture, Mock or live, No build step, Two paths, one ladder, Who owns what

### Community 96 - "Documentation Index"
Cohesion: 0.29
Nodes (3): Deletion and supersession ledger, Delivery roadmap, docs

### Community 97 - "Brain Client Activity Metering"
Cohesion: 0.05
Nodes (50): supportViewFor(), BrainParseError, missionFrame(), ActivitySpend, asSentence(), BRAIN_ACTIVITIES, BrainActivity, brainClient() (+42 more)

### Community 100 - "Scenario and Turn Prompts"
Cohesion: 0.13
Nodes (18): SupportMaterial, ConversationState, LearnerSnapshot, buildScenarioInstruction(), INSTRUCTION, ScenarioRequestInput, INPUT_NOTES, RUNG_LENGTH (+10 more)

### Community 101 - "Profile Gate and Age Check"
Cohesion: 0.11
Nodes (27): Ctx, ProfileGate(), ProfileValue, needsOnboarding(), ageConfirmedFromDob(), ageOn(), MIN_AGE, TODAY (+19 more)

### Community 102 - "Path Node Status Line"
Cohesion: 0.16
Nodes (12): PathNodeRow(), st, MOMENT_ANSWER_MS, momentAnswer(), statusLine(), offersTalkAgain(), seedTopicFor(), TALK_AGAIN (+4 more)

### Community 103 - "Live Sync Policy Engine"
Cohesion: 0.07
Nodes (31): SyncEngine, createSyncPolicy(), dirtySettled(), anonKeyOf(), blockedReport(), CheckOutcome, CheckResult, Device (+23 more)

### Community 104 - "Scene Replay Controls"
Cohesion: 0.23
Nodes (11): hasSayableSupportLine(), ReplayLine, sceneControls, controls(), fullLine, hint, none, options (+3 more)

### Community 105 - "Deploy Engineer Agent"
Cohesion: 0.22
Nodes (8): How you work, Product invariants — a change that breaks one of these is wrong, however green, Ship the smallest real thing, Start by being honest about where this is, The order this has to happen in, What you must never do, When there is nothing to deploy to, say so, Your territory

### Community 106 - "Observability Engineer Agent"
Cohesion: 0.22
Nodes (8): How you work, Product invariants — a change that breaks one of these is wrong, however green, The line you do not cross, The seam to cut, when the time comes, What exists, and what does not, What you must never do, When there is no seam yet, say so, Your territory

### Community 107 - "Revenue Engineer Agent"
Cohesion: 0.20
Nodes (9): Copy about money is still learner copy, Handoff contract, How you work, Product invariants — a change that breaks one of these is wrong, however green, The rule enforcement lives at, What already exists, What you must never do, Where a purchase lands (+1 more)

### Community 108 - "App Agent Protocol"
Cohesion: 0.11
Nodes (27): asTheAgentReadsIt(), asTheAppReadsIt(), CLIENT_TAGS, ConvoCoachItem, ConvoPhrase, ConvoSpeakerLine, ConvoView, decodeAs() (+19 more)

### Community 111 - "Conversation State Machine"
Cohesion: 0.13
Nodes (25): CoachItem, SpeakerLine, SupportView, sanitizeLearnerText(), AssistanceDepth, BASE_RUNG_BY_CEFR, beatOf(), createConversation() (+17 more)

### Community 112 - "Forge Command Doc"
Cohesion: 0.22
Nodes (9): /forge, Looping it, Not wired yet: the unattended loop, The contract, The gate watches the wiring too, Watch for judge drift, Who actually builds it, Why the judge's findings go in the ledger (+1 more)

### Community 113 - "Colour Palette Tokens"
Cohesion: 0.15
Nodes (15): accents, HASHED, ink, Paper, PaperName, ALL, CARRIED, channels() (+7 more)

### Community 115 - "Secure Session Storage"
Cohesion: 0.22
Nodes (10): chunkKey(), KeyValueStorage, metaKey(), parseMeta(), readSecure(), removeAllGenerations(), removeGeneration(), StoredMeta (+2 more)

### Community 116 - "French Authenticity Pack"
Cohesion: 0.19
Nodes (13): FR_PACK, renderAuthenticityPack(), AuthenticityPack, ContrastPair, Filler, RegisterDef, SlangEntry, ENGLISH_ACCENTED_WORDS (+5 more)

### Community 117 - "Learner Profile Merge"
Cohesion: 0.10
Nodes (38): ANSWER_FIELD_SET, compareEvidence(), compareStrings(), coreSlice(), finish(), finiteOr(), identityOf(), inKeyOrder() (+30 more)

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
Cohesion: 0.21
Nodes (12): HomeIcon(), MyFrenchIcon(), PracticeIcon(), ProfileIcon(), TabIconProps, TutorIcon(), announceTab(), ICONS (+4 more)

### Community 129 - "Release Engineer Agent"
Cohesion: 0.40
Nodes (4): The bar, The checks, What you must never do, Your output

### Community 130 - "Work Judge Agent"
Cohesion: 0.40
Nodes (4): The bar for sending work back, The checks, You may not grow the job, Your output

### Community 131 - "Review Deck Store"
Cohesion: 0.24
Nodes (17): addFromSummary(), addPhrases(), adoptDeck(), caches, gradeCard(), gradeCards(), isCard(), KEY() (+9 more)

### Community 138 - "Dev Launcher Script"
Cohesion: 0.20
Nodes (18): AGENT_ENV_FILE, children, COLOURS, die(), hasClaudeCli(), launch(), main(), probe() (+10 more)

### Community 139 - "LiveKit Session Tokens"
Cohesion: 0.20
Nodes (14): developmentEntitlementsEnabled(), GrantResult, grantSession(), ROOM_LIFECYCLE, roomNameFor(), SeedTopic, SessionGrant, SessionMode (+6 more)

### Community 140 - "Token Server URL Selection"
Cohesion: 0.38
Nodes (4): selectTokenServerUrl(), SRC, TOKEN_SERVER, TokenServerEnvironment

### Community 141 - "Account Security Evidence"
Cohesion: 0.12
Nodes (16): D0 — the build is on the Supabase adapter, D10 — deletion demands a recent Google reauthentication, D11 — a failed local wipe is reported honestly, D12 — no bearer token in logs, in AsyncStorage, or in the bundle, D13 — two accounts on one device never see each other's learning, D14 — the installation signal survives deletion, D1 — a session survives backgrounding, cold start and reboot, D2 — the session is in the keychain, not in plaintext storage (+8 more)

### Community 142 - "Sync Diagnostics and Alarms"
Cohesion: 0.11
Nodes (26): ALARM_CODES, ALARM_STATUSES, counter(), createSyncDiagnostics(), elapsed(), record(), formatSyncDiagnostic(), isSyncAlarm() (+18 more)

### Community 143 - "Store Binding Tests"
Cohesion: 0.09
Nodes (13): setActiveUser(), landingOf(), localProfile, nextUid(), phraseKeysOnDisk(), profileAfterConvo, QUEUED_WRITES, QueuedWrite (+5 more)

### Community 144 - "Turn Timing Instrumentation"
Cohesion: 0.22
Nodes (12): TokenMeta, parseStoredProfile(), createTurnTiming(), formatTiming(), formatVendorMetrics(), mark(), SEGMENTS, TimingStage (+4 more)

### Community 145 - "LLM Usage Pricing"
Cohesion: 0.11
Nodes (32): carriesFrench(), addLlmUsage(), ZERO_USAGE, defaultModel(), DEFAULT_OPENAI_ANALYST_MODEL, costUsd(), FALLBACK_PRICE_MODEL, MtokPrices (+24 more)

### Community 146 - "Server User Resolution"
Cohesion: 0.25
Nodes (5): createUserResolver(), ResolvedUser, SIGN_IN_REQUIRED, UserResolver, VerifierConfig

### Community 147 - "CI Dependency Contract"
Cohesion: 0.14
Nodes (13): accepted, AdvisoryDecision, dependencyClosure(), fixed, lock, LockEntry, Lockfile, manifest (+5 more)

### Community 148 - "Tutor Prompt Building"
Cohesion: 0.13
Nodes (15): Rung, Lesson, baseInstructions(), buildPrompt(), turnInstructions(), forgetReportedSessions(), noteSessionReported(), Publisher (+7 more)

### Community 149 - "Daily Activity and Levels"
Cohesion: 0.14
Nodes (24): ActivityEntry, hasToday(), NOTHING, SITTINGS_IN_A_DAY, NOON, todayFrom(), clamp(), ConversationEvidence (+16 more)

### Community 150 - "Land Command Doc"
Cohesion: 0.25
Nodes (7): 1. Who else is in this tree, 2. Where you are standing, 3. The gate, 4. The shape of the branch, 5. Deciding, 6. Landing, 7. Say what happened

### Community 151 - "Privacy And Safety Doc"
Cohesion: 0.13
Nodes (14): Analytics: consent, opt-out and retention, Antifraud identifiers: purpose, retention and disclosure, Deletion and export, Escalation and what Parle is not, Known limits of a deterministic net, Not true yet, Privacy and safety, Raw speech is never stored (+6 more)

### Community 152 - "Brain Test Doubles"
Cohesion: 0.11
Nodes (6): DeadBrain, HeldAnalystBrain, HeldFrameBrain, MeteredBrain, SlowBrain, SlowFrameBrain

### Community 153 - "Motion Vocabulary Test"
Cohesion: 0.33
Nodes (3): FILES, SRC, stripComments()

### Community 154 - "Deletion Ledger Test"
Cohesion: 0.29
Nodes (5): GROUNDS, HERE, LEDGER, REPO, RULE_TEST

### Community 155 - "Implementation Evidence Doc"
Cohesion: 0.14
Nodes (13): Applying the schema to whatever project ships, Baseline, Credential state, measured 2026-08-25, Current focused verification, Failed-room billing: the P0 the phase found, then closed, Feature matrix, Found and fixed during Phase 1, Implementation evidence (+5 more)

### Community 156 - "Retired Labels Test"
Cohesion: 0.40
Nodes (5): KEPT, labelsInSource(), RETIRED, sourceFiles(), SRC

### Community 157 - "Device Verification Runbook"
Cohesion: 0.17
Nodes (10): Android, Before you start, D15 — a keystore key invalidated by a lock-screen change, D16 — restored from an Android backup, Device verification — iOS and Android auth, session storage and deletion, Recording the result, The matrix, What a device proves that this machine cannot (+2 more)

### Community 159 - "Phrasebook Cards"
Cohesion: 0.15
Nodes (13): PhrasebookCard(), papers, hasPhrases(), Hold, holdFor(), LESSONS_GROUP, Phrase, PhraseGroup (+5 more)

### Community 160 - "Token Hygiene Test"
Cohesion: 0.22
Nodes (8): authSources(), callArguments(), loggingCalls(), PLAINTEXT_WRITERS, REPO_ROOT, Source, sources, withoutComments()

### Community 161 - "Fresh Device Adoption"
Cohesion: 0.17
Nodes (11): adoptBeforeReady(), adoptedAnything(), FAILED, FRESH_DEVICE_BUDGET_MS, FreshStart, FreshStartKind, FreshStartOptions, settled() (+3 more)

### Community 162 - "Mission Completion Store"
Cohesion: 0.20
Nodes (15): source, adoptMissionCompletions(), COMPLETIONS_PER_MISSION, isCompletion(), KEY(), MissionCompletion, persistedCompletions(), readCompletions() (+7 more)

### Community 163 - "Surface Contract Test"
Cohesion: 0.40
Nodes (3): APP, SOURCES, stripComments()

### Community 164 - "Tutor Brain Doc"
Cohesion: 0.33
Nodes (5): Acceptance checks, Cost envelope, Product contract, Provider decision, The free-form tutor brain

### Community 167 - "Agent Voice Config"
Cohesion: 0.17
Nodes (12): CONVO_LINES, buildTTS(), DEFAULT_CACHE_DIR, LANGUAGE_CODE, MODEL, PROBE_LINE, SETTINGS_FINGERPRINT, ENV_KEYS (+4 more)

### Community 170 - "HTTP Security And CORS"
Cohesion: 0.39
Nodes (7): applyHttpSecurity(), createOriginPolicy(), DEVELOPMENT_ORIGINS, originAllowed(), OriginPolicy, parseAllowedOrigins(), requestOrigin()

### Community 171 - "Turn Handling Thresholds"
Cohesion: 0.29
Nodes (6): ENDPOINTING_MIN_DELAY_MS, INTERRUPTION_MIN_DURATION_MS, INTERRUPTION_MIN_WORDS, SessionMode, TurnHandling, turnHandlingFor()

### Community 172 - "Supabase Runbook"
Cohesion: 0.25
Nodes (7): Apply, Backup, Restore, Rollback, Rollback evidence, Supabase runbook, When something goes wrong

### Community 173 - "Sync Retry Backoff"
Cohesion: 0.16
Nodes (7): Backoff, BACKOFF_BASE_MS, BACKOFF_CAP_MS, backoffCeiling(), backoffDelay(), BackoffOptions, createBackoff()

### Community 174 - "Session Grading and Feedback"
Cohesion: 0.14
Nodes (25): LiveSession, SessionViewProps, TurnQuality, createSession(), FEEDBACK, FEEDBACK_FAMILIES, feedbackMessage(), grade() (+17 more)

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
Cohesion: 0.40
Nodes (4): Abandoned rooms: a risk this register overstated, Failed-room billing: a control this register claimed, lost, and rebuilt, Risk register, Trial farming: theoretical no longer

### Community 180 - "Repository Archaeologist Agent"
Cohesion: 0.50
Nodes (3): Boundaries and escalation, Handoff contract, Output

### Community 203 - "Coach Surfacing Policy"
Cohesion: 0.20
Nodes (13): Assessment, CoachKind, ANSWERS_RATHER_THAN_INTERRUPTS, assessmentToQuality(), INLINE_CAP, INLINE_COACH_COOLDOWN_TURNS, splitCoach(), SURFACE (+5 more)

### Community 204 - "Session Recap Assembly"
Cohesion: 0.24
Nodes (10): KIND_PRIORITY, assembleRecap(), dedupeFixes(), FOCUS_BY_TAG, focusFrom(), HEADLINE_FAMILIES, headlineFor(), HEADLINES (+2 more)

### Community 205 - "Mock Auth Adapter"
Cohesion: 0.25
Nodes (9): createMockAdapter(), notify(), setSession(), emptyStore(), MockAccount, MockStore, readStore(), toUser() (+1 more)

### Community 206 - "Memory Fact Extraction Prompt"
Cohesion: 0.31
Nodes (9): MemoryFact, ChatMessage, buildExtractionRequest(), ExtractionInput, factLine(), INSTRUCTION, interview, request() (+1 more)

### Community 209 - "Session Topic Mix"
Cohesion: 0.14
Nodes (20): topic(), MIX_OFFER, offersMix(), sittingTitle(), CAFE, due(), JOB, later() (+12 more)

### Community 210 - "Live Session Screen"
Cohesion: 0.10
Nodes (21): HelpGlyph(), LineBullet(), MicGlyph(), SpeakCircle(), StationLine(), failureCopy, LiveErrorView(), show() (+13 more)

### Community 211 - "Sync Engine Tests"
Cohesion: 0.10
Nodes (20): SyncEngineOptions, Card, deckPolicy, engineFor(), FakeRow, FoldCall, foldingStore(), keyFor() (+12 more)

### Community 212 - "Sync Adopter Registry"
Cohesion: 0.14
Nodes (19): adopters, dirty, listeners, persistChain, Persisted, SyncAdopter, SyncAdoption, SyncFold (+11 more)

### Community 213 - "Project Principles And Constraints"
Cohesion: 0.15
Nodes (13): Read the exact versioned Expo docs before writing code, Paper colour token set, Paper & Ink design world, Absolute-beginner audience (CEFR A0-A2), Everything spoken must also be readable, Absent evidence must not be fabricated, Parle (working name), Expo + TypeScript npm-workspaces monorepo (+5 more)

### Community 214 - "Per-User Storage Scoping"
Cohesion: 0.19
Nodes (11): SignedInRoot(), clearActiveUserData(), LEGACY_KEYS, migrateLegacyStores(), onUserScopeReset(), resetHooks, APP, sourceFiles() (+3 more)

### Community 215 - "Session Progress History Store"
Cohesion: 0.29
Nodes (12): adoptHistory(), isSession(), KEY(), loadHistory(), persistedHistory(), readHistory(), recordSession(), registerAdopter() (+4 more)

### Community 216 - "Tutor Access Gate"
Cohesion: 0.25
Nodes (7): TUTOR_INTRO_LINK, TUTOR_OFFLINE, TutorDoor, TutorDoorKey, tutorDoors(), tutorGate, TutorOfflineCopy

### Community 217 - "Drill Answer Grading"
Cohesion: 0.38
Nodes (8): acceptedFor(), gradeAnswer(), gradeFreeText(), GradeResult, realWordSet(), damerauLevenshtein(), TYPO_MAX_DISTANCE, TYPO_MIN_LENGTH

## Knowledge Gaps
- **1318 isolated node(s):** `BrainConfig`, `OnboardingAnswers`, `UpgradedProfile`, `CheckOutcome`, `Device` (+1313 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **49 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `Auth Screens and Context` to `Tab Bar Icons`, `Mobile TypeScript Config`, `Conversation Screen and Motion`, `Profile Gate and Age Check`, `Auth Screens And Validation`, `Mobile App Bootstrap`, `Product Analytics and Today Row`, `Live and Profile Providers`, `Onboarding Questions Copy`, `Illustration Scenes`, `Live Session Screen`, `Drill Screen Views`, `Mock Speech Session`, `Live Failure Classification`, `Phrasebook Cards`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Why does `DrillExercise` connect `Drill Copy and Grading Tests` to `Drill Validation`, `Drill Answer Grading`, `Drill Exercise Bank Merge`, `App Agent Protocol`, `Session Grading and Feedback`, `Store Binding Tests`, `Authored Learning Path`, `Session Journal Recovery`, `Drill Bank Store`, `Topic Curation`, `Drill Screen Views`, `Sync Policy and Identity`, `Live Failure Classification`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Why does `registerSyncAdopter()` connect `Sync Engine Tests` to `Mission Completion Store`, `Review Deck Store`, `Sync Engine Core`, `Activity Log Store`, `Profile Gate and Age Check`, `Live Sync Policy Engine`, `Tutor Intro and Coach Marks`, `Drill Bank Store`, `Sync Adopter Registry`, `Sound Check Model`, `Session Progress History Store`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **What connects `BrainConfig`, `OnboardingAnswers`, `UpgradedProfile` to the rest of the system?**
  _1318 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Entitlement Store` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._
- **Should `Drill Copy and Grading Tests` be split into smaller, more focused modules?**
  _Cohesion score 0.09696969696969697 - nodes in this community are weakly interconnected._
- **Should `Attempt Scoring and Drills` be split into smaller, more focused modules?**
  _Cohesion score 0.08602150537634409 - nodes in this community are weakly interconnected._