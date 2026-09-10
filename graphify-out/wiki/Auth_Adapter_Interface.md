# Auth Adapter Interface

> 24 nodes · cohesion 0.10

## Key Concepts

- **AuthAdapter** (24 connections) — `apps/mobile/src/auth/types.ts`
- **privacy/export.ts** (15 connections) — `apps/mobile/src/privacy/export.ts`
- **export.test.ts** (9 connections) — `apps/mobile/src/privacy/export.test.ts`
- **downloadAccountData()** (6 connections) — `apps/mobile/src/privacy/export.ts`
- **saveTextFile()** (4 connections) — `apps/mobile/src/progress/saveFile.ts`
- **AuthContextValue** (3 connections) — `apps/mobile/src/auth/useAuth.tsx`
- **saveFile.ts** (3 connections) — `apps/mobile/src/progress/saveFile.ts`
- **parsed()** (2 connections) — `apps/mobile/src/privacy/export.ts`
- **.completePasswordReset()** (1 connections) — `apps/mobile/src/auth/types.ts`
- **.deleteAccount()** (1 connections) — `apps/mobile/src/auth/types.ts`
- **.getSession()** (1 connections) — `apps/mobile/src/auth/types.ts`
- **.onAuthStateChange()** (1 connections) — `apps/mobile/src/auth/types.ts`
- **.onPasswordRecovery()** (1 connections) — `apps/mobile/src/auth/types.ts`
- **.reauthenticateForDeletion()** (1 connections) — `apps/mobile/src/auth/types.ts`
- **.sendPasswordReset()** (1 connections) — `apps/mobile/src/auth/types.ts`
- **.signInWithApple()** (1 connections) — `apps/mobile/src/auth/types.ts`
- **.signInWithGoogle()** (1 connections) — `apps/mobile/src/auth/types.ts`
- **.signInWithPassword()** (1 connections) — `apps/mobile/src/auth/types.ts`
- **.signOut()** (1 connections) — `apps/mobile/src/auth/types.ts`
- **.signUpWithPassword()** (1 connections) — `apps/mobile/src/auth/types.ts`
- **AccountExportResult** (1 connections) — `apps/mobile/src/privacy/export.ts`
- **ExportDependencies** (1 connections) — `apps/mobile/src/privacy/export.ts`
- **adapter()** (1 connections) — `apps/mobile/src/privacy/export.test.ts`
- **user** (1 connections) — `apps/mobile/src/privacy/export.test.ts`

## Relationships

- [OAuth Sign-In Adapters](OAuth_Sign-In_Adapters.md) (7 shared connections)
- [Consent Storage](Consent_Storage.md) (4 shared connections)
- [Conversation Packs Storage](Conversation_Packs_Storage.md) (3 shared connections)
- [Auth Mode Selection](Auth_Mode_Selection.md) (2 shared connections)
- [Guarded Auth Attempts](Guarded_Auth_Attempts.md) (2 shared connections)
- [Auth Flow Screens](Auth_Flow_Screens.md) (2 shared connections)
- [Token Server URL Config](Token_Server_URL_Config.md) (2 shared connections)
- [Settings Sections](Settings_Sections.md) (2 shared connections)
- [UI Components Library](UI_Components_Library.md) (2 shared connections)
- [Phone Settings Links](Phone_Settings_Links.md) (1 shared connections)
- [App Root and Live Context](App_Root_and_Live_Context.md) (1 shared connections)

## Source Files

- `apps/mobile/src/auth/types.ts`
- `apps/mobile/src/auth/useAuth.tsx`
- `apps/mobile/src/privacy/export.test.ts`
- `apps/mobile/src/privacy/export.ts`
- `apps/mobile/src/progress/saveFile.ts`

## Audit Trail

- EXTRACTED: 54 (98%)
- INFERRED: 1 (2%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*