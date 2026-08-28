# Graph Report - Parle  (2026-08-28)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 4728 nodes · 11127 edges · 246 communities (197 shown, 49 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 169 edges (avg confidence: 0.69)
- Token cost: 182,785 input · 3,314 output

## Graph Freshness
- Built from commit: `db1df383`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Entitlement Store
- Topic Curation
- Session Metering and Plans
- Pronunciation Drill Bank
- Sync Engine Core
- Activity Log Store
- Brain Playground CLI
- Claude CLI and Pricing
- Expo App Config
- Auth Screens
- Tutor Agent Dependencies
- Safety Policy Records
- Dev Launcher Script
- Bug Loop Runner
- Difficulty Ladder
- Supabase Auth & OAuth
- Authored Learning Path
- TTS Audio Cache
- Illustration Scenes
- Supabase Live Checks
- Drill Generation Prompts
- Brain Package Manifest
- Token Server Manifest
- Playground Package Manifest
- Mock Speech Session Screen
- Conversation View Model
- Conversation Orchestration
- Drill Grading
- Core Package Manifest
- Client Server Protocol
- TypeScript Base Config
- HTTP Retry Client
- Parle Tutor Agent
- Friends Local Store
- Mobile TypeScript Config
- Dependency Audit Manifest
- First Run Disclosure
- Mobile Dependencies
- Mobile Package Manifest
- Learner Profile Updates
- Topics Store
- Brain TypeScript Config
- Core TypeScript Config
- Playground TypeScript Config
- Token Server TypeScript Config
- Tutor Agent TypeScript Config
- Tutor Tab Gate
- Mobile NPM Scripts
- Native Audio Globals
- Conversation Screen Tests
- Environment Preflight Probe
- Drill Store
- Brain LLM Client Types
- Practice Evidence Records
- Voice Lifecycle Checks
- Expo Metro Runtime
- Expo Sharing
- Spaced Repetition Scheduler
- Age Gate & Profile Upgrade
- Expo Web Browser
- Account Deletion and Events
- Secret Scanner
- Review Card View
- Graphify Guard Script
- React Native Core
- Async Storage Dependency
- Zod Contract Schemas
- Upstash Live Checks
- Conversation Screen UI
- Profile Store and Context
- Gate Runner Script
- Mastery Evidence Tracking
- Tutor Defect Ledger
- Agent Fleet Frontmatter
- Evidence Ledger Contract
- Drill Chooser View
- Auth Adapter Interface
- Rate Limit and Leases
- LiveKit WebRTC Native
- Onboarding Age Gate
- Repo Design Principles
- React Native Screens
- Database Contract Tests
- Sync Retention Policy
- Supabase Client
- UI Component Primitives
- Lesson Definitions
- Sound Check Store
- Pedagogy Doc
- Live Session Hook Tests
- Live Voice Doc
- Agent Loop Doc
- State & Storage Doc
- Testing Doc
- Bug Hunter Agent
- Playground Architecture Doc
- Project Documentation Index
- Conversation Engine Tests
- Fix Verification Agent
- React Context Providers
- Auth Mode & Installation
- Path Node Status Line
- Sync Policy and Live Checks
- French Authenticity Pack
- Deploy Engineer Agent
- Observability Engineer Agent
- Revenue Engineer Agent
- Conversation Scene Controls
- LiveKit React Native
- Safe Area Context
- Coach Sample Fixtures
- Forge Command Doc
- Palette Contrast Checks
- Mobile Copy Tests
- Secure Session Storage
- User Scope Reset
- Profile Merge
- API Engineer Agent
- Performance Engineer Agent
- Security Engineer Agent
- Auth Engineer Agent
- Backend Engineer Agent
- Data Engineer Agent
- Frontend Engineer Agent
- Team Ownership Doc
- Design Architect Agent
- Scaling Engineer Agent
- Tab Bar Icons
- Release Engineer Agent
- Work Judge Agent
- Review Deck Store
- Pre-commit Git Hook
- Pre-push Git Hook
- Git Hook Installer
- Android App Config
- Session Token Grants
- Drill Screen UI
- Device & Accessibility Verification
- Sync Diagnostics
- Store Binding Tests
- Agent Turn Timing
- Namespace Merge Policy
- Server User Resolver
- Dependency Lockfile Contract
- Export and History Reports
- XP and Levels
- Land Command Doc
- Privacy and Safety Docs
- Fake Brain Test Doubles
- Motion Usage Tests
- Ledger Entry Tests
- Implementation Evidence Doc
- Retired Label Tests
- Onboarding Doc
- Keyboard Input Tests
- Merge Helper Utilities
- Token Logging Hygiene
- Fresh Device Adoption
- Mission Completion Store
- Thinking and Session Reporting
- Tutor Brain Doc
- Review Deck Merge
- Join Metadata Tests
- Expo Plugins & File Saving
- LiveKit Client
- Review Engine Tests
- HTTP Security & CORS
- Token Server URL Selection
- Supabase Runbook
- Retry Backoff Policy
- Session and Attempt Scoring
- Supabase Test Fakes
- Server Config Validation
- Product Orchestrator Agent
- Current State Map
- Risk Register
- Repository Archaeologist Agent
- Data Sync Agent Spec
- Learning Science Agent Spec
- Privacy Safety Agent Spec
- QA Release Agent Spec
- Tutor Behaviour Agent Spec
- Voice Platform Agent Spec
- Server Security Contract Tests
- Audio Recorder Helpers
- Safety Wiring Tests
- Expo Linking
- Expo Secure Store
- App Surface Contract
- Parle Core Package
- React DOM
- React Native Web
- Navigation Native Stack
- Design System Agent Spec
- Onboarding UX Agent Spec
- Practice UX Agent Spec
- Progress Retention Agent Spec
- Social Systems Agent Spec
- Profile Merge Tests
- Safety Category Taxonomy
- Mock Auth Adapter
- Tutor Evaluation Cases
- Turn Queue
- Source Text Tests
- Phrasebook and Mix
- Attempt Audio Cleanup
- Delivery Roadmap
- Live Failure Classification
- Anthropic Brain Client
- Session Progress History
- Drill Exercise Merge
- Drill Fixtures and Validation
- Expo File System
- Session Turns and Views
- Today Activity Row
- Drill Exercise Types
- React
- LiveKit Expo Plugin
- Expo Audio
- Review Merge Tests
- Tutor Strictness Setting
- App Root Wiring
- Live Session Hook
- Delivery Roadmap Tests
- Auth & Deletion Device Checks
- Microphone Sound Check
- Safety Category Rules
- Drill Screen Tests
- Drill Session Building
- Session View Typing Ping
- Brain Client Interface
- Typed Door Failure Tests
- Storage Doc Tests
- Brain Spend Metering
- Topic Merging & Staggering
- Stored Shape Type Guards
- Playground Commands
- Tutor Agent Prompt
- Safety Decision Guard
- Expo SDK

