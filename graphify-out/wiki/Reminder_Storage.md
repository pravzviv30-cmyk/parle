# Reminder Storage

> 16 nodes · cohesion 0.20

## Key Concepts

- **reminders/store.ts** (18 connections) — `apps/mobile/src/reminders/store.ts`
- **reminders/store.test.ts** (13 connections) — `apps/mobile/src/reminders/store.test.ts`
- **reminderTime** (8 connections) — `apps/mobile/src/reminders/reminder.ts`
- **loadReminder()** (6 connections) — `apps/mobile/src/reminders/store.ts`
- **saveReminder()** (5 connections) — `apps/mobile/src/reminders/store.ts`
- **StoredReminder** (4 connections) — `apps/mobile/src/reminders/reminder.ts`
- **KEY()** (4 connections) — `apps/mobile/src/reminders/store.ts`
- **DEFAULT_REMINDER_TIME** (3 connections) — `apps/mobile/src/reminders/reminder.ts`
- **presetOf()** (3 connections) — `apps/mobile/src/reminders/store.ts`
- **read()** (3 connections) — `apps/mobile/src/reminders/store.ts`
- **serialized()** (3 connections) — `apps/mobile/src/reminders/store.ts`
- **StoredEnvelope** (2 connections) — `apps/mobile/src/reminders/store.ts`
- **installDisk()** (1 connections) — `apps/mobile/src/reminders/store.test.ts`
- **nextUid()** (1 connections) — `apps/mobile/src/reminders/store.test.ts`
- **noAudio()** (1 connections) — `apps/mobile/src/reminders/store.test.ts`
- **writeChain** (1 connections) — `apps/mobile/src/reminders/store.ts`

## Relationships

- [Reminder Copy & Times](Reminder_Copy_&_Times.md) (7 shared connections)
- [Reminder Scheduling](Reminder_Scheduling.md) (7 shared connections)
- [UI Components Library](UI_Components_Library.md) (5 shared connections)
- [Consent Storage](Consent_Storage.md) (4 shared connections)
- [Drill Store](Drill_Store.md) (2 shared connections)
- [Tutor Coach Marks Store](Tutor_Coach_Marks_Store.md) (2 shared connections)
- [App Root and Live Context](App_Root_and_Live_Context.md) (1 shared connections)

## Source Files

- `apps/mobile/src/reminders/reminder.ts`
- `apps/mobile/src/reminders/store.test.ts`
- `apps/mobile/src/reminders/store.ts`

## Audit Trail

- EXTRACTED: 52 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*