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

- [Auth Adapter & Mode](Auth_Adapter_&_Mode.md) (8 shared connections)
- [Consent Store](Consent_Store.md) (4 shared connections)
- [Conversation Pack Sync](Conversation_Pack_Sync.md) (3 shared connections)
- [Auth Guard Wrapper](Auth_Guard_Wrapper.md) (2 shared connections)
- [App Root Context](App_Root_Context.md) (2 shared connections)
- [Token Server URL Selection](Token_Server_URL_Selection.md) (2 shared connections)
- [Settings Sections](Settings_Sections.md) (2 shared connections)
- [UI Component Library](UI_Component_Library.md) (2 shared connections)
- [Mock Auth Adapter](Mock_Auth_Adapter.md) (1 shared connections)
- [Phone Settings Links](Phone_Settings_Links.md) (1 shared connections)
- [Conversation Pack Library UI](Conversation_Pack_Library_UI.md) (1 shared connections)

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