## God Nodes (most connected - your core abstractions)
1. `Format` - 248 edges
2. `space()` - 88 edges
3. `ParleConversation` - 62 edges
4. `LlmUsage` - 54 edges
5. `paper` - 52 edges
6. `react` - 40 edges
7. `type` - 39 edges
8. `ConvoScreen()` - 38 edges
9. `DrillExercise` - 32 edges
10. `ParleTutor` - 32 edges

## Surprising Connections (you probably didn't know these)
- `A real spoken exchange inside one five-minute session` --rationale_for--> `createSession()`  [INFERRED]
  PRODUCT.md → packages/core/src/session/session.ts
- `Drill mode and the recognition-to-production ramp` --conceptually_related_to--> `bestDrillFor()`  [INFERRED]
  README.md → packages/core/src/phonemes/drills.ts
- `Words-right and sounds-right are separate questions` --rationale_for--> `TurnFeedback`  [INFERRED]
  PRODUCT.md → packages/core/src/session/session.ts
- `The conversation upgrade` --rationale_for--> `RecapPayload`  [INFERRED]
  README.md → packages/core/src/protocol/protocol.ts
- `Words-right and sounds-right are separate questions` --rationale_for--> `grade()`  [INFERRED]
  PRODUCT.md → packages/core/src/session/session.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **The four-rung scaffolding system, from principle to pixel** — product_scaffolding_ladder, product_never_stranded_never_scolded, design_support_colours_cool, packages_core_src_ladder_ladder_applyturn, apps_mobile_src_theme_rungcolor, readme_agent_authoritative [INFERRED 0.85]
- **The trustworthy-pronunciation chain** — product_trustworthy_pronunciation, product_french_only_depth, product_say_one_thing, readme_missing_score_no_penalty, packages_core_src_phonemes_inventory_french_phonemes, packages_core_src_phonemes_drills_drills, packages_core_src_phonemes_scoring_buildreport, services_shared_speechace_scoreutterance [INFERRED 0.85]
- **Unit economics and metering enforcement** — product_metered_minutes, product_cascaded_voice_pipeline, readme_metering_at_token_issuance, readme_tts_warm_cache, readme_risk_cost_per_session, packages_core_src_metering_meter_plans, packages_core_src_metering_meter_estimatesessioncost [INFERRED 0.85]

## Communities (246 total, 49 thin omitted)

### Community 0 - "Entitlement Store"
Cohesion: 0.11
Nodes (9): Entitlement, Plan, DevelopmentEntitlementStore, entitlementFrom(), EntitlementStore, FileEntitlementStore, InMemoryEntitlementStore, SupabaseEntitlementRow (+1 more)

### Community 1 - "Topic Curation"
Cohesion: 0.06
Nodes (48): NewPhrase, applyCuration(), buildCurationRequest(), CuratedTopic, CurationInput, CurationSchema, extensionViolations(), INSTRUCTION (+40 more)

### Community 2 - "Session Metering and Plans"
Cohesion: 0.15
Nodes (25): canStartSession(), CostModel, DEFAULT_COST_MODEL, estimateSessionCost(), Margin, MIN_VIABLE_SESSION_SEC, planMargin(), PLANS (+17 more)

### Community 3 - "Pronunciation Drill Bank"
Cohesion: 0.13
Nodes (34): bestDrillFor(), BY_ID, Drill, DrillKind, DRILLS, drillsFor(), DrillWord, getDrill() (+26 more)

### Community 4 - "Sync Engine Core"
Cohesion: 0.07
Nodes (47): startSync(), clearIfRunning(), event(), flushDirty(), headers(), outcome(), pull(), queue() (+39 more)

### Community 5 - "Activity Log Store"
Cohesion: 0.16
Nodes (21): ActivityKind, adoptActivity(), backfillFrom(), chain, earnedXp(), empty(), isEntry(), isStored() (+13 more)

### Community 6 - "Brain Playground CLI"
Cohesion: 0.15
Nodes (31): SessionRecap, Side, LearnerProfile, main(), pickClient(), DEFAULT_PROFILE_PATH, loadProfile(), resetProfile() (+23 more)

### Community 7 - "Claude CLI and Pricing"
Cohesion: 0.09
Nodes (29): ParseCapableSdk, ClaudeCliRun, blocks(), envelope(), EXTRACTION, recordingRun(), addLlmUsage(), ZERO_USAGE (+21 more)

### Community 8 - "Expo App Config"
Cohesion: 0.10
Nodes (19): expo, icon, ios, name, newArchEnabled, orientation, scheme, slug (+11 more)

### Community 9 - "Auth Screens"
Cohesion: 0.08
Nodes (46): AuthScreen, SetNewPasswordScreen(), st, SignInScreen(), st, SignUpScreen(), st, looksLikeEmail() (+38 more)

### Community 10 - "Tutor Agent Dependencies"
Cohesion: 0.05
Nodes (37): @livekit/agents, @livekit/agents-plugin-anthropic, @livekit/agents-plugin-deepgram, @livekit/agents-plugin-elevenlabs, @livekit/agents-plugin-openai, @livekit/agents-plugin-silero, dependencies, dotenv (+29 more)

### Community 11 - "Safety Policy Records"
Cohesion: 0.05
Nodes (30): recordSafetyDecision(), SafetyRecord, ANSWERS_PATH, APP, callCount(), codeOnly(), CONDUCT_PATH, CONVO_PATH (+22 more)

### Community 12 - "Dev Launcher Script"
Cohesion: 0.09
Nodes (36): AGENT_ENV_FILE, children, COLOURS, die(), hasClaudeCli(), launch(), main(), probe() (+28 more)

### Community 13 - "Bug Loop Runner"
Cohesion: 0.07
Nodes (18): ALLOWED_TOOLS, argv, BRANCH, branchNow, current, deadEnds, DRY_RUN, final (+10 more)

### Community 14 - "Difficulty Ladder"
Cohesion: 0.14
Nodes (27): No number and no scolding mid-session, applyTurn(), clamp(), directiveFor(), initialState(), INSTRUCTION_BY_RUNG, LadderState, nextSessionRung() (+19 more)

### Community 15 - "Supabase Auth & OAuth"
Cohesion: 0.27
Nodes (5): startGoogleSignIn(), createSecureSessionStorage(), createSupabaseAdapter(), AuthResult, AuthUser

