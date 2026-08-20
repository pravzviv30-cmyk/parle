# Graph Report - Parle  (2026-08-20)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 2199 nodes · 5328 edges · 141 communities (109 shown, 32 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 73 edges (avg confidence: 0.83)
- Token cost: 106,923 input · 1,991 output

## Graph Freshness
- Built from commit: `1596d7e5`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- French Authenticity Pack
- Drill Session Flow
- Session Cost Metering
- Drill Bank and Design Tokens
- Drill Exercise Screens
- Drill Types and Grading
- Client Agent Wire Protocol
- Playground Chat Commands
- Expo App Config
- App Root and Profile Gate
- Tutor Agent Dependencies
- Drill Generation Prompt
- Dev Launcher Script
- Autonomous Build Loop
- Tutor Copy Rules
- Mock Auth Adapter
- Drill Fixtures and Stores
- Utterance Audio Capture
- Live Failure Handling
- Conversation Ladder and Copy Rules
- Sign In and Password Screens
- Brain Package Manifest
- Token Server Manifest
- Brain Playground Manifest
- Lesson Session Grading
- Onboarding Welcome Screens
- Conversation Orchestrator
- Anthropic and Claude CLI Providers
- Core Package Exports
- Lesson Content Model
- Base TypeScript Config
- Alternate Brain Clients
- LiveKit Tutor Agent
- Friends Store Adapter
- Mobile TypeScript Config
- Root Package Scripts
- Learner Profile Model
- Mobile Dependencies
- Mobile Package Manifest
- Auth Context and Friends UI
- Mock Speech Session Screen
- Brain TypeScript Config
- Core TypeScript Config
- Playground TypeScript Config
- Token Server TypeScript Config
- Tutor Agent TypeScript Config
- Live Session Navigation Context
- Mobile NPM Scripts
- Native Audio Session Globals
- Drill Answer Grading
- Agent Preflight Checks
- Drill Local Store
- Brain Client Contracts
- Entitlement Store
- Expo Linking Dependency
- Metro Runtime Dependency
- Expo Sharing Dependency
- Expo Speech Dependency
- Expo Status Bar Dependency
- Expo Web Browser Dependency
- Tab Bar Icons
- LiveKit Expo Plugin
- Core Package Dependency
- Graphify Guard Hook
- React Native Dependency
- Async Storage Dependency
- Zod Contract Schemas
- React Native SVG Dependency
- XP and Levels
- Expo Audio Dependency
- Gate Runner Script
- Memory Curation
- Known Issues Ledger
- Agent Fleet Metadata
- Supabase Auth Adapter
- Phoneme Scoring Bridge
- Auth Adapter Interface
- Scenario Prompt and Grading
- LiveKit WebRTC Dependency
- Memory Extraction Prompt
- React DOM Dependency
- React Native Screens Dependency
- Bottom Tabs Navigation
- React Navigation Core
- Supabase Client Dependency
- Shared UI Components
- Token Server Endpoints
- Android App Config
- Pedagogy Ladder Doc
- Conversation and Recap Screens
- Live Voice Doc
- Loop and Forge Doc
- State and Storage Doc
- Testing Doc
- Bug Hunter Agent Spec
- Project Architecture Overview
- Project Documentation Index
- Conversation Test Doubles
- Fix Verifier Agent Spec
- Conversation State and Recap
- Anthropic Brain Client
- Drill Batch Validation
- Expo Native Plugins
- LiveKit Token Minting
- Deploy Engineer Agent
- Observability Engineer Agent
- Revenue Engineer Agent
- Prompt and Turn Queue
- LiveKit React Native SDK
- Safe Area Context Dependency
- iOS App Config
- Forge Workflow Doc
- Server User Resolver
- Mobile Copy Tests
- Expo Font Dependency
- Playground Eval Harness
- Device Voice Playback
- API Engineer Agent
- Performance Engineer Agent
- Security Engineer Agent
- Auth Engineer Agent
- Backend Engineer Agent
- Data Engineer Agent
- Frontend Engineer Agent Spec
- Agent Team Roster
- Design Architect Agent Spec
- Scaling Engineer Agent Spec
- TTS Cache
- Release Engineer Agent Spec
- Work Judge Agent Spec
- TTS Cache Tests
- Pre-commit Git Hook
- Pre-push Git Hook
- Git Hook Installer
- Voice Cache Warming
- Cached Audio Stream
- LiveKit Client Dependency

