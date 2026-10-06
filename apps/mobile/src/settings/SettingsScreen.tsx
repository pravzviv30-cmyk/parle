/**
 * Settings — the account, the subscription, the law, and the phone.
 *
 * Profile used to be one long scroll mixing three unrelated things: what a
 * learner chooses about their learning, who the account belongs to, and what the
 * law and the store require the app to say. The first stays on Profile. The
 * other two are here, behind one row, which is the shape every mainstream app
 * uses and the shape both supplied mockups refused.
 *
 * A root stack sibling ABOVE the tabs, drawing its own `ScreenHeader back` the
 * way the five screens already up there do. No native header: the back is the
 * in-screen chevron, and a title bar would be a second, duplicate way out.
 *
 * ## Nothing here decides anything
 *
 * There is no renderer in this suite (docs/TESTING.md), so every judgement this
 * screen would otherwise make lives in a plain module with its own tests, and
 * what is left in this file is layout and wiring:
 *
 * - whether the Subscription group exists at all is `subscriptionGroup`;
 * - which phone permissions are worth a row is `phoneRows`;
 * - whether a stored consent means yes is `analyticsAllowed`;
 * - whether there is a company or an address to name is `legal/company.ts`;
 * - what a restore is allowed to claim is `restoreTrouble` and `RESTORE_DONE`;
 * - and every label is a const in `settings/sections.ts` and its neighbours.
 *
 * ## Read on focus AND on the way back into the foreground
 *
 * The store, the microphone and the notification channel are all read in one
 * `useFocusEffect`. That is the F231 defence applied to three values instead of
 * one: a permission revoked in iOS Settings months ago is invisible to a value
 * captured at launch. Nothing here caches, and nothing raises a dialog:
 * `microphonePermission` and `reminderPermission` are reads.
 *
 * Focus alone is not the walk back, though, and F492 is the entry that says so.
 * `useFocusEffect` fires on a NAVIGATION focus change, and tapping the
 * Microphone row backgrounds Luvani without this screen ever losing focus, so
 * on return the effect does not run and the row the learner just repaired is
 * still there. An iOS microphone change usually terminates the app, which hid
 * it for that one row; a notification change does not. So the same read is also
 * subscribed to `AppState`, from inside the focus effect and torn down with it,
 * which keeps the listener alive exactly while this screen is the one on top.
 *
 * All four values start null or empty and draw nothing until the first read
 * lands. Guessing would flash a row at somebody who has never been asked.
 *
 * ## No count, no meter, no score
 *
 * There is no minutes row on this screen and no remaining time anywhere on it.
 * F377 is the standing decision: the meter is settled on the server at token
 * issuance, and a number the phone cannot verify is the dead switch F239
 * refused. Both mockups drew one. It stays unbuilt.
 *
 * ## The sheets, and which of them answers back for itself
 *
 * Acknowledgements, the privacy notice and the terms each render their own
 * screen with their own `useHardwareBack`, so this screen's hook stands down for
 * all three. Two handlers on one screen race, and the loser closes the whole
 * sheet from page two. That is F319's rule, and the condition below is the whole
 * of it.
 */

import { useCallback, useState } from 'react';
import { AppState, View, Text } from 'react-native';
import Constants from 'expo-constants';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { paper, space, type } from '../theme.ts';
import { Card, Field, Label, OptionRow, OutlineButton, PillButton, GhostButton, Sheet as BottomSheet } from '../components.tsx';
import { ScrollScreen, ScreenHeader } from '../layout.tsx';
import { useHardwareBack } from '../nav/useHardwareBack.ts';
import { SettingsRow } from './SettingsRow.tsx';
import { loadHapticPreference, setHapticPreference } from '../motion/hapticPreference.ts';
import { SwitchRow } from './SwitchRow.tsx';
import { TroubleLine } from './TroubleLine.tsx';
import { PlanCard } from '../profile/PlanCard.tsx';
import { TutorIntro } from '../tutor/TutorIntro.tsx';
import { DATA_USE_ROW, DATA_USE_SUB, CONNECTION_HELP_ROW, CONNECTION_HELP_SUB, LOCAL_PRACTICE_ROW, LOCAL_PRACTICE_SUB } from './sections.ts';
import { Acknowledgements } from '../legal/Acknowledgements.tsx';
import { PolicyScreen } from '../legal/PolicyScreen.tsx';
import { TermsScreen } from '../legal/TermsScreen.tsx';
import { companyLine, contactRow, privacyNote } from '../legal/company.ts';
import { TERMS_TITLE } from '../legal/terms.ts';
import { CONSENT_ROW, CONSENT_SUB, analyticsAllowed } from '../analytics/consent.ts';
import { loadConsent, saveConsent } from '../analytics/consentStore.ts';
import { activeUserId, scopeGeneration } from '../storage/scope.ts';
import { useAuth } from '../auth/useAuth.tsx';
import { downloadVerifiedAccountData } from '../privacy/export.ts';
import { appVersionLine } from '../profile/appVersion.ts';
import { purchases, type StoreOffering } from '../purchases/adapter.ts';
import { restorePurchases } from '../purchases/restore.ts';
import { PURCHASE_TROUBLE, RESTORE_BUSY, restoreTrouble } from '../purchases/paywallView.ts';
import { RESTORE_DONE, subscriptionGroup, type SubscriptionAction } from '../purchases/subscription.ts';
import {
  REMINDER_ROW,
  REMINDER_TIMES,
  REMINDER_TIME_SUB,
  REMINDER_TIME_TITLE,
  reminderRow,
  reminderTime,
  type ReminderTimeId,
  type StoredReminder,
} from '../reminders/reminder.ts';
import { loadReminder, saveReminder } from '../reminders/store.ts';
import {
  REMINDERS_AVAILABLE,
  askReminderPermission,
  cancelReminder,
  reminderPermission,
  scheduleReminder,
} from '../reminders/schedule.ts';
import { openMail } from './links.ts';
import { phoneRows, type PhonePermission } from './phone.ts';
import { PHONE_SETTINGS_AVAILABLE, microphonePermission, openPhoneSettings } from './phoneSettings.ts';
import {
  ABOUT_GROUP,
  ACCOUNT_GROUP,
  ACKNOWLEDGEMENTS_ROW,
  CONSENT_SAVE_TROUBLE,
  DELETE_ROW,
  DEMO_ROW,
  DEMO_VALUE,
  DOWNLOAD_BUSY,
  DOWNLOAD_ROW,
  DOWNLOAD_SUB,
  EMAIL_ROW,
  EMAIL_UNKNOWN,
  HELP_GROUP,
  LINK_TROUBLE,
  PHONE_GROUP,
  PLAN_GROUP,
  PRIVACY_GROUP,
  PRIVACY_POLICY_ROW,
  SAVED_ROW,
  SAVED_SUB,
  SETTINGS_TITLE,
  SIGN_OUT_ROW,
  SUBSCRIPTION_GROUP,
} from './sections.ts';
import type { AuthResult } from '../auth/types.ts';

