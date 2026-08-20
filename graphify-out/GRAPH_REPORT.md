# Graph Report - Parle  (2026-08-20)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 2224 nodes · 5407 edges · 131 communities (97 shown, 34 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 76 edges (avg confidence: 0.82)
- Token cost: 105,964 input · 1,884 output

## Graph Freshness
- Built from commit: `34b1493a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- French Authenticity Pack
- Drill Grading and Fixtures
- Session Metering and Plans
- Lesson Drill Definitions
- Drill Screen Views
- Add Friends Screen
- Activity Log Store
- Learner Profile and Support
- Expo App Config
- App Root and Profile Gate
- LiveKit Tutor Agent Deps
- Topic Curation Prompt
- Dev Launcher Script
- Unattended Build Loop
- Session Recap Contract Types
- Mock Auth Adapter
- Learning Path Graph
- Cached TTS Audio Stream
- Live Failure Copy and Globals
- Pedagogy Ladder Rungs
- Session Journal Recovery
- Brain Package Manifest
- Token Server Manifest
- Brain Playground Manifest
- Lesson Session Engine
- Onboarding Welcome Screens
- Conversation Orchestrator
- Anthropic Brain Client
- Core Package Manifest
- Cafe Lesson Definitions
- Base TypeScript Config
- French Tutor Voice Playback
- Live Tutor Agent
- Friends Store Adapter
- Mobile TypeScript Config
- Root Workspace Manifest
- Learner Profile Updates
- Mobile App Dependencies
- Mobile Package Manifest
- Auth Screens Flow
- Mock Speech Session Screen
- Brain TypeScript Config
- Core TypeScript Config
- Playground TypeScript Config
- Token Server TypeScript Config
- Tutor Agent TypeScript Config
- Live Session Navigation Context
- Workspace NPM Scripts
- Native Audio Session Globals
- Spaced Repetition Scheduler
- Agent Preflight and Env
- Generated Drill Store
- Brain LLM Client Schemas
- Tab Bar Icons
- Expo Linking Dependency
- Expo Metro Runtime
- Expo Sharing Dependency
- Expo Speech Dependency
- Dead Brain Client Stub
- Expo Web Browser
- Discussed Topics Store
- LiveKit Expo Plugin
- Core Package Dependency
- Graphify Guard Hook
- React Native Dependency
- Async Storage Dependency
- Brain Zod Schemas
- React Native SVG
- XP and Levels
- Expo Audio Dependency
- Gate Enforcement Script
- LiveKit Client Dependency
- Known Issues Ledger
- Agent Fleet Metadata
- Supabase Auth Adapter
- French Phoneme Mapping
- Auth Adapter Interface
- LiveKit WebRTC Dependency
- Memory Extraction Prompt
- React DOM Dependency
- React Native Screens
- Bottom Tabs Navigation
- React Navigation Core
- Supabase Client Dependency
- Paper UI Component Kit
- Review Deck Store
- Android App Config
- Pedagogy Doc
- Live Voice Doc
- Bug Loop Doc
- State and Storage Doc
- Testing Doc
- Bug Hunter Agent
- Architecture Overview Doc
- Project Documentation Index
- Conversation View and Profile Parsing
- Fix Verifier Agent Spec
- Expo Native Plugins
- Turn Queue
- Deploy Engineer Agent
- Observability Engineer Agent
- Revenue Engineer Agent
- Client Agent Wire Protocol
- LiveKit React Native
- Safe Area Context
- iOS App Config
- Forge Command Spec
- Copy Lint Tests
- Expo Font Dependency
- Drill Eval Harness
- Expo File System
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
- Release Engineer Agent
- Work Judge Agent
- Pre-commit Gate Hook
- Pre-push Gate Hook
- Git Hook Installer
- TTS Warm Cache Script

## God Nodes (most connected - your core abstractions)
1. `space()` - 69 edges
2. `ParleConversation` - 39 edges
3. `LlmUsage` - 39 edges
4. `paper` - 38 edges
5. `Format` - 34 edges
6. `type` - 31 edges
7. `MockLlmClient` - 26 edges
8. `LlmClient` - 25 edges
9. `ParleTutor` - 24 edges
10. `ScenarioFrame` - 24 edges

## Surprising Connections (you probably didn't know these)
- `A real spoken exchange inside one five-minute session` --rationale_for--> `createSession()`  [INFERRED]
  PRODUCT.md → packages/core/src/session/session.ts
- `Chrome is plain English, French only where it is content` --rationale_for--> `CAFE_LESSON`  [INFERRED]
  DESIGN.md → packages/core/src/lessons/cafe.ts
- `Words-right and sounds-right are separate questions` --rationale_for--> `TurnFeedback`  [INFERRED]
  PRODUCT.md → packages/core/src/session/session.ts
- `Words-right and sounds-right are separate questions` --rationale_for--> `grade()`  [INFERRED]
  PRODUCT.md → packages/core/src/session/session.ts
- `A missing score is never an invented penalty` --rationale_for--> `grade()`  [INFERRED]
  README.md → packages/core/src/session/session.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **The four-rung scaffolding system, from principle to pixel** — product_scaffolding_ladder, product_never_stranded_never_scolded, design_support_colours_cool, packages_core_src_ladder_ladder_applyturn, apps_mobile_src_theme_rungcolor, readme_agent_authoritative [INFERRED 0.85]
- **The trustworthy-pronunciation chain** — product_trustworthy_pronunciation, product_french_only_depth, product_say_one_thing, readme_missing_score_no_penalty, packages_core_src_phonemes_inventory_french_phonemes, packages_core_src_phonemes_drills_drills, packages_core_src_phonemes_scoring_buildreport, services_shared_speechace_scoreutterance [INFERRED 0.85]
- **Unit economics and metering enforcement** — product_metered_minutes, product_cascaded_voice_pipeline, readme_metering_at_token_issuance, readme_tts_warm_cache, readme_risk_cost_per_session, packages_core_src_metering_meter_plans, packages_core_src_metering_meter_estimatesessioncost [INFERRED 0.85]

## Communities (131 total, 34 thin omitted)

### Community 0 - "French Authenticity Pack"
Cohesion: 0.16
Nodes (15): FR_PACK, renderAuthenticityPack(), AuthenticityPack, ContrastPair, Filler, RegisterDef, SlangEntry, ClaudeCliRun (+7 more)

### Community 1 - "Drill Grading and Fixtures"
Cohesion: 0.06
Nodes (72): DrillStore, DrillScreen(), scoreAttempt(), verdictColor(), DRILL_FIXTURES, acceptedFor(), DrillVerdict, gradeAnswer() (+64 more)

### Community 2 - "Session Metering and Plans"
Cohesion: 0.05
Nodes (54): canStartSession(), CostModel, DEFAULT_COST_MODEL, Entitlement, estimateSessionCost(), Margin, MIN_VIABLE_SESSION_SEC, Plan (+46 more)

### Community 3 - "Lesson Drill Definitions"
Cohesion: 0.07
Nodes (56): Paper colour token set, Paper & Ink design world, check(), checkDrill(), bestDrillFor(), BY_ID, Drill, DrillKind (+48 more)

### Community 4 - "Drill Screen Views"
Cohesion: 0.13
Nodes (22): fitDisplay(), OptionCard(), ConvoScreen(), AppropriateReplyView(), BestSentenceView(), ds, FillBlankView(), kindTag() (+14 more)

### Community 5 - "Add Friends Screen"
Cohesion: 0.17
Nodes (16): useProfile(), friends, AddFriendsScreen(), Hit, RowStatus, st, Monogram(), PersonPlusGlyph() (+8 more)

### Community 6 - "Activity Log Store"
Cohesion: 0.19
Nodes (16): ActivityEntry, ActivityKind, backfillFrom(), chain, earnedXp(), empty(), loadActivity(), prune() (+8 more)

### Community 7 - "Learner Profile and Support"
Cohesion: 0.11
Nodes (40): applyNonSpokenInput(), supportViewFor(), defaultModel(), createProfile(), learnerSnapshotFrom(), migrateProfile(), DEFAULT_CONFIG, main() (+32 more)

### Community 8 - "Expo App Config"
Cohesion: 0.13
Nodes (14): expo, icon, name, newArchEnabled, orientation, scheme, slug, splash (+6 more)

### Community 9 - "App Root and Profile Gate"
Cohesion: 0.09
Nodes (32): Read the exact versioned Expo docs before writing code, App(), Gate(), SignedInRoot(), st, Ctx, ProfileGate(), ProfileValue (+24 more)

### Community 10 - "LiveKit Tutor Agent Deps"
Cohesion: 0.05
Nodes (37): @livekit/agents, @livekit/agents-plugin-anthropic, @livekit/agents-plugin-deepgram, @livekit/agents-plugin-elevenlabs, @livekit/agents-plugin-openai, @livekit/agents-plugin-silero, dependencies, dotenv (+29 more)

### Community 11 - "Topic Curation Prompt"
Cohesion: 0.07
Nodes (33): NewPhrase, applyCuration(), buildCurationRequest(), CuratedTopic, CurationInput, INSTRUCTION, keyOf(), MAX_CURATED_TOPICS (+25 more)

### Community 12 - "Dev Launcher Script"
Cohesion: 0.09
Nodes (36): AGENT_ENV_FILE, children, COLOURS, die(), hasClaudeCli(), launch(), main(), probe() (+28 more)

### Community 13 - "Unattended Build Loop"
Cohesion: 0.07
Nodes (18): ALLOWED_TOOLS, argv, BRANCH, branchNow, current, deadEnds, DRY_RUN, final (+10 more)

### Community 14 - "Session Recap Contract Types"
Cohesion: 0.06
Nodes (69): sampleCoachItem(), sampleSupport(), sampleTurn(), Assessment, CoachItem, CoachKind, SessionRecap, SupportMaterial (+61 more)

### Community 15 - "Mock Auth Adapter"
Cohesion: 0.21
Nodes (11): auth, build(), createMockAdapter(), notify(), setSession(), emptyStore(), MockAccount, MockStore (+3 more)

### Community 16 - "Learning Path Graph"
Cohesion: 0.19
Nodes (15): AUTHORED_PATH, AuthoredNode, authoredPhraseKeys(), AuthoredUnit, buildPath(), discussedInWords(), drillableKeys(), GENERATED_PREFIX (+7 more)

### Community 17 - "Cached TTS Audio Stream"
Cohesion: 0.05
Nodes (26): CachedChunkedStream, CachedTTS, CachedTTSOptions, defaultMissTransport(), normaliseLine(), ResolvedCachedTTSOptions, FakeChunkedStream, FakeSynthesizeStream (+18 more)

### Community 18 - "Live Failure Copy and Globals"
Cohesion: 0.13
Nodes (22): authHeaders(), classifyFailure(), COPY, failureCopy, LiveFailure, micApiUnavailable(), TokenServerError, ensureAudioSession() (+14 more)

### Community 19 - "Pedagogy Ladder Rungs"
Cohesion: 0.14
Nodes (28): Chrome is plain English, French only where it is content, No number and no scolding mid-session, applyTurn(), clamp(), directiveFor(), initialState(), INSTRUCTION_BY_RUNG, LadderState (+20 more)

### Community 20 - "Session Journal Recovery"
Cohesion: 0.20
Nodes (17): clearJournal(), journalRecap(), KEY(), recoverJournal(), serialized(), NOW, phrase(), recap() (+9 more)

### Community 21 - "Brain Package Manifest"
Cohesion: 0.08
Nodes (24): @anthropic-ai/sdk, dependencies, @anthropic-ai/sdk, @parle/core, zod, description, devDependencies, @types/node (+16 more)

### Community 22 - "Token Server Manifest"
Cohesion: 0.08
Nodes (24): jose, livekit-server-sdk, dependencies, dotenv, jose, livekit-server-sdk, @parle/core, devDependencies (+16 more)

### Community 23 - "Brain Playground Manifest"
Cohesion: 0.08
Nodes (24): dependencies, dotenv, @parle/brain, @parle/core, description, devDependencies, @types/node, typescript (+16 more)

### Community 24 - "Lesson Session Engine"
Cohesion: 0.16
Nodes (23): SessionViewProps, LadderDirective, LessonTurn, PhonemeObservation, feedbackMessage(), grade(), INTELLIGIBLE, LearnerInput (+15 more)

### Community 25 - "Onboarding Welcome Screens"
Cohesion: 0.06
Nodes (41): st, WelcomeScreen(), ProgressDots(), TabBar(), HeroCafe(), LearnStack(), OnboardCake(), OnboardClock() (+33 more)

### Community 27 - "Anthropic Brain Client"
Cohesion: 0.10
Nodes (19): AnthropicBrainClient, AnthropicBrainConfig, outputConfig(), parse(), ParseCapableSdk, toProviderMessages(), usageOf(), ClaudeCliConfig (+11 more)

### Community 28 - "Core Package Manifest"
Cohesion: 0.10
Nodes (19): devDependencies, @types/node, typescript, exports, ./ladder, ./lessons, ./metering, ./phonemes (+11 more)

### Community 29 - "Cafe Lesson Definitions"
Cohesion: 0.16
Nodes (21): CAFE_LESSON, BY_ID, getLesson(), LESSONS, AcceptanceMatch, AcceptanceRoute, candidatesFor(), CefrLevel (+13 more)

### Community 30 - "Base TypeScript Config"
Cohesion: 0.10
Nodes (19): DOM, ES2023, compilerOptions, allowImportingTsExtensions, esModuleInterop, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, isolatedModules (+11 more)

### Community 31 - "French Tutor Voice Playback"
Cohesion: 0.43
Nodes (6): available(), frenchVoice(), loadVoices(), speak(), speakLines(), withTimeout()

### Community 33 - "Friends Store Adapter"
Cohesion: 0.09
Nodes (37): build(), createLocalAdapter(), defaultStore(), FriendsStore, isStore(), KEY(), listeners, loadStore() (+29 more)

### Community 34 - "Mobile TypeScript Config"
Cohesion: 0.13
Nodes (14): compilerOptions, allowImportingTsExtensions, noEmit, noUncheckedIndexedAccess, strict, exclude, extends, include (+6 more)

### Community 35 - "Root Workspace Manifest"
Cohesion: 0.09
Nodes (21): description, engines, node, name, private, scripts, dev, gate (+13 more)

### Community 36 - "Learner Profile Updates"
Cohesion: 0.19
Nodes (17): normalizeErrorTag(), applyExtractionToProfile(), applyTurnToProfile(), bandIndex(), evictOverflowPhrases(), evictStalePatterns(), EVIDENCE_WINDOW, finishSession() (+9 more)

### Community 37 - "Mobile App Dependencies"
Cohesion: 0.13
Nodes (15): dependencies, expo, expo-crypto, expo-status-bar, @parle/brain, react, react-native-web, @react-navigation/native-stack (+7 more)

### Community 38 - "Mobile Package Manifest"
Cohesion: 0.20
Nodes (9): devDependencies, @types/react, typescript, typescript, main, name, private, version (+1 more)

### Community 39 - "Auth Screens Flow"
Cohesion: 0.18
Nodes (19): AuthScreen, SetNewPasswordScreen(), st, SignInScreen(), st, SignUpScreen(), st, AuthContext (+11 more)

### Community 40 - "Mock Speech Session Screen"
Cohesion: 0.18
Nodes (16): ANGLOPHONE_WEAKNESS, CARRIER, carrierWord(), estimateDurationSec(), jitter(), LearnerProfile, mockObservations(), Phase (+8 more)

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
Cohesion: 0.10
Nodes (26): Ctx, LiveProvider(), LiveValue, useLive(), loadDrillBank(), LiveSessionScreen(), asRung(), DrillRoute() (+18 more)

### Community 47 - "Workspace NPM Scripts"
Cohesion: 0.29
Nodes (7): scripts, android, ios, start, test, typecheck, web

### Community 49 - "Spaced Repetition Scheduler"
Cohesion: 0.27
Nodes (14): buildCardsFromSummary(), AGAIN_RETRY_MS, applyGrade(), DEFAULT_EASE, DUE_CAP, dueCards(), goodIntervalDays(), GRADUATION_INTERVALS_DAYS (+6 more)

### Community 50 - "Agent Preflight and Env"
Cohesion: 0.14
Nodes (21): TokenMeta, tutorLLM(), Brain, BRAIN_KEY, Env, FetchLike, missingRequired(), preflight() (+13 more)

### Community 51 - "Generated Drill Store"
Cohesion: 0.27
Nodes (14): defaultStore(), getMicSuppressedUntil(), hasGeneratedExercises(), isMicSuppressed(), isStore(), KEY(), loadStore(), mergeExercises() (+6 more)

### Community 52 - "Brain LLM Client Schemas"
Cohesion: 0.09
Nodes (37): MemoryExtractionSchema, ScenarioFrameSchema, TurnSchema, MemoryExtraction, ScenarioFrame, TutorTurn, Curation, CurationSchema (+29 more)

### Community 53 - "Tab Bar Icons"
Cohesion: 0.20
Nodes (11): HomeIcon(), LeaderboardIcon(), PracticeIcon(), ProfileIcon(), TabIconProps, TutorIcon(), ICONS, LABELS (+3 more)

### Community 60 - "Discussed Topics Store"
Cohesion: 0.23
Nodes (13): KEY(), loadTopics(), mergeSessionTopics(), serialized(), StoredTopics, writeChain, MAX_DISCUSSED_DATES, mergeTopics() (+5 more)

### Community 63 - "Graphify Guard Hook"
Cohesion: 0.29
Nodes (4): GRAPH, ROOT, ROUTING, SOURCE_EXTS

### Community 66 - "Brain Zod Schemas"
Cohesion: 0.12
Nodes (14): AssessmentZ, CefrBandZ, CoachItemZ, CoachKindZ, MemoryFactZ, NewPhraseZ, OptionZ, PhraseZ (+6 more)

### Community 68 - "XP and Levels"
Cohesion: 0.24
Nodes (18): clamp(), ConversationEvidence, conversationXp(), DAILY_XP_CAP, DatedXp, DrillEvidence, drillXp(), LessonEvidence (+10 more)

### Community 70 - "Gate Enforcement Script"
Cohesion: 0.10
Nodes (15): AGENT_MODELS, agentFiles, args, asJson, bless, counts, entries, failures (+7 more)

### Community 72 - "Known Issues Ledger"
Cohesion: 0.06
Nodes (34): A1 — A spoken answer has to match the script exactly, A2 — An empty transcript is graded as a wrong answer, A3 — A freeze at the top rung still asks the learner to invent French, A4 — A rescue can skip the beat the learner froze on, A5 — Two different opening-rung formulas, A6 — A focus point vanishes when the worst sound has no drill, A7 — A v2 snapshot with no memory crashes the worker, B0 — ParleTutor cannot be tested at all (+26 more)

### Community 73 - "Agent Fleet Metadata"
Cohesion: 0.20
Nodes (11): AgentFrontmatter, agentProblems(), FRONTMATTER_FIELDS, frontmatterBlock(), parseAgentFrontmatter(), pinnedAgents(), READ_ONLY_AGENTS, routedAgents() (+3 more)

### Community 74 - "Supabase Auth Adapter"
Cohesion: 0.26
Nodes (4): startGoogleSignIn(), AuthResult, AuthUser, AuthContextValue

### Community 75 - "French Phoneme Mapping"
Cohesion: 0.13
Nodes (14): Parle (working name), Expo + TypeScript npm-workspaces monorepo, Trustworthy pronunciation needs a reference text, The alignment thesis, A missing score is never an invented penalty, Repo path contains a space, ALIASES, FRENCH_IPA (+6 more)

### Community 79 - "Memory Extraction Prompt"
Cohesion: 0.33
Nodes (8): MemoryFact, buildExtractionRequest(), ExtractionInput, factLine(), INSTRUCTION, interview, request(), tennis

### Community 85 - "Paper UI Component Kit"
Cohesion: 0.08
Nodes (55): ArrowRight(), Card(), EarGlyph(), GhostButton(), HelpGlyph(), Label(), LineBullet(), MicGlyph() (+47 more)

### Community 86 - "Review Deck Store"
Cohesion: 0.49
Nodes (9): addFromSummary(), addPhrases(), gradeCard(), KEY(), loadDeck(), saveDeck(), serialized(), writeChain (+1 more)

### Community 87 - "Android App Config"
Cohesion: 0.20
Nodes (10): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, package, permissions, predictiveBackGestureEnabled (+2 more)

### Community 88 - "Pedagogy Doc"
Cohesion: 0.25
Nodes (8): One focus, one drill, The four rungs, The invariants, The pedagogy, The rescue, Two independent axes, What counts as a right answer, Where the next session opens

### Community 90 - "Live Voice Doc"
Cohesion: 0.25
Nodes (7): Audio, and what may be claimed about it, Serialisation, The four modes, The live path, The route, The wire, When it fails

### Community 91 - "Bug Loop Doc"
Cohesion: 0.29
Nodes (7): Giving it a goal, Running it, The agents, The bar, The loop, The other half: building something new, Verifying UI work

### Community 92 - "State and Storage Doc"
Cohesion: 0.29
Nodes (6): On the device, Server side, Sessions and progress, State and storage, The brain's learner model, The round trip, and where it broke

### Community 93 - "Testing Doc"
Cohesion: 0.29
Nodes (6): Never, Running, Testing, The rule that matters most, What is not covered, Writing

### Community 94 - "Bug Hunter Agent"
Cohesion: 0.33
Nodes (5): House style, How you work, Product invariants — a change that breaks one of these is a bug, however green, What counts as a finding, What you must never do

### Community 95 - "Architecture Overview Doc"
Cohesion: 0.40
Nodes (5): Architecture, Mock or live, No build step, Two paths, one ladder, Who owns what

### Community 97 - "Conversation View and Profile Parsing"
Cohesion: 0.08
Nodes (25): SpeakerLine, TurnView, isRecord(), repairProfile(), brainClient(), chooseFrame(), ConversationPhase, ConvoView (+17 more)

### Community 103 - "Expo Native Plugins"
Cohesion: 0.25
Nodes (6): plugins, expo-audio, expo-font, expo-sharing, expo-web-browser, @livekit/react-native-expo-plugin

### Community 105 - "Deploy Engineer Agent"
Cohesion: 0.22
Nodes (8): How you work, Product invariants — a change that breaks one of these is wrong, however green, Ship the smallest real thing, Start by being honest about where this is, The order this has to happen in, What you must never do, When there is nothing to deploy to, say so, Your territory

### Community 106 - "Observability Engineer Agent"
Cohesion: 0.22
Nodes (8): How you work, Product invariants — a change that breaks one of these is wrong, however green, The line you do not cross, The seam to cut, when the time comes, What exists, and what does not, What you must never do, When there is no seam yet, say so, Your territory

### Community 107 - "Revenue Engineer Agent"
Cohesion: 0.22
Nodes (8): Copy about money is still learner copy, How you work, Product invariants — a change that breaks one of these is wrong, however green, The rule enforcement lives at, What already exists, What you must never do, Where a purchase lands, Your territory

### Community 108 - "Client Agent Wire Protocol"
Cohesion: 0.12
Nodes (27): LiveSession, CLIENT_TAGS, ClientMessage, ConvoCoachItem, ConvoPhrase, ConvoSpeakerLine, ConvoSupportView, ConvoView (+19 more)

### Community 111 - "iOS App Config"
Cohesion: 0.40
Nodes (5): ios, NSMicrophoneUsageDescription, bundleIdentifier, infoPlist, supportsTablet

### Community 112 - "Forge Command Spec"
Cohesion: 0.22
Nodes (9): /forge, Looping it, Not wired yet: the unattended loop, The contract, The gate watches the wiring too, Watch for judge drift, Who actually builds it, Why the judge's findings go in the ledger (+1 more)

### Community 116 - "Drill Eval Harness"
Cohesion: 0.12
Nodes (29): ZERO_USAGE, blocks(), buildScenarioRequest(), buildSystemBlocks(), EVAL_CASES, EvalCase, EvalExpectation, main() (+21 more)

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

### Community 124 - "Frontend Engineer Agent"
Cohesion: 0.29
Nodes (6): How you work, Product invariants — a change that breaks one of these is wrong, however green, The constraints that are not negotiable, The one thing that catches everyone out, What you must never do, Your territory

### Community 125 - "Team Roster Doc"
Cohesion: 0.29
Nodes (7): Calling them, Territory is the point, The gate defends the fleet, The team, The two that answer rather than build, Three of them are ahead of the code, Who owns what

### Community 126 - "Design Architect Agent"
Cohesion: 0.33
Nodes (5): Orienting yourself, The ledger format is parsed, not read, The question you are actually answering, What you must never do, Your output — the contract

### Community 127 - "Scaling Engineer Agent"
Cohesion: 0.33
Nodes (5): Default answer, The checks, What genuinely blocks a second instance today, What you must never do, Your output

### Community 129 - "Release Engineer Agent"
Cohesion: 0.40
Nodes (4): The bar, The checks, What you must never do, Your output

### Community 130 - "Work Judge Agent"
Cohesion: 0.40
Nodes (4): The bar for sending work back, The checks, You may not grow the job, Your output

### Community 138 - "TTS Warm Cache Script"
Cohesion: 0.50
Nodes (4): CONVO_LINES, main(), scriptedLines(), splitter

## Knowledge Gaps
- **681 isolated node(s):** `LabelledString`, `TimingStage`, `TurnTiming`, `Command`, `Publisher` (+676 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **34 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ParleConversation` connect `Conversation Orchestrator` to `Conversation View and Profile Parsing`, `App Root and Profile Gate`, `Topic Curation Prompt`, `Client Agent Wire Protocol`, `Session Recap Contract Types`, `Agent Preflight and Env`, `Brain LLM Client Schemas`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Why does `DrillExercise` connect `Drill Grading and Fixtures` to `Drill Screen Views`, `Topic Curation Prompt`, `Client Agent Wire Protocol`, `Learning Path Graph`, `Live Failure Copy and Globals`, `Generated Drill Store`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Why does `ParleTutor` connect `Live Tutor Agent` to `Mock Speech Session Screen`, `Client Agent Wire Protocol`, `Cached TTS Audio Stream`, `Agent Preflight and Env`, `Lesson Session Engine`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **What connects `LabelledString`, `TimingStage`, `TurnTiming` to the rest of the system?**
  _681 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Drill Grading and Fixtures` be split into smaller, more focused modules?**
  _Cohesion score 0.05975485188968335 - nodes in this community are weakly interconnected._
- **Should `Session Metering and Plans` be split into smaller, more focused modules?**
  _Cohesion score 0.05450165612767239 - nodes in this community are weakly interconnected._
- **Should `Lesson Drill Definitions` be split into smaller, more focused modules?**
  _Cohesion score 0.07329192546583851 - nodes in this community are weakly interconnected._