## God Nodes (most connected - your core abstractions)
1. `space()` - 69 edges
2. `ParleConversation` - 39 edges
3. `LlmUsage` - 39 edges
4. `paper` - 38 edges
5. `Format` - 33 edges
6. `type` - 31 edges
7. `MockLlmClient` - 26 edges
8. `LlmClient` - 25 edges
9. `ParleTutor` - 24 edges
10. `ScenarioFrame` - 24 edges

## Surprising Connections (you probably didn't know these)
- `Chrome is plain English, French only where it is content` --rationale_for--> `CAFE_LESSON`  [INFERRED]
  DESIGN.md → packages/core/src/lessons/cafe.ts
- `Words-right and sounds-right are separate questions` --rationale_for--> `TurnFeedback`  [INFERRED]
  PRODUCT.md → packages/core/src/session/session.ts
- `Words-right and sounds-right are separate questions` --rationale_for--> `grade()`  [INFERRED]
  PRODUCT.md → packages/core/src/session/session.ts
- `A missing score is never an invented penalty` --rationale_for--> `grade()`  [INFERRED]
  README.md → packages/core/src/session/session.ts
- `Drill mode and the recognition-to-production ramp` --conceptually_related_to--> `bestDrillFor()`  [INFERRED]
  README.md → packages/core/src/phonemes/drills.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **The four-rung scaffolding system, from principle to pixel** — product_scaffolding_ladder, product_never_stranded_never_scolded, design_support_colours_cool, packages_core_src_ladder_ladder_applyturn, apps_mobile_src_theme_rungcolor, readme_agent_authoritative [INFERRED 0.85]
- **The trustworthy-pronunciation chain** — product_trustworthy_pronunciation, product_french_only_depth, product_say_one_thing, readme_missing_score_no_penalty, packages_core_src_phonemes_inventory_french_phonemes, packages_core_src_phonemes_drills_drills, packages_core_src_phonemes_scoring_buildreport, services_shared_speechace_scoreutterance [INFERRED 0.85]
- **Unit economics and metering enforcement** — product_metered_minutes, product_cascaded_voice_pipeline, readme_metering_at_token_issuance, readme_tts_warm_cache, readme_risk_cost_per_session, packages_core_src_metering_meter_plans, packages_core_src_metering_meter_estimatesessioncost [INFERRED 0.85]

## Communities (141 total, 32 thin omitted)

### Community 0 - "French Authenticity Pack"
Cohesion: 0.22
Nodes (12): FR_PACK, renderAuthenticityPack(), AuthenticityPack, ContrastPair, Filler, RegisterDef, SlangEntry, historyViewOfTurn() (+4 more)

### Community 1 - "Drill Session Flow"
Cohesion: 0.12
Nodes (25): DrillScreen(), verdictColor(), check(), checkDrill(), answerCurrent(), AnsweredExercise, applyDrillResults(), buildDrillSession() (+17 more)

### Community 2 - "Session Cost Metering"
Cohesion: 0.16
Nodes (23): canStartSession(), CostModel, DEFAULT_COST_MODEL, estimateSessionCost(), Margin, MIN_VIABLE_SESSION_SEC, planMargin(), PLANS (+15 more)

### Community 3 - "Drill Bank and Design Tokens"
Cohesion: 0.07
Nodes (59): Read the exact versioned Expo docs before writing code, Paper colour token set, Paper & Ink design world, bestDrillFor(), BY_ID, Drill, DrillKind, DRILLS (+51 more)

### Community 4 - "Drill Exercise Screens"
Cohesion: 0.21
Nodes (16): fitDisplay(), ConvoScreen(), AppropriateReplyView(), BestSentenceView(), ds, FillBlankView(), kindTag(), ListenTypeView() (+8 more)

