# App Root Wiring

> 18 nodes · cohesion 0.14

## Key Concepts

- **App.tsx** (67 connections) — `apps/mobile/App.tsx`
- **SignedInRoot()** (14 connections) — `apps/mobile/App.tsx`
- **setActiveUser()** (14 connections) — `apps/mobile/src/storage/scope.ts`
- **startAccountSync()** (6 connections) — `apps/mobile/App.tsx`
- **App()** (5 connections) — `apps/mobile/App.tsx`
- **clearActiveUserData()** (4 connections) — `apps/mobile/src/storage/scope.ts`
- **migrateLegacyStores()** (4 connections) — `apps/mobile/src/storage/scope.ts`
- **Gate()** (2 connections) — `apps/mobile/App.tsx`
- **mobile/index.ts** (2 connections) — `apps/mobile/index.ts`
- **LiveProvider()** (2 connections) — `apps/mobile/src/app/LiveContext.tsx`
- **AuthFlow()** (2 connections) — `apps/mobile/src/auth/AuthFlow.tsx`
- **AuthProvider()** (2 connections) — `apps/mobile/src/auth/useAuth.tsx`
- **RootNavigator()** (2 connections) — `apps/mobile/src/nav/RootNavigator.tsx`
- **linking** (2 connections) — `apps/mobile/src/nav/theme.ts`
- **navTheme** (2 connections) — `apps/mobile/src/nav/theme.ts`
- **Loading()** (1 connections) — `apps/mobile/App.tsx`
- **st** (1 connections) — `apps/mobile/App.tsx`
- **460pt centred web column** (1 connections) — `DESIGN.md`

## Relationships

- [React Context Providers](React_Context_Providers.md) (13 shared connections)
- [Profile Store and Context](Profile_Store_and_Context.md) (10 shared connections)
- [User Scope Reset](User_Scope_Reset.md) (7 shared connections)
- [Conversation Screen Tests](Conversation_Screen_Tests.md) (6 shared connections)
- [Auth Mode & Installation](Auth_Mode_&_Installation.md) (5 shared connections)
- [Auth Screens](Auth_Screens.md) (5 shared connections)
- [Sync Engine Core](Sync_Engine_Core.md) (4 shared connections)
- [UI Component Primitives](UI_Component_Primitives.md) (3 shared connections)
- [Session Progress History](Session_Progress_History.md) (3 shared connections)
- [Activity Log Store](Activity_Log_Store.md) (3 shared connections)
- [Fresh Device Adoption](Fresh_Device_Adoption.md) (3 shared connections)
- [Drill Store](Drill_Store.md) (3 shared connections)

## Source Files

- `DESIGN.md`
- `apps/mobile/App.tsx`
- `apps/mobile/index.ts`
- `apps/mobile/src/app/LiveContext.tsx`
- `apps/mobile/src/auth/AuthFlow.tsx`
- `apps/mobile/src/auth/useAuth.tsx`
- `apps/mobile/src/nav/RootNavigator.tsx`
- `apps/mobile/src/nav/theme.ts`
- `apps/mobile/src/storage/scope.ts`

## Audit Trail

- EXTRACTED: 107 (96%)
- INFERRED: 4 (4%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*