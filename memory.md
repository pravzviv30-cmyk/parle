# Luvani working memory

Updated: 2026-09-01

## Brand rename: Luvani

- The app's name is **Luvani**. Its slogan is **"Find your voice in French"**.
- Use `Luvani` for learner-facing copy and `luvani` / `LUVANI_` for technical
  identifiers. Do not reintroduce Parle branding in code, documentation,
  package names, configuration, logs, storage keys or UI.
- Keep valid French-language examples such as `je parle français` and `parler`
  unchanged: they are French verbs, not brand references.
- The repository has been fully renamed: workspace packages use `@luvani/*`,
  Expo uses slug and scheme `luvani`, and native identifiers are
  `com.luvani.app`. Environment variable names use `LUVANI_`.
- Before a native production release, register the new `com.luvani.app` app
  identifiers, `luvani://` OAuth redirect URI, and the renamed RevenueCat
  products and entitlement in their respective external dashboards. Update
  deployed environment variable names and production domains/CORS settings to
  match the renamed app before deploying.

## Phase audit and landing

- Audited all repository worktrees and the phase documentation.
- Completed Phase 7 revenue implementation: RevenueCat subscriber projection,
  authenticated replay-safe webhooks, bounded refresh, native purchase/restore
  adapter, dark-until-configured paywall, paid-lapse handling, migrations and
  updated evidence/risk documentation.
- Completed the locally implementable Phase 8 privacy work: authenticated
  server-plus-device JSON export, Profile download action, deletion/export
  documentation and a release checklist.
- Phase 8 is intentionally not described as release-complete. Legal review,
  vendor-retention confirmation, real iOS/Android and store lifecycle runs,
  deployed Supabase migration/rollback evidence, production domains and CI
  evidence remain external release work.
- Full repository gate: 2,185 tests, 0 failures. Web build and tracked secret
  scan passed.
- Landed and pushed to `origin/main` at `87f015d` (`Land revenue and local
  privacy phases on main`).
- Four worktrees were clean after landing. The Phase 7 branch is behind main
  only by its merge commit. The local-only archived tag
  `archive/codex-freeform-tutor-baseline` remains untouched for a later
  push/prune decision.

## Local development configuration audit

- Existing local server configuration includes Supabase server settings,
  Upstash configuration and a sufficiently long rate-limit salt.
- Tutor-agent configuration includes usable OpenAI/Groq, Deepgram and
  ElevenLabs credentials plus a configured voice. Vendor preflight confirmed
  that brain, voice and transcription all answered.
- Local LiveKit uses the intended development server credentials and
  `ws://localhost:7880`; this is correct for local testing and must not be used
  for production.
- RevenueCat configuration is absent, so purchases remain safely dark.
- `LUVANI_AGENT_SECRET` is absent. Local development permits this, but a strong
  shared value must be stored in both token-server and tutor-agent deployments
  before either is network-accessible.
- `SUPABASE_JWT_SECRET` is not required for production while Supabase URL/JWKS
  verification is configured.
- An unused `OPEN_AI_KEY` typo exists beside the correctly configured
  `OPENAI_API_KEY`; remove the unused variable during credential cleanup.
- Server-side Speechace is optional and currently absent; tutor-agent speech
  configuration exists.

## Tutor-unavailable diagnosis and local setup

- The app's `Tutor unavailable` card is controlled by a 1.5-second request to
  `GET <token-server>/health`. It does not directly indicate a LiveKit or LLM
  failure.
- The original failure occurred because nothing was listening on port 8787.
- Local LiveKit was already running on port 7880.
- The normal token-server watch command hit macOS `EMFILE` (too many watched
  files). Running the same server without watch mode works:

  ```bash
  cd services/token-server
  LUVANI_LOCAL_DEVELOPMENT=1 node --experimental-strip-types src/server.ts
  ```

- The token server then returned a healthy response at
  `http://localhost:8787/health`.
- The tutor worker started successfully, connected to LiveKit and registered:

  ```bash
  npm run dev --workspace=@luvani/tutor-agent
  ```

- The mobile app previously had no `apps/mobile/.env`, so it used mock accounts
  while the token server required real Supabase bearer tokens. This made session
  start return 401 even after health recovered.
- Created ignored local `apps/mobile/.env` with only public client settings:
  token-server URL, Supabase project URL and Supabase anon key. No service-role,
  Upstash, LiveKit or AI/vendor secret belongs in that file.
- Expo now loads that file and runs with real Supabase authentication:

  ```bash
  npm run start --workspace=@luvani/mobile
  ```

- Current local web address is `http://localhost:8081`. Sign up or sign in with
  a real Supabase account before opening Tutor.
- A physical phone cannot reach the Mac through `localhost`; add a secure tunnel
  or another reachable development endpoint when device testing begins.
- The repository smoke script currently sends a synthetic unauthenticated user
  and therefore receives 401 when real Supabase authentication is enabled. This
  is a smoke-script limitation, not a tutor-worker failure.

## Credential safety

- Never copy actual credential values into this file, chat summaries, tracked
  files or logs.
- During diagnostics, server-only Supabase and Upstash values appeared in tool
  output. Rotate the Supabase service-role key and Upstash token before further
  sharing or any deployment.
- After rotation, update only ignored local env files and the deployment secret
  manager. Do not commit filled `.env` files.

## Recommended next steps

1. Test the web/local flow with a real Supabase account: sign-in, Tutor health,
   start a typed conversation, then start a spoken conversation.
2. Update the smoke script to authenticate through Supabase or provide an
   explicit safe local-auth mode.
3. Remove the unused `OPEN_AI_KEY` variable.
4. Rotate the exposed server-only credentials.
5. When ready for iPhone testing, configure a secure reachable endpoint rather
   than `localhost` and run the device checklist.
6. Leave payments and the remaining Phase 8 release evidence until the app is
   ready for publishing.