### Community 5 - "Drill Types and Grading"
Cohesion: 0.16
Nodes (21): DrillVerdict, typed(), withOptions(), DrillFeedback, AppropriateReplyExercise, BestSentenceExercise, DrillDifficulty, DrillExerciseBase (+13 more)

### Community 6 - "Client Agent Wire Protocol"
Cohesion: 0.12
Nodes (26): LiveSession, CLIENT_TAGS, ClientMessage, ConvoCoachItem, ConvoPhrase, ConvoSpeakerLine, ConvoSupportView, ConvoView (+18 more)

### Community 7 - "Playground Chat Commands"
Cohesion: 0.15
Nodes (31): SessionRecap, main(), pickClient(), Command, COMMAND_HELP, parseCommand(), STRICTNESS_LEVELS, resetProfile() (+23 more)

### Community 8 - "Expo App Config"
Cohesion: 0.13
Nodes (14): expo, icon, name, newArchEnabled, orientation, scheme, slug, splash (+6 more)

### Community 9 - "App Root and Profile Gate"
Cohesion: 0.09
Nodes (30): App(), Gate(), SignedInRoot(), st, Ctx, ProfileGate(), ProfileValue, AuthFlow() (+22 more)

### Community 10 - "Tutor Agent Dependencies"
Cohesion: 0.05
Nodes (37): @livekit/agents, @livekit/agents-plugin-anthropic, @livekit/agents-plugin-deepgram, @livekit/agents-plugin-elevenlabs, @livekit/agents-plugin-openai, @livekit/agents-plugin-silero, dependencies, dotenv (+29 more)

### Community 11 - "Drill Generation Prompt"
Cohesion: 0.09
Nodes (23): AppropriateReplyZ, BASE, BestSentenceZ, buildDrillGenerationRequest(), DrillBatchSchema, DrillGenerationInput, FillBlankZ, GeneratedExerciseZ (+15 more)

### Community 12 - "Dev Launcher Script"
Cohesion: 0.09
Nodes (36): AGENT_ENV_FILE, children, COLOURS, die(), hasClaudeCli(), launch(), main(), probe() (+28 more)

### Community 13 - "Autonomous Build Loop"
Cohesion: 0.07
Nodes (18): ALLOWED_TOOLS, argv, BRANCH, branchNow, current, deadEnds, DRY_RUN, final (+10 more)

### Community 14 - "Tutor Copy Rules"
Cohesion: 0.09
Nodes (35): CoachKind, coachFallbackLine(), CopyRule, copyViolations(), EM_DASH_RE, FILLER_RE, outsideQuotes(), RECOVERY_LINE (+27 more)

### Community 15 - "Mock Auth Adapter"
Cohesion: 0.21
Nodes (11): auth, build(), createMockAdapter(), notify(), setSession(), emptyStore(), MockAccount, MockStore (+3 more)

### Community 16 - "Drill Fixtures and Stores"
Cohesion: 0.24
Nodes (6): DrillStore, DRILL_FIXTURES, DrillSessionState, DrillExercise, NOW, OPTS

### Community 17 - "Utterance Audio Capture"
Cohesion: 0.17
Nodes (10): audioScoringEnabled(), CapturedUtterance, observeEvents(), observeFrames(), feed(), frame(), UtteranceTap, decodeWav() (+2 more)

### Community 18 - "Live Failure Handling"
Cohesion: 0.13
Nodes (22): authHeaders(), scoreAttempt(), classifyFailure(), COPY, failureCopy, LiveFailure, micApiUnavailable(), TokenServerError (+14 more)

### Community 19 - "Conversation Ladder and Copy Rules"
Cohesion: 0.10
Nodes (39): Chrome is plain English, French only where it is content, No number and no scolding mid-session, SpeakerLine, SupportView, BASE_RUNG_BY_CEFR, MAX_ATTEMPTS_PER_BEAT, MAX_SESSION_TOPICS, openingRungFor() (+31 more)

### Community 20 - "Sign In and Password Screens"
Cohesion: 0.19
Nodes (17): AuthScreen, SetNewPasswordScreen(), st, SignInScreen(), st, SignUpScreen(), st, looksLikeEmail() (+9 more)

