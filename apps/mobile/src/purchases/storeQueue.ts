/** RevenueCat has one mutable app-user identity; keep it stable through a sheet. */
export function storeQueue() {
  let tail: Promise<void> = Promise.resolve();
  return <T>(work: () => Promise<T>): Promise<T> => {
    const next = tail.then(work, work);
    tail = next.then(() => {}, () => {});
    return next;
  };
}
