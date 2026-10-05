/**
 * The twelve sound effects, by id. Pure: no imports, so any module or test may use it.
 * The recipes are scripts/sfx/recipes.mjs; sound/sfxAssets.test.ts holds this union, the
 * recipes and the generated sound/sfxManifest.ts to the same list.
 */
export type SfxId =
  | 'tap'
  | 'select'
  | 'correct'
  | 'nearly'
  | 'complete'
  | 'streak'
  | 'levelup'
  | 'quest'
  | 'badge'
  | 'save'
  | 'count-tick'
  | 'whoosh';