### Community 21 - "Brain Package Manifest"
Cohesion: 0.08
Nodes (24): @anthropic-ai/sdk, dependencies, @anthropic-ai/sdk, @parle/core, zod, description, devDependencies, @types/node (+16 more)

### Community 22 - "Token Server Manifest"
Cohesion: 0.08
Nodes (24): jose, livekit-server-sdk, dependencies, dotenv, jose, livekit-server-sdk, @parle/core, devDependencies (+16 more)

### Community 23 - "Brain Playground Manifest"
Cohesion: 0.08
Nodes (24): dependencies, dotenv, @parle/brain, @parle/core, description, devDependencies, @types/node, typescript (+16 more)

### Community 24 - "Lesson Session Grading"
Cohesion: 0.12
Nodes (28): SessionViewProps, CAFE_LESSON, LessonTurn, PhonemeObservation, SessionPhonemeReport, createSession(), feedbackMessage(), grade() (+20 more)

### Community 25 - "Onboarding Welcome Screens"
Cohesion: 0.09
Nodes (29): st, WelcomeScreen(), ProgressDots(), TabBar(), HeroCafe(), LearnStack(), OnboardCake(), OnboardClock() (+21 more)

### Community 26 - "Conversation Orchestrator"
Cohesion: 0.16
Nodes (6): LearnerTurnInput, supportViewFor(), ParleConversation, sttLanguageFor(), toConvoView(), toRecapPayload()

### Community 27 - "Anthropic and Claude CLI Providers"
Cohesion: 0.08
Nodes (27): AnthropicBrainConfig, parse(), ParseCapableSdk, ParsedResponse, toProviderMessages(), usageOf(), ClaudeCliConfig, ClaudeCliRun (+19 more)

### Community 28 - "Core Package Exports"
Cohesion: 0.10
Nodes (19): devDependencies, @types/node, typescript, exports, ./ladder, ./lessons, ./metering, ./phonemes (+11 more)

### Community 29 - "Lesson Content Model"
Cohesion: 0.21
Nodes (17): BY_ID, getLesson(), LESSONS, AcceptanceMatch, AcceptanceRoute, candidatesFor(), CefrLevel, contentHits() (+9 more)

### Community 30 - "Base TypeScript Config"
Cohesion: 0.10
Nodes (19): DOM, ES2023, compilerOptions, allowImportingTsExtensions, esModuleInterop, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, isolatedModules (+11 more)

### Community 31 - "Alternate Brain Clients"
Cohesion: 0.27
Nodes (4): ClaudeCliBrainClient, LlmUsage, jsonSchemaText(), OpenAiCompatBrainClient

### Community 32 - "LiveKit Tutor Agent"
Cohesion: 0.25
Nodes (3): Lesson, currentPrompt(), ParleTutor

### Community 33 - "Friends Store Adapter"
Cohesion: 0.09
Nodes (37): build(), createLocalAdapter(), defaultStore(), FriendsStore, isStore(), KEY(), listeners, loadStore() (+29 more)

### Community 34 - "Mobile TypeScript Config"
Cohesion: 0.13
Nodes (14): compilerOptions, allowImportingTsExtensions, noEmit, noUncheckedIndexedAccess, strict, exclude, extends, include (+6 more)

### Community 35 - "Root Package Scripts"
Cohesion: 0.09
Nodes (21): description, engines, node, name, private, scripts, dev, gate (+13 more)

### Community 36 - "Learner Profile Model"
Cohesion: 0.10
Nodes (32): normalizeErrorTag(), applyExtractionToProfile(), applyTurnToProfile(), bandIndex(), createProfile(), evictOverflowPhrases(), evictStalePatterns(), EVIDENCE_WINDOW (+24 more)

### Community 37 - "Mobile Dependencies"
Cohesion: 0.13
Nodes (15): dependencies, expo, expo-crypto, expo-file-system, @parle/brain, react, react-native-web, @react-navigation/native-stack (+7 more)