### Community 16 - "Authored Learning Path"
Cohesion: 0.22
Nodes (14): AUTHORED_PATH, AuthoredNode, authoredPhraseKeys(), AuthoredUnit, buildPath(), discussedInWords(), drillableKeys(), GENERATED_PREFIX (+6 more)

### Community 17 - "TTS Audio Cache"
Cohesion: 0.06
Nodes (22): CachedChunkedStream, CachedTTS, CachedTTSOptions, defaultMissTransport(), normaliseLine(), ResolvedCachedTTSOptions, FakeChunkedStream, FakeSynthesizeStream (+14 more)

### Community 18 - "Illustration Scenes"
Cohesion: 0.14
Nodes (39): Frame(), Moving(), Scene(), SceneProps, Stipple(), SpeakBubbles(), HeroCafe(), NobodyYet() (+31 more)

### Community 19 - "Supabase Live Checks"
Cohesion: 0.09
Nodes (23): anonKeyOf(), CheckOutcome, CheckResult, codeOf(), Environment, Learner, makeRedactor(), MARK (+15 more)

### Community 20 - "Drill Generation Prompts"
Cohesion: 0.09
Nodes (21): AppropriateReplyZ, BASE, BestSentenceZ, buildDrillGenerationRequest(), FillBlankZ, GeneratedExerciseZ, INSTRUCTION, ListenTypeZ (+13 more)

### Community 21 - "Brain Package Manifest"
Cohesion: 0.07
Nodes (26): @anthropic-ai/sdk, dependencies, @anthropic-ai/sdk, @parle/core, zod, description, devDependencies, @types/node (+18 more)

### Community 22 - "Token Server Manifest"
Cohesion: 0.08
Nodes (24): jose, livekit-server-sdk, dependencies, dotenv, jose, livekit-server-sdk, @parle/core, devDependencies (+16 more)

### Community 23 - "Playground Package Manifest"
Cohesion: 0.08
Nodes (25): dependencies, dotenv, @parle/brain, @parle/core, description, devDependencies, @types/node, typescript (+17 more)

### Community 24 - "Mock Speech Session Screen"
Cohesion: 0.16
Nodes (16): ANGLOPHONE_WEAKNESS, CARRIER, carrierWord(), estimateDurationSec(), jitter(), LearnerProfile, mockObservations(), Phase (+8 more)

### Community 25 - "Conversation View Model"
Cohesion: 0.08
Nodes (30): ActivitySpend, asSentence(), BRAIN_ACTIVITIES, BrainActivity, brainClient(), cacheHitRate(), chargedInput(), chooseFrame() (+22 more)

### Community 27 - "Drill Grading"
Cohesion: 0.20
Nodes (20): acceptedFor(), DrillVerdict, gradeAnswer(), gradeFreeText(), GradeResult, realWordSet(), AnsweredExercise, DrillFeedback (+12 more)

### Community 28 - "Core Package Manifest"
Cohesion: 0.10
Nodes (19): devDependencies, @types/node, typescript, exports, ./ladder, ./lessons, ./metering, ./phonemes (+11 more)

### Community 29 - "Client Server Protocol"
Cohesion: 0.07
Nodes (35): asTheAgentReadsIt(), asTheAppReadsIt(), CLIENT_TAGS, ConvoCoachItem, ConvoSpeakerLine, ConvoView, decodeAs(), decodeClientMessage() (+27 more)

### Community 30 - "TypeScript Base Config"
Cohesion: 0.10
Nodes (19): DOM, ES2023, compilerOptions, allowImportingTsExtensions, esModuleInterop, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, isolatedModules (+11 more)

### Community 31 - "HTTP Retry Client"
Cohesion: 0.07
Nodes (39): AnthropicBrainConfig, ClaudeCliConfig, FetchLike, realSleep(), RETRY_AFTER_CAP_MS, RETRY_AFTER_FALLBACK_MS, retryAfterMs(), SleepLike (+31 more)

### Community 32 - "Parle Tutor Agent"
Cohesion: 0.19
Nodes (3): currentPrompt(), ParleTutor, rescueOnce()

### Community 33 - "Friends Local Store"
Cohesion: 0.09
Nodes (36): caches, defaultStore(), FriendsStore, isStore(), KEY(), listeners, loadStore(), loadStoreFor() (+28 more)

### Community 34 - "Mobile TypeScript Config"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, noEmit, noUncheckedIndexedAccess, strict, types, exclude, extends (+8 more)

### Community 35 - "Dependency Audit Manifest"
Cohesion: 0.05
Nodes (38): advisories, auditFailsAbove, note, reviewed, description, engines, node, name (+30 more)

### Community 36 - "First Run Disclosure"
Cohesion: 0.14
Nodes (22): FIRST_RUN_COPY, FIRST_RUN_SURFACES, FirstRunSurface, MEET_AI, MEET_MIC, MEET_MORE, MEET_PILL, MEET_PRIVACY (+14 more)

### Community 37 - "Mobile Dependencies"
Cohesion: 0.12
Nodes (17): dependencies, expo-crypto, expo-font, expo-speech, expo-status-bar, @parle/brain, react-native-svg, @react-navigation/bottom-tabs (+9 more)

### Community 38 - "Mobile Package Manifest"
Cohesion: 0.17
Nodes (11): devDependencies, @types/node, @types/react, typescript, @types/node, typescript, main, name (+3 more)

### Community 39 - "Learner Profile Updates"
Cohesion: 0.16
Nodes (25): applyExtractionToProfile(), applyTurnToProfile(), bandIndex(), coachedThisTurn(), EVIDENCE_WINDOW, FACT_KINDS, finishSession(), isRecord() (+17 more)

### Community 40 - "Topics Store"
Cohesion: 0.16
Nodes (26): userKey(), markDirty(), registerSyncAdopter(), adoptTopics(), KEY(), mergeSessionTopics(), persistedTopics(), readTopics() (+18 more)

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

### Community 46 - "Tutor Tab Gate"
Cohesion: 0.26
Nodes (8): st, TUTOR_INTRO_LINK, TUTOR_OFFLINE, TutorDoor, TutorDoorKey, tutorDoors(), tutorGate, TutorOfflineCopy

### Community 47 - "Mobile NPM Scripts"
Cohesion: 0.25
Nodes (8): scripts, android, export:web, ios, start, test, typecheck, web

### Community 49 - "Conversation Screen Tests"
Cohesion: 0.07
Nodes (60): DiskFaults, drill(), earlyExitBatch(), journalledSession(), NOW, ordinaryBatch(), phrase(), PRACTICE (+52 more)

### Community 50 - "Environment Preflight Probe"
Cohesion: 0.10
Nodes (29): CONVO_LINES, Brain, BRAIN_KEY, Env, FetchLike, missingRequired(), NEAR_MISS_KEYS, preflight() (+21 more)

