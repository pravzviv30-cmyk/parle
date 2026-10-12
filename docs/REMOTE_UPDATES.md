# Luvani iPhone preview updates

## Current state — 12 October 2026

Luvani is linked to Expo account `praveen30`, project
`19183dc7-05cc-459a-b95f-6d7ad6fd6665`:
[Expo project](https://expo.dev/accounts/praveen30/projects/luvani).
The hosted `preview` channel and its branch exist. The Expo `preview` environment
has the existing Supabase public client configuration and explicit `0` values for
local development, wall preview, kept phrase audio and Walk mode.

**Remote previews are not live yet.** A hosted Luvani HTTPS API remains required.
The existing mobile environment points to a Mac-local server; no hosted API
deployment was found, and no Vercel or Railway account is connected in the available
hosting integration. Configure `EXPO_PUBLIC_TOKEN_SERVER_URL` in Expo's `preview`
environment only after the backend is deployed and accepted using
[BACKEND_RELEASE_RUNBOOK.md](BACKEND_RELEASE_RUNBOOK.md). `/health` and `/ready`
must succeed, and Supabase must expose asymmetric auth signing keys. The real EAS
environment check currently stops with a missing HTTPS API configuration error;
no update has been published.

The Expo robot `luvani-github-preview` has only `VIEW` and `PUBLISH` permissions on
account `praveen30`, which currently owns only Luvani. Its publishing credential was
verified with EAS CLI, encrypted with GitHub's public key using a sealed box, and
stored as repository Actions secret `EXPO_TOKEN`; secret metadata was verified after
the write. It has no `OWN`, `ADMIN` or `PUBLISH_PROTECTED` permission. No personal
access token or login session was stored in GitHub, and no token value was written
to source, disk or logs. Credential revocation belongs in Expo's account settings.

Native `expo-updates` support was added. The signed local development binary passed
`codesign --verify --deep --strict`, installed successfully over the trusted iPhone
Wi-Fi connection, and launched with `com.luvani.app` through `devicectl`. It still
uses Metro for the current local preview. Loading a first cloud update with Metro
off remains unverified until the hosted API exists.

The existing Supabase project was paused. It has been restored and reports
`ACTIVE_HEALTHY`; this does not prove its schema, OAuth providers, signing keys or
the full backend are ready. No database migrations or paid subscriptions were
applied as part of this setup.

## How future main pushes reach the phone

`.github/workflows/mobile-preview.yml` runs after the existing `gate` workflow
succeeds for a push to this repository's `main`. It checks out the exact tested SHA,
skips a superseded commit, installs the locked dependencies, loads Expo's `preview`
environment, checks the online services, and publishes an iOS update to `preview`.
Local dotenv files are disabled. No production channel is published.

The publishing CLI is pinned to `eas-cli@24.10.0`. SDK 57 requires the explicit
`--environment preview` argument. `scripts/checkMobilePreview.mjs` rejects missing
settings, local/placeholder URLs, privileged Supabase keys, enabled local preview
modes, unavailable services and missing asymmetric signing keys before publishing.
These checks establish basic availability; the backend runbook supplies the deeper
schema, privacy, billing and voice acceptance requirements.

App config uses the `fingerprint` runtime policy so a native dependency change
cannot silently ship to an incompatible installed build. Native changes still need
a new binary. Onboarding copy, layouts and JavaScript animations can normally travel
as compatible updates. See [Expo runtime versions](https://docs.expo.dev/eas-update/runtime-versions/).

## Opening updates

After installing the new development binary, open its launcher, sign in to the Expo
account under **Extensions**, and select Luvani's newest published preview. Once an
update is downloaded, it can run without Metro or USB; online features still need
the hosted backend. The development launcher requires choosing/loading previews;
it does not behave like a store app's automatic update launcher. See
[Expo development previews](https://docs.expo.dev/eas-update/expo-dev-client/).

For a release-style preview that checks automatically on launch, build the `staging`
profile once. It uses the `preview` channel and real hosted authentication, without
the development launcher. A downloaded compatible update takes effect on a later
launch; `fallbackToCacheTimeout: 0` lets the current cached app open promptly.

## Apple signing

A fresh Debug binary from the task checkout was built and installed on 12 October
2026. Automatic signing renewed its Apple Personal Team provisioning profile
through **19 October 2026, 15:11 UTC**. Strict signature, profile/device membership
and permitted entitlements checks passed; the app launched after the user verified
the developer profile on the phone. This is a Metro development build with native
fingerprint `37c2ea50d7d91f8aff5748893a11c8a3e6d18937`; OTA and device behavior are
not yet accepted. Hosted JavaScript updates do not renew it. Re-sign
and reinstall locally when the current profile expires, or use an Apple Developer membership and
TestFlight for ongoing wireless distribution. No membership was purchased here.

For this Personal Team local development binary only, generated ignored iOS
entitlements omit Apple Sign-in and Push Notifications because the team cannot sign
those capabilities. Tracked production configuration retains Apple Sign-in and
notifications. Real OAuth and push behavior require an appropriately signed build.

## Verification still required before calling this complete

- Configure an accepted hosted API and publish the first preview.
- With Metro stopped and USB disconnected, load that update over internet access.
- Push a harmless visible JavaScript change, wait for successful CI and publication,
  then confirm the phone loads it and its saved account/onboarding state survives.
- ~~Verify a native dependency change produces a different runtime and needs a build.~~
  Verified 5 October 2026: adding `react-native-reanimated` 4.5.1 and
  `react-native-worklets` 0.10.1 and the `EXDevMenuShowFloatingActionButton` plist key
  (commit `e077f1cf`) changed the iOS fingerprint from
  `19ef095c560e019dfa0a05e0a12e9a8eed34e1a5` (at `47fbc2ea`) to
  `f6be04049fbace22d1e9e7d1ea3bb236c8b37720`. The changed sources were both packages,
  `expoConfig` and `rncoreAutolinkingConfig:ios`, measured with
  `npx @expo/fingerprint fingerprint:generate --platform ios`. Updates published after
  that commit only reach a binary rebuilt from it.