### Community 38 - "Mobile Package Manifest"
Cohesion: 0.20
Nodes (9): devDependencies, @types/react, typescript, typescript, main, name, private, version (+1 more)

### Community 39 - "Auth Context and Friends UI"
Cohesion: 0.11
Nodes (27): useProfile(), AuthContext, AuthProvider(), AuthStatus, useAuth(), friends, AddFriendsScreen(), Hit (+19 more)

### Community 40 - "Mock Speech Session Screen"
Cohesion: 0.29
Nodes (9): ANGLOPHONE_WEAKNESS, CARRIER, carrierWord(), estimateDurationSec(), jitter(), LearnerProfile, mockObservations(), Phase (+1 more)

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

### Community 46 - "Live Session Navigation Context"
Cohesion: 0.08
Nodes (41): Ctx, LiveProvider(), LiveValue, useLive(), Stat(), loadDrillBank(), LiveSessionScreen(), asRung() (+33 more)

### Community 47 - "Mobile NPM Scripts"
Cohesion: 0.29
Nodes (7): scripts, android, ios, start, test, typecheck, web

### Community 49 - "Drill Answer Grading"
Cohesion: 0.36
Nodes (9): acceptedFor(), gradeAnswer(), gradeFreeText(), GradeResult, realWordSet(), damerauLevenshtein(), sameWord(), TYPO_MAX_DISTANCE (+1 more)

### Community 50 - "Agent Preflight Checks"
Cohesion: 0.14
Nodes (21): TokenMeta, tutorLLM(), Brain, BRAIN_KEY, Env, FetchLike, missingRequired(), preflight() (+13 more)

### Community 51 - "Drill Local Store"
Cohesion: 0.27
Nodes (14): defaultStore(), getMicSuppressedUntil(), hasGeneratedExercises(), isMicSuppressed(), isStore(), KEY(), loadStore(), mergeExercises() (+6 more)

### Community 52 - "Brain Client Contracts"
Cohesion: 0.13
Nodes (21): MemoryExtraction, ScenarioFrame, TutorTurn, Curation, DrillBatch, BrainCurateRequest, BrainDrillsRequest, BrainExtractRequest (+13 more)

### Community 53 - "Entitlement Store"
Cohesion: 0.23
Nodes (6): Entitlement, Plan, rollPeriod(), EntitlementStore, FileEntitlementStore, InMemoryEntitlementStore

### Community 60 - "Tab Bar Icons"
Cohesion: 0.05
Nodes (67): HomeIcon(), LeaderboardIcon(), PracticeIcon(), ProfileIcon(), TabIconProps, TutorIcon(), ICONS, LABELS (+59 more)

### Community 63 - "Graphify Guard Hook"
Cohesion: 0.29
Nodes (4): GRAPH, ROOT, ROUTING, SOURCE_EXTS

### Community 66 - "Zod Contract Schemas"
Cohesion: 0.10
Nodes (26): sampleCoachItem(), sampleSupport(), sampleTurn(), AssessmentZ, CefrBandZ, CoachItemZ, CoachKindZ, MemoryExtractionSchema (+18 more)

### Community 68 - "XP and Levels"
Cohesion: 0.24
Nodes (18): clamp(), ConversationEvidence, conversationXp(), DAILY_XP_CAP, DatedXp, DrillEvidence, drillXp(), LessonEvidence (+10 more)

### Community 70 - "Gate Runner Script"
Cohesion: 0.10
Nodes (15): AGENT_MODELS, agentFiles, args, asJson, bless, counts, entries, failures (+7 more)

### Community 71 - "Memory Curation"
Cohesion: 0.22
Nodes (12): NewPhrase, applyCuration(), buildCurationRequest(), CuratedTopic, CurationInput, CurationSchema, INSTRUCTION, keyOf() (+4 more)

### Community 72 - "Known Issues Ledger"
Cohesion: 0.06
Nodes (33): A1 — A spoken answer has to match the script exactly, A2 — An empty transcript is graded as a wrong answer, A3 — A freeze at the top rung still asks the learner to invent French, A4 — A rescue can skip the beat the learner froze on, A5 — Two different opening-rung formulas, A6 — A focus point vanishes when the worst sound has no drill, A7 — A v2 snapshot with no memory crashes the worker, B0 — ParleTutor cannot be tested at all (+25 more)

