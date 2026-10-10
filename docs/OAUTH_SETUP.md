# Luvani social sign-in

The iPhone development and store builds use bundle ID `com.luvani.app` and
scheme `luvani`. Login and create account share the same provider methods.
Google uses a system authentication browser and a PKCE code exchange; iOS
Apple uses the native system sheet and an identity-token exchange.

## Supabase project configuration

Project: `cfimkuustkhthujdpjlq` (dashboard name **Parle**).

- In **Authentication → URL Configuration → Redirect URLs**, add the exact
  `luvani://auth/callback` URL, preserving existing web URLs. A wildcard for the
  entire scheme is unnecessary. The app currently passes the PKCE flow ID
  directly to the SDK exchange instead of appending it to the callback URL.
- Keep Google enabled. Its web OAuth client must allow
  `https://cfimkuustkhthujdpjlq.supabase.co/auth/v1/callback` in Google Cloud's
  authorized redirect URIs. This is a separate redirect from the final native
  return above.
- Enable Apple and include `com.luvani.app` in its Client IDs. Keep nonce
  verification enabled. Native iOS identity-token sign-in does not require an
  Apple OAuth client secret.
- Apple on web/Android additionally requires a registered Apple Services ID,
  website domain, callback URL and current OAuth secret. Put the Services ID
  first in Supabase's Client IDs and retain `com.luvani.app` for iOS. Enter
  credentials in the dashboard; never commit them or send them in chat.
- In Apple Developer, enable **Sign in with Apple** for `com.luvani.app`, then
  rebuild the signed development client if its provisioning or entitlements
  predate that capability. `app.json` already requests the entitlement and
  registers `expo-apple-authentication`.

## Investigation on 10 October 2026

Read-only live settings showed **Google enabled, Apple disabled**. The app's
Apple availability check stops before opening the system sheet when Supabase
reports it disabled. Recent Google `/callback` log entries were 302 responses
with `http://localhost:3000` as the recorded referrer. Inspection of the signed-in
Chrome dashboard confirmed an empty redirect allow list and a default Site URL
of `http://localhost:3000`. Apple was disabled with no Client IDs configured.
After user approval, saved the exact native callback and enabled Apple with
Client ID `com.luvani.app`. Chrome had autofilled unrelated saved-login values
into the Apple form; both inputs were confirmed as browser autofill and those
unsaved values were discarded before saving the native configuration.

Live `/auth/v1/settings` now reports both providers enabled. A read-only Google
authorize probe with the app's exact callback produces a 302 and the server
records `luvani://auth/callback` as the return destination. A probe that appends
a flow-ID query still falls back to localhost; the app does not append this
query, as verified by the SDK integration test. Keep the callback exact or
update the allow list deliberately if that SDK option is enabled in future.

Provider failures now appear immediately below the social buttons on both
forms, with an iOS accessibility announcement. They no longer appear only below
the email/password fields.

## Verification

Automated tests exercise the native Google flow with the installed Supabase
SDK and a Hermes-style crypto environment: S256 matches the stored verifier,
the original flow ID reaches the exchange, and the resulting session is
persisted. Other tests reject cancelled, malformed, denied and mismatched
callbacks. Native Apple tests verify the hashed/raw nonce pairing, repeat
sign-in without email/name, cancellation and missing identity tokens.

The hosted native configuration is corrected. Test on the signed iPhone build:

1. From both login and create account, complete Google sign-in. The browser
   must close and Luvani must receive a session. Cancel and retry as well.
2. From both forms, open and complete the Apple sheet. Repeat using the same
   Apple account (including Hide My Email), then cancel and retry.
3. Restart Luvani and confirm the session restores. A returning account should
   retain its existing profile and progress.

Mocked tests do not establish that vendor credentials, provisioning or an
installed phone binary work. Physical iPhone verification remains pending.

References: [Expo WebBrowser SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/webbrowser/),
[Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls),
[Supabase Sign in with Apple](https://supabase.com/docs/guides/auth/social-login/auth-apple).
