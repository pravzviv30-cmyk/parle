/**
 * Which pages the wall has this time, and why the number is not a constant.
 *
 * 2026-09-27, notebook Phase 6-E: at most two pages, what you get and then the
 * plans. The map and French pages left the wall.
 *
 * Three reasons the list is computed rather than written down:
 *
 * 1. The plans page cannot exist without a store. The web adapter answers
 *    `{ available: false }` unconditionally and a build with no RevenueCat key
 *    answers the same, so a hardcoded two would draw a second dot onto a page
 *    that is never coming. The first page standing alone is also what lets all
 *    of this ship and be reviewed before the first key is set.
 * 2. Somebody who came to buy should not be sold to. The Settings row opens the
 *    plans directly.
 * 3. `ProgressDots` takes a total. A total that lies is worse than no dots, and
 *    a learner counting two dots on a one page flow has been told the wall is
 *    longer than it is at exactly the moment they are deciding whether to
 *    continue.
 *
 * Nothing is dropped for want of data, and nothing varies by what the learner
 * has done: the first page is the same for everybody.
 */

/**
 * The pages, in the order they are ever drawn.
 *
 * `map` and `french` are retired and never drawn. They stay in the union only
 * because it must name exactly the pages the `wall_page_seen` event can carry
 * (`analytics/track.ts`, held by the agreement test in `wallPages.test.ts`), and
 * the two should narrow together, in one change, by whoever owns the funnel.
 */
export type WallPage = 'yours' | 'plans';

/**
 * How the wall was reached.
 *
 * The same four strings the `wall_shown` analytics event carries, because a
 * funnel split by a different set of doors than the code has is a funnel nobody
 * can read. `path-complete` is the founder's primary door: the learner has
 * walked the welcome path and reached for the next situation.
 */
export type WallEntry = 'path-complete' | 'refused' | 'settings' | 'recap';

/** The value page. The plans page is decided separately, by the store. */
const VALUE_PAGES: readonly WallPage[] = ['yours'];

export function wallPages(input: { entry: WallEntry; storeHasPlans: boolean }): readonly WallPage[] {
  if (input.entry === 'settings' || input.entry === 'path-complete') {
    // Straight to the price. The Settings group is already drawn only when the
    // store answered with a product, so this list is empty only in a state that
    // cannot be reached from there.
    return input.storeHasPlans ? ['plans'] : input.entry === 'path-complete' ? VALUE_PAGES : [];
  }
  return input.storeHasPlans ? [...VALUE_PAGES, 'plans'] : VALUE_PAGES;
}

/**
 * What the one primary button does on this page.
 *
 * A decision rather than a ternary in the screen, because it is the difference
 * between offering a plan and offering nothing, and that difference depends on a
 * page that may not exist. `to-plans` is the last value page when there is
 * somewhere to go; `done` is the last page when there is not, and it points at
 * the free product the page just promised rather than at a plan nobody can buy.
 */
export type WallAction = 'next' | 'to-plans' | 'buy' | 'done';

export function wallAction(pages: readonly WallPage[], index: number): WallAction {
  if (pages[index] === 'plans') return 'buy';
  return pages[index + 1] === 'plans' ? 'to-plans' : index === pages.length - 1 ? 'done' : 'next';
}

/** Whether this showing can end in a purchase at all. */
export function canBuy(pages: readonly WallPage[]): boolean {
  return pages.includes('plans');
}

/**
 * The last page's forward action, which differs by whether there is one.
 *
 * With a store the first page leads to the plans. Without one the wall ends on
 * the first page, and the honest last word is the free promise it just made
 * rather than a button to nowhere.
 */
export function endsOnPlans(pages: readonly WallPage[]): boolean {
  return pages[pages.length - 1] === 'plans';
}