### Community 51 - "Drill Store"
Cohesion: 0.10
Nodes (25): adoptDrillBank(), caches, defaultStore(), DrillStore, getMicSuppressedUntil(), hasGeneratedExercises(), isExercise(), isMicSuppressed() (+17 more)

### Community 52 - "Brain LLM Client Types"
Cohesion: 0.08
Nodes (38): MemoryExtraction, ScenarioFrame, TutorTurn, Curation, DrillBatch, DrillBatchSchema, ParsedResponse, ClaudeCliBrainClient (+30 more)

### Community 53 - "Practice Evidence Records"
Cohesion: 0.09
Nodes (20): Entry, EVIDENCE, EXTERNAL, FILES, flat(), LEDGER, NEVER_TRUE, outstandingBlockers() (+12 more)

### Community 54 - "Voice Lifecycle Checks"
Cohesion: 0.08
Nodes (61): Check, checkAgentSecret(), checkConcurrentStart(), checkDepartureClosesRoom(), checkExactlyOnceDebit(), checkHardStop(), checkInsecureUrlRefused(), checkJoinTokenExpiry() (+53 more)

### Community 57 - "Spaced Repetition Scheduler"
Cohesion: 0.21
Nodes (17): buildCardsFromSummary(), PhraseEvidence, AGAIN_RETRY_MS, applyGrade(), DEFAULT_EASE, DUE_CAP, dueCards(), earned() (+9 more)

### Community 58 - "Age Gate & Profile Upgrade"
Cohesion: 0.21
Nodes (11): ageConfirmedFromDob(), ageOn(), AgeStopCandidate, MIN_AGE, TODAY, storedGoal(), storedStop(), NOW (+3 more)

### Community 60 - "Account Deletion and Events"
Cohesion: 0.10
Nodes (29): adminHeaders(), deleteSupabaseUser(), signedInRecently(), agentDebitAllowed(), exactKeys(), insertProductEvent(), missionId(), nonNegativeCount() (+21 more)

### Community 61 - "Secret Scanner"
Cohesion: 0.11
Nodes (32): ALLOW_MARKER, BINARY_EXTENSIONS, BUNDLE_DIRECTORIES, bundleFiles(), Finding, formatFinding(), git(), isCodeReference() (+24 more)

### Community 62 - "Review Card View"
Cohesion: 0.13
Nodes (17): AttemptKind, CARD_START, CardAnswer, cardView, faces(), frenchSide(), hearable(), INTRODUCTION_TAG (+9 more)

### Community 63 - "Graphify Guard Script"
Cohesion: 0.29
Nodes (4): GRAPH, ROOT, ROUTING, SOURCE_EXTS

### Community 66 - "Zod Contract Schemas"
Cohesion: 0.08
Nodes (32): AssessmentZ, CefrBandZ, CoachItemZ, CoachKindZ, MemoryExtractionSchema, MemoryFactZ, NewPhraseZ, OptionZ (+24 more)

### Community 67 - "Upstash Live Checks"
Cohesion: 0.12
Nodes (25): RATE_LIMITS, UpstashSessionLeaseStore, blockedReport(), CheckResult, CheckStatus, expect(), freePort(), Instance (+17 more)

### Community 68 - "Conversation Screen UI"
Cohesion: 0.05
Nodes (60): ConvoScreen(), practiceBatch(), st, connectionLine, RECONNECTING, failureCopy, LiveErrorView(), show() (+52 more)

### Community 69 - "Profile Store and Context"
Cohesion: 0.17
Nodes (20): Ctx, ProfileGate(), ProfileValue, adoptProfile(), completeProfile(), confirmedFrom(), createStoredProfile(), KEY() (+12 more)

### Community 70 - "Gate Runner Script"
Cohesion: 0.08
Nodes (18): AGENT_MODELS, agentFiles, args, asJson, auditOnly, bless, counts, entries (+10 more)

### Community 71 - "Mastery Evidence Tracking"
Cohesion: 0.24
Nodes (18): holdFor(), addEvidence(), count(), EVIDENCE_STATES, evidenceOf(), EvidenceState, evidenceStateOf(), isDue() (+10 more)

### Community 72 - "Tutor Defect Ledger"
Cohesion: 0.01
Nodes (248): A1 — A spoken answer has to match the script exactly, A2 — An empty transcript is graded as a wrong answer, A3 — A freeze at the top rung still asks the learner to invent French, A4 — A rescue can skip the beat the learner froze on, A5 — Two different opening-rung formulas, A6 — A focus point vanishes when the worst sound has no drill, A7 — A v2 snapshot with no memory crashes the worker, B0 — ParleTutor cannot be tested at all (+240 more)

### Community 73 - "Agent Fleet Frontmatter"
Cohesion: 0.20
Nodes (11): AgentFrontmatter, agentProblems(), FRONTMATTER_FIELDS, frontmatterBlock(), parseAgentFrontmatter(), pinnedAgents(), READ_ONLY_AGENTS, routedAgents() (+3 more)

### Community 74 - "Evidence Ledger Contract"
Cohesion: 0.08
Nodes (28): classify(), evidence, EVIDENCE_PATH, evidenceFlat, FLOORS_PATH, ledger, LEDGER_PATH, LedgerEntry (+20 more)

### Community 75 - "Drill Chooser View"
Cohesion: 0.07
Nodes (63): trackProductEvent(), useLive(), loadDrillBank(), PhrasebookCard(), assertBankedExactlyOnce(), CHOOSER_HEADLINE, CHOOSER_SUB, ChooserCard (+55 more)

### Community 77 - "Rate Limit and Leases"
Cohesion: 0.07
Nodes (18): CONSUME_SCRIPT, Counter, createRateLimiter(), createSessionLeaseStore(), FetchLike, MemoryRateLimiter, MemorySessionLeaseStore, RateLimitDecision (+10 more)

### Community 79 - "Onboarding Age Gate"
Cohesion: 0.08
Nodes (36): REPORTED_BY_PAGE, UNION, OnboardCake(), AgeGateScreen(), st, AGE_CONFIRM, AGE_DENY, AGE_QUESTION (+28 more)

### Community 80 - "Repo Design Principles"
Cohesion: 0.10
Nodes (18): Read the exact versioned Expo docs before writing code, Absolute-beginner audience (CEFR A0-A2), Parle (working name), Expo + TypeScript npm-workspaces monorepo, Trustworthy pronunciation needs a reference text, The agent is authoritative over session state, The alignment thesis, A missing score is never an invented penalty (+10 more)