/**
 * The sub-views that open in place rather than as stack routes.
 *
 * Every one of them takes the whole screen. Three render screens of their own
 * and answer the hardware back themselves; `delete` does not, and is the one
 * this screen's own hook exists for.
 *
 * There was a fifth, `unavailable`, and F489 took it out rather than moving it.
 * It held a failed data export, and it was drawn at the very bottom of the list
 * instead of taking the screen, about a screen and a half below the row that
 * was tapped. So the tap read as dead, and the next hardware back was eaten
 * closing a card nobody had seen. A refusal is not a sheet: it is a line in the
 * group whose control caused it, which is what every other one here already is.
 */
type Sheet = 'none' | 'acknowledgements' | 'policy' | 'terms' | 'intro' | 'reminderTime' | 'delete' | 'export';

/**
 * Said when the disk refuses the reminder's two-field write, and only then.
 *
 * `saveReminder` answers `failed` on a full phone. A row that moved anyway
 * would be a switch that reverts silently at the next launch, so the row stays
 * where it was and this says why. It blames the device, which is what actually
 * happened, and it asks for nothing: no retry loop, no apology, no number.
 *
 * It moved here from Profile with the reminder itself (F576), unchanged: it is
 * about this phone rather than about the reminder, which is why it is a
 * sentence in the screen rather than one of `reminder.ts`'s.
 */
const REMINDER_SAVE_TROUBLE = 'Your phone did not save that. The reminder is unchanged, and you can try again.';

/**
 * Said when the write landed and the operating system would not take the alarm.
 *
 * A different fact from the one above, so a different sentence. The choice did
 * reach the disk; what refused was `scheduleReminder`, and telling somebody
 * their phone "did not save that" when it saved it perfectly well is a small
 * lie in the one place this screen has to be trusted.
 *
 * Three things it has to do. It puts the refusal on the phone, because that is
 * where it happened and the learner did nothing wrong. It leaves a way forward,
 * which here is simply flipping the switch again, and "just now" says the state
 * is a moment rather than a verdict. And it is silent about what is on disk,
 * because the rollback below can itself be refused by the same full phone, and
 * a sentence that claimed "nothing has changed" would be the second lie.
 *
 * Deliberately direction-neutral. It is shown when the OS refuses to schedule
 * and when it refuses to cancel, and a learner who was turning the reminder off
 * must not read a line about setting one. "Change" covers both, so nothing here
 * branches on which way the switch was going.
 */
const REMINDER_SCHEDULE_TROUBLE = 'Your phone would not change the reminder just now. You can try again.';

/** Which store call is in flight, so neither row can be tapped twice. */
type StoreBusy = 'none' | SubscriptionAction;