### Community 73 - "Agent Fleet Metadata"
Cohesion: 0.20
Nodes (11): AgentFrontmatter, agentProblems(), FRONTMATTER_FIELDS, frontmatterBlock(), parseAgentFrontmatter(), pinnedAgents(), READ_ONLY_AGENTS, routedAgents() (+3 more)

### Community 74 - "Supabase Auth Adapter"
Cohesion: 0.26
Nodes (4): startGoogleSignIn(), AuthResult, AuthUser, AuthContextValue

### Community 75 - "Phoneme Scoring Bridge"
Cohesion: 0.20
Nodes (8): ALIASES, FRENCH_IPA, toInventoryIpa(), parseSpeechace(), ScoreFetch, ScoreRequest, scoreUtterance(), RESPONSE

### Community 77 - "Scenario Prompt and Grading"
Cohesion: 0.13
Nodes (19): Assessment, LearnerSnapshot, assessmentToQuality(), INLINE_CAP, splitCoach(), SURFACE, surfacePolicy(), INSTRUCTION (+11 more)

### Community 79 - "Memory Extraction Prompt"
Cohesion: 0.31
Nodes (9): MemoryFact, ChatMessage, buildExtractionRequest(), ExtractionInput, factLine(), INSTRUCTION, interview, request() (+1 more)

### Community 85 - "Shared UI Components"
Cohesion: 0.08
Nodes (42): ArrowRight(), Card(), EarGlyph(), GhostButton(), HelpGlyph(), Label(), LineBullet(), MicGlyph() (+34 more)

### Community 86 - "Token Server Endpoints"
Cohesion: 0.20
Nodes (11): agentDebitAllowed(), config, json(), livekitUrl, PORT, readAudio(), readJson(), scoreCounts (+3 more)

### Community 87 - "Android App Config"
Cohesion: 0.20
Nodes (10): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, package, permissions, predictiveBackGestureEnabled (+2 more)

### Community 88 - "Pedagogy Ladder Doc"
Cohesion: 0.25
Nodes (8): One focus, one drill, The four rungs, The invariants, The pedagogy, The rescue, Two independent axes, What counts as a right answer, Where the next session opens

### Community 89 - "Conversation and Recap Screens"
Cohesion: 0.13
Nodes (18): st, RecapScreen(), registerTag(), st, paper, Line(), Recast(), st (+10 more)

### Community 90 - "Live Voice Doc"
Cohesion: 0.25
Nodes (7): Audio, and what may be claimed about it, Serialisation, The four modes, The live path, The route, The wire, When it fails

### Community 91 - "Loop and Forge Doc"
Cohesion: 0.29
Nodes (7): Giving it a goal, Running it, The agents, The bar, The loop, The other half: building something new, Verifying UI work

### Community 92 - "State and Storage Doc"
Cohesion: 0.29
Nodes (6): On the device, Server side, Sessions and progress, State and storage, The brain's learner model, The round trip, and where it broke

### Community 93 - "Testing Doc"
Cohesion: 0.29
Nodes (6): Never, Running, Testing, The rule that matters most, What is not covered, Writing

### Community 94 - "Bug Hunter Agent Spec"
Cohesion: 0.33
Nodes (5): House style, How you work, Product invariants — a change that breaks one of these is a bug, however green, What counts as a finding, What you must never do

### Community 95 - "Project Architecture Overview"
Cohesion: 0.40
Nodes (5): Architecture, Mock or live, No build step, Two paths, one ladder, Who owns what

### Community 97 - "Conversation Test Doubles"
Cohesion: 0.13
Nodes (10): SttLanguage, buildConvo(), DeadBrain, FailingBrain, finishSessionWith(), heard(), inScene(), NoCuration (+2 more)