### Community 82 - "Database Contract Tests"
Cohesion: 0.08
Nodes (30): and3(), branchTaken(), claimOutcome(), CreatedObject, createdObjects(), debitFixMigration, effectiveBody(), effectiveClaimTrialBody() (+22 more)

### Community 83 - "Sync Retention Policy"
Cohesion: 0.07
Nodes (16): ACTIVITY_KEEP_DAYS, MAX_COMPLETIONS_PER_MISSION, MAX_HISTORY_SESSIONS, MAX_SOUND_CHECKS, SYNC_EXCLUSIONS, SYNC_POLICIES, adoptedNamespaces(), BASE (+8 more)

### Community 85 - "UI Component Primitives"
Cohesion: 0.06
Nodes (72): ArrowRight(), Card(), EarGlyph(), GhostButton(), HelpGlyph(), Label(), LineBullet(), MicGlyph() (+64 more)

### Community 86 - "Lesson Definitions"
Cohesion: 0.15
Nodes (23): Chrome is plain English, French only where it is content, CAFE_LESSON, BY_ID, getLesson(), LESSONS, AcceptanceMatch, AcceptanceRoute, candidatesFor() (+15 more)

### Community 87 - "Sound Check Store"
Cohesion: 0.29
Nodes (12): adoptSoundChecks(), isEvidence(), isKind(), KEY(), persisted(), read(), recordSoundCheck(), registerAdopter() (+4 more)

### Community 88 - "Pedagogy Doc"
Cohesion: 0.20
Nodes (9): One focus, one drill, The four rungs, The invariants, The pedagogy, The rescue, Two independent axes, What counts as a right answer, What counts as learned (+1 more)

### Community 89 - "Live Session Hook Tests"
Cohesion: 0.06
Nodes (33): ABANDON, asJs(), AsyncFunction, AUDIO_BLOCKS, deliver(), DISMISS, EVERY_FAILURE, fragment() (+25 more)

### Community 90 - "Live Voice Doc"
Cohesion: 0.25
Nodes (7): Audio, and what may be claimed about it, Serialisation, The four modes, The live path, The route, The wire, When it fails

### Community 91 - "Agent Loop Doc"
Cohesion: 0.29
Nodes (7): Giving it a goal, Running it, The agents, The bar, The loop, The other half: building something new, Verifying UI work

### Community 92 - "State & Storage Doc"
Cohesion: 0.17
Nodes (12): Attempt audio, and the one thing on the phone that is not a key, Banking a conversation, and when the journal is allowed to go, Device-level keys, and the one that retired, On the device, Server side, Sessions and progress, State and storage, The age stop, and exactly how strong it is (+4 more)

### Community 93 - "Testing Doc"
Cohesion: 0.29
Nodes (6): Never, Running, Testing, The rule that matters most, What is not covered, Writing

### Community 94 - "Bug Hunter Agent"
Cohesion: 0.33
Nodes (5): House style, How you work, Product invariants — a change that breaks one of these is a bug, however green, What counts as a finding, What you must never do

### Community 95 - "Playground Architecture Doc"
Cohesion: 0.40
Nodes (5): Architecture, Mock or live, No build step, Two paths, one ladder, Who owns what

### Community 96 - "Project Documentation Index"
Cohesion: 0.22
Nodes (3): Deletion and supersession ledger, Known issues — the goal file, docs

### Community 97 - "Conversation Engine Tests"
Cohesion: 0.06
Nodes (26): supportViewFor(), emptySpend(), MOMENT_GRACE_MS, openerFor(), parseStoredProfile(), SttLanguage, BEATLESS_FRAME, buildConvo() (+18 more)

### Community 100 - "React Context Providers"
Cohesion: 0.07
Nodes (36): Ctx, LiveValue, useProfile(), AuthContext, AuthStatus, useAuth(), build(), friends (+28 more)

### Community 101 - "Auth Mode & Installation"
Cohesion: 0.27
Nodes (7): auth, authHeaders(), build(), AuthMode, AuthModeEnvironment, selectAuthMode(), installationId()

### Community 102 - "Path Node Status Line"
Cohesion: 0.14
Nodes (16): PathNodeRow(), st, MOMENT_ANSWER_MS, momentAnswer(), statusLine(), offersTalkAgain(), seedTopicFor(), TALK_AGAIN (+8 more)

### Community 103 - "Sync Policy and Live Checks"
Cohesion: 0.07
Nodes (31): SyncEngine, createSyncPolicy(), dirtySettled(), anonKeyOf(), blockedReport(), CheckOutcome, CheckResult, Device (+23 more)

### Community 104 - "French Authenticity Pack"
Cohesion: 0.09
Nodes (31): FR_PACK, renderAuthenticityPack(), AuthenticityPack, ContrastPair, Filler, RegisterDef, SlangEntry, LearnerSnapshot (+23 more)

### Community 105 - "Deploy Engineer Agent"
Cohesion: 0.22
Nodes (8): How you work, Product invariants — a change that breaks one of these is wrong, however green, Ship the smallest real thing, Start by being honest about where this is, The order this has to happen in, What you must never do, When there is nothing to deploy to, say so, Your territory

### Community 106 - "Observability Engineer Agent"
Cohesion: 0.22
Nodes (8): How you work, Product invariants — a change that breaks one of these is wrong, however green, The line you do not cross, The seam to cut, when the time comes, What exists, and what does not, What you must never do, When there is no seam yet, say so, Your territory

### Community 107 - "Revenue Engineer Agent"
Cohesion: 0.20
Nodes (9): Copy about money is still learner copy, Handoff contract, How you work, Product invariants — a change that breaks one of these is wrong, however green, The rule enforcement lives at, What already exists, What you must never do, Where a purchase lands (+1 more)

### Community 108 - "Conversation Scene Controls"
Cohesion: 0.26
Nodes (10): hasSayableSupportLine(), ReplayLine, sceneControls, controls(), fullLine, hint, none, options (+2 more)

### Community 111 - "Coach Sample Fixtures"
Cohesion: 0.04
Nodes (97): sampleCoachItem(), sampleSupport(), sampleTurn(), Assessment, CoachItem, SpeakerLine, SupportMaterial, SupportView (+89 more)

### Community 112 - "Forge Command Doc"
Cohesion: 0.22
Nodes (9): /forge, Looping it, Not wired yet: the unattended loop, The contract, The gate watches the wiring too, Watch for judge drift, Who actually builds it, Why the judge's findings go in the ledger (+1 more)

### Community 113 - "Palette Contrast Checks"
Cohesion: 0.21
Nodes (10): ALL, CARRIED, channels(), contrast(), Lab, linear(), luminance(), ORB (+2 more)

### Community 115 - "Secure Session Storage"
Cohesion: 0.22
Nodes (10): chunkKey(), KeyValueStorage, metaKey(), parseMeta(), readSecure(), removeAllGenerations(), removeGeneration(), StoredMeta (+2 more)

