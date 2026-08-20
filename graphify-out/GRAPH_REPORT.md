# Graph Report - Parle  (2026-08-20)

## Corpus Check
- 286 files · ~208,079 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2199 nodes · 5328 edges · 138 communities (107 shown, 31 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 73 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1596d7e5`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- brain/src/index.ts
- drill/session.ts
- metering/index.ts
- phonemes/index.ts
- space
- drill/index.ts
- protocol.ts
- sessionLoop.ts
- Expo App Config
- App.tsx
- Tutor Agent Dependencies
- generate.ts
- dev.mjs
- Bug Loop Runner
- runEval.ts
- Mock Auth Adapter
- DrillExercise
- ttsCache.test.ts
- useLiveSession.ts
- ladder.ts
- type
- Brain Package Manifest
- Token Server Manifest
- Brain Playground Manifest
- session/session.ts
- paper
- ParleConversation
- anthropic.ts
- Core Package Manifest
- lessons/types.ts
- Shared TypeScript Config
- LlmUsage
- ParleTutor
- localAdapter.ts
- Mobile TypeScript Config
- scripts
- profile.ts
- Mobile Dependencies
- Mobile Package Manifest
- src/theme.ts
- SessionScreen.tsx
- Brain TypeScript Config
- Core TypeScript Config
- Playground TypeScript Config
- Token Server TypeScript Config
- Tutor Agent TypeScript Config
- core/src/index.ts
- Mobile Scripts
- Native Audio Globals
- drill/grading.ts
- Agent Env Preflight
- drill/store.ts
- openaiCompat.ts
- Entitlement
- Expo Linking
- Metro Runtime
- Expo Sharing
- Expo Speech
- Expo Status Bar
- Expo Web Browser
- review/store.ts
- LiveKit Expo Plugin
- Core Package Dependency
- Graphify Guard Hook
- React Native Framework
- Async Storage Library
- contract/types.ts
- SVG Rendering Library
- Levels & XP
- Expo Audio Playback
- gate.mjs
- Topic Curation
- Format
- agentFleet.ts
- Supabase Auth Adapter
- shared/speechace.ts
- Auth Adapter Interface
- activity.ts
- LiveKit WebRTC Transport
- Memory Extraction Prompt
- React DOM Renderer
- Native Screen Primitives
- Bottom Tab Navigation
- React Navigation Core
- Supabase Client SDK
- components.tsx
- server.ts
- Android App Config
- Pedagogy Doc
- Expo File System
- Live Voice Doc
- The loop
- State And Storage Doc
- Testing Doc
- Bug Hunter Agent Spec
- Architecture
- README.md
- convo.ts
- Fix Verifier Spec
- conversation.ts
- AnthropicBrainClient
- drill/validate.ts
- Expo Plugins & File Saving
- tokens.ts
- deploy-engineer.md
- observability-engineer.md
- revenue-engineer.md
- tutor.ts
- LiveKit React Native SDK
- Safe Area Insets
- iOS App Config
- /forge
- auth.ts
- Mobile Copy Test
- Expo Font Loading
- Expo + TypeScript npm-workspaces monorepo
- tutorVoice.ts
- api-engineer.md
- performance-engineer.md
- security-engineer.md
- auth-engineer.md
- backend-engineer.md
- data-engineer.md
- frontend-engineer.md
- The team
- design-architect.md
- scaling-engineer.md
- commands.ts
- release-engineer.md
- work-judge.md
- claudeCli.test.ts
- pre-commit
- pre-push
- installHooks.mjs

## God Nodes (most connected - your core abstractions)
1. `space()` - 69 edges
2. `LlmUsage` - 39 edges
3. `ParleConversation` - 39 edges
4. `paper` - 38 edges
5. `Format` - 33 edges
6. `type` - 31 edges
7. `MockLlmClient` - 26 edges
8. `LlmClient` - 25 edges
9. `ScenarioFrame` - 24 edges
10. `ParleTutor` - 24 edges

## Surprising Connections (you probably didn't know these)
- `Chrome is plain English, French only where it is content` --rationale_for--> `CAFE_LESSON`  [INFERRED]
  DESIGN.md → packages/core/src/lessons/cafe.ts
- `A real spoken exchange inside one five-minute session` --rationale_for--> `createSession()`  [INFERRED]
  PRODUCT.md → packages/core/src/session/session.ts
- `460pt centred web column` --rationale_for--> `App()`  [INFERRED]
  DESIGN.md → apps/mobile/App.tsx
- `Gate, onboarding, Home with Speak and Learn tabs` --rationale_for--> `ProgressDots()`  [INFERRED]
  DESIGN.md → apps/mobile/src/components.tsx
- `Paper colour token set` --rationale_for--> `paper`  [EXTRACTED]
  DESIGN.md → apps/mobile/src/theme.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **The four-rung scaffolding system, from principle to pixel** — product_scaffolding_ladder, product_never_stranded_never_scolded, design_support_colours_cool, packages_core_src_ladder_ladder_applyturn, apps_mobile_src_theme_rungcolor, readme_agent_authoritative [INFERRED 0.85]
- **The trustworthy-pronunciation chain** — product_trustworthy_pronunciation, product_french_only_depth, product_say_one_thing, readme_missing_score_no_penalty, packages_core_src_phonemes_inventory_french_phonemes, packages_core_src_phonemes_drills_drills, packages_core_src_phonemes_scoring_buildreport, services_shared_speechace_scoreutterance [INFERRED 0.85]
- **Unit economics and metering enforcement** — product_metered_minutes, product_cascaded_voice_pipeline, readme_metering_at_token_issuance, readme_tts_warm_cache, readme_risk_cost_per_session, packages_core_src_metering_meter_plans, packages_core_src_metering_meter_estimatesessioncost [INFERRED 0.85]

## Communities (138 total, 31 thin omitted)

### Community 0 - "brain/src/index.ts"
Cohesion: 0.10
Nodes (26): FR_PACK, renderAuthenticityPack(), AuthenticityPack, ContrastPair, Filler, RegisterDef, SlangEntry, SessionRecap (+18 more)

### Community 1 - "drill/session.ts"
Cohesion: 0.12
Nodes (25): DrillScreen(), verdictColor(), check(), checkDrill(), answerCurrent(), AnsweredExercise, applyDrillResults(), buildDrillSession() (+17 more)

### Community 2 - "metering/index.ts"
Cohesion: 0.16
Nodes (23): canStartSession(), CostModel, DEFAULT_COST_MODEL, estimateSessionCost(), Margin, MIN_VIABLE_SESSION_SEC, planMargin(), PLANS (+15 more)

### Community 3 - "phonemes/index.ts"
Cohesion: 0.08
Nodes (52): Paper colour token set, Paper & Ink design world, bestDrillFor(), BY_ID, Drill, DrillKind, DRILLS, drillsFor() (+44 more)

### Community 4 - "space"
Cohesion: 0.15
Nodes (21): fitDisplay(), OptionCard(), ConvoScreen(), AppropriateReplyView(), BestSentenceView(), ds, FillBlankView(), kindTag() (+13 more)

### Community 5 - "drill/index.ts"
Cohesion: 0.16
Nodes (21): DrillVerdict, typed(), withOptions(), DrillFeedback, AppropriateReplyExercise, BestSentenceExercise, DrillDifficulty, DrillExerciseBase (+13 more)

### Community 6 - "protocol.ts"
Cohesion: 0.12
Nodes (26): LiveSession, Rung, CLIENT_TAGS, ClientMessage, ConvoCoachItem, ConvoPhrase, ConvoSpeakerLine, ConvoSupportView (+18 more)

### Community 7 - "sessionLoop.ts"
Cohesion: 0.10
Nodes (46): SupportView, RescueView, blocks(), ZERO_USAGE, defaultModel(), blocks(), buildScenarioRequest(), buildSystemBlocks() (+38 more)

### Community 8 - "Expo App Config"
Cohesion: 0.13
Nodes (14): expo, icon, name, newArchEnabled, orientation, scheme, slug, splash (+6 more)

### Community 9 - "App.tsx"
Cohesion: 0.09
Nodes (33): App(), Gate(), SignedInRoot(), st, Ctx, ProfileGate(), ProfileValue, AuthFlow() (+25 more)

### Community 10 - "Tutor Agent Dependencies"
Cohesion: 0.05
Nodes (37): @livekit/agents, @livekit/agents-plugin-anthropic, @livekit/agents-plugin-deepgram, @livekit/agents-plugin-elevenlabs, @livekit/agents-plugin-openai, @livekit/agents-plugin-silero, dependencies, dotenv (+29 more)

### Community 11 - "generate.ts"
Cohesion: 0.09
Nodes (21): AppropriateReplyZ, BASE, BestSentenceZ, buildDrillGenerationRequest(), FillBlankZ, GeneratedExerciseZ, INSTRUCTION, ListenTypeZ (+13 more)

### Community 12 - "dev.mjs"
Cohesion: 0.09
Nodes (36): AGENT_ENV_FILE, children, COLOURS, die(), hasClaudeCli(), launch(), main(), probe() (+28 more)

### Community 13 - "Bug Loop Runner"
Cohesion: 0.07
Nodes (18): ALLOWED_TOOLS, argv, BRANCH, branchNow, current, deadEnds, DRY_RUN, final (+10 more)

### Community 14 - "runEval.ts"
Cohesion: 0.12
Nodes (26): CoachKind, coachFallbackLine(), CopyRule, copyViolations(), EM_DASH_RE, FILLER_RE, outsideQuotes(), RECOVERY_LINE (+18 more)

### Community 15 - "Mock Auth Adapter"
Cohesion: 0.21
Nodes (11): auth, build(), createMockAdapter(), notify(), setSession(), emptyStore(), MockAccount, MockStore (+3 more)

### Community 16 - "DrillExercise"
Cohesion: 0.24
Nodes (6): DrillStore, DRILL_FIXTURES, DrillSessionState, DrillExercise, NOW, OPTS

### Community 17 - "ttsCache.test.ts"
Cohesion: 0.05
Nodes (26): CachedChunkedStream, CachedTTS, CachedTTSOptions, defaultMissTransport(), normaliseLine(), ResolvedCachedTTSOptions, FakeChunkedStream, FakeSynthesizeStream (+18 more)

### Community 18 - "useLiveSession.ts"
Cohesion: 0.12
Nodes (23): authHeaders(), scoreAttempt(), classifyFailure(), COPY, failureCopy, LiveFailure, micApiUnavailable(), TokenServerError (+15 more)

### Community 19 - "ladder.ts"
Cohesion: 0.13
Nodes (29): Chrome is plain English, French only where it is content, No number and no scolding mid-session, applyTurn(), clamp(), directiveFor(), initialState(), INSTRUCTION_BY_RUNG, LadderState (+21 more)

### Community 20 - "type"
Cohesion: 0.12
Nodes (27): AuthScreen, SetNewPasswordScreen(), st, SignInScreen(), st, SignUpScreen(), st, AuthContext (+19 more)

### Community 21 - "Brain Package Manifest"
Cohesion: 0.08
Nodes (24): @anthropic-ai/sdk, dependencies, @anthropic-ai/sdk, @parle/core, zod, description, devDependencies, @types/node (+16 more)

### Community 22 - "Token Server Manifest"
Cohesion: 0.08
Nodes (24): jose, livekit-server-sdk, dependencies, dotenv, jose, livekit-server-sdk, @parle/core, devDependencies (+16 more)

### Community 23 - "Brain Playground Manifest"
Cohesion: 0.08
Nodes (24): dependencies, dotenv, @parle/brain, @parle/core, description, devDependencies, @types/node, typescript (+16 more)

### Community 24 - "session/session.ts"
Cohesion: 0.15
Nodes (23): SessionViewProps, LadderDirective, LessonTurn, PhonemeObservation, SessionPhonemeReport, feedbackMessage(), grade(), INTELLIGIBLE (+15 more)

### Community 25 - "paper"
Cohesion: 0.07
Nodes (36): st, WelcomeScreen(), HeroCafe(), LearnStack(), OnboardCake(), OnboardClock(), OnboardSuitcase(), OnboardWave() (+28 more)

### Community 27 - "anthropic.ts"
Cohesion: 0.12
Nodes (16): AnthropicBrainConfig, ParseCapableSdk, ParsedResponse, ClaudeCliConfig, spawnClaude(), BrainParseError, BrainRefusalError, AnyRecord (+8 more)

### Community 28 - "Core Package Manifest"
Cohesion: 0.10
Nodes (19): devDependencies, @types/node, typescript, exports, ./ladder, ./lessons, ./metering, ./phonemes (+11 more)

### Community 29 - "lessons/types.ts"
Cohesion: 0.21
Nodes (17): BY_ID, getLesson(), LESSONS, AcceptanceMatch, AcceptanceRoute, candidatesFor(), CefrLevel, contentHits() (+9 more)

### Community 30 - "Shared TypeScript Config"
Cohesion: 0.10
Nodes (19): DOM, ES2023, compilerOptions, allowImportingTsExtensions, esModuleInterop, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, isolatedModules (+11 more)

### Community 31 - "LlmUsage"
Cohesion: 0.23
Nodes (6): ClaudeCliBrainClient, extractJson(), jsonSchemaText(), LlmUsage, jsonSchemaText(), OpenAiCompatBrainClient

### Community 32 - "ParleTutor"
Cohesion: 0.25
Nodes (3): Lesson, currentPrompt(), ParleTutor

### Community 33 - "localAdapter.ts"
Cohesion: 0.09
Nodes (37): build(), createLocalAdapter(), defaultStore(), FriendsStore, isStore(), KEY(), listeners, loadStore() (+29 more)

### Community 34 - "Mobile TypeScript Config"
Cohesion: 0.13
Nodes (14): compilerOptions, allowImportingTsExtensions, noEmit, noUncheckedIndexedAccess, strict, exclude, extends, include (+6 more)

### Community 35 - "scripts"
Cohesion: 0.09
Nodes (21): description, engines, node, name, private, scripts, dev, gate (+13 more)

### Community 36 - "profile.ts"
Cohesion: 0.14
Nodes (23): normalizeErrorTag(), applyExtractionToProfile(), applyTurnToProfile(), bandIndex(), createProfile(), evictOverflowPhrases(), evictStalePatterns(), EVIDENCE_WINDOW (+15 more)

### Community 37 - "Mobile Dependencies"
Cohesion: 0.13
Nodes (15): dependencies, expo, expo-crypto, livekit-client, @parle/brain, react, react-native-web, @react-navigation/native-stack (+7 more)

### Community 38 - "Mobile Package Manifest"
Cohesion: 0.20
Nodes (9): devDependencies, @types/react, typescript, typescript, main, name, private, version (+1 more)

### Community 39 - "src/theme.ts"
Cohesion: 0.16
Nodes (20): useProfile(), friends, AddFriendsScreen(), Hit, RowStatus, st, Monogram(), PersonPlusGlyph() (+12 more)

### Community 40 - "SessionScreen.tsx"
Cohesion: 0.23
Nodes (12): ANGLOPHONE_WEAKNESS, CARRIER, carrierWord(), estimateDurationSec(), jitter(), LearnerProfile, mockObservations(), Phase (+4 more)

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

### Community 46 - "core/src/index.ts"
Cohesion: 0.08
Nodes (33): Ctx, LiveProvider(), LiveValue, useLive(), loadDrillBank(), LiveSessionScreen(), asRung(), ConvoRoute() (+25 more)

### Community 47 - "Mobile Scripts"
Cohesion: 0.29
Nodes (7): scripts, android, ios, start, test, typecheck, web

### Community 49 - "drill/grading.ts"
Cohesion: 0.36
Nodes (9): acceptedFor(), gradeAnswer(), gradeFreeText(), GradeResult, realWordSet(), damerauLevenshtein(), sameWord(), TYPO_MAX_DISTANCE (+1 more)

### Community 50 - "Agent Env Preflight"
Cohesion: 0.14
Nodes (21): TokenMeta, tutorLLM(), Brain, BRAIN_KEY, Env, FetchLike, missingRequired(), preflight() (+13 more)

### Community 51 - "drill/store.ts"
Cohesion: 0.27
Nodes (14): defaultStore(), getMicSuppressedUntil(), hasGeneratedExercises(), isMicSuppressed(), isStore(), KEY(), loadStore(), mergeExercises() (+6 more)

### Community 52 - "openaiCompat.ts"
Cohesion: 0.13
Nodes (21): MemoryExtraction, ScenarioFrame, TutorTurn, Curation, DrillBatch, BrainCurateRequest, BrainDrillsRequest, BrainExtractRequest (+13 more)

### Community 53 - "Entitlement"
Cohesion: 0.23
Nodes (6): Entitlement, Plan, rollPeriod(), EntitlementStore, FileEntitlementStore, InMemoryEntitlementStore

### Community 60 - "review/store.ts"
Cohesion: 0.06
Nodes (65): HomeIcon(), LeaderboardIcon(), PracticeIcon(), ProfileIcon(), TabIconProps, TutorIcon(), ICONS, LABELS (+57 more)

### Community 63 - "Graphify Guard Hook"
Cohesion: 0.29
Nodes (4): GRAPH, ROOT, ROUTING, SOURCE_EXTS

### Community 66 - "contract/types.ts"
Cohesion: 0.12
Nodes (22): sampleCoachItem(), AssessmentZ, CefrBandZ, CoachItemZ, CoachKindZ, MemoryExtractionSchema, MemoryFactZ, NewPhraseZ (+14 more)

### Community 68 - "Levels & XP"
Cohesion: 0.24
Nodes (18): clamp(), ConversationEvidence, conversationXp(), DAILY_XP_CAP, DatedXp, DrillEvidence, drillXp(), LessonEvidence (+10 more)

### Community 70 - "gate.mjs"
Cohesion: 0.10
Nodes (15): AGENT_MODELS, agentFiles, args, asJson, bless, counts, entries, failures (+7 more)

### Community 71 - "Topic Curation"
Cohesion: 0.20
Nodes (13): NewPhrase, applyCuration(), buildCurationRequest(), CuratedTopic, CurationInput, CurationSchema, INSTRUCTION, keyOf() (+5 more)

### Community 72 - "Format"
Cohesion: 0.06
Nodes (33): A1 — A spoken answer has to match the script exactly, A2 — An empty transcript is graded as a wrong answer, A3 — A freeze at the top rung still asks the learner to invent French, A4 — A rescue can skip the beat the learner froze on, A5 — Two different opening-rung formulas, A6 — A focus point vanishes when the worst sound has no drill, A7 — A v2 snapshot with no memory crashes the worker, B0 — ParleTutor cannot be tested at all (+25 more)

### Community 73 - "agentFleet.ts"
Cohesion: 0.20
Nodes (11): AgentFrontmatter, agentProblems(), FRONTMATTER_FIELDS, frontmatterBlock(), parseAgentFrontmatter(), pinnedAgents(), READ_ONLY_AGENTS, routedAgents() (+3 more)

### Community 74 - "Supabase Auth Adapter"
Cohesion: 0.26
Nodes (4): startGoogleSignIn(), AuthResult, AuthUser, AuthContextValue

### Community 75 - "shared/speechace.ts"
Cohesion: 0.20
Nodes (8): ALIASES, FRENCH_IPA, toInventoryIpa(), parseSpeechace(), ScoreFetch, ScoreRequest, scoreUtterance(), RESPONSE

### Community 77 - "activity.ts"
Cohesion: 0.29
Nodes (11): ActivityEntry, ActivityKind, backfillFrom(), chain, empty(), loadActivity(), prune(), read() (+3 more)

### Community 79 - "Memory Extraction Prompt"
Cohesion: 0.31
Nodes (9): MemoryFact, ChatMessage, buildExtractionRequest(), ExtractionInput, factLine(), INSTRUCTION, interview, request() (+1 more)

### Community 85 - "components.tsx"
Cohesion: 0.09
Nodes (42): Card(), EarGlyph(), GhostButton(), HelpGlyph(), Label(), LineBullet(), MicGlyph(), OutlineButton() (+34 more)

### Community 86 - "server.ts"
Cohesion: 0.20
Nodes (11): agentDebitAllowed(), config, json(), livekitUrl, PORT, readAudio(), readJson(), scoreCounts (+3 more)

### Community 87 - "Android App Config"
Cohesion: 0.20
Nodes (10): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, package, permissions, predictiveBackGestureEnabled (+2 more)

### Community 88 - "Pedagogy Doc"
Cohesion: 0.25
Nodes (8): One focus, one drill, The four rungs, The invariants, The pedagogy, The rescue, Two independent axes, What counts as a right answer, Where the next session opens

### Community 90 - "Live Voice Doc"
Cohesion: 0.25
Nodes (7): Audio, and what may be claimed about it, Serialisation, The four modes, The live path, The route, The wire, When it fails

### Community 91 - "The loop"
Cohesion: 0.29
Nodes (7): Giving it a goal, Running it, The agents, The bar, The loop, The other half: building something new, Verifying UI work

### Community 92 - "State And Storage Doc"
Cohesion: 0.29
Nodes (6): On the device, Server side, Sessions and progress, State and storage, The brain's learner model, The round trip, and where it broke

### Community 93 - "Testing Doc"
Cohesion: 0.29
Nodes (6): Never, Running, Testing, The rule that matters most, What is not covered, Writing

### Community 94 - "Bug Hunter Agent Spec"
Cohesion: 0.33
Nodes (5): House style, How you work, Product invariants — a change that breaks one of these is a bug, however green, What counts as a finding, What you must never do

### Community 95 - "Architecture"
Cohesion: 0.40
Nodes (5): Architecture, Mock or live, No build step, Two paths, one ladder, Who owns what

### Community 97 - "convo.ts"
Cohesion: 0.07
Nodes (32): integrateTurn(), supportViewFor(), learnerSnapshotFrom(), brainClient(), chooseFrame(), ConversationPhase, CONVO_LINES, ConvoView (+24 more)

### Community 100 - "conversation.ts"
Cohesion: 0.08
Nodes (38): sampleSupport(), sampleTurn(), Assessment, CoachItem, SpeakerLine, BASE_RUNG_BY_CEFR, beatOf(), ConversationState (+30 more)

### Community 101 - "AnthropicBrainClient"
Cohesion: 0.33
Nodes (5): AnthropicBrainClient, outputConfig(), parse(), toProviderMessages(), usageOf()

### Community 102 - "drill/validate.ts"
Cohesion: 0.31
Nodes (12): checkAccepted(), checkDistinct(), englishGlosses(), expectedDifficulty(), inRange(), LabelledString, learnerVisibleStrings(), validateBatch() (+4 more)

### Community 103 - "Expo Plugins & File Saving"
Cohesion: 0.25
Nodes (6): plugins, expo-audio, expo-font, expo-sharing, expo-web-browser, @livekit/react-native-expo-plugin

### Community 104 - "tokens.ts"
Cohesion: 0.29
Nodes (9): GrantResult, grantSession(), roomNameFor(), SessionGrant, SessionMode, config, metadataFor(), TokenConfig (+1 more)

### Community 105 - "deploy-engineer.md"
Cohesion: 0.22
Nodes (8): How you work, Product invariants — a change that breaks one of these is wrong, however green, Ship the smallest real thing, Start by being honest about where this is, The order this has to happen in, What you must never do, When there is nothing to deploy to, say so, Your territory

### Community 106 - "observability-engineer.md"
Cohesion: 0.22
Nodes (8): How you work, Product invariants — a change that breaks one of these is wrong, however green, The line you do not cross, The seam to cut, when the time comes, What exists, and what does not, What you must never do, When there is no seam yet, say so, Your territory

### Community 107 - "revenue-engineer.md"
Cohesion: 0.22
Nodes (8): Copy about money is still learner copy, How you work, Product invariants — a change that breaks one of these is wrong, however green, The rule enforcement lives at, What already exists, What you must never do, Where a purchase lands, Your territory

### Community 108 - "tutor.ts"
Cohesion: 0.21
Nodes (7): CAFE_LESSON, A real spoken exchange inside one five-minute session, baseInstructions(), buildPrompt(), turnInstructions(), TurnQueue, Publisher

### Community 111 - "iOS App Config"
Cohesion: 0.40
Nodes (5): ios, NSMicrophoneUsageDescription, bundleIdentifier, infoPlist, supportsTablet

### Community 112 - "/forge"
Cohesion: 0.22
Nodes (9): /forge, Looping it, Not wired yet: the unattended loop, The contract, The gate watches the wiring too, Watch for judge drift, Who actually builds it, Why the judge's findings go in the ledger (+1 more)

### Community 113 - "auth.ts"
Cohesion: 0.25
Nodes (5): createUserResolver(), ResolvedUser, SIGN_IN_REQUIRED, UserResolver, VerifierConfig

### Community 116 - "Expo + TypeScript npm-workspaces monorepo"
Cohesion: 0.25
Nodes (8): Read the exact versioned Expo docs before writing code, Absolute-beginner audience (CEFR A0-A2), Parle (working name), Expo + TypeScript npm-workspaces monorepo, Trustworthy pronunciation needs a reference text, The alignment thesis, packages/core is deliberately platform-free, Repo path contains a space

### Community 117 - "tutorVoice.ts"
Cohesion: 0.43
Nodes (6): available(), frenchVoice(), loadVoices(), speak(), speakLines(), withTimeout()

### Community 118 - "api-engineer.md"
Cohesion: 0.25
Nodes (7): How you work, Product invariants — a change that breaks one of these is wrong, however green, The LLM layer, The rule that matters most, The shape of the API, What you must never do, Your territory

### Community 119 - "performance-engineer.md"
Cohesion: 0.25
Nodes (7): How the TTS cache actually works, How you work, Product invariants — a change that breaks one of these is wrong, however green, Prompt caching, The number, What you must never do, Your territory

### Community 120 - "security-engineer.md"
Cohesion: 0.25
Nodes (7): How you work, Product invariants — a change that breaks one of these is wrong, however green, The habits already in the code, which you should extend, What is actually true today, unvarnished, What you must never do, When dispatched by /ship, Your territory

### Community 121 - "auth-engineer.md"
Cohesion: 0.29
Nodes (6): How you work, Product invariants — a change that breaks one of these is wrong, however green, The seam, and why it is shaped this way, The server side, What you must never do, Your territory

### Community 122 - "backend-engineer.md"
Cohesion: 0.29
Nodes (6): How you work, Product invariants — a change that breaks one of these is wrong, however green, Running it locally, What this stack does not have, What you must never do, Your territory

### Community 123 - "data-engineer.md"
Cohesion: 0.29
Nodes (6): How you work, Product invariants — a change that breaks one of these is wrong, however green, What is actually true today, What you must never do, When a database is proposed, Your territory

### Community 124 - "frontend-engineer.md"
Cohesion: 0.29
Nodes (6): How you work, Product invariants — a change that breaks one of these is wrong, however green, The constraints that are not negotiable, The one thing that catches everyone out, What you must never do, Your territory

### Community 125 - "The team"
Cohesion: 0.29
Nodes (7): Calling them, Territory is the point, The gate defends the fleet, The team, The two that answer rather than build, Three of them are ahead of the code, Who owns what

### Community 126 - "design-architect.md"
Cohesion: 0.33
Nodes (5): Orienting yourself, The ledger format is parsed, not read, The question you are actually answering, What you must never do, Your output — the contract

### Community 127 - "scaling-engineer.md"
Cohesion: 0.33
Nodes (5): Default answer, The checks, What genuinely blocks a second instance today, What you must never do, Your output

### Community 128 - "commands.ts"
Cohesion: 0.40
Nodes (4): Command, COMMAND_HELP, parseCommand(), STRICTNESS_LEVELS

### Community 129 - "release-engineer.md"
Cohesion: 0.40
Nodes (4): The bar, The checks, What you must never do, Your output

### Community 130 - "work-judge.md"
Cohesion: 0.40
Nodes (4): The bar for sending work back, The checks, You may not grow the job, Your output

### Community 131 - "claudeCli.test.ts"
Cohesion: 0.50
Nodes (4): ClaudeCliRun, envelope(), EXTRACTION, recordingRun()

## Knowledge Gaps
- **677 isolated node(s):** `st`, `name`, `slug`, `version`, `orientation` (+672 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **31 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Rung` connect `protocol.ts` to `brain/src/index.ts`, `ParleTutor`, `conversation.ts`, `profile.ts`, `sessionLoop.ts`, `SessionScreen.tsx`, `App.tsx`, `tutor.ts`, `core/src/index.ts`, `useLiveSession.ts`, `ladder.ts`, `Agent Env Preflight`, `components.tsx`, `session/session.ts`, `lessons/types.ts`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Why does `DrillExercise` connect `DrillExercise` to `drill/session.ts`, `space`, `drill/index.ts`, `protocol.ts`, `drill/validate.ts`, `generate.ts`, `drill/grading.ts`, `useLiveSession.ts`, `drill/store.ts`, `review/store.ts`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `plugins` connect `Expo Plugins & File Saving` to `Expo App Config`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **What connects `st`, `name`, `slug` to the rest of the system?**
  _677 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `brain/src/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10384068278805121 - nodes in this community are weakly interconnected._
- **Should `drill/session.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11693548387096774 - nodes in this community are weakly interconnected._
- **Should `phonemes/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07740384615384616 - nodes in this community are weakly interconnected._