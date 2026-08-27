# Device verification — auth, session storage, deletion, and the first run

**Status: not run.** No representative iOS or Android build of Parle exists on the
machine this was written on, so every row in [the matrix](#the-matrix) below says
`not run`. This file is the runbook, not the result. `F71` in
[KNOWN_ISSUES.md](KNOWN_ISSUES.md) stays open until the matrix is filled in from a
real device pass and the outcome is recorded here. `F114`'s checked ledger entry
means that this runbook and its static responsive-width contracts exist; it does
not mean the matrix was run. Release evidence remains pending until
[the first run on five viewports](#the-first-run-on-five-viewports) has been walked
and recorded, including F58's authenticated web-first-run assertions.

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
- whether the Google deep link `parle://auth/callback` is actually claimed by the
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

- iOS: bundle identifier `com.parle.app`, scheme `parle`.
- Android: package `com.parle.app`, scheme `parle`.

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
| iOS simulator | `xcrun simctl spawn booted log stream --predicate 'process == "Parle"'` | `xcrun simctl get_app_container booted com.parle.app data` |
| Android | `adb logcat --pid=$(adb shell pidof -s com.parle.app)` | `adb shell run-as com.parle.app ls -R` (debuggable builds only) |

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
| D7 | Google sign-in over the `parle://auth/callback` deep link | not run | not run |
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

**Fail looks like:** the session starts anyway with no account, or the Profile tab
shows an email ending `@parle.local`. That is `mockAdapter`, and it means a
development flag reached this build. Stop; nothing else in this runbook is valid.

### D1 — a session survives backgrounding, cold start and reboot

1. Sign in with `A`. Note the email shown in Profile.
2. Background the app for five minutes, return.
3. Force-quit, relaunch.
4. Reboot the phone, relaunch **without** unlocking anything else first, then
   unlock and open Parle.

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
   com.parle.app data` on the simulator.
2. Look in `Documents/RCTAsyncLocalStorage_V1/` — that is AsyncStorage.

**Expect:** AsyncStorage holds `parle.installation.v1` and keys shaped
`parle.u.<uid>.<suffix>` (the per-account stores from `storage/scope.ts`) and
**nothing else that looks like a session**. Specifically no `sb-…-auth-token`, and
no `.parle-secure-meta` or `.parle-secure-a-0` — those belong in the keychain,
which is not in the container at all. The container carrying no session material
is the pass.

**Fail looks like:** any value in that directory that is a long dot-separated
base64 string. Count it, do not copy it, and file it as a P0.

### D3 — a reinstall does not resurrect a session for a deleted account

This is the iOS-specific one. Keychain items are **not** removed when an app is
deleted, so a reinstalled Parle can find a session written by the previous install.

1. Sign in as `A`. Delete the account from Profile → Delete account and complete
   the flow (see D9).
2. Delete the app. Reinstall it. Launch.

**Expect:** the welcome screen. `deleteAccount()` is followed by `auth.signOut()`
in `App.tsx`, and sign-out runs `removeItem`, which drops the `.parle-secure-meta`
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
3. Sign out from Profile. Confirm the welcome screen.
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
error mentioning `redirect_uri`. The redirect URL `parle://auth/callback` must be
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
2. Profile → Delete account. Enter the correct password. Confirm.

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
2. Profile → Delete account.

**Expect:** the sheet explains that Google will ask you to sign in again, the
Google sheet opens, and after completing it the deletion goes through. On native
`reauthenticateForDeletion` returns the result of `startGoogleSignIn` directly, so
the flow finishes in one pass.

**Fail looks like:** the deletion proceeding without the Google sheet at all, or
the sheet completing and the delete then failing with the recent-authentication
message.

### D11 — a failed local wipe is reported honestly

The order in `App.tsx` is deliberate: reauthenticate, delete server-side, then
`clearActiveUserData()`, then sign out. The local wipe can fail on a device with no
free storage, and the learner is told the truth when it does.

Temporary local patch, never committed — make the wipe throw:

```ts
export async function clearActiveUserData(): Promise<void> { throw new Error('device verification D11'); }
```

1. Sign in as a disposable account, delete it.

**Expect:** exactly this sentence on screen — *Your online account was deleted, but
this device could not finish erasing its local copy. Clear the app data before
sharing this device.* — and the app signs out anyway and lands on welcome. No
screen claims the deletion succeeded cleanly, and the learner is not stranded.

**Fail looks like:** a success screen, a silent swallow, a crash, or a session that
stays signed in to an account the server has deleted.

2. Revert the patch. `git diff` must be empty.

### D12 — no bearer token in logs, in AsyncStorage, or in the bundle

**Logs.** With a live signed-in session, exercise sign-in, a conversation, and
deletion while capturing the log, then count — never print — matches:

```bash
xcrun simctl spawn booted log stream --predicate 'process == "Parle"' > /tmp/parle-ios.log
grep -c 'eyJ' /tmp/parle-ios.log        # JWT header prefix. Expect 0.
grep -ci 'authorization: Bearer' /tmp/parle-ios.log   # Expect 0.
grep -ci 'password' /tmp/parle-ios.log  # Expect 0.
```

Delete the capture afterwards. A non-zero count is a finding; report the count and
the line number, not the line.

**AsyncStorage.** As D2.

**Bundle.** `npm run export:web --workspace=@parle/mobile` produces `dist/`, and the
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
2. Sign out. Sign in as `B`.

**Expect:** `B` sees an empty history and their own onboarding. Every store keys
through `userKey` in `storage/scope.ts`, which namespaces by uid and **throws** if
nothing is signed in.

3. Sign out, sign back in as `A`.

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
adb shell run-as com.parle.app ls -R           # the whole container
adb shell run-as com.parle.app ls databases    # AsyncStorage is RKStorage (SQLite)
adb shell run-as com.parle.app ls shared_prefs # SecureStore lives here
```

**D2 on Android.** AsyncStorage is `databases/RKStorage`, a plain SQLite file with
a `catalystLocalStorage` table. Expect `parle.installation.v1` and
`parle.u.<uid>.*` and no session key. SecureStore is a SharedPreferences XML file
whose **values are AES ciphertext** under an Android Keystore key; expect entries
whose names end `.parle-secure-meta`, `.parle-secure-a-0`, `.parle-secure-b-0` and
so on, and expect their values to be unreadable. A value that starts with `eyJ` in
that file means the encryption is not happening.

**D12 on Android.**

```bash
adb logcat -c
# exercise sign-in, a session, and deletion
adb logcat -d --pid=$(adb shell pidof -s com.parle.app) > /tmp/parle-android.log
grep -c 'eyJ' /tmp/parle-android.log        # Expect 0.
grep -ci 'bearer' /tmp/parle-android.log    # Expect 0.
```

`adb logcat` needs no root and no unlocked bootloader, which is exactly why a token
in the log is worse on Android than on iOS.

### D15 — a keystore key invalidated by a lock-screen change

Android invalidates keystore-backed keys when the screen lock changes or a new
biometric is enrolled. `expo-secure-store` then throws on read.

1. Sign in as `A`. Confirm the session survives a cold start.
2. Change the device PIN, or enrol a new fingerprint.
3. Launch Parle.

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
2. Launch Parle on the restored device.

**Expect:** the welcome screen, and a clean sign-in. Same path as D15.

**Fail looks like:** a crash, or — much worse — a decryptable session, which would
mean the session travelled off the original device. `WHEN_UNLOCKED_THIS_DEVICE_ONLY`
is the iOS half of that promise; Android's is the keystore key not being backed up.

## The first run on five viewports

Everything from the welcome to the first spoken French, on the screens where it is
most likely to break. Owner: `onboarding-ux-engineer` for the steps,
`qa-release-engineer` for running them. `F114` in
[KNOWN_ISSUES.md](KNOWN_ISSUES.md) closes when this matrix is filled in.
[ONBOARDING.md](ONBOARDING.md) describes the flow these steps walk.

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
| V-L | Large iPhone | iPhone Pro Max, 430 x 932 pt |
| V-A | Android | Pixel-class, ~412 x 915 dp |
| V-W | Narrow web | Browser at 360 px wide |
| V-D | Wide web | Browser at 1440 px wide |

| Id | Check | V-S | V-L | V-A | V-W | V-D |
|---|---|---|---|---|---|---|
| O1 | Every first-run screen is fully reachable at default text size | not run | not run | not run | not run | not run |
| O2 | The same at the largest accessibility text size | not run | not run | not run | not run | not run |
| O3 | Reduce motion shows the café scene's final frame, not an empty box | not run | not run | not run | not run | not run |
| O4 | The screen reader reads the heading first and the name field by its label | not run | not run | not run | not run | not run |
| O5 | The keyboard reaches every control, in order, with focus visible | n/a | n/a | n/a | not run | not run |
| O6 | Time from first launch to the first French spoken aloud | not run | not run | not run | not run | not run |

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

## What this runbook cannot prove

- **Anything about a build it was not run against.** These are manual steps on
  specific hardware; they say nothing about the next build.
- **Anything a dependency does internally.** If the Supabase SDK, LiveKit or React
  Native logs something the platform log does not show under Parle's process, D12
  will not see it.
- **Keychain and keystore strength.** The check is that the session is there and
  not in plaintext storage, not that the platform's encryption is sound.
- **Timing races on slower hardware.** D4 and D5 exercise the migration once. A
  device that dies mid-write is covered by the A/B generation design in
  `secureSessionStorage.ts` and by its unit tests, not by a step here.
- **The server side of deletion.** That the Supabase rows actually cascade is one
  of the checks in the blocked Supabase harness (`F63`), not something a phone can
  show you.