### Community 116 - "User Scope Reset"
Cohesion: 0.18
Nodes (12): AttemptAudioSweepResult, sweepAttemptAudio(), ATTEMPT_AUDIO_NOT_SWEPT, ClearHooks, LEGACY_KEYS, onUserScopeReset(), resetHooks, RETIRED_DEVICE_KEYS (+4 more)

### Community 117 - "Profile Merge"
Cohesion: 0.19
Nodes (25): ANSWER_FIELD_SET, canonical(), compareEvidence(), compareStrings(), coreSlice(), DEVICE_FIELD_SET, finish(), finiteOr() (+17 more)

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

### Community 125 - "Team Ownership Doc"
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
Cohesion: 0.21
Nodes (18): addFromSummary(), addPhrases(), adoptDeck(), caches, CardGrade, foldConvoUses(), gradeCard(), gradeCards() (+10 more)

### Community 138 - "Android App Config"
Cohesion: 0.20
Nodes (10): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, package, permissions, predictiveBackGestureEnabled (+2 more)

### Community 139 - "Session Token Grants"
Cohesion: 0.20
Nodes (14): developmentEntitlementsEnabled(), GrantResult, grantSession(), ROOM_LIFECYCLE, roomNameFor(), SeedTopic, SessionGrant, SessionMode (+6 more)

### Community 140 - "Drill Screen UI"
Cohesion: 0.11
Nodes (22): setMicSuppressed(), AppropriateReplyView(), BestSentenceView(), DrillScreen(), ds, kindTag(), ListenTypeView(), sheet (+14 more)

### Community 141 - "Device & Accessibility Verification"
Cohesion: 0.12
Nodes (17): Android, Before you start, D15 — a keystore key invalidated by a lock-screen change, D16 — restored from an Android backup, Device verification — auth, session storage, deletion, and the first run, O1 — every first-run screen is reachable, O2 — the same at the largest text size, O3 — reduce motion (+9 more)

### Community 142 - "Sync Diagnostics"
Cohesion: 0.11
Nodes (26): ALARM_CODES, ALARM_STATUSES, counter(), createSyncDiagnostics(), elapsed(), record(), formatSyncDiagnostic(), isSyncAlarm() (+18 more)

### Community 143 - "Store Binding Tests"
Cohesion: 0.09
Nodes (12): landingOf(), localProfile, nextUid(), phraseKeysOnDisk(), profileAfterConvo, QUEUED_WRITES, QueuedWrite, recap (+4 more)

### Community 144 - "Agent Turn Timing"
Cohesion: 0.12
Nodes (19): TokenMeta, tutorLLM(), sttLanguageFor(), createTurnTiming(), formatTiming(), formatVendorMetrics(), mark(), SEGMENTS (+11 more)

### Community 145 - "Namespace Merge Policy"
Cohesion: 0.12
Nodes (16): ACTIVITY_KINDS, ActivityEntryish, isSeen(), mergeProfile(), mergeReview(), mergeTutorIntro(), MissionCompletionish, NamespacePolicy (+8 more)

### Community 146 - "Server User Resolver"
Cohesion: 0.25
Nodes (5): createUserResolver(), ResolvedUser, SIGN_IN_REQUIRED, UserResolver, VerifierConfig

### Community 147 - "Dependency Lockfile Contract"
Cohesion: 0.14
Nodes (13): accepted, AdvisoryDecision, dependencyClosure(), fixed, lock, LockEntry, Lockfile, manifest (+5 more)

### Community 148 - "Export and History Reports"
Cohesion: 0.25
Nodes (13): buildEntries(), csvField(), ExportEntry, toAnkiTsv(), toCsv(), buildReport(), buildTrends(), mean() (+5 more)

### Community 149 - "XP and Levels"
Cohesion: 0.24
Nodes (18): clamp(), ConversationEvidence, conversationXp(), DAILY_XP_CAP, DatedXp, DrillEvidence, drillXp(), LessonEvidence (+10 more)

### Community 150 - "Land Command Doc"
Cohesion: 0.25
Nodes (7): 1. Who else is in this tree, 2. Where you are standing, 3. The gate, 4. The shape of the branch, 5. Deciding, 6. Landing, 7. Say what happened

### Community 151 - "Privacy and Safety Docs"
Cohesion: 0.11
Nodes (18): An under-13 stop is remembered on this device, Analytics: consent, opt-out and retention, Antifraud identifiers: purpose, retention and disclosure, Deletion and export, Disclosure at first run, Escalation and what Parle is not, Known limits of a deterministic net, Not true yet (+10 more)

### Community 152 - "Fake Brain Test Doubles"
Cohesion: 0.11
Nodes (6): DeadBrain, HeldAnalystBrain, HeldFrameBrain, MeteredBrain, SlowBrain, SlowFrameBrain

### Community 153 - "Motion Usage Tests"
Cohesion: 0.33
Nodes (3): FILES, SRC, stripComments()

### Community 154 - "Ledger Entry Tests"
Cohesion: 0.29
Nodes (5): GROUNDS, HERE, LEDGER, REPO, RULE_TEST

### Community 155 - "Implementation Evidence Doc"
Cohesion: 0.13
Nodes (14): Applying the schema to whatever project ships, Credential state, measured 2026-08-25, Current focused verification, Current landing snapshot, Failed-room billing: the P0 the phase found, then closed, Feature matrix, Found and fixed during Phase 1, Historical Phase 1 baseline (+6 more)

### Community 156 - "Retired Label Tests"
Cohesion: 0.40
Nodes (5): KEPT, labelsInSource(), RETIRED, sourceFiles(), SRC

### Community 157 - "Onboarding Doc"
Cohesion: 0.29
Nodes (7): Onboarding — everything before the first French word, The files, The shape now, What changed, and why each one, What is measured here, and what is not, What it looked like before, Who never sees any of this

### Community 159 - "Merge Helper Utilities"
Cohesion: 0.25
Nodes (18): arrayOf(), compareExercises(), compareText(), envelopeOf(), exerciseIdentity(), firstDiscussed(), joinTopics(), laterOf() (+10 more)

### Community 160 - "Token Logging Hygiene"
Cohesion: 0.22
Nodes (8): authSources(), callArguments(), loggingCalls(), PLAINTEXT_WRITERS, REPO_ROOT, Source, sources, withoutComments()

### Community 161 - "Fresh Device Adoption"
Cohesion: 0.17
Nodes (11): adoptBeforeReady(), adoptedAnything(), FAILED, FRESH_DEVICE_BUDGET_MS, FreshStart, FreshStartKind, FreshStartOptions, settled() (+3 more)