export function SettingsScreen({
  onSignOut,
  onDeleteAccount,
}: {
  onSignOut: () => void;
  onDeleteAccount: (reauthentication?: string) => Promise<AuthResult>;
}) {

  const [hapticFeedback, setHapticFeedback] = useState(true);
  const [hapticSaving, setHapticSaving] = useState(false);
  const [hapticTrouble, setHapticTrouble] = useState('');
  const nav = useNavigation<{
    goBack: () => void;
    canGoBack: () => boolean;
    navigate: (screen: string, params?: object) => void;
  }>();
  const { user, adapter } = useAuth();
  const [sheet, setSheet] = useState<Sheet>('none');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportPassword, setExportPassword] = useState('');

  // Null until the first read lands, in all four cases, and for the same reason
  // the reminder row is: a guess draws a row at somebody who was never asked.
  const [consent, setConsent] = useState<boolean | null>(null);
  const [consentTrouble, setConsentTrouble] = useState<string | null>(null);
  const [offering, setOffering] = useState<StoreOffering | null>(null);
  const [microphone, setMicrophone] = useState<PhonePermission | null>(null);
  const [notifications, setNotifications] = useState<PhonePermission | null>(null);
  // What the learner asked for, read off the disk. The permission half of the
  // reminder is `notifications` above: it is the same channel, read by the same
  // call, and a second copy of it here would be a second answer to one question
  // that could disagree with the row two lines below it.
  const [stored, setStored] = useState<StoredReminder | null>(null);
  const [storedOwner, setStoredOwner] = useState<{ scope: number; userId: string | null } | null>(null);
  const [unreadReminderOwner, setUnreadReminderOwner] = useState<{ scope: number; userId: string | null } | null>(null);
  const [reminderAttempt, setReminderAttempt] = useState(0);
  const [reminderBusy, setReminderBusy] = useState(false);

  const [storeBusy, setStoreBusy] = useState<StoreBusy>('none');
  const [storeMessage, setStoreMessage] = useState<string | null>(null);
  // One piece of state per door out of the app, rather than one shared line.
  // They are drawn in different cards, and a single flag would set a sentence
  // the group that could show it is not even on the page: the Phone group is
  // absent unless a permission was refused, so a mail app that would not open
  // would fail in silence, which is the tap that does nothing F239 refused.
  const [phoneTrouble, setPhoneTrouble] = useState<string | null>(null);
  const [contactTrouble, setContactTrouble] = useState<string | null>(null);
  // The fourth of those, and the one F489 was filed about. A data export is a
  // legal right exercised through one row, so a refusal belongs beside that row
  // rather than a screen and a half below it.
  const [exportTrouble, setExportTrouble] = useState<string | null>(null);
  // The fifth, and the reminder's. The line to show rather than a flag,
  // because there are two of them and which one is shown is the whole of what
  // this state says.
  const [reminderTrouble, setReminderTrouble] = useState<string | null>(null);

  /**
   * Everything the operating system and the store own, read again on every entry.
   *
   * One effect rather than four, because they are all the same kind of value:
   * something outside this app decides them and this app finds out by asking.
   *
   * Entry is two events, not one. Focus is a learner arriving from Profile;
   * foreground is a learner arriving back from the phone's own settings, which
   * is the walk the Phone rows exist to make possible and the one focus cannot
   * see (F492). Both go through `readPhonePermissions`, so there is exactly one
   * answer to what the OS said and no second copy to drift.
   *
   * `loadConsent` throws rather than resolving when nobody is signed in, the way
   * `loadReminder` does. Behind the auth gate that cannot happen, but a sign-out
   * can land between focus and read, so the throw is caught and the switch draws
   * off rather than taking the screen down.
   */
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void loadHapticPreference().then(value => { if (!cancelled) setHapticFeedback(value); });
      const reminderOwner = { scope: scopeGeneration(), userId: user?.id ?? null };
      const sameReminderOwner = () => !cancelled && reminderOwner.scope === scopeGeneration() && reminderOwner.userId === activeUserId();
      setStoredOwner(null);
      setUnreadReminderOwner(null);
      setReminderBusy(false);
      setReminderTrouble(null);
      const readPhonePermissions = () => {
        void Promise.all([microphonePermission(), reminderPermission()])
          .then(([mic, notify]) => {
            if (cancelled) return;
            setMicrophone(mic);
            setNotifications(notify);
          })
          .catch(() => {
            // The platform pair catches its own failures and answers in a word,
            // so there is nothing here to report and nothing to draw.
          });
      };
      readPhonePermissions();
      // The walk back. Nothing else in the app listens for this, and the
      // subscription is torn down with the focus effect below, so it is live
      // exactly while Settings is the screen on top.
      const foreground = AppState.addEventListener('change', (next) => {
        if (next === 'active') readPhonePermissions();
      });
      if (user) {
        void purchases
          .offering(user.id)
          .then((next) => {
            if (!cancelled) setOffering(next);
          })
          .catch(() => {
            // No store, no group. Exactly what an unanswered store means.
          });
      }
      // What the learner asked for. The permission half rides with the
      // notification channel above, read on focus AND on the walk back, which
      // is the whole defence against a dead switch: permission is per install
      // and can be turned off in the phone's own settings months later without
      // the app hearing a word about it. A missing choice can draw Off. An
      // unread choice stays unknown, with Retry, until its owner can reread it.
      if (user) {
        void Promise.resolve()
          .then(() => loadReminder({ strict: true }))
          .then((saved) => {
            if (sameReminderOwner()) { setStored(saved); setStoredOwner(reminderOwner); }
          })
          .catch(() => {
            if (sameReminderOwner()) setUnreadReminderOwner(reminderOwner);
          });
      }
      void loadConsent()
        .then((consented) => {
          if (!cancelled) setConsent(analyticsAllowed(consented));
        })
        .catch(() => {
          // Nothing readable is not a yes, and an off switch is the honest thing
          // to draw for a permission this build cannot prove was ever given.
          if (!cancelled) setConsent(false);
        });
      return () => {
        cancelled = true;
        foreground.remove();
      };
    }, [user, reminderAttempt]),
  );

  /**
   * Everything the last visit to the delete sheet left behind, forgotten.
   *
   * One door rather than a line repeated at each exit, because the draft has
   * two halves and only one of them was being cleared: the password went on
   * every exit and the reason stayed, so the sheet reopened with a red sentence
   * accusing the learner of a failure that had not happened yet, on the most
   * consequential question this app asks (F490). A single function is the shape
   * that cannot go half done again.
   */
  const forgetDeleteDraft = () => {
    setDeletePassword('');
    setDeleteError(null);
  };

  /**
   * Close whichever sheet is open, by its own correct closer.
   *
   * A switch rather than a chain of `if (sheet === '…')`, so a test can slice
   * one branch by its braces. The delete sheet forgets its draft, exactly as its
   * own Keep my account button does and as the row that opens it does.
   */
  const closeCurrentSheet = () => {
    switch (sheet) {
      case 'export':
        setExportPassword('');
        setExportTrouble(null);
        setSheet('none');
        return;
      case 'delete':
        forgetDeleteDraft();
        setSheet('none');
        return;
      default:
        setSheet('none');
    }
  };

  // Android's hardware back closes the open sheet in place rather than popping
  // Settings. Inactive on the main list, so ordinary back stands, and inactive
  // for the three sheets that render their own screens and answer the hardware
  // back through their own hook (F319).
  useHardwareBack(
    sheet !== 'none' &&
      sheet !== 'acknowledgements' &&
      sheet !== 'policy' &&
      sheet !== 'terms' &&
      sheet !== 'intro',
    closeCurrentSheet,
  );

  // Only an email sign-up has a password to change; Google, Apple and the
  // device-local demo account have nothing this screen could check.
  const hasPassword = user?.provider === 'password';
  // Which build this is. The property read is here rather than in appVersion.ts
  // because expo-constants cannot be loaded by the test runner; the rule that
  // turns it into a line, or into nothing, is over there where a test can ask.
  const versionLine = appVersionLine(Constants.expoConfig?.version);
  const company = companyLine();
  const contact = contactRow();
  // Null while the store has not answered yet, which draws no group either. The
  // module decides; nothing here re-reads what an offering means.
  const subscription = offering === null ? null : subscriptionGroup(offering);
  const phone = phoneRows({ microphone, notifications, available: PHONE_SETTINGS_AVAILABLE });
  // What the learner asked for, crossed with what the OS will allow. Every
  // judgement in it belongs to reminder.ts; nothing below re-decides any of it.
  const currentReminderScope = scopeGeneration();
  const currentReminderUser = user?.id ?? null;
  const reminderOwned = storedOwner?.scope === currentReminderScope && storedOwner.userId === currentReminderUser && storedOwner.userId === activeUserId();
  const reminderUnread = unreadReminderOwner?.scope === currentReminderScope && unreadReminderOwner.userId === currentReminderUser && unreadReminderOwner.userId === activeUserId();
  const reminderPending = !reminderOwned && !reminderUnread;
  const ownsReminderNow = () => reminderOwned && storedOwner.scope === scopeGeneration() && storedOwner.userId === activeUserId();
  const row = notifications === null || !reminderOwned ? null : reminderRow(stored, notifications);
  // The preset behind the row. `reminderTime` repairs a mangled or missing id
  // to the default, so there is no second opinion here about which hour is
  // which, and no throw on a byte that came back wrong from disk.
  const chosen = reminderTime(reminderOwned ? stored?.time : undefined);
  // Whether there is a reminder to draw at all: a build with a scheduler, and a
  // permission that has come back. `REMINDERS_AVAILABLE` is the platform pair
  // saying the OS can be asked; `row` is null until the first read lands.
  const reminders = REMINDERS_AVAILABLE && row !== null;
  const reminderUnknown = REMINDERS_AVAILABLE && notifications !== null && !reminderOwned;
  // What the group has to say right now: the wait while it is waiting, and
  // whatever the last attempt settled on otherwise.
  const storeLine = storeBusy === 'restore' ? RESTORE_BUSY : storeMessage;

  /**
   * The store, asked once at a time, and told honestly what came back.
   *
   * Manage is iOS 13 and up. On anything older the store's own call rejects and
   * the adapter answers `{ ok: false, cancelled: false }`, so this says the store
   * could not finish rather than leaving a learner on a tap that did nothing.
   * A dismissed sheet answers `cancelled` and says nothing at all, because
   * backing out is a choice and not a failure.
   *
   * Restore reports that the store was checked rather than a result, because
   * RevenueCat cannot tell us which and entitlement is settled on the server.
   */
  const askStore = (action: SubscriptionAction) => {
    if (!user || storeBusy !== 'none') return;
    const owner = scopeGeneration();
    setStoreBusy(action);
    setStoreMessage(null);
    const asked: Promise<string | null> =
      action === 'manage'
        ? purchases.manage(user.id).then((result) => (result.ok || result.cancelled ? null : PURCHASE_TROUBLE))
        : restorePurchases(user.id).then((outcome) =>
            // Granted and granted-nothing are one sentence here on purpose. This row
            // reports that the store was checked, which is true either way, and it is
            // the paywall rather than Settings that has just seen a purchase and can
            // reasonably say a grant is still catching up.
            outcome.kind === 'done' || outcome.kind === 'nothing-granted'
              ? RESTORE_DONE
              : restoreTrouble(outcome),
          );
    void asked
      .then(message => { if (owner === scopeGeneration()) setStoreMessage(message); })
      .catch(() => { if (owner === scopeGeneration()) setStoreMessage(PURCHASE_TROUBLE); })
      .finally(() => { if (owner === scopeGeneration()) setStoreBusy('none'); });
  };

  /**
   * The consent, written to disk, and put back when the disk refuses.
   *
   * The switch moves first so the tap feels answered, and moves back if the
   * write failed. `saveConsent` reports that in a word for exactly this reason:
   * a switch showing one answer over a disk holding the other is a withdrawal
   * that is simply gone at the next launch, and the learner is never told.
   */
  const setConsentAllowed = (next: boolean) => {
    setConsent(next);
    setConsentTrouble(null);
    void saveConsent({ allowed: next })
      .then((ack) => {
        if (ack === 'failed') {
          setConsent(!next);
          setConsentTrouble(CONSENT_SAVE_TROUBLE);
        }
      })
      .catch(() => {
        setConsent(!next);
        setConsentTrouble(CONSENT_SAVE_TROUBLE);
      });
  };

  /**
   * The switch, which asks the OS before it believes the learner's thumb.
   *
   * One shape for all four states, because the module already told us which one
   * we are in. `row.asks` is true in exactly the state where a dialog belongs;
   * everywhere else this is a plain re-read that raises nothing, which is how a
   * permission changed in the phone's own settings reaches the row without
   * anybody being asked twice. iOS will not show that dialog a second time
   * anyway, so a re-ask would be a control that silently does nothing.
   *
   * Then `reminderRow` decides again, against the answer that just came back.
   * A refusal turns what the learner asked for into an off row and an honest
   * line, and the value that goes to disk is that answer rather than the
   * position the switch was left in. Turning off keeps the chosen preset, so
   * turning it back on months later restores the part of the day they picked.
   */
  const toggleReminder = (next: boolean) => {
    if (row === null || reminderBusy || !ownsReminderNow()) return;
    setReminderBusy(true);
    setReminderTrouble(null);
    void (row.asks ? askReminderPermission() : reminderPermission())
      .then(async (fresh) => {
        if (!ownsReminderNow()) return;
        setNotifications(fresh);
        const honest = reminderRow({ enabled: next, time: chosen.value }, fresh);
        const wanted: StoredReminder = { ...stored, enabled: honest.on, time: chosen.value };
        // What the phone is doing already, in the shape the store writes. Built
        // from `row.on`, which is reminderRow's answer for the state the row is
        // in, so putting the disk back is the module's value and never a
        // negation worked out here.
        const reverted: StoredReminder = { ...stored, enabled: row.on, time: chosen.value };
        const ack = await saveReminder(wanted);
        if (!ownsReminderNow()) return;
        if (ack === 'failed') {
          setReminderTrouble(REMINDER_SAVE_TROUBLE);
          return;
        }
        const outcome = honest.on ? await scheduleReminder(wanted.time, wanted.days) : await cancelReminder();
        if (!ownsReminderNow()) return;
        if (outcome === 'failed') {
          await saveReminder(reverted);
          if (!ownsReminderNow()) return;
          setReminderTrouble(REMINDER_SCHEDULE_TROUBLE);
          return;
        }
        setStored(wanted);
      })
      // The platform pair catches its own failures and answers in a word, so
      // the only way here is a sign-out landing between the tap and the write,
      // where `saveReminder` throws the way `loadConsent` does. The row stays
      // where it was and says so: a flip that changed nothing and explained
      // nothing is the dead switch this whole entry exists to prevent.
      .catch(() => { if (ownsReminderNow()) setReminderTrouble(REMINDER_SAVE_TROUBLE); })
      .finally(() => { if (ownsReminderNow()) setReminderBusy(false); });
  };

  /**
   * A different part of the day, through the same door as the switch.
   *
   * Reached only from an on row, so the intent is `enabled: true`, and it still
   * goes through `reminderRow` against a freshly read permission: a learner can
   * revoke notifications and come back to this sheet in the same minute. The
   * read raises no dialog, which keeps the no-re-ask rule intact.
   */
  const chooseReminderTime = (value: ReminderTimeId) => {
    if (row === null || !ownsReminderNow()) return;
    setReminderTrouble(null);
    void (async () => {
      const fresh = await reminderPermission();
      if (!ownsReminderNow()) return;
      setNotifications(fresh);
      const honest = reminderRow({ enabled: true, time: value }, fresh);
      const wanted: StoredReminder = { ...stored, enabled: honest.on, time: value };
      const reverted: StoredReminder = { ...stored, enabled: row.on, time: chosen.value };
      const ack = await saveReminder(wanted);
      if (!ownsReminderNow()) return;
      if (ack === 'failed') {
        setReminderTrouble(REMINDER_SAVE_TROUBLE);
        return;
      }
      const outcome = honest.on ? await scheduleReminder(wanted.time, wanted.days) : await cancelReminder();
      if (!ownsReminderNow()) return;
      if (outcome === 'failed') {
        await saveReminder(reverted);
        if (!ownsReminderNow()) return;
        setReminderTrouble(REMINDER_SCHEDULE_TROUBLE);
        return;
      }
      setStored(wanted);
    })().catch(() => { if (ownsReminderNow()) setReminderTrouble(REMINDER_SAVE_TROUBLE); });
  };

  /** Hand the learner to their own phone, and say so when the phone will not go. */
  const walkToPhoneSettings = () => {
    setPhoneTrouble(null);
    void openPhoneSettings().then((outcome) => {
      if (outcome !== 'done') setPhoneTrouble(LINK_TROUBLE);
    });
  };

  /**
   * Ask for the copy of everything, and say so in the card when it cannot be built.
   *
   * The refusal is a line in the Data and privacy card rather than a sheet: it
   * is drawn beside the row that was tapped, the way the phone and contact
   * refusals are, and it is announced rather than only drawn, because the row
   * itself flips back from Preparing to its ordinary value and that change is
   * invisible to somebody who cannot see it (F489).
   */
  const prepareMyData = (secret?: string) => {
    if (!user || exporting) return;
    const owner = scopeGeneration();
    setExporting(true);
    setExportTrouble(null);
    const requested = downloadVerifiedAccountData(user, adapter, secret);
    setExportPassword('');
    void requested.then(result => {
      if (owner !== scopeGeneration()) return;
      if (!result.ok) setExportTrouble(result.message);
      else setSheet('none');
    }).finally(() => { if (owner === scopeGeneration()) setExporting(false); });
  };
  const askForMyData = () => {
    if (!user || exporting) return;
    if (adapter.kind === 'mock') { prepareMyData(); return; }
    setExportPassword(''); setExportTrouble(null); setSheet('export');
  };

  /** Open a mail app at the one address, and leave the address readable if it will not. */
  const writeTo = (address: string) => {
    setContactTrouble(null);
    void openMail(address).then((outcome) => {
      if (outcome !== 'done') setContactTrouble(LINK_TROUBLE);
    });
  };

  // Demoted, not deleted: the intro is still the only place that teaches what
  // the three colours of the circle mean, and it is one tap from the Help
  // group. It renders its own screen and answers its own hardware back, which
  // is why the hook above stands down for it (F319).
  if (sheet === 'intro') return <TutorIntro onDone={() => setSheet('none')} />;

  if (sheet === 'acknowledgements') return <Acknowledgements onBack={() => setSheet('none')} />;
  if (sheet === 'policy') return <PolicyScreen onBack={() => setSheet('none')} />;
  if (sheet === 'terms') return <TermsScreen onBack={() => setSheet('none')} />;

  /**
   * Which part of the day, not which minute.
   *
   * Four presets in the shape the voice sheet already uses. A real picker would
   * mean a second native dependency to answer a question nobody is asking: the
   * interesting choice is morning or evening, and a preset at 18:07 is a time
   * picker that has been hidden rather than removed.
   */
  if (sheet === 'delete') {
    // No chevron: this is the one sheet where leaving is the safe answer and it
    // is spelled out as "Keep my account" rather than a quiet back arrow.
    return (
      <ScrollScreen>
        <Text accessibilityRole="header" style={[type.display, { color: paper.ink }]}>Delete your account?</Text>
        <Text style={[type.body, { color: paper.inkSoft, marginTop: space(3) }]}>
          This permanently removes your sign-in, conversations turned into practice, progress, and remaining minutes. It cannot be undone. Cancel an App Store or Google Play subscription in the store; deleting your Luvani account does not cancel it.
        </Text>
        {/* The reason a wrong password was refused belongs to the field that
            holds the password, not to a loose line under it. `Field` marks the
            input invalid, points the web at the reason, gives Android a live
            region, speaks it on iOS, and says the name and the reason together
            when the learner comes back to it. F491: an error that only changes
            pixels is invisible to somebody who cannot see the pixels change,
            and this is the one branch whose failure the learner can fix. */}
        {hasPassword && (
          <View style={{ marginTop: space(5) }}>
            <Field
              label="Confirm with your password"
              value={deletePassword}
              onChangeText={setDeletePassword}
              placeholder="Your password"
              secure
              autoComplete="current-password"
              error={deleteError}
            />
          </View>
        )}
        {user?.provider === 'google' && (
          <Text style={[type.body, { color: paper.inkSoft, marginTop: space(4) }]}>
            Google will ask you to sign in again before anything is deleted.
          </Text>
        )}
        {/* The Apple twin of the line above. An Apple account has no password
            this app could check, so the sheet says what will happen rather than
            showing a field nobody can fill. Owed to auth/apple.test.ts, which
            names the sentence rather than waiting for one to appear. */}
        {user?.provider === 'apple' && (
          <Text style={[type.body, { color: paper.inkSoft, marginTop: space(4) }]}>
            Apple will ask you to sign in again before anything is deleted.
          </Text>
        )}
        {/* A Google, Apple or demo account has no field to carry the reason, so
            the line carries it, and carries the announcement with it. Exactly
            one of these two ever draws: the field above holds it whenever there
            is a password to hold it. */}
        {!hasPassword && deleteError !== null && <TroubleLine message={deleteError} strong />}
        <View style={{ marginTop: space(7), gap: space(3) }}>
          <GhostButton
            label={deleting ? 'Verifying…' : 'Verify and delete permanently'}
            disabled={deleting || (hasPassword && deletePassword.length === 0)}
            onPress={() => {
              if (deleting) return;
              setDeleting(true);
              setDeleteError(null);
              void onDeleteAccount(hasPassword ? deletePassword : undefined).then((result) => {
                if (!result.ok) {
                  setDeleteError(result.message);
                  setDeleting(false);
                }
              });
            }}
          />
          <PillButton
            label="Keep my account"
            disabled={deleting}
            onPress={() => {
              forgetDeleteDraft();
              setSheet('none');
            }}
          />
        </View>
      </ScrollScreen>
    );
  }

  return (
    <>
    <ScrollScreen
      header={
        <ScreenHeader back={{ onPress: () => (nav.canGoBack() ? nav.goBack() : nav.navigate('Tabs')) }} />
      }
    >
      <Text accessibilityRole="header" style={[type.display, { color: paper.ink, marginBottom: space(5) }]}>
        {SETTINGS_TITLE}
      </Text>

      <Label>{ACCOUNT_GROUP}</Label>
      <Card style={{ marginTop: space(2.5) }}>
        <SettingsRow first label={EMAIL_ROW} value={user?.email ?? EMAIL_UNKNOWN} />
        {user?.provider === 'mock' && <SettingsRow label={DEMO_ROW} value={DEMO_VALUE} />}
        <SettingsRow label={SIGN_OUT_ROW} onPress={onSignOut} />
      </Card>

      {/* The plan, which moved here from Profile with revamp A (F576). It sits
          above Subscription because the plan is what a learner has and the
          group below it is what the store can do about it. The card reads the
          server itself and draws its own honest line when it cannot. */}
      <View style={{ marginTop: space(6) }}>
        <Label>{PLAN_GROUP}</Label>
        <PlanCard />
      </View>

      {/* Present only when the store answered with a real product, which is what
          keeps it honest in Expo Go, on the web and on a build with no keys. In
          all three, both rows would open onto nothing. */}
      {subscription !== null && (
        <View style={{ marginTop: space(6) }}>
          <Label>{SUBSCRIPTION_GROUP}</Label>
          <Card style={{ marginTop: space(2.5) }}>
            {storeLine !== null && (
              <Text
                accessibilityLiveRegion="polite"
                style={[type.small, { color: paper.inkSoft, marginBottom: space(3) }]}
              >
                {storeLine}
              </Text>
            )}
            {subscription.map((row, index) => (
              <SettingsRow
                key={row.action}
                first={index === 0}
                label={row.label}
                value={row.sub}
                onPress={() => askStore(row.action)}
              />
            ))}
          </Card>
        </View>
      )}

      <View style={{ marginTop: space(6) }}>
        <Label>{PRIVACY_GROUP}</Label>
        <Card style={{ marginTop: space(2.5) }}>
          {/* The honest paragraph, and every fact in it comes from one module.
              This screen never spells an address or a company name itself. */}
          <Text style={[type.small, { color: paper.inkSoft, marginBottom: space(3) }]}>Control what is saved, export your data or delete your account. Live tasks send spoken or typed words to speech and language services.</Text>
          <SettingsRow first label={DATA_USE_ROW} value={DATA_USE_SUB} onPress={() => setSheet('policy')} />
          <Text style={[type.small, { color: paper.inkSoft, marginBottom: space(3) }]}>{privacyNote()}</Text>
          {consentTrouble !== null && <TroubleLine message={consentTrouble} />}
          {/* The export refusal, in the card that holds the row that asked for
              it. It used to be a sheet drawn under the version line, which is
              the tap that answered nothing F239 refused. */}
          {exportTrouble !== null && <TroubleLine message={exportTrouble} />}
          {/* Off until the first read lands, so a fresh install never shows a
              consent switch sitting on for a frame. */}
          <SwitchRow
            first
            title={CONSENT_ROW}
            sub={CONSENT_SUB}
            value={consent === true}
            onChange={setConsentAllowed}
            accessibilityLabel={CONSENT_ROW}
          />
          <SettingsRow
            label={DOWNLOAD_ROW}
            value={exporting ? DOWNLOAD_BUSY : DOWNLOAD_SUB}
            onPress={askForMyData}
          />
          <SettingsRow label={SAVED_ROW} value={SAVED_SUB} onPress={() => nav.navigate('Conversations')} />
        </Card>
      </View>

      {/* Everything this app asks of the phone: the daily reminder, and one row
          per permission the OS has refused. `phoneRows` decides the second
          half; an allowed permission draws no row because a row reading Allowed
          does nothing when it is tapped.

          The reminder moved here from Profile with revamp A (F576). It is the
          one control on this screen that draws a state the operating system
          owns, and every judgement about it lives in `reminders/reminder.ts`:
          this screen asks `reminderRow` what to draw, asks it again against a
          freshly read permission before it writes anything down, and shows the
          sentence it is handed. The whole block is absent on a build with no
          scheduler rather than sitting there disabled, because the refusal line
          names phone settings and would be a lie on a laptop. */}
      {(reminders || reminderUnknown || phone.length > 0) && (
        <View style={{ marginTop: space(6) }}>
          <Label>{PHONE_GROUP}</Label>
          <Card style={{ marginTop: space(2.5) }}>
            {/* The explaining sentence, written ABOVE the switch that raises the
                system dialog: a permission dialog that arrives unannounced is a
                dialog most people decline, and iOS never offers it twice. */}
            {reminders && row !== null && row.note.length > 0 && (
              <Text style={[type.small, { color: paper.inkSoft, marginBottom: space(3) }]}>{row.note}</Text>
            )}
            {reminderOwned && sheet !== 'reminderTime' && reminderTrouble !== null && <TroubleLine message={reminderTrouble} />}
            {reminderUnknown && <View style={{ gap: space(2) }}>
              <Text accessibilityLiveRegion="polite" style={[type.small, { color: paper.inkSoft }]}>{reminderPending ? 'Checking reminder status…' : 'Reminder status could not be read. Try again before changing it.'}</Text>
              {reminderUnread && <GhostButton label="Retry reminder status" onPress={() => setReminderAttempt(value => value + 1)} />}
            </View>}
            {reminders && row !== null && (
              <SwitchRow
                first
                title={REMINDER_ROW}
                sub={row.value}
                value={row.on}
                onChange={toggleReminder}
                accessibilityLabel={REMINDER_ROW}
              />
            )}
            {reminders && row !== null && row.on && (
              <SettingsRow label={REMINDER_TIME_TITLE} value={chosen.label} onPress={() => setSheet('reminderTime')} />
            )}
            {phoneTrouble !== null && <TroubleLine message={phoneTrouble} />}
            {phone.map((permissionRow, index) => (
              <SettingsRow
                key={permissionRow.key}
                first={!reminders && index === 0}
                label={permissionRow.label}
                value={permissionRow.sub}
                onPress={walkToPhoneSettings}
              />
            ))}
          </Card>
        </View>
      )}

      <View style={{ marginTop: space(6) }}>
        <Label>Interaction</Label>
        <Card style={{ marginTop: space(2.5) }}>
          <SwitchRow title="Haptic feedback" sub="A gentle tap when an action lands. Motion follows your phone’s accessibility setting." accessibilityLabel="Haptic feedback" value={hapticFeedback} disabled={hapticSaving} onChange={value => {
            if (hapticSaving) return;
            setHapticSaving(true);
            const previous = hapticFeedback;
            setHapticFeedback(value);
            void setHapticPreference(value).then(saved => { setHapticSaving(false); setHapticTrouble(saved ? '' : 'That preference could not be saved. Try again.'); if (!saved) setHapticFeedback(previous); });
          }} />
          {hapticTrouble !== '' ? <TroubleLine message={hapticTrouble} /> : null}
        </Card>
      </View>

      {/* Help, which always has the intro in it and has a Contact row only once
          an address is supplied. A Contact us row with nothing behind it is a
          row that lies, so `contactRow` answers null and nothing is drawn
          rather than a dead row somebody would tap. */}
      <View style={{ marginTop: space(6) }}>
        <Label>{HELP_GROUP}</Label>
        <Card style={{ marginTop: space(2.5) }}>
          {contactTrouble !== null && <TroubleLine message={contactTrouble} />}
          {/* The address is the row's own value, so a phone with no mail app
              set up still leaves something a learner can read and write down
              rather than a tap that answered nothing. */}
          {contact !== null && (
            <SettingsRow first label={contact.label} value={contact.address} onPress={() => writeTo(contact.address)} />
          )}
          {/* What the three colours of the circle mean. It was a row on Profile
              and it is here now (F576): it explains a control rather than
              setting one, which is what the Help group is for. */}
          <SettingsRow first={contact === null} label={CONNECTION_HELP_ROW} value={CONNECTION_HELP_SUB} onPress={() => setSheet('intro')} />
          <SettingsRow label={LOCAL_PRACTICE_ROW} value={LOCAL_PRACTICE_SUB} onPress={() => nav.navigate('Tabs', { screen: 'Practice' })} />
        </Card>
      </View>

      <View style={{ marginTop: space(6), paddingBottom: space(6) }}>
        <Label>{ABOUT_GROUP}</Label>
        <Card style={{ marginTop: space(2.5) }}>
          <SettingsRow first label={PRIVACY_POLICY_ROW} onPress={() => setSheet('policy')} />
          <SettingsRow label={TERMS_TITLE} onPress={() => setSheet('terms')} />
          <SettingsRow label={ACKNOWLEDGEMENTS_ROW} onPress={() => setSheet('acknowledgements')} />
        </Card>
        {/* Who Luvani is, or nothing while the name is unset. Soft ink, never
            faint: these are words somebody is asked to read back to us (F330). */}
        {company === null ? null : (
          <Text style={[type.small, { color: paper.inkSoft, marginTop: space(4), textAlign: 'center' }]}>
            {company}
          </Text>
        )}
        {/* Which build this is, so a learner writing in about something that went
            wrong can say which one it went wrong on. Absent rather than half
            written when the config carries no version. */}
        {versionLine === null ? null : (
          <Text style={[type.small, { color: paper.inkSoft, marginTop: space(2), textAlign: 'center' }]}>
            {versionLine}
          </Text>
        )}
      </View>

      {/* Delete account, apart from every routine row (Stage 3). It used to sit
          in the Account card between Sign out and nothing, one slip away from
          the row above it. Now it is a card of its own at the foot of the
          screen, with room above it, and it opens the same confirmation. */}
      <View style={{ marginTop: space(2), paddingBottom: space(8) }}>
        <Card>
          {/* Opening is an exit too: the sheet is entered blank, never holding a
              password or a reason from a visit that ended some other way. */}
          <SettingsRow
            first
            label={DELETE_ROW}
            destructive
            onPress={() => {
              forgetDeleteDraft();
              setSheet('delete');
            }}
          />
        </Card>
      </View>
    </ScrollScreen>
    <BottomSheet visible={sheet === 'export'} title="Download your data" onClose={closeCurrentSheet}
      footer={<View style={{ gap: space(3) }}>
        <PillButton label={exporting ? 'Preparing…' : 'Verify and download'} disabled={exporting || (hasPassword && exportPassword.length === 0)} onPress={() => prepareMyData(hasPassword ? exportPassword : undefined)} />
        <GhostButton label="Cancel" onPress={closeCurrentSheet} />
      </View>}>
      <Text style={[type.body, { color: paper.inkSoft }]}>Confirm it is you before downloading your account and learning data.</Text>
      {hasPassword ? <Field label="Confirm with your password" value={exportPassword} onChangeText={setExportPassword} placeholder="Your password" secure autoComplete="current-password" error={exportTrouble} />
        : <Text style={[type.body, { color: paper.inkSoft }]}>{user?.provider === 'apple' ? 'Apple' : 'Google'} will ask you to sign in again.</Text>}
      {!hasPassword && exportTrouble !== null && <TroubleLine message={exportTrouble} />}
    </BottomSheet>
    <BottomSheet visible={sheet === 'reminderTime' && reminderOwned} title={REMINDER_TIME_TITLE} onClose={() => setSheet('none')} footer={<PillButton label="Done" onPress={() => setSheet('none')} />}>
      <Text style={[type.body, { color: paper.inkSoft }]}>{REMINDER_TIME_SUB}</Text>
      {REMINDER_TIMES.map((option) => (
        <OptionRow key={option.value} title={option.label} detail={option.gloss}
          selected={chosen.value === option.value} onPress={() => chooseReminderTime(option.value)} />
      ))}
      {reminderOwned && reminderTrouble !== null && <TroubleLine message={reminderTrouble} />}
    </BottomSheet>
    </>
  );
}