### Community 100 - "Conversation State and Recap"
Cohesion: 0.17
Nodes (14): CoachItem, ConversationState, createConversation(), fresh(), KIND_PRIORITY, assembleRecap(), dedupeFixes(), FOCUS_BY_TAG (+6 more)

### Community 102 - "Drill Batch Validation"
Cohesion: 0.31
Nodes (12): checkAccepted(), checkDistinct(), englishGlosses(), expectedDifficulty(), inRange(), LabelledString, learnerVisibleStrings(), validateBatch() (+4 more)

### Community 103 - "Expo Native Plugins"
Cohesion: 0.25
Nodes (6): plugins, expo-audio, expo-font, expo-sharing, expo-web-browser, @livekit/react-native-expo-plugin

### Community 104 - "LiveKit Token Minting"
Cohesion: 0.29
Nodes (9): GrantResult, grantSession(), roomNameFor(), SessionGrant, SessionMode, config, metadataFor(), TokenConfig (+1 more)

### Community 105 - "Deploy Engineer Agent"
Cohesion: 0.22
Nodes (8): How you work, Product invariants — a change that breaks one of these is wrong, however green, Ship the smallest real thing, Start by being honest about where this is, The order this has to happen in, What you must never do, When there is nothing to deploy to, say so, Your territory

### Community 106 - "Observability Engineer Agent"
Cohesion: 0.22
Nodes (8): How you work, Product invariants — a change that breaks one of these is wrong, however green, The line you do not cross, The seam to cut, when the time comes, What exists, and what does not, What you must never do, When there is no seam yet, say so, Your territory

### Community 107 - "Revenue Engineer Agent"
Cohesion: 0.22
Nodes (8): Copy about money is still learner copy, How you work, Product invariants — a change that breaks one of these is wrong, however green, The rule enforcement lives at, What already exists, What you must never do, Where a purchase lands, Your territory

### Community 108 - "Prompt and Turn Queue"
Cohesion: 0.17
Nodes (8): thinkingAfter(), baseInstructions(), buildPrompt(), turnInstructions(), TurnQueue, Publisher, reportUsage(), UsageReport

### Community 111 - "iOS App Config"
Cohesion: 0.40
Nodes (5): ios, NSMicrophoneUsageDescription, bundleIdentifier, infoPlist, supportsTablet

### Community 112 - "Forge Workflow Doc"
Cohesion: 0.22
Nodes (9): /forge, Looping it, Not wired yet: the unattended loop, The contract, The gate watches the wiring too, Watch for judge drift, Who actually builds it, Why the judge's findings go in the ledger (+1 more)

### Community 113 - "Server User Resolver"
Cohesion: 0.25
Nodes (5): createUserResolver(), ResolvedUser, SIGN_IN_REQUIRED, UserResolver, VerifierConfig

### Community 116 - "Playground Eval Harness"
Cohesion: 0.18
Nodes (17): blocks(), ZERO_USAGE, blocks(), buildScenarioRequest(), buildSystemBlocks(), main(), pickClient(), PROFILES (+9 more)

### Community 117 - "Device Voice Playback"
Cohesion: 0.43
Nodes (6): available(), frenchVoice(), loadVoices(), speak(), speakLines(), withTimeout()

### Community 118 - "API Engineer Agent"
Cohesion: 0.25
Nodes (7): How you work, Product invariants — a change that breaks one of these is wrong, however green, The LLM layer, The rule that matters most, The shape of the API, What you must never do, Your territory

### Community 119 - "Performance Engineer Agent"
Cohesion: 0.25
Nodes (7): How the TTS cache actually works, How you work, Product invariants — a change that breaks one of these is wrong, however green, Prompt caching, The number, What you must never do, Your territory

### Community 120 - "Security Engineer Agent"
Cohesion: 0.25
Nodes (7): How you work, Product invariants — a change that breaks one of these is wrong, however green, The habits already in the code, which you should extend, What is actually true today, unvarnished, What you must never do, When dispatched by /ship, Your territory

### Community 121 - "Auth Engineer Agent"
Cohesion: 0.29
Nodes (6): How you work, Product invariants — a change that breaks one of these is wrong, however green, The seam, and why it is shaped this way, The server side, What you must never do, Your territory

