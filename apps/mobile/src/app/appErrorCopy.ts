/**
 * Every word the error screen says (F794).
 *
 * Here rather than in AppErrorScreen.tsx because a screen holds no copy: a
 * sentence written inside a component is one no sweep can read and no test
 * can hold.
 *
 * Each line has to be true wherever the screen appears, and it can appear
 * anywhere: mid-conversation, partway through onboarding, on Home, or just
 * after an account and this device's copy of it were deleted on purpose. So it
 * names no screen and promises nothing about what is saved, because that last
 * case is one where nothing is. It says the fault is the app's, because it is,
 * and it offers the one thing the screen can do.
 */

/** The title. */
export const APP_ERROR_TITLE = 'Something went wrong';

/** The one sentence under it. */
export const APP_ERROR_BODY = 'That was a problem in Luvani, not something you did.';

/** The one pill. It opens everything behind the door again, the way a relaunch would. */
export const APP_ERROR_TRY_AGAIN = 'Try again';

/** Every fixed line the error screen can say, for the copy sweeps. */
export const APP_ERROR_COPY: readonly string[] = [APP_ERROR_TITLE, APP_ERROR_BODY, APP_ERROR_TRY_AGAIN];
