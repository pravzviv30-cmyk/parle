/** Keep human-readable output, but only completed test events prove ledger claims. */
import { spec } from 'node:test/reporters';
import { Readable } from 'node:stream';
export const PROOF_PREFIX = 'LUVANI_TEST_PASS ';
export function passingTestTitles(output) {
  return output.split('\n').filter(line => line.startsWith(PROOF_PREFIX)).map(line => JSON.parse(line.slice(PROOF_PREFIX.length)));
}
export default async function* reporter(source) {
  const passed = [];
  async function* events() {
    for await (const event of source) {
      if (event.type === 'test:pass' && event.data.details?.type === 'test' && !event.data.skip && !event.data.todo) passed.push(event.data.name);
      yield event;
    }
  }
  yield* Readable.from(events()).pipe(new spec());
  for (const name of passed) yield `${PROOF_PREFIX}${JSON.stringify(name)}\n`;
}
