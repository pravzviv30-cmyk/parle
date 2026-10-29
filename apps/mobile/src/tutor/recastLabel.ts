/**
 * The chip under a learner's line (founder, 2026-10-29). A grammar fix
 * (`grammar-slip`) is a small fix; every other kind, and a kind this build has
 * never heard of, keeps "A more natural way".
 */
export function recastLabel(kind: string | undefined): string {
  return kind === 'grammar-slip' ? 'Small fix' : 'A more natural way';
}