### Community 162 - "Mission Completion Store"
Cohesion: 0.20
Nodes (15): source, adoptMissionCompletions(), COMPLETIONS_PER_MISSION, isCompletion(), KEY(), MissionCompletion, persistedCompletions(), readCompletions() (+7 more)

### Community 163 - "Thinking and Session Reporting"
Cohesion: 0.10
Nodes (17): thinkingAfter(), ServerMessage, TEXT_SILENCE_MS, forgetReportedSessions(), noteSessionReported(), Publisher, REPLAYED_SESSION_MESSAGE, reportedSessions (+9 more)

### Community 164 - "Tutor Brain Doc"
Cohesion: 0.33
Nodes (5): Acceptance checks, Cost envelope, Product contract, Provider decision, The free-form tutor brain

### Community 165 - "Review Deck Merge"
Cohesion: 0.30
Nodes (13): canonical(), CARD_KINDS, counted(), countersOf(), deckOf(), gradesApplied(), higherCounts(), isFiniteNumber() (+5 more)

### Community 167 - "Expo Plugins & File Saving"
Cohesion: 0.22
Nodes (7): plugins, expo-audio, expo-font, expo-secure-store, expo-sharing, expo-web-browser, @livekit/react-native-expo-plugin

### Community 169 - "Review Engine Tests"
Cohesion: 0.09
Nodes (31): Card, deckPolicy, engineFor(), FakeRow, FoldCall, foldingStore(), keyFor(), manualScheduler() (+23 more)

### Community 170 - "HTTP Security & CORS"
Cohesion: 0.39
Nodes (7): applyHttpSecurity(), createOriginPolicy(), DEVELOPMENT_ORIGINS, originAllowed(), OriginPolicy, parseAllowedOrigins(), requestOrigin()

### Community 171 - "Token Server URL Selection"
Cohesion: 0.38
Nodes (4): selectTokenServerUrl(), SRC, TOKEN_SERVER, TokenServerEnvironment

### Community 172 - "Supabase Runbook"
Cohesion: 0.25
Nodes (7): Apply, Backup, Restore, Rollback, Rollback evidence, Supabase runbook, When something goes wrong

### Community 173 - "Retry Backoff Policy"
Cohesion: 0.16
Nodes (7): Backoff, BACKOFF_BASE_MS, BACKOFF_CAP_MS, backoffCeiling(), backoffDelay(), BackoffOptions, createBackoff()

### Community 174 - "Session and Attempt Scoring"
Cohesion: 0.10
Nodes (35): LiveSession, SessionViewProps, AttemptScore, LadderDirective, LessonTurn, PhonemeObservation, SessionPhonemeReport, createSession() (+27 more)

### Community 175 - "Supabase Test Fakes"
Cohesion: 0.14
Nodes (11): blockedReport(), expect(), main(), newEmail(), newPassword(), PostgrestFilter, PostgrestTable, runSupabaseVerification() (+3 more)

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
Cohesion: 0.33
Nodes (5): Abandoned rooms: a risk this register overstated, Failed-room billing: a control this register claimed, lost, and rebuilt, Phase 4 practice: one risk closed, three accepted, one question left open, Risk register, Trial farming: theoretical no longer

### Community 180 - "Repository Archaeologist Agent"
Cohesion: 0.50
Nodes (3): Boundaries and escalation, Handoff contract, Output

### Community 192 - "App Surface Contract"
Cohesion: 0.20
Nodes (8): APP, APP_ENTRY, EVERYTHING, FIRST_RUN, openingTag(), SOURCES, stripComments(), tags()

### Community 203 - "Profile Merge Tests"
Cohesion: 0.13
Nodes (15): MergedStoredProfile, PROFILE_ANSWER_FIELDS, ProfileMergeDeps, brain(), deps, GOALS, ISO, merge() (+7 more)

### Community 204 - "Safety Category Taxonomy"
Cohesion: 0.06
Nodes (32): AGE_STANDS_ALONE, APPROACH_DIRECT, APPROACH_REQUEST, DANGEROUS, DANGEROUS_OBJECT, DEPENDENCY, GUARDIAN_SECRECY, HATE_ATROCITY (+24 more)

### Community 205 - "Mock Auth Adapter"
Cohesion: 0.25
Nodes (9): createMockAdapter(), notify(), setSession(), emptyStore(), MockAccount, MockStore, readStore(), toUser() (+1 more)

### Community 206 - "Tutor Evaluation Cases"
Cohesion: 0.21
Nodes (15): CoachKind, applyNonSpokenInput(), defaultModel(), EVAL_CASES, EvalCase, EvalExpectation, CaseResult, expectationMisses() (+7 more)

### Community 209 - "Phrasebook and Mix"
Cohesion: 0.15
Nodes (18): card(), days(), NOW, topic(), MIX_OFFER, offersMix(), sittingTitle(), CAFE (+10 more)

### Community 211 - "Delivery Roadmap"
Cohesion: 0.33
Nodes (5): Delivery roadmap, Phase 4 execution order, and what was built against it, Phase 5: what the exit criterion means, and where it stands, Phase boundary: Phase 3 landed, Phase 4 branched from it, then Phase 4 landed too, What Phase 4 did not verify

### Community 213 - "Live Failure Classification"
Cohesion: 0.13
Nodes (19): AUDIO_ONLY, classifyFailure(), classifyPipelineError(), COPY, KIND_FAILURE, KIND_NOTICE, PIPELINE_ALARM_PREFIX, PIPELINE_LOG_PREFIX (+11 more)

### Community 214 - "Anthropic Brain Client"
Cohesion: 0.38
Nodes (5): AnthropicBrainClient, outputConfig(), parse(), toProviderMessages(), usageOf()

### Community 215 - "Session Progress History"
Cohesion: 0.23
Nodes (15): asRung(), LessonRoute(), adoptHistory(), isSession(), KEY(), lastSummaryFor(), loadHistory(), persistedHistory() (+7 more)

### Community 216 - "Drill Exercise Merge"
Cohesion: 0.36
Nodes (3): MAX_DRILL_EXERCISES, mergeExerciseBank(), DrillExercise

### Community 217 - "Drill Fixtures and Validation"
Cohesion: 0.13
Nodes (20): check(), checkDrill(), DRILL_FIXTURES, DRILL_STAGES, GOOD_FEEDBACK, DrillDifficulty, checkAccepted(), checkDistinct() (+12 more)

### Community 219 - "Session Turns and Views"
Cohesion: 0.14
Nodes (21): OPENING_TAGS, opensSession(), tagsFor(), MAX_TURNS, pushTurn(), TurnLine, switchWorld(), ANYTHING_GOES (+13 more)

