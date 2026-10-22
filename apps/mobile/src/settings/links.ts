/**
 * The two ways out of the app, and the only two there are.
 *
 * Before this, `Linking` was imported exactly once in the whole repo, for the
 * OAuth callback (`auth/oauth.native.ts`). That is worth keeping close to true:
 * a link out is a moment the app hands somebody to software it does not control,
 * and every one of them should be countable. So there are two functions here and
 * a test that says which files may reach a browser at all.
 *
 * **`openMail`** is the Contact us row and the beta's report control, drawn only when
 * `legal/company.ts` has an address to write to. The address is passed in rather
 * than read here, because that module owns whether there is one.
 *
 * **`openLink`** is the terms screen, opening Apple's own standard licence at
 * the fixed address in `legal/terms.ts`. It is not a general browser: the URL is
 * a constant in a module, never built from anything a learner typed or a server
 * sent, so there is no way for this to open somewhere nobody chose.
 *
 * ## Why the licence opens in the app and mail does not
 *
 * The licence goes to `openBrowserAsync`, which is an in-app browser sheet with
 * Done in the corner. A learner reading terms is mid task, and leaving the app
 * for Safari means finding their way back afterwards. Mail is the opposite: the
 * point is to write something, which cannot happen inside a sheet, so a `mailto:`
 * goes to the OS and their own mail app answers it.
 *
 * ## Both say what happened
 *
 * Neither swallows a failure. A phone with no mail account set up rejects the
 * `mailto:`, and a tap that quietly did nothing is the dead switch F239 refused.
 * The caller shows a sentence and the address stays on screen, so somebody can
 * still write it down. Nobody is stranded on a row that will not answer.
 */

import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

/** Whether the phone took the request. Nothing stronger than that is knowable. */
export type LinkOutcome = 'done' | 'failed';

/**
 * Open the learner's own mail app with the address filled in.
 *
 * Never a body. A prefilled body would be the app putting words in their
 * mouth, and the Contact us row passes no subject either: a prefilled subject
 * there is a small piece of theatre that decides what somebody is writing about
 * before they have said.
 *
 * The one subject this takes is a reference, not words. "Report this reply"
 * (`settings/reportMail.ts`) passes the session id and the app version and
 * nothing else, because Luvani keeps no transcript: a report without the
 * session id cannot be matched to anything, and the learner would be writing
 * into a void. Nothing they or the tutor said is ever part of it.
 */
export async function openMail(address: string, subject?: string): Promise<LinkOutcome> {
  const url = subject === undefined ? `mailto:${address}` : `mailto:${address}?subject=${encodeURIComponent(subject)}`;
  try {
    await Linking.openURL(url);
    return 'done';
  } catch {
    return 'failed';
  }
}

/**
 * Open one fixed address in an in-app browser sheet.
 *
 * `openBrowserAsync` resolves when the sheet closes and rejects when it could
 * not be opened at all, so a rejection here really is "this phone would not open
 * it" rather than "they read it and came back".
 */
export async function openLink(url: string): Promise<LinkOutcome> {
  try {
    await WebBrowser.openBrowserAsync(url);
    return 'done';
  } catch {
    return 'failed';
  }
}