### Community 122 - "Backend Engineer Agent"
Cohesion: 0.29
Nodes (6): How you work, Product invariants — a change that breaks one of these is wrong, however green, Running it locally, What this stack does not have, What you must never do, Your territory

### Community 123 - "Data Engineer Agent"
Cohesion: 0.29
Nodes (6): How you work, Product invariants — a change that breaks one of these is wrong, however green, What is actually true today, What you must never do, When a database is proposed, Your territory

### Community 124 - "Frontend Engineer Agent Spec"
Cohesion: 0.29
Nodes (6): How you work, Product invariants — a change that breaks one of these is wrong, however green, The constraints that are not negotiable, The one thing that catches everyone out, What you must never do, Your territory

### Community 125 - "Agent Team Roster"
Cohesion: 0.29
Nodes (7): Calling them, Territory is the point, The gate defends the fleet, The team, The two that answer rather than build, Three of them are ahead of the code, Who owns what

### Community 126 - "Design Architect Agent Spec"
Cohesion: 0.33
Nodes (5): Orienting yourself, The ledger format is parsed, not read, The question you are actually answering, What you must never do, Your output — the contract

### Community 127 - "Scaling Engineer Agent Spec"
Cohesion: 0.33
Nodes (5): Default answer, The checks, What genuinely blocks a second instance today, What you must never do, Your output

### Community 128 - "TTS Cache"
Cohesion: 0.16
Nodes (7): CachedTTS, CachedTTSOptions, defaultMissTransport(), normaliseLine(), ResolvedCachedTTSOptions, DEFAULT_CACHE_DIR, VOICE_SETTINGS

### Community 129 - "Release Engineer Agent Spec"
Cohesion: 0.40
Nodes (4): The bar, The checks, What you must never do, Your output

### Community 130 - "Work Judge Agent Spec"
Cohesion: 0.40
Nodes (4): The bar for sending work back, The checks, You may not grow the job, Your output

### Community 131 - "TTS Cache Tests"
Cohesion: 0.15
Nodes (6): FakeChunkedStream, FakeSynthesizeStream, FakeTTS, NO_RETRY, rampFrames(), synth()

### Community 138 - "Voice Cache Warming"
Cohesion: 0.32
Nodes (6): CONVO_LINES, buildTTS(), ENV_KEYS, main(), scriptedLines(), splitter

## Knowledge Gaps
- **677 isolated node(s):** `BrainConfig`, `LabelledString`, `GrantResult`, `SessionGrant`, `SessionMode` (+672 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **32 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AuthAdapter` connect `Auth Adapter Interface` to `Supabase Auth Adapter`, `Auth Context and Friends UI`, `Mock Auth Adapter`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Why does `Rung` connect `Conversation Ladder and Copy Rules` to `LiveKit Tutor Agent`, `Learner Profile Model`, `Client Agent Wire Protocol`, `Mock Speech Session Screen`, `Prompt and Turn Queue`, `Scenario Prompt and Grading`, `Live Session Navigation Context`, `Live Failure Handling`, `Agent Preflight Checks`, `Shared UI Components`, `Lesson Session Grading`, `Lesson Content Model`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Why does `AnthropicBrainClient` connect `Anthropic Brain Client` to `Conversation Test Doubles`, `Learner Profile Model`, `Playground Chat Commands`, `Tutor Copy Rules`, `Playground Eval Harness`, `Brain Client Contracts`, `Anthropic and Claude CLI Providers`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **What connects `BrainConfig`, `LabelledString`, `GrantResult` to the rest of the system?**
  _677 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Drill Session Flow` be split into smaller, more focused modules?**
  _Cohesion score 0.11693548387096774 - nodes in this community are weakly interconnected._
- **Should `Drill Bank and Design Tokens` be split into smaller, more focused modules?**
  _Cohesion score 0.0661189358372457 - nodes in this community are weakly interconnected._
- **Should `Client Agent Wire Protocol` be split into smaller, more focused modules?**
  _Cohesion score 0.12298387096774194 - nodes in this community are weakly interconnected._