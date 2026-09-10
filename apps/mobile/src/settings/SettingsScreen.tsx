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
import { Card, Field, Label, OutlineButton } from '../components.tsx';
import { ScrollScreen, ScreenHeader } from '../layout.tsx';
import { useHardwareBack } from '../nav/useHardwareBack.ts';
import { SettingsRow } from './SettingsRow.tsx';
import { SwitchRow } from './SwitchRow.tsx';
import { TroubleLine } from './TroubleLine.tsx';
import { Acknowledgements } from '../legal/Acknowledgements.tsx';
import { PolicyScreen } from '../legal/PolicyScreen.tsx';
import { TermsScreen } from '../legal/TermsScreen.tsx';
import { companyLine, contactRow, privacyNote } from '../legal/company.ts';
import { TERMS_TITLE } from '../legal/terms.ts';
import { CONSENT_ROW, CONSENT_SUB, analyticsAllowed } from '../analytics/consent.ts';
import { loadConsent, saveConsent } from '../analytics/consentStore.ts';
import { useAuth } from '../auth/useAuth.tsx';
import { downloadAccountData } from '../privacy/export.ts';
import { appVersionLine } from '../profile/appVersion.ts';
import { purchases, type StoreOffering } from '../purchases/adapter.ts';
import { restorePurchases } from '../purchases/restore.ts';
import { PURCHASE_TROUBLE, RESTORE_BUSY, restoreTrouble } from '../purchases/paywallView.ts';
import { RESTORE_DONE, subscriptionGroup, type SubscriptionAction } from '../purchases/subscription.ts';
import { reminderPermission } from '../reminders/schedule.ts';
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
type Sheet = 'none' | 'acknowledgements' | 'policy' | 'terms' | 'delete';

/** Which store call is in flight, so neither row can be tapped twice. */
type StoreBusy = 'none' | SubscriptionAction;

