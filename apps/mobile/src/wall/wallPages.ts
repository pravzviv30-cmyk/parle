/**
 * Which pages the wall has this time, and why the number is not a constant.
 *
 * Three reasons the list is computed rather than written down:
 *
 * 1. Page four cannot exist without a store. The web adapter answers
 *    `{ available: false }` unconditionally and a build with no RevenueCat key
 *    answers the same, so a hardcoded four would draw a fourth dot onto a page
 *    that is never coming. Three pages standing alone is also what lets all of
 *    this ship and be reviewed before the first key is set.
 * 2. Somebody who came to buy should not be sold to. The Settings row opens the
 *    plans directly, and walking them through their own progress first would be
 *    a sales pitch delivered to a decided customer.
 * 3. `ProgressDots` takes a total. A total that lies is worse than no dots, and
 *    a learner counting four dots on a three page flow has been told the wall is
 *    longer than it is at exactly the moment they are deciding whether to
 *    continue.
 *
 * Nothing is dropped for want of data. The wall varies its tail and never its
 * opening or its middle: page one is four rows for everybody and page two has a
 * start line for a learner with nothing yet. The designs that varied the opening
 * handed their weakest screen to the learner they most needed to convince.
 */

/** The pages, in the order they are ever drawn. */
export type WallPage = 'limit' | 'map' | 'french' | 'yours' | 'plans';

/**
 * How the wall was reached.
 *
 * The same four strings the `wall_shown` analytics event carries, because a
 * funnel split by a different set of doors than the code has is a funnel nobody
 * can read. `path-complete` is the founder's primary door: the learner has
 * walked the welcome path and reached for the next situation.
 */
export type WallEntry = 'path-complete' | 'refused' | 'settings' | 'recap';

/** The value pages, in order. Page four is decided separately, by the store. */
const VALUE_PAGES: readonly WallPage[] = ['map', 'french', 'yours'];

export function wallPages(input: { entry: WallEntry; storeHasPlans: boolean }): readonly WallPage[] {
  if (input.entry === 'settings') {
    // Straight to the price. The Settings group is already drawn only when the
    // store answered with a product, so this list is empty only in a state that
    // cannot be reached from there.
    return input.storeHasPlans ? ['plans'] : [];
  }
  const opening: readonly WallPage[] = input.entry === 'refused' ? ['limit', ...VALUE_PAGES] : VALUE_PAGES;
  return input.storeHasPlans ? [...opening, 'plans'] : opening;
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
 * With a store the value pages lead to the plans. Without one the wall ends on
 * page three, and the honest last word is the free promise it just made rather
 * than a button to nowhere.
 */
export function endsOnPlans(pages: readonly WallPage[]): boolean {
  return pages[pages.length - 1] === 'plans';
}
