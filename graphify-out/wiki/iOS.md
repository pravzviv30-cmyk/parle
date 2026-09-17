# iOS

> 16 nodes · cohesion 0.12

## Key Concepts

- **iOS** (16 connections) — `docs/DEVICE_VERIFICATION.md`
- **D0 — the build is on the Supabase adapter** (1 connections) — `docs/DEVICE_VERIFICATION.md`
- **D10 — deletion demands a recent Google reauthentication** (1 connections) — `docs/DEVICE_VERIFICATION.md`
- **D11 — a failed local wipe is reported honestly** (1 connections) — `docs/DEVICE_VERIFICATION.md`
- **D12 — no bearer token in logs, in AsyncStorage, or in the bundle** (1 connections) — `docs/DEVICE_VERIFICATION.md`
- **D13 — two accounts on one device never see each other's learning** (1 connections) — `docs/DEVICE_VERIFICATION.md`
- **D14 — the installation signal survives deletion** (1 connections) — `docs/DEVICE_VERIFICATION.md`
- **D1 — a session survives backgrounding, cold start and reboot** (1 connections) — `docs/DEVICE_VERIFICATION.md`
- **D2 — the session is in the keychain, not in plaintext storage** (1 connections) — `docs/DEVICE_VERIFICATION.md`
- **D3 — a reinstall does not resurrect a session for a deleted account** (1 connections) — `docs/DEVICE_VERIFICATION.md`
- **D4 — a plaintext session from an older build migrates, then is gone** (1 connections) — `docs/DEVICE_VERIFICATION.md`
- **D5 — a failed secure migration forces a safe sign-in** (1 connections) — `docs/DEVICE_VERIFICATION.md`
- **D6 — email and password** (1 connections) — `docs/DEVICE_VERIFICATION.md`
- **D7 — Google sign-in over the deep link** (1 connections) — `docs/DEVICE_VERIFICATION.md`
- **D8 — password reset** (1 connections) — `docs/DEVICE_VERIFICATION.md`
- **D9 — deletion demands a recent password reauthentication** (1 connections) — `docs/DEVICE_VERIFICATION.md`

## Relationships

- [Device verification — auth, session storage, deletion, and the first run](Device_verification_—_auth,_session_storage,_deletion,_and_the_first_run.md) (1 shared connections)

## Source Files

- `docs/DEVICE_VERIFICATION.md`

## Audit Trail

- EXTRACTED: 16 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*