### Community 220 - "Today Activity Row"
Cohesion: 0.23
Nodes (8): st, TodayRow(), ActivityEntry, hasToday(), NOTHING, SITTINGS_IN_A_DAY, NOON, Today

### Community 221 - "Drill Exercise Types"
Cohesion: 0.17
Nodes (18): typed(), withOptions(), AppropriateReplyExercise, BestSentenceExercise, DrillExerciseBase, FillBlankExercise, ListenTypeExercise, RepeatThisExercise (+10 more)

### Community 225 - "Review Merge Tests"
Cohesion: 0.28
Nodes (5): card(), countsFor(), randomDeck(), reviewed(), withCounters()

### Community 226 - "Tutor Strictness Setting"
Cohesion: 0.17
Nodes (14): COPY, DEFAULT_STRICTNESS, Strictness, STRICTNESS_OPTIONS, STRICTNESS_ORDER, STRICTNESS_ROW, STRICTNESS_SUB, STRICTNESS_TITLE (+6 more)

### Community 227 - "App Root Wiring"
Cohesion: 0.14
Nodes (15): App(), Gate(), SignedInRoot(), st, startAccountSync(), LiveProvider(), AuthFlow(), AuthProvider() (+7 more)

### Community 228 - "Live Session Hook"
Cohesion: 0.16
Nodes (15): LiveFailure, micApiUnavailable(), ensureAudioSession(), ensureLiveKitGlobals(), releaseAudioSession(), afterDismiss(), abandonSession(), CONNECT_TIMEOUTS (+7 more)

### Community 229 - "Delivery Roadmap Tests"
Cohesion: 0.12
Nodes (12): CHOOSING_VIEW_PATH, choosingView, criteriaFor(), KNOWN_ISSUES_PATH, MOBILE_SRC, NUMBER_WORDS, PhaseRow, phaseRows() (+4 more)

### Community 230 - "Auth & Deletion Device Checks"
Cohesion: 0.12
Nodes (16): D0 — the build is on the Supabase adapter, D10 — deletion demands a recent Google reauthentication, D11 — a failed local wipe is reported honestly, D12 — no bearer token in logs, in AsyncStorage, or in the bundle, D13 — two accounts on one device never see each other's learning, D14 — the installation signal survives deletion, D1 — a session survives backgrounding, cold start and reboot, D2 — the session is in the keychain, not in plaintext storage (+8 more)

### Community 231 - "Microphone Sound Check"
Cohesion: 0.23
Nodes (12): ProductEvent, nextSoundCheckReference(), SELF_GUIDED, soundCheckDecision, SoundCheckEvidence, SoundCheckKind, emptyReport, sheet (+4 more)

### Community 232 - "Safety Category Rules"
Cohesion: 0.14
Nodes (14): MinorSexualRule, OutputRule, SAFETY_CATEGORIES, SafetyCategory, CategoryCorpus, CORPUS, everyLine(), FALSE_POSITIVES (+6 more)

### Community 233 - "Drill Screen Tests"
Cohesion: 0.19
Nodes (9): asTheScreenSends(), card(), installDisk(), nextUid(), NOW, withDeck(), applyDrillResults(), DrillSessionState (+1 more)

### Community 234 - "Drill Session Building"
Cohesion: 0.23
Nodes (8): buildDrillSession(), pickForStage(), stageForReps(), stageOf(), blocked(), listenEx(), optionsEx(), spokenEx()

### Community 235 - "Session View Typing Ping"
Cohesion: 0.25
Nodes (5): convo, screen, view, shouldPingTyping(), TYPING_PING_MS

### Community 236 - "Brain Client Interface"
Cohesion: 0.33
Nodes (3): ConversationState, postSessionDeadlineMs(), withDeadline()

### Community 237 - "Typed Door Failure Tests"
Cohesion: 0.20
Nodes (5): convo, errorView, EVERY_FAILURE, hook, lesson

### Community 238 - "Storage Doc Tests"
Cohesion: 0.22
Nodes (4): AGENT, CONVO, DOC, REPO

### Community 239 - "Brain Spend Metering"
Cohesion: 0.28
Nodes (7): ClientMessage, DEBIT_HOSTS, FULL_TURNS, runSession(), SHORT_TURNS, stubSession(), tapped()

### Community 240 - "Topic Merging & Staggering"
Cohesion: 0.42
Nodes (6): MAX_DISCUSSED_DATES, MAX_STORED_TOPICS, mergeTopics(), STAGGER_DUE_NOW, staggerNewCards(), topicId()

### Community 241 - "Stored Shape Type Guards"
Cohesion: 0.36
Nodes (8): isActivityEntry(), isCompletion(), isExercise(), isFiniteNumber(), isRecord(), isSession(), isSoundCheck(), isTopic()

### Community 242 - "Playground Commands"
Cohesion: 0.40
Nodes (4): Command, COMMAND_HELP, parseCommand(), STRICTNESS_LEVELS

### Community 243 - "Tutor Agent Prompt"
Cohesion: 0.90
Nodes (3): baseInstructions(), buildPrompt(), turnInstructions()

### Community 244 - "Safety Decision Guard"
Cohesion: 0.25
Nodes (8): forms(), has(), loosen(), minorSexualRulesFor(), MinorSexualSignals, normalise(), outputGuard(), safetyDecision

## Knowledge Gaps
- **1589 isolated node(s):** `CurationCheckId`, `CurationProblem`, `CurationScore`, `CurationSummary`, `Environment` (+1584 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **49 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `plugins` connect `Expo Plugins & File Saving` to `Expo App Config`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Why does `expo` connect `Expo App Config` to `Android App Config`, `Expo Plugins & File Saving`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Why does `react` connect `Auth Screens` to `Tab Bar Icons`, `Mobile TypeScript Config`, `App Root Wiring`, `React Context Providers`, `Profile Store and Context`, `Conversation Screen UI`, `Live Session Hook`, `First Run Disclosure`, `Microphone Sound Check`, `Path Node Status Line`, `Drill Chooser View`, `Drill Screen UI`, `Tutor Tab Gate`, `Onboarding Age Gate`, `Illustration Scenes`, `UI Component Primitives`, `Mock Speech Session Screen`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **What connects `CurationCheckId`, `CurationProblem`, `CurationScore` to the rest of the system?**
  _1589 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Entitlement Store` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._
- **Should `Topic Curation` be split into smaller, more focused modules?**
  _Cohesion score 0.05711263881544157 - nodes in this community are weakly interconnected._
- **Should `Pronunciation Drill Bank` be split into smaller, more focused modules?**
  _Cohesion score 0.13472706155632985 - nodes in this community are weakly interconnected._