export function SettingsScreen({
  onSignOut,
  onDeleteAccount,
}: {
  onSignOut: () => void;
  onDeleteAccount: (reauthentication?: string) => Promise<AuthResult>;
}) {
  const nav = useNavigation<{ goBack: () => void; navigate: (screen: string, params?: object) => void }>();
  const { user, adapter } = useAuth();
  const [sheet, setSheet] = useState<Sheet>('none');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [exporting, setExporting] = useState(false);

  // Null until the first read lands, in all four cases, and for the same reason
  // the reminder row is: a guess draws a row at somebody who was never asked.
  const [consent, setConsent] = useState<boolean | null>(null);
  const [consentTrouble, setConsentTrouble] = useState<string | null>(null);
  const [offering, setOffering] = useState<StoreOffering | null>(null);
  const [microphone, setMicrophone] = useState<PhonePermission | null>(null);
  const [notifications, setNotifications] = useState<PhonePermission | null>(null);

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
      void loadConsent()
        .then((stored) => {
          if (!cancelled) setConsent(analyticsAllowed(stored));
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
    }, [user]),
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
    sheet !== 'none' && sheet !== 'acknowledgements' && sheet !== 'policy' && sheet !== 'terms',
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
    setStoreBusy(action);
    setStoreMessage(null);
    const asked: Promise<string | null> =
      action === 'manage'
        ? purchases.manage(user.id).then((result) => (result.ok || result.cancelled ? null : PURCHASE_TROUBLE))
        : restorePurchases(user.id).then((outcome) => (outcome.kind === 'done' ? RESTORE_DONE : restoreTrouble(outcome)));
    void asked
      .then(setStoreMessage)
      .catch(() => setStoreMessage(PURCHASE_TROUBLE))
      .finally(() => setStoreBusy('none'));
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
  const askForMyData = () => {
    if (!user || exporting) return;
    setExporting(true);
    setExportTrouble(null);
    void downloadAccountData(user, adapter)
      .then((result) => {
        if (!result.ok) setExportTrouble(result.message);
      })
      .finally(() => setExporting(false));
  };

  /** Open a mail app at the one address, and leave the address readable if it will not. */
  const writeTo = (address: string) => {
    setContactTrouble(null);
    void openMail(address).then((outcome) => {
      if (outcome !== 'done') setContactTrouble(LINK_TROUBLE);
    });
  };

  if (sheet === 'acknowledgements') return <Acknowledgements onBack={() => setSheet('none')} />;
  if (sheet === 'policy') return <PolicyScreen onBack={() => setSheet('none')} />;
  if (sheet === 'terms') return <TermsScreen onBack={() => setSheet('none')} />;

  if (sheet === 'delete') {
    // No chevron: this is the one sheet where leaving is the safe answer and it
    // is spelled out as "Keep my account" rather than a quiet back arrow.
    return (
      <ScrollScreen>
        <Text style={[type.display, { color: paper.ink }]}>Delete your account?</Text>
        <Text style={[type.body, { color: paper.inkSoft, marginTop: space(3) }]}>
          This permanently removes your sign-in, conversations turned into practice, progress, and remaining minutes. It cannot be undone.
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
          <OutlineButton
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
          <OutlineButton
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
    <ScrollScreen header={<ScreenHeader back={{ onPress: () => nav.goBack() }} />}>
      <Text accessibilityRole="header" style={[type.display, { color: paper.ink, marginBottom: space(5) }]}>
        {SETTINGS_TITLE}
      </Text>

      <Label>{ACCOUNT_GROUP}</Label>
      <Card style={{ marginTop: space(2.5) }}>
        <SettingsRow first label={EMAIL_ROW} value={user?.email ?? EMAIL_UNKNOWN} />
        {user?.provider === 'mock' && <SettingsRow label={DEMO_ROW} value={DEMO_VALUE} />}
        <SettingsRow label={SIGN_OUT_ROW} onPress={onSignOut} />
        {/* Opening is an exit too: the sheet is entered blank, never holding a
            password or a reason from a visit that ended some other way. */}
        <SettingsRow
          label={DELETE_ROW}
          destructive
          onPress={() => {
            forgetDeleteDraft();
            setSheet('delete');
          }}
        />
      </Card>

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
          <SettingsRow label={SAVED_ROW} value={SAVED_SUB} onPress={() => nav.navigate('Tabs', { screen: 'MyFrench' })} />
        </Card>
      </View>

      {/* One row per permission the OS has refused, and nothing at all otherwise.
          `phoneRows` decides; an allowed permission draws no row because a row
          reading Allowed does nothing when it is tapped. */}
      {phone.length > 0 && (
        <View style={{ marginTop: space(6) }}>
          <Label>{PHONE_GROUP}</Label>
          <Card style={{ marginTop: space(2.5) }}>
            {phoneTrouble !== null && <TroubleLine message={phoneTrouble} />}
            {phone.map((row, index) => (
              <SettingsRow
                key={row.key}
                first={index === 0}
                label={row.label}
                value={row.sub}
                onPress={walkToPhoneSettings}
              />
            ))}
          </Card>
        </View>
      )}

      {/* Absent until an address is supplied. A Contact us row with nothing
          behind it is a row that lies, so `contactRow` answers null and this
          draws nothing rather than a dead row somebody would tap. */}
      {contact !== null && (
        <View style={{ marginTop: space(6) }}>
          <Label>{HELP_GROUP}</Label>
          <Card style={{ marginTop: space(2.5) }}>
            {contactTrouble !== null && <TroubleLine message={contactTrouble} />}
            {/* The address is the row's own value, so a phone with no mail app
                set up still leaves something a learner can read and write down
                rather than a tap that answered nothing. */}
            <SettingsRow first label={contact.label} value={contact.address} onPress={() => writeTo(contact.address)} />
          </Card>
        </View>
      )}

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
    </ScrollScreen>
  );
}
