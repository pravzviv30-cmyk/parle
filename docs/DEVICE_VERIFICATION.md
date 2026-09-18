# Device verification — auth, session storage, deletion, and the first run

**Status: device and five-viewport matrices not run; one local web route check
recorded.** No representative iOS or Android build of Luvani exists on the machine
this was written on, so every row in [the matrix](#the-matrix) below says `not run`.
This file is primarily the runbook, not the result. `F71` in
[KNOWN_ISSUES.md](KNOWN_ISSUES.md) stays open until the matrix is filled in from a
real device pass and the outcome is recorded here. `F114`'s checked ledger entry
means that this runbook and its static responsive-width contracts exist; it does
not mean the matrix was run. Release evidence remains pending until
[the first run on five viewports](#the-first-run-on-five-viewports) has been walked
and recorded. F58's narrower web route defect has separate runtime evidence below.

Owner: `auth-engineer` for the auth steps, `onboarding-ux-engineer` for the
first-run steps, `qa-release-engineer` for running all of them — independent
evidence is the point, and `qa-release-engineer` cannot edit the code it is
checking.

## What a device proves that this machine cannot

`apps/mobile/src/auth/tokenHygiene.test.ts` runs in the gate today and proves,
statically, three things about the source: the auth layer logs no values, the only
persistence a bearer token has is device-only encrypted storage, and a bearer
leaves the layer in an `authorization` header rather than a URL.

That is a walk over text. It cannot see any of the following, and neither can any
other test in this repo:

- whether the iOS keychain and the Android keystore actually hold and return the
  session across a cold start, a reboot, and a reinstall;
- whether `expo-secure-store` **fails** the way the migration code assumes it does
  — by throwing — rather than silently returning a wrong or empty value;
- what the Supabase SDK, `expo-web-browser`, LiveKit or React Native itself write
  to the platform log while a real session is alive;
- whether the Google deep link `luvani://auth/callback` is actually claimed by the
  installed build;
- whether deletion, reauthentication and the local wipe hold together on a device
  whose storage is full, whose keystore key was invalidated, or which was restored
  from a backup.

Everything below exists because one of those is unknowable from here.

## Before you start

**Builds.** A development build or a release build installed on hardware — not
Expo Go, and not the web bundle. Expo Go rewrites the deep-link scheme to `exp://`
and does not carry the app's own bundle identifier, so both the OAuth step and the
keychain steps mean something different there.

- iOS: bundle identifier `com.luvani.app`, scheme `luvani`.
- Android: package `com.luvani.app`, scheme `luvani`.

**Configuration.** The build must be on the Supabase adapter, not the on-device
mock. `selectAuthMode` in `apps/mobile/src/auth/authMode.ts` picks `supabase` only
when both `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are set,
and refuses to run at all in production without them. **Step D0 confirms this
before anything else**, because every step after it is meaningless against the mock:
`mockAdapter`'s `getAccessToken()` returns `null`, so there is no bearer token to
find, lose or leak.

**Accounts.** Two disposable email accounts (`A` and `B`) on a disposable Supabase
project, plus one Google account. Never a real learner's account.

**Tools.**

| Platform | Logs | App container |
|---|---|---|
| iOS device | Console.app, or `idevicesyslog` | `xcrun devicectl` / Xcode → Devices → Download Container |
| iOS simulator | `xcrun simctl spawn booted log stream --predicate 'process == "Luvani"'` | `xcrun simctl get_app_container booted com.luvani.app data` |
| Android | `adb logcat --pid=$(adb shell pidof -s com.luvani.app)` | `adb shell run-as com.luvani.app ls -R` (debuggable builds only) |

**Recording rule, and it is not negotiable.** Never paste a token, a password, an
access token or a full email address into this file, a ticket, a screenshot or a
chat. Every check below is written so it can be answered with a **count** or a
**yes/no**. Where a value must be looked at, look at it on the device and write
down the verdict, not the value. The Supabase **anon** key is public and is
expected to appear in the bundle; the service-role key and any user access token
are not, and finding either is a P0.

## The matrix

`pass` / `fail` / `not run`. A `fail` becomes a ledger entry in
[KNOWN_ISSUES.md](KNOWN_ISSUES.md) with the step id in the `where:` line.

| Id | Check | iOS | Android |
|---|---|---|---|
| D0 | The build is on the Supabase adapter, not the mock | not run | not run |
| D1 | A session survives backgrounding, cold start and reboot | not run | not run |
| D2 | The session is in the keychain / keystore, not in plaintext storage | not run | not run |
| D3 | A reinstall does not resurrect a session for a deleted account | not run | not run |
| D4 | A plaintext session from an older build migrates, then is gone | not run | not run |
| D5 | A **failed** secure migration forces a safe sign-in | not run | not run |
| D6 | Email and password: sign up, sign out, sign in | not run | not run |
| D7 | Google sign-in over the `luvani://auth/callback` deep link | not run | not run |
| D8 | Password reset from the email link | not run | not run |
| D9 | Deletion demands a recent password reauthentication | not run | not run |
| D10 | Deletion demands a recent Google reauthentication | not run | not run |
| D11 | A failed local wipe is reported honestly, not swallowed | not run | not run |
| D12 | No bearer token in logs, in AsyncStorage, or in the bundle | not run | not run |
| D13 | Two accounts on one device never see each other's learning | not run | not run |
| D14 | The installation signal survives deletion | not run | not run |

## iOS

Run every step on a physical device. The simulator is acceptable only for D4, D5
and D12, and the row must say so.

### D0 — the build is on the Supabase adapter

1. Sign in with account `A`.
2. Start a conversation from Home and let it connect.

**Expect:** the session connects. The token server verifies a real Supabase JWT
through `createUserResolver`, so a live session at all is proof the app sent a
bearer the server could verify — the mock's `getAccessToken()` returns `null` and
would be refused with `Sign in to use this.`

**Fail looks like:** the session starts anyway with no account, or the Email row
under Account on Profile → Settings shows an address ending `@luvani.local`. That
is `mockAdapter`, and it means a development flag reached this build. Stop;
nothing else in this runbook is valid.

### D1 — a session survives backgrounding, cold start and reboot

1. Sign in with `A`. Note the email shown on Profile → Settings, under Account.
2. Background the app for five minutes, return.
3. Force-quit, relaunch.
4. Reboot the phone, relaunch **without** unlocking anything else first, then
   unlock and open Luvani.

**Expect:** signed in as `A` every time, with no sign-in screen and no spinner that
never resolves. `createSecureSessionStorage` reads the chunked session back out of
SecureStore; `AppState` drives `startAutoRefresh` / `stopAutoRefresh`, so the token
refreshes on the return to foreground rather than in the background.

**Fail looks like:** signed out after a reboot, or a launch that hangs on the
loading screen. Both point at the keychain accessibility class: the session is
written with `keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY`, so
a read before first unlock returns nothing. Record which of the four steps broke.

### D2 — the session is in the keychain, not in plaintext storage

1. Signed in as `A`, download the app container (Xcode → Devices and Simulators →
   the app → Download Container), or `xcrun simctl get_app_container booted
   com.luvani.app data` on the simulator.
2. Look in `Documents/RCTAsyncLocalStorage_V1/` — that is AsyncStorage.

**Expect:** AsyncStorage holds `luvani.installation.v1` and keys shaped
`luvani.u.<uid>.<suffix>` (the per-account stores from `storage/scope.ts`) and
**nothing else that looks like a session**. Specifically no `sb-…-auth-token`, and
no `.luvani-secure-meta` or `.luvani-secure-a-0` — those belong in the keychain,
which is not in the container at all. The container carrying no session material
is the pass.

**Fail looks like:** any value in that directory that is a long dot-separated
base64 string. Count it, do not copy it, and file it as a P0.

### D3 — a reinstall does not resurrect a session for a deleted account

This is the iOS-specific one. Keychain items are **not** removed when an app is
deleted, so a reinstalled Luvani can find a session written by the previous install.

1. Sign in as `A`. Delete the account from Profile → Settings → Delete account and
   complete the flow (see D9).
2. Delete the app. Reinstall it. Launch.

**Expect:** the welcome screen. `deleteAccount()` is followed by `auth.signOut()`
in `App.tsx`, and sign-out runs `removeItem`, which drops the `.luvani-secure-meta`
pointer first and then every chunk of both generations.

3. Now the interrupted case: sign in as `B`, and force-quit the app **between** the
   server-side deletion and the sign-out — in practice, put the phone into airplane
   mode immediately after tapping the delete confirmation, then force-quit.
4. Delete the app, reinstall, launch.

**Expect:** the learner ends up signed out at the welcome screen. A leftover
keychain session for a user that no longer exists cannot refresh; the SDK's refresh
fails and `onAuthStateChange` reports `null`. What must **never** happen is the app
rendering the signed-in tabs keyed to the dead uid — `userKey` in
`storage/scope.ts` would then namespace a fresh store under a deleted account.

**Fail looks like:** landing inside the app as `B` after a reinstall of a deleted
account, or a crash from `userKey` throwing behind a rendered screen.

### D4 — a plaintext session from an older build migrates, then is gone

Builds before the encrypted store kept the Supabase session in AsyncStorage. The
migration lives in `createSecureSessionStorage`'s `getItem`: read the legacy value,
write it through `writeSecure`, read it back through the committed metadata, and
only then remove the plaintext copy.

1. Install the **previous** release, sign in as `A`, confirm the session key is in
   `Documents/RCTAsyncLocalStorage_V1/`.
2. Install the current build over it. Do not sign out first.
3. Launch, and confirm you are still signed in as `A`.
4. Download the container again.

**Expect:** still signed in, no re-authentication, and the session key is **gone**
from AsyncStorage. The unit test `a legacy Supabase session moves to encrypted
storage before plaintext is removed` covers the ordering; this step is checking
that the same ordering holds against real SecureStore latency and the real 1,800
character chunk size, on a session large enough to need several chunks.

**Fail looks like:** being signed out by the upgrade (a migration that lost the
session), or the plaintext key still sitting in the container afterwards (a
migration that copied instead of moving).

### D5 — a failed secure migration forces a safe sign-in

The rule this is checking: *a bearer token must never remain readable in plaintext
because the encrypted write did not work.* If the secure write fails, the plaintext
copy is removed anyway and the learner signs in again.

There is no natural way to make SecureStore fail on demand on iOS, so this one is
run with a temporary local patch. **It must never be committed.** In
`createSupabaseAdapter`, replace the `setItem` lambda passed to
`createSecureSessionStorage` with one that throws:

```ts
setItem: async () => { throw new Error('device verification D5'); },
```

1. Do D4 steps 1 and 2 with the patched build, so a legacy plaintext session is
   present.
2. Launch.

**Expect:** the welcome screen — signed out, not signed in — and the plaintext
session key is gone from the container. Nothing anywhere says the learner did
something wrong; they simply sign in again.

**Fail looks like:** staying signed in (the session survived somewhere it should
not have), or being signed out while the plaintext key is still in AsyncStorage
(the readable copy outlived the failure).

3. Revert the patch. `git diff` must be empty before you continue.

### D6 — email and password

1. Sign up as a fresh account `C` from Welcome → Create account.
2. If the project requires confirmation, confirm the sentence shown is the one the
   adapter sends: *Almost there. Check your email for a confirmation link, then
   sign in.* Then confirm the email and sign in.
3. Sign out from Profile → Settings. Confirm the welcome screen.
4. Sign in again with the right password.
5. Sign in with a deliberately wrong password.

**Expect:** step 5 shows *That email and password do not match an account.* — a
plain sentence, no provider code, no error number, no scolding. Every failure has
a way forward on screen (try again, or create an account).

**Fail looks like:** a raw Supabase message, a stack trace, an alert with `AuthApiError`
in it, or a screen with no way out.

### D7 — Google sign-in over the deep link

1. From Welcome → Sign in, tap Continue with Google.
2. Complete the Google flow in the browser sheet that opens.

**Expect:** the sheet is an in-app auth session (`WebBrowser.openAuthSessionAsync`,
which on iOS is `ASWebAuthenticationSession`), the redirect returns to the app, and
`startGoogleSignIn` in `oauth.native.ts` pulls the `code` out of the callback URL
and calls `exchangeCodeForSession`. You land signed in on Home.

3. Repeat, and cancel the sheet halfway.

**Expect:** *Google sign in was closed before it finished.* and the sign-in screen
still usable.

**Fail looks like:** the browser opening as a full Safari app rather than a sheet
(the redirect will not come back), a redirect that lands on a blank page, or an
error mentioning `redirect_uri`. The redirect URL `luvani://auth/callback` must be
allow-listed in the Supabase dashboard for this build.

### D8 — password reset

1. Sign-in screen, type `A`'s email, tap the forgot-password link.

**Expect:** *Check your email for a reset link.* on the same screen.

2. Open the link on the device.

**Expect:** the set-new-password screen. On native this arrives through
`onPasswordRecovery`, and `useAuth` renders that screen ahead of everything else.

3. Set a new password, then sign in with it, and confirm the old one is refused.

**Fail looks like:** the link opening a browser page that cannot return to the app,
or the app landing on Home without ever asking for a new password.

### D9 — deletion demands a recent password reauthentication

1. Sign in as `A` and leave the app open for **more than five minutes** without
   signing in again.
2. Profile → Settings → Delete account. Enter the correct password. Confirm.

**Expect:** the account is deleted, and the app returns to the welcome screen.
`reauthenticateForDeletion(password)` calls `signInWithPassword` against the
signed-in email first, which refreshes `last_sign_in_at`; the token server then
checks it with `signedInRecently`, whose window is five minutes.

3. Repeat with account `B`, and enter the **wrong** password.

**Expect:** *That email and password do not match an account.*, the account still
exists, the delete sheet still open, and a Keep my account button that works.
Nothing was deleted.

**Fail looks like:** a deletion that succeeds without the password, or a 403 with
*Sign in again to confirm it is you, then delete the account within five minutes.*
after a correct password — the second means the reauthentication did not actually
refresh the sign-in timestamp, and it is a real defect rather than a test error.

### D10 — deletion demands a recent Google reauthentication

1. Sign in with the Google account, wait more than five minutes.
2. Profile → Settings → Delete account.

**Expect:** the sheet explains that Google will ask you to sign in again, the
Google sheet opens, and after completing it the deletion goes through. On native
`reauthenticateForDeletion` returns the result of `startGoogleSignIn` directly, so
the flow finishes in one pass.

**Fail looks like:** the deletion proceeding without the Google sheet at all, or
the sheet completing and the delete then failing with the recent-authentication
message.

### D11 — a failed local wipe is reported honestly

The order in `auth/deleteAccountFlow.ts`, wired up in `App.tsx`, is deliberate:
reauthenticate, delete server-side, then `clearActiveUserData`, then sign out. The
local wipe can fail on a device with no free storage, and the learner is told the
truth when it does. Where that sentence is drawn matters as much as the words: the
sign-out unmounts the whole signed-in tree, so it is raised before the sign-out and
read on a screen of its own on the far side of it (F496).

Temporary local patch, never committed — make the wipe throw:

```ts
export async function clearActiveUserData(): Promise<void> { throw new Error('device verification D11'); }
```

1. Sign in as a disposable account, delete it.

**Expect:** the app signs out anyway, and the screen it lands on is headed *This
device kept a copy* and carries exactly this sentence — *Your online account was
deleted, but this device could not finish erasing its local copy. Clear the app data
before sharing this device.* — with one control, *Got it*, which leads to the
welcome. A screen reader must speak the sentence when the screen appears. No screen
claims the deletion succeeded cleanly, and the learner is not stranded.

**Fail looks like:** a success screen, a silent swallow, a crash, the welcome
arriving with no warning in front of it, or a session that stays signed in to an
account the server has deleted.

2. Revert the patch. `git diff` must be empty.

### D12 — no bearer token in logs, in AsyncStorage, or in the bundle

**Logs.** With a live signed-in session, exercise sign-in, a conversation, and
deletion while capturing the log, then count — never print — matches:

```bash
xcrun simctl spawn booted log stream --predicate 'process == "Luvani"' > /tmp/luvani-ios.log
grep -c 'eyJ' /tmp/luvani-ios.log        # JWT header prefix. Expect 0.
grep -ci 'authorization: Bearer' /tmp/luvani-ios.log   # Expect 0.
grep -ci 'password' /tmp/luvani-ios.log  # Expect 0.
```

Delete the capture afterwards. A non-zero count is a finding; report the count and
the line number, not the line.

**AsyncStorage.** As D2.

**Bundle.** `npm run export:web --workspace=@luvani/mobile` produces `dist/`, and the
native bundle can be extracted from the build artefact the same way.

```bash
grep -rc 'service_role' apps/mobile/dist   # Expect 0 everywhere.
grep -rc 'SUPABASE_SERVICE_ROLE_KEY' apps/mobile/dist   # Expect 0.
```

The anon key **is** expected in the bundle: it is public by design and
`selectAuthMode` requires it at build time. The service-role key is server-only and
its presence is a P0.

### D13 — two accounts on one device never see each other's learning

1. Sign in as `A`, finish a short session so there is progress to see.
2. Sign out from Profile → Settings. Sign in as `B`.

**Expect:** `B` sees an empty history and their own onboarding. Every store keys
through `userKey` in `storage/scope.ts`, which namespaces by uid and **throws** if
nothing is signed in.

3. Sign out the same way, sign back in as `A`.

**Expect:** `A`'s progress is exactly as it was.

**Fail looks like:** `B` seeing any of `A`'s phrases, streak or history. That is a
cross-account leak and a P0, not a display bug.

### D14 — the installation signal survives deletion

1. Note that a fresh install grants a trial.
2. Delete the account, create a new one on the same device.

**Expect:** the second account does **not** get a second free trial. `installationId`
in `installation.ts` is a random UUID in AsyncStorage that deliberately outlives
sign-out and account deletion, and the server keys its trial refusal on a hash of
it. It carries no account content and is not an advertising identifier.

**Fail looks like:** a second trial. Note that the server-side half of this is
`claim_trial`, which has its own open ledger entry (`F73`); if this step fails,
check that entry is closed before filing a new one.

## Android

Run every step from the iOS list. Substitute the tooling below, and add D15 and
D16, which have no iOS equivalent.

**Container and storage.** On a debuggable build:

```bash
adb shell run-as com.luvani.app ls -R           # the whole container
adb shell run-as com.luvani.app ls databases    # AsyncStorage is RKStorage (SQLite)
adb shell run-as com.luvani.app ls shared_prefs # SecureStore lives here
```

**D2 on Android.** AsyncStorage is `databases/RKStorage`, a plain SQLite file with
a `catalystLocalStorage` table. Expect `luvani.installation.v1` and
`luvani.u.<uid>.*` and no session key. SecureStore is a SharedPreferences XML file
whose **values are AES ciphertext** under an Android Keystore key; expect entries
whose names end `.luvani-secure-meta`, `.luvani-secure-a-0`, `.luvani-secure-b-0` and
so on, and expect their values to be unreadable. A value that starts with `eyJ` in
that file means the encryption is not happening.

**D12 on Android.**

```bash
adb logcat -c
# exercise sign-in, a session, and deletion
adb logcat -d --pid=$(adb shell pidof -s com.luvani.app) > /tmp/luvani-android.log
grep -c 'eyJ' /tmp/luvani-android.log        # Expect 0.
grep -ci 'bearer' /tmp/luvani-android.log    # Expect 0.
```

`adb logcat` needs no root and no unlocked bootloader, which is exactly why a token
in the log is worse on Android than on iOS.

### D15 — a keystore key invalidated by a lock-screen change

Android invalidates keystore-backed keys when the screen lock changes or a new
biometric is enrolled. `expo-secure-store` then throws on read.

1. Sign in as `A`. Confirm the session survives a cold start.
2. Change the device PIN, or enrol a new fingerprint.
3. Launch Luvani.

**Expect:** the learner is signed out and can sign in again. In
`createSecureSessionStorage`, the throw is caught, the code falls through to the
legacy source, finds nothing, and returns `null`. No crash, no loop, no screen that
cannot be left.

**Fail looks like:** a crash on launch, a spinner that never resolves, or a repeated
sign-in that never sticks.

### D16 — restored from an Android backup

Android auto-backup can restore SharedPreferences onto a new device while the
keystore key stays behind, leaving ciphertext nothing can decrypt.

1. Sign in as `A`, trigger a backup, restore onto a second device.
2. Launch Luvani on the restored device.

**Expect:** the welcome screen, and a clean sign-in. Same path as D15.

**Fail looks like:** a crash, or — much worse — a decryptable session, which would
mean the session travelled off the original device. `WHEN_UNLOCKED_THIS_DEVICE_ONLY`
is the iOS half of that promise; Android's is the keystore key not being backed up.

## The first run on five viewports

Everything from the welcome to the first spoken French, on the screens where it is
most likely to break. Owner: `onboarding-ux-engineer` for the steps,
`qa-release-engineer` for running them. `F114` in
[KNOWN_ISSUES.md](KNOWN_ISSUES.md) checks the existence of this runbook and its
static width contracts; release evidence is complete only when this matrix is filled in.
[ONBOARDING.md](ONBOARDING.md) describes the flow these steps walk.

### Recorded web route check — 2026-08-27

This is a single behavior check, not a completed viewport row. A development build
at `http://127.0.0.1:8089/` used explicit local mock auth and a synthetic account.
The driven journey was welcome → create account → age → name → Meet Luc → Choose
your first scene. It landed visibly at `/missions`, including the first-win promise
and just-in-time microphone/type notice. Back reached `/home`; reloading stayed at
`/home`; See all situations returned to `/missions`; Back returned normally to
`/home`. This closes F58's React Navigation precedence defect. It does not prove a
Supabase round trip, a production export, native behavior, accessibility, responsive
layout at the five named sizes or time to first spoken French.

**What is already proven, statically, in the gate.** Four checks read the source of
every first-run screen and fail if it regresses: `no first-run screen hardcodes a
viewport width`, `no first-run screen caps font scaling`, `every first-run screen
leads with a heading role`, and `every visible field label is bound to its input
for assistive tech`. They are a walk over text. They cannot see a single one of the
things below.

**The five viewports.** A build on hardware or a browser at that width, not a
screenshot tool.

| Id | Viewport | Representative |
|---|---|---|
| V-S | Small iPhone | iPhone SE, 375 x 667 pt |
| V-X | Notched iPhone at the narrow floor | iPhone 13 mini, 375 x 812 pt |
| V-L | Large iPhone | iPhone Pro Max, 430 x 932 pt |
| V-A | Android | Pixel-class, ~412 x 915 dp |
| V-W | Narrow web | Browser at 360 px wide |
| V-D | Wide web | Browser at 1440 px wide |
| V-T | iPad | iPad Air 11-inch, 820 x 1180 pt portrait and 1180 x 820 landscape |

**V-X and V-T were added on 2026-09-06**, when the founder set the supported range as
iPhone X onward plus iPad. The matrix above them jumped from a 667pt-tall phone with no
notch straight to a 932pt one, so the geometry the founder actually named as the floor,
375 x 812 with a notch and a home indicator, was not represented at all. iPhone 13 mini
stands in for it: iPhone X, XS, 11 Pro, 12 mini and 13 mini are all 375 x 812, and 13
mini is the one of them the installed iOS 26 runtime can still boot.

V-T exists because `app.json` sets `supportsTablet: true`, so the App Store lists the app
on iPad whether or not anybody designed for it. What it should show is the 460pt centred
column `App.tsx` already clamps every platform to, reading as a deliberate phone column
rather than as a stretched screen.

| Id | Check | V-S | V-X | V-L | V-A | V-W | V-D | V-T |
|---|---|---|---|---|---|---|---|---|
| O1 | Every first-run screen is fully reachable at default text size | not run | not run | not run | not run | not run | not run | not run |
| O2 | The same at the largest accessibility text size | not run | not run | not run | not run | not run | not run | not run |
| O3 | Reduce motion shows the café scene's final frame, not an empty box | not run | not run | not run | not run | not run | not run | not run |
| O4 | The screen reader reads the heading first and the name field by its label | not run | not run | not run | not run | not run | not run | not run |
| O5 | The keyboard reaches every control, in order, with focus visible | n/a | n/a | n/a | n/a | not run | not run | n/a |
| O6 | Time from first launch to the first French spoken aloud | not run | not run | not run | not run | not run | not run | not run |

### O1 — every first-run screen is reachable

Install fresh, or sign out and clear app data. Walk welcome → sign up → age → name
→ Meet Luc → chooser.

**Expect:** on every screen, the title, the body and the primary action are all
reachable without the keyboard covering the field, and the primary action is either
visible or arrived at by scrolling. Meet Luc is the densest page and the one to
watch.

**Fail looks like:** a pill under the fold with nothing indicating it scrolls, a
title clipped to one line, or a text field hidden behind the keyboard on V-S.

### O2 — the same at the largest text size

iOS: Settings → Accessibility → Display & Text Size → Larger Text, at maximum.
Android: Settings → Display → Font size, at maximum. Web: browser zoom at 200%.

**Expect:** every screen scrolls to reveal what grew. Nothing is truncated with an
ellipsis, and no control becomes unreachable.

**Fail looks like:** two lines of a four-line disclosure, or a Continue pill pushed
off a screen that does not scroll. This is the step the static check cannot do:
`no first-run screen caps font scaling` proves only that nothing *asked* the text
to stay small.

### O3 — reduce motion

iOS: Settings → Accessibility → Motion → Reduce Motion. Android: Settings →
Accessibility → Remove animations. Web: OS-level reduce motion, then reload.

**Expect:** the welcome still draws the café, steam and all, held at rest. The rule
is final frame, never nothing. Turn the setting on *while* the welcome is on screen
and the movement stops without the drawing disappearing.

**Fail looks like:** an empty box where the scene was, or movement that continues.

### O4 — VoiceOver and TalkBack

Turn the screen reader on and walk the same six screens without looking.

**Expect:** each screen announces its title as a heading. The name field is
announced as "Your name", not as "text field". An error under a field is announced
when it appears. The Back chevron is announced as "Back".

**Fail looks like:** an unlabelled text field, a heading read as ordinary text, or
an error that only exists visually. Record which platform, because the three
mechanisms behind this differ per platform: Android resolves the label by id, iOS
reads the accessible name, and the web reads ARIA.

### O5 — the keyboard, web only

Tab from a fresh load of the welcome through to the chooser.

**Expect:** every control is reachable in reading order, the focus ring is visible
on all of them, and nothing traps focus. Enter submits the field it is in.

**Fail looks like:** a pill that can only be clicked, an invisible focus ring, or a
tab order that jumps backwards.

### O6 — the stopwatch

The number this whole phase is about, and the one thing no test in this repo can
produce. Start the timer at the first frame after launch on a fresh install. Stop
it when the learner has said their first French sentence aloud in a scene and the
tutor has answered.

Run it twice per viewport: once as an unhurried first-time reader, once as somebody
tapping through as fast as the screens allow. Record both, in seconds, along with
the network conditions, because a cold token server and a cold model are part of
what a learner waits through.

**Record it as:**

```
O6: <viewport> — read: <n>s — rushed: <n>s — network: <wifi|4g|throttled> — build <id>
```

**Expect:** nothing. There is no target to hold this to yet, and inventing one now
would be a number chosen to be beaten. The first honest pass sets the baseline, and
`ONBOARDING.md` records the screen and tap counts in the meantime.

**Fail looks like:** any run where the learner cannot get there at all, which is a
ledger entry, not a slow number.

## Phase 1 layout and back

The scroll, navigation and tab-bar work (F307–F315) is verified statically up to a
point: the surface tests read the source and fail if a screen re-grows its own
safe-area maths, opens a second back control, or truncates a tab label. What they
cannot see is a keyboard actually clearing a field, a label wrapping at the largest
accessibility size, an edge swipe being blocked, or a hardware back closing a sheet.
Those are a device's to prove, and this is where that pass is recorded. Owner:
`frontend-engineer` for the build, `qa-release-engineer` for running it.

`pass` / `fail` / `not run`. Every row is `not run` until a real device pass is walked.

| Id | Check | iOS | Android |
|---|---|---|---|
| P1-1 | The keyboard clears the field over the **Review** deck and the Drill exercise (iOS padding, Android resize), and the answer's grade buttons stay reachable | not run | not run |
| P1-2 | The **tab bar** label wraps rather than truncating at iOS AX3–AX5 / Android font scale 2.0 on a 320pt device, and the bar grows to hold it | not run | not run |
| P1-3 | VoiceOver and TalkBack read each tab as "…, tab, selected" and read the label once, not twice | not run | not run |
| P1-4 | Inside a live room, the iOS edge **swipe** back is blocked and raises the leave confirm; Staying keeps the room, Leaving ends it | not run | not run |
| P1-5 | Android **hardware back** raises the same confirm in a live room, and closes in place on Phrasebook, each Profile sheet, the delete confirmation on Profile → Settings, and TutorIntro page one (which leaves) | not run | not run |
| P1-6 | The notched bottom inset is paid once on every `bottom="inset"` screen, and once by the bar on every tab | not run | not run |
| P1-7 | Web at a short viewport (600px tall) scrolls every ScrollScreen to reveal what grew | not run | not run |

### P1-1 — the keyboard over Review and Drill

1. On the smallest device, open the Review deck to a retrieval card and tap the answer field. On iOS the card lifts (`KeyboardAvoidingView` padding); on Android the window resizes.
2. Repeat on a typing Drill exercise.

**Expect:** the field and its Check/attempt buttons stay above the keyboard, and a tap on them lands the first time rather than only dismissing the keyboard.

**Fail looks like:** the grade or Check buttons under the keyboard with no way to scroll to them, or a first tap that only closes the keyboard.

### P1-4 and P1-5 — the swipe and the hardware back in a room

1. Start a lesson and a conversation. In each, try the iOS edge swipe and the Android hardware back.

**Expect:** neither pops the room silently; both raise the leave confirm with Stay first. Stay keeps the room and its minutes; Leave ends it and still delivers whatever the session earned.

**Fail looks like:** a swipe or back that leaves the room without asking, or a confirm whose primary action is Leave.

## Pass 1b chrome

The chrome-consistency work (F329–F343) is verified statically up to a point: the
surface tests read the source and fail if a tab re-grows its own title, a caps label
sinks to faint ink, a tab hand-rolls a pill, or a scroll pads itself over the frame.
What they cannot see is a display title actually scrolling with the body at the
largest reading size, a monogram letter staying inside its disc, a soft-ink status
line reading on real glass, or the tutor's header, scene, doors and pill arriving in
order on a small phone. Those are a device's to prove, and this is where that pass is
recorded. Owner: `frontend-engineer` for the build, `qa-release-engineer` for running it.

`pass` / `fail` / `not run`. Every row is `not run` until a real device pass is walked.

| Id | Check | iOS | Android |
|---|---|---|---|
| P1b-1 | Each tab's display title scrolls with the body at iOS AX5 / Android font scale 2.0, and the tab's closing action stays reachable below it | not run | not run |
| P1b-2 | The five tab tops read as one family on a swipe between them: same display title, same left edge, same purpose line beneath | not run | not run |
| P1b-3 | The monogram initial stays inside its disc on Profile across AX3 to AX5, and the disc is skipped by the screen reader while the name is read from the text | not run | not run |
| P1b-4 | A pushed screen's centred title (the Review card count, the session connection line) sits centred, not half a touch target off | not run | not run |
| P1b-5 | Soft-ink status lines, costs and captions stay legible on the ground and on a white card in daylight; no word reads as greyed out | not run | not run |
| P1b-6 | On an SE-class phone the Tutor tab shows its header, then the scene, then the doors, then the one pill, in that order, and every one is reachable | not run | not run |

## Pass 2 content

The content work (F345–F350) is verified statically up to a point: the surface and
tab tests read the source and fail if Practice grows a second primary, if My French
draws a count with no module gate, or if a row spells its own verb instead of
reading it from `progress/portfolio.ts`. What they cannot see is the headline and
its button arriving first under the header at the largest reading size, the refine
verb wrapping inside its row rather than clipping, or a whole tab of rows plus the
closing card fitting a small phone in order. Those are a device's to prove, and this
is where that pass is recorded. Owner: `frontend-engineer` for the build,
`qa-release-engineer` for running it.

`pass` / `fail` / `not run`. Every row is `not run` until a real device pass is walked.

| Id | Check | iOS | Android |
|---|---|---|---|
| P2-1 | On Practice at iOS AX5 / Android font scale 2.0, the next-step headline and its one button sit first under the header, above the path, and both are reachable | not run | not run |
| P2-2 | A finished situation's "Refine pronunciation" wraps inside its My French row from iOS AX3 through AX5, never clipping or pushing the row off the card | not run | not run |
| P2-3 | On an SE-class phone My French shows its situation rows, then the next-situation card, then the one pill, then the quiet "Choose another situation" door, in that order, each reachable | not run | not run |
| P2-4 | A brand-new account's My French shows no number anywhere: no stat rail, no notebook count, no week, no stamp until one is earned | not run | not run |

## Pass 3 first run

The first-run frame work (F352, F355, F356, F357, F359, F361) is verified statically
up to a point: the surface, answers and voice-step tests read the source and fail if a
first-run screen re-grows its own safe-area maths, if an auth pill leaves the footer, if
the deny ghost survives a refusal, or if the Meet lines go back to centred. What they
cannot see is the left edge holding still from the voice step into the chooser, the
keyboard actually keeping a field and the pill visible, an ear turning violet and
clearing when its clip ends, the refusal being spoken on both gates, or the dense Meet
page wrapping as left-set paragraphs at AX5. Those are a device's to prove, and this is
where that pass is recorded. Owner: `onboarding-ux-engineer` for the build,
`qa-release-engineer` for running it.

`pass` / `fail` / `not run`. Every row is `not run` until a real device pass is walked.

| Id | Check | iOS | Android |
|---|---|---|---|
| P3-1 | The left edge does not move as a first run advances: the back chevron, the dots and every title sit on the same gutter from the voice step into the chooser and on into Home | not run | not run |
| P3-2 | On SignUp with the keyboard up, an SE-class phone keeps a field and the Create account pill both visible; the pill does not scroll away and the switch row is not what sits above the keys | not run | not run |
| P3-3 | On the voice step an ear turns violet on a quiet disc when tapped, clears on a second tap and again when the clip ends on its own, and VoiceOver reads "Stop Luc" while it sounds and "Hear Luc" once it stops | not run | not run |
| P3-4 | Saying "I am younger than that" speaks the refusal on both the first-run gate and the return gate, removes the way through, and Sign out lands back on the welcome | not run | not run |
| P3-5 | The progress dots read "Step 1 of 4" as one element, and a chosen voice reads selected to the screen reader | not run | not run |
| P3-6 | The Meet page at iOS AX5 / Android font scale 2.0 wraps its four lines as left-set paragraphs under the centred title and art, with the one pill still pinned and reachable | not run | not run |

## Pass 4 mockup review

The mockup-review pass (F362 to F381) is verified statically up to a point: the palette
test holds every tint to a paper's floors, the screen tests read the source and fail if a
tab grows a second pill, if the evidence row draws at zero, if a door stops reading its
words from gate.ts, if the Field loses its Show/Hide, or if the Apple door is drawn where
the platform does not offer it. What they cannot see is a disc reading as a disc at the
largest reading size, the Apple sheet on a signed build, a typed-by-default learner
meeting the box with the circle still tappable, a slow-pace first line being short, the
ear lighting while the tutor sounds, or the caret surviving Show/Hide on iOS. Those are a
device's to prove, and this is where that pass is recorded. Owner: `frontend-engineer`
for the screens, `auth-engineer` for the Apple door, `qa-release-engineer` for running it.

Apple Sign In needs the paid Apple Developer capability on the bundle id and the Supabase
Apple provider configured before P4-2 can be walked at all; until then the row is
`not run` for a reason the phone cannot fix.

`pass` / `fail` / `not run`. Every row is `not run` until a real device pass is walked.

| Id | Check | iOS | Android |
|---|---|---|---|
| P4-1 | At iOS AX5 / Android font scale 2.0 the six tinted discs on Home, Tutor and My French still read as discs under their drawings, and no tint is mistaken for a rung or a signal beside the orb | fail | not run |
| P4-2 | On a signed iOS build, Continue with Apple opens the Apple sheet; cancelling it leaves one plain sentence and nothing else changed; completing it lands in the app with the provider recorded as apple. Android and web draw no Apple door | not run | not run |
| P4-3 | With Prefer typing on, a conversation opens with the reply box showing, no microphone prompt, the tutor still speaking, and the circle still tappable; turning it off restores the circle-first opening | not run | not run |
| P4-4 | With Tutor speaks slower on, the first line of a new conversation is short and simple, and stays so; the Slower chip still works for a learner who never asked | not run | not run |
| P4-5 | The ear on the tutor's last bubble is ink while quiet and turns violet on a quiet disc while the tutor sounds; tapping the bubble replays the line; VoiceOver reads "Hear that line again" | not run | not run |
| P4-6 | Show/Hide on every password field keeps the caret and the typed text in place on iOS, and VoiceOver reads "Show password" / "Hide password" | not run | not run |

## Pass 5 daily home

The daily-home pass (F387 to F410, extended by F432 to F440) is verified statically up to a
point: the greeting rule is a plain module with its clock injected, the daily pick is a pure
function of the day key, every momentum numeral is gated on its own field by construction, and
the source walk fails if a tab grows a third pill, if a line caps its reading size, or if a row
falls under the touch floor.
What no test in this repo can see is a fade at the measured timing, a screen reader meeting
text that changes every few seconds, a column at the largest reading size on a small phone,
or whether the two pills can be reached with one thumb. Those are a device's to prove, and
this is where that pass is recorded. Owner: `frontend-engineer` for the screens,
`design-system-engineer` for the scene and the contrast, `qa-release-engineer` for running it.

P5-4 changed with F432. The founder decided on 2026-09-05 that the four momentum cards are
present from the learner's first day, worded as a start, overturning the earlier rule that kept
them off a fresh account entirely. The row now asks a tester to look at exactly the screen that
rule was protecting: four cards with no numbers in them. What it is checking is that they read
as an invitation and not as a scoreboard of noughts, which is the one thing no source walk in
this repository can answer.

`pass` / `fail` / `not run`. Every row is `not run` until a real device pass is walked.

P5-1 was walked in the web build on 2026-09-05 and the greeting cycled at 3760ms and 3744ms against
the 3750ms measured off the founder's video. **That walk is withdrawn.** The founder then asked for a
swipe rather than a fade, and a measurement of the old motion is not evidence about the new one. The
cadence between words is deliberately unchanged, so the number is likely to hold; the row is back to
`not run` because likely is not walked. That same run found F415 and F416, which is what a screen
nobody had looked at is for.

| Id | Check | iOS | Android |
|---|---|---|---|
| P5-1 | Home's complete greeting rises through one clipped line about every four seconds; the name moves with the phrase, the two lines never double over one baseline, and there is no blank, flash or pause at the commit, including on the first rotation after a cold start | not run | not run |
| P5-2 | With reduce motion on, the greeting stops on one still word, Bonjour by day and Bonsoir after six, the day's word scene holds its final frame, and nothing on Home is blank | not run | not run |
| P5-3 | VoiceOver and TalkBack read one greeting on Home and do not announce it again while it cycles; the word of the day drawing is walked past in silence | not run | not run |
| P5-4 | On a fresh account, Home shows the greeting and mission hero, while Progress carries all four momentum cards. Every card uses a start line where a number would be nought. The speaking-time card has no fraction, percentage or progress bar in any state: after a timed conversation it shows only the measured minutes and a gentle status sentence. The phrase-bank link appears only when there is a real phrase behind it | not run | not run |
| P5-5 | At iOS AX5 / Android font scale 2.0 on an SE-sized phone, Home and Tutor show no clipped line, no truncated title and no horizontal scroll; the two momentum tiles stay side by side or stack cleanly, the hero's French chips wrap onto further lines rather than being cut off, and the phrase bank link stays reachable at the touch floor | not run | not run |
| P5-6 | VoiceOver and TalkBack read the speaking-time title, truthful measured minutes and gentle status sentence; neither exposes hidden progress-bar semantics or a percentage for the optional target | not run | not run |
| P5-7 | Leaving a guided mission part way makes the Tutor resume card offer it back with a minutes line; finishing that mission clears the line | not run | not run |
| P5-8 | Resume and Open conversation are both reachable one-handed on a large phone, and each is comfortably above the touch floor | not run | not run |
| P5-9 | Bookmarking today's situation on Home makes it appear under My French; un-bookmarking removes it, and it stays removed after a relaunch | not run | not run |
| P5-10 | Every animated greeting keeps a normal word-space before the name. At AX3–AX5 the animation stands down, the complete greeting uses normal flow, and a long name wraps rather than clipping | not run | not run |
| P5-11 | A different drawing appears on a different day, each one moving, and the situation card carries no Demo mode label even with the tutor servers down | not run | not run |

## Pass 6 Practice, and the audit that came with it

The Practice rebuild (F442 to F448) and the repair of what running it exposed (F449 to
F455) are verified statically up to a point: the archive is a pure module with its clock
injected and its growth tested at nought, one, three and six conversations; the shuffle is
tested as a permutation rather than a sample; a pack written before `topics` existed is
folded rather than thrown on; and the source walk fails if the tab counts anything itself,
grows a second pill, or drops the monogram rule.

What no test in this repository can see is the thing that actually went wrong. F449 was a
screen that sat there loading, and every suite was green while it did, because every
fixture written for the feature included the field the real device did not have. A source
walk cannot open a tab. So the rows below are the ones that need a phone, and the first of
them is the one that matters.

`pass` / `fail` / `not run`. Owner: `frontend-engineer` for the screens,
`qa-release-engineer` for running them.

| Id | Check | iOS | Android |
|---|---|---|---|
| P6-1 | On an account whose packs were written before `topics` existed, Practice draws its vault, its feed and its next step rather than a header and a floating suggestion card | not run | not run |
| P6-2 | With storage made to fail, Practice says the read did not finish and Try again re-runs it, rather than showing a screen that cannot be told apart from a slow one | not run | not run |
| P6-3 | Tapping Suggest another five hundred times meets five hundred different situations, and the five hundred and first is a fresh order rather than the first one again | not run | not run |
| P6-4 | A brand new account is shown only tier one situations, on Home and on Practice, and a learner past General is shown tier two | not run | not run |
| P6-5 | The voice circle stops moving when the Tutor tab loses focus, and starts again when it returns | not run | not run |
| P6-6 | VoiceOver on the lesson and the conversation reads the progress rail without speaking a count | not run | not run |
| P6-7 | At iOS AX5 on a 375 x 812 phone, Practice shows the vault, the feed, a session card and the suggestion card in order, with no clipped line and no horizontal scroll | not run | not run |
| P6-8 | Every door out of Practice lands somewhere that agrees with the card that opened it: both next-step branches, Revisit topics, Suggest another, Practise your phrases, With tutor | not run | not run |

P6-1 is the row this whole pass exists for, and it is worth saying how to set it up,
because the obvious way to run it proves nothing. A pack built by the current code always
carries the field. The row needs a pack written by the previous build, or one edited into
the app container by hand with `topics` and `durationSec` deleted. Anything else is
testing the fixture rather than the learner's phone.

## Recording the result

Fill the matrix in place, in this file, in the same commit as any ledger entry a
failure produced. Then add a run record:

```
Run: <date> — <tester> — iOS <version> on <device>, build <id>
              — Android <version> on <device>, build <id>
Result: <n> pass, <n> fail, <n> not run
Filed: <ledger ids, or none>
```

`F71` may be ticked only when every row reads `pass` on both platforms, and the
ledger's `verified-by` test is passing. A row that reads `not run` is not a pass,
and a runbook that exists is not a run.

Do not include tokens, passwords, access tokens, full email addresses, log
excerpts containing any of those, or screenshots of them. Counts and verdicts only.

Run: 2026-09-04 — Claude (Pass 4 walk) — iOS 26 on iPhone 17 Pro Simulator, debug build from
     `apps/mobile/ios` at `de9aae6` plus the fixes below — Android not run, no device
Result: 0 pass, 1 fail, 5 not run
Filed: F382, F383, F384, F385, F386

What the walk actually established, row by row. A simulator is not a device, so nothing here
is a substitute for P1 to P4 on real hardware; what it can prove it proved.

- **P4-1 fail.** The tinted discs themselves read correctly at accessibility XXXL: the sand disc
  on Home stayed a disc with its drawing inside, and the Tutor tab's six-disc teaser drew six
  distinct tinted discs. The row fails on its third surface: at that text size My French draws its
  header and subtitle and nothing else, and will not scroll (F383).
- **P4-2 not run.** The build is unsigned, so no real Apple sheet can open. What the walk did
  establish is the half above it: `Continue with Apple` is drawn on iOS, above the Google door,
  and was absent on the same screens on web. Tapping it completed through the mock adapter into
  the first-run flow. The sheet, a cancel, and a real provider round trip still need a signed
  build and the Supabase Apple provider.
- **P4-3 not run.** With Prefer typing on, a live cafe session opened with the reply box and Send
  showing, the circle still labelled "Tap to talk", the tutor speaking, and no microphone prompt.
  The other half of the row, that turning it off restores the circle-first opening, was not walked.
- **P4-4 not run.** Tutor speaks slower was on and the opening line was short, but a mission opens
  on its authored line with no model call (`openScene` in convo.ts), so that says nothing about
  pace. This needs the talk-freely door, where the first line comes from the model.
- **P4-5 not run.** The ear draws on the tutor's last bubble now that F385 is fixed. Its lit state
  while the tutor sounds, tap-to-replay, and the VoiceOver label were not verified.
- **P4-6 not run.** On iOS, Show revealed the typed password with the caret held after the last
  character and Hide restored the dots, both without losing the text. The VoiceOver announcement
  was not heard, so the row is not complete.

Three defects were found by running this and are fixed on the branch: the phone was being served
the web stand-in of every native module (F382), every job process re-verified the vendors and timed
out so no tutor ever joined (F384), and the tutor's lines rendered at zero width beside their own
ear (F385). Two are recorded and one of those is fixed: My French at the largest text size (F383,
open) and the recap's render loop (F386, fixed — the first attempt at that fix introduced a
conditional-hook crash and was caught by review before it landed). One environment note that is not a product defect:
the local token server's distributed rate limiter timed out against Upstash and answered 500 on
`/session/start`; commenting the two `UPSTASH_*` lines out of `services/token-server/.env` let
sessions start. That was not investigated further and is local configuration, not shipped code.


## Pass 7 settings

Profile split in two (F473). What stayed is the learner and their tutor; what moved is the
account, the subscription, the analytics consent, the two legal documents, the phone's own
permissions and the version line, all behind one row on a pushed `Settings` screen.

It is verified statically up to a point, and the point is unusually clear here. Every rule
is a pure module with its own suite: `phoneRows` is a truth table over nine states,
`subscriptionGroup` answers null with no store, `analyticsAllowed` reads only a literal
true, `companyLine` and `contactRow` answer nothing for a fact nobody has supplied, and the
source walk fails if a row spells its own label, if a label carries a digit, or if either
screen reaches the operating system anywhere but through the platform pair.

What no test in this repository can see is every one of the rows below, and they are the
nine things this pass actually promises. A source walk cannot open iOS Settings, cannot
make the App Store show a subscription sheet, cannot restore a purchase, cannot open Mail,
and cannot read a long document at the largest reading size. Two of the nine are the same
axis as the still-open F383, so they are worth running early. P7-9 is F489's own row: a
refusal drawn beside the row that caused it is the whole of that fix, and where a line is
drawn on a scroll is the one thing a source walk cannot see.

`pass` / `fail` / `not run`. Every row is `not run` until a real device pass is walked.
Owner: `frontend-engineer` for the screens, `qa-release-engineer` for running them.

| Id | Check | iOS | Android |
|---|---|---|---|
| P7-1 | With the microphone refused in the phone's own settings, the Microphone row appears under Phone on Settings, and tapping it opens Luvani's own page in Settings rather than the top of the settings app | not run | not run |
| P7-2 | With notifications refused the same way, the Notifications row appears and does the same, and the reminder row under Phone on Settings still says notifications are off rather than showing a live switch | not run | not run |
| P7-3 | Allowing either permission and taking the ordinary walk back into the app makes that row go away without a relaunch, and allowing both leaves no Phone group at all | not run | not run |
| P7-4 | On a signed build with store keys, Manage subscription opens the store's own subscription sheet, and dismissing it says nothing at all; on a build without keys the whole Subscription group is absent rather than showing two rows that open onto nothing | not run | not run |
| P7-5 | Restore purchases on a fresh install reports that the store was checked, with no number, no price and no claim about speaking time, and the same tap on the paywall behaves the way it always did | not run | not run |
| P7-6 | Privacy policy reads end to end at the largest text size on a small phone: every section scrolls into view, no line is clipped, the screen scrolls past the intro, and the line saying a review is still required is present and legible | not run | not run |
| P7-7 | Once a support address is set, Contact us appears under Help and opens Mail with the address filled in and no subject; on a phone with no mail account the row says the phone would not open it and the address is still readable on screen | not run | not run |
| P7-8 | The Share usage data switch is off on a fresh install, survives a relaunch after being turned on, and is gone after Delete account, so a new account on the same phone starts off again | not run | not run |
| P7-9 | With the phone offline, Download my data says why in the Data and privacy card, beside the row that was tapped and without the list scrolling anywhere, the row goes back from Preparing on its own, and the next Android back press leaves Settings rather than being eaten | not run | not run |

P7-6 is the row worth setting up carefully. The policy is the longest piece of text in the
app, and the failure it is looking for is the one F383 records on My French: the header
renders, everything below it does not, and the screen will not scroll past it. Set the text
size to accessibility XXXL before opening the screen rather than after, because a layout
that has already measured itself at the default size can pass a check the first open would
have failed.

P7-4 and P7-5 need a signed build with real store keys. In Expo Go, on the web, and on any
build without keys the store answers with no product, `subscriptionGroup` returns null, and
there is nothing on screen to walk. That is the designed behaviour rather than a blocker,
and it is what P7-4's second clause checks.


## Pass 8 revamp

Revamp A replaced the surface of the whole app: white cards on porcelain with one whisper
of a shadow, pastel rows with a white disc and a line-art glyph, watercolour pictures
bleeding off four header corners, a gradient orb, and three sections moved one level down
onto routes of their own.

Almost none of that is a rule a source walk can see. It can prove a picture is registered,
sized once and spread decorative; it cannot see whether the wash meets the corner cleanly
on a 320pt phone. It can prove the tab bar caps nothing; it cannot see whether five words
fit at accessibility XXXL. It can prove the orb has a rest branch; it cannot see the orb
rest. And two of these rows are the only evidence there will ever be for a promise made in
words rather than in code: that replaying a moment records nothing, and that an own-words
attempt with no verdict leaves no grade behind.

Three rows are the same axis as the still-open F383 and F461, and P8-9 is the one filed
with F592: the raster art decodes at file size on Android until somebody measures it.

`pass` / `fail` / `not run`. Every row is `not run` until a real device pass is walked.
Owner: `frontend-engineer` for the screens, `qa-release-engineer` for running them.

| Id | Check | iOS | Android |
|---|---|---|---|
| P8-1 | The header picture bleeds off the corner on Home, Practice, My French and Profile, at 390pt and again at 320pt, with no seam and no white box behind the wash, and the headline never runs underneath it | not run | not run |
| P8-2 | At accessibility XXXL the tab bar keeps every whole word, stacking the glyph over the label rather than truncating it (F461, F583), and all five tabs scroll from the header to the last row without a block clipping (F383) | not run | not run |
| P8-3 | With reduce motion on, the orb is one still gradient with its rings and lines drawn once, Home's greeting stops swapping and shows one greeting, and nothing on any tab loops | not run | not run |
| P8-4 | VoiceOver and TalkBack walk past every illustration in silence, and read each tinted row once as its title, its gloss and a button, rather than as three separate nodes | not run | not run |
| P8-5 | The speaker on Your next practice says the French line aloud, names itself Stop while it is playing, and stops when the tab is left rather than talking over the next screen | not run | not run |
| P8-6 | Replay a moment speaks the better line and keeps nothing: no recording is made, no microphone permission is asked for, and coming back to the tab shows the same row rather than a result | not run | not run |
| P8-7 | The own-words drill takes a typed attempt and returns a verdict; with the phone offline the same Check reveals one way to say it, says the tutor could not read it, and leaves the card ungraded, because a verdict that never arrived is never a grade | not run | not run |
| P8-8 | A scripted lesson at the largest reading size keeps every support control reachable with one thumb, collapsing the ghost row to one More chip rather than clipping it off the right edge (F462) | not run | not run |
| P8-9 | On an Android device, graphics memory measured with `adb shell dumpsys meminfo` after walking all five tabs, the chooser and Progress stays inside the budget agreed for the build, and no picture decodes larger than twice its box (F592) | not run | not run |
| P8-10 | The rhythm card on Profile fills exactly the days the learner spoke, Monday first and Sunday last whatever today is, days after today unfilled, and the goal and correction controls announce which one is chosen on the web as well as on a device (F522) | not run | not run |
| P8-11 | Onboarding and sign-in at 320pt with the keyboard raised keep the primary pill and at least one field visible, and the corner picture never covers a field | not run | not run |
| P8-12 | The wall's four pages and the inline paywall can be read and answered with one thumb while standing, the chosen plan is ringed and announced, and no price or period is a number the screen invented | not run | not run |
| P8-13 | On the web the app clamps to the column at 460pt in a 1440pt browser window: the header art, every tinted row, the hero card and the tab bar all stay inside it, and nothing spans the window | not run | not run |
| P8-14 | A live conversation at 320pt keeps the orb, the thread and all five ghost controls reachable one-handed, and the out-of-minutes card reads end to end with no horizontal scroll | not run | not run |

P8-6 and P8-7 are promises about what does NOT happen, so they are walked with the phone's
own indicators rather than with the app: the microphone indicator must never appear during
a replay, and the review deck must hold the same number of due cards before and after an
offline Check. A row that cannot be shown to have not happened is worth more here than a
row that shows something did.


## What this runbook cannot prove

- **Anything about a build it was not run against.** These are manual steps on
  specific hardware; they say nothing about the next build.
- **Anything a dependency does internally.** If the Supabase SDK, LiveKit or React
  Native logs something the platform log does not show under Luvani's process, D12
  will not see it.
- **Keychain and keystore strength.** The check is that the session is there and
  not in plaintext storage, not that the platform's encryption is sound.
- **Timing races on slower hardware.** D4 and D5 exercise the migration once. A
  device that dies mid-write is covered by the A/B generation design in
  `secureSessionStorage.ts` and by its unit tests, not by a step here.
- **The server side of deletion.** That the Supabase rows actually cascade is one
  of the checks in the blocked Supabase harness (`F63`), not something a phone can
  show you.

Run: 2026-09-07 — Claude — iOS 26.5 on iPhone 13 mini Simulator (375 x 812, the V-X row),
     dev client against the full local stack from `npm run dev`, at `a1da4d6` plus the two
     SessionView fixes — Android not run, no device
Result: 4 pass, 2 fail, the rest not run
Filed: F461, F462

What the walk established, and what it did not.

**Passed.** Practice opens correctly on a fresh account with no vault, no feed and no
zeros, which is the screen F449 broke. Home draws the day, pitches the word and the
situation at the learner's tier, and its momentum block shows four cards with invitation
lines and not one nought. A scripted lesson runs end to end: the tutor speaks, a typed
answer is graded, the rail advances, and the rail carries no count. The new pool reaches
the tutor agent intact, verified in the room metadata as a seed topic authored yesterday.
Home scrolls fully at accessibility XXXL.

**Failed.** The tab bar at accessibility XXXL (F461) and the live session at the same size
(F462). Both are recorded rather than repaired, and both are the same axis as the open
F383.

**Not reached: a free conversation with the tutor.** The room opened, the token server
issued the grant and the agent worker was registered with vendors verified, but LiveKit
never dispatched a job to it, so nobody joined. That is local dispatch configuration
rather than app code, and the app answered it exactly as designed: "Your tutor did not
pick up. The room opened but nobody joined it, so nothing has been counted against your
minutes", with a way back. So `ConvoScreen` itself, and the three controls dimmed there by
F459, remain unwalked on a device. `LiveErrorView` was walked, and it pays its inset, which
is one of the three screens F444 moved onto the shared frame.
