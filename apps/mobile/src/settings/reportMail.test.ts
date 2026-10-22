/**
 * "Report this reply": the subject is a reference and nothing else.
 *
 * `reportMail.ts` is pure, so the subject is executed here rather than read.
 * `links.ts` reaches expo-linking and cannot be loaded under `node --test`, so
 * its one rule that matters here, that no body is ever built, is read from its
 * source with comments stripped.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { REPORT_COPY, reportAddress, reportSubject } from './reportMail.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

describe('reportSubject', () => {
  test('carries the full session id and the app version', () => {
    const id = '7f3c2a10-9b1e-4d6a-8c55-0e2f4b7a9d31';
    assert.equal(reportSubject({ sessionId: id, version: '0.1.0' }), `Luvani report, session ${id}, app 0.1.0`);
  });

  test('drops each part it does not know', () => {
    assert.equal(reportSubject({ sessionId: null, version: '0.1.0' }), 'Luvani report, app 0.1.0');
    assert.equal(reportSubject({ sessionId: 'abc', version: undefined }), 'Luvani report, session abc');
    assert.equal(reportSubject({ sessionId: '  ', version: '' }), 'Luvani report');
    assert.equal(reportSubject({ sessionId: undefined, version: null }), 'Luvani report');
  });

  test('contains nothing but the reference parts', () => {
    const subject = reportSubject({ sessionId: 's1', version: '2.0.0' });
    const rest = subject.replace('Luvani report', '').replace(', session s1', '').replace(', app 2.0.0', '');
    assert.equal(rest, '');
  });
});

describe('reportAddress', () => {
  test('follows the Contact us row: no supplied address, no report', () => {
    assert.equal(reportAddress({ supportEmail: null, registeredName: null, companyNumber: null }), null);
    assert.equal(reportAddress({ supportEmail: 'help@example.com', registeredName: null, companyNumber: null }), 'help@example.com');
  });
});

describe('REPORT_COPY', () => {
  const all = [
    REPORT_COPY.title, REPORT_COPY.roomTitle, REPORT_COPY.body('Camille'), REPORT_COPY.roomBody('Camille'), REPORT_COPY.reply,
    REPORT_COPY.safety, REPORT_COPY.write, REPORT_COPY.notNow, REPORT_COPY.close, REPORT_COPY.failed('a@b.c'),
    REPORT_COPY.endLink, REPORT_COPY.control, REPORT_COPY.later, REPORT_COPY.cancel, REPORT_COPY.pendingControl,
  ];

  test('has no em dash and no middot', () => {
    for (const line of all) {
      assert.ok(!line.includes('—'), line);
      assert.ok(!line.includes('·'), line);
    }
  });

  test('says it is not an emergency line', () => {
    assert.match(REPORT_COPY.safety, /not an emergency/i);
    assert.match(REPORT_COPY.safety, /emergency number/i);
  });

  test('names a time for the reply', () => {
    assert.match(REPORT_COPY.reply, /within two working days/);
  });

  test('promises nothing the learner said is attached', () => {
    assert.match(REPORT_COPY.body('Camille'), /Nothing you said is attached\./);
  });

  test('the room body says the report waits for the end, and keeps their place', () => {
    const room = REPORT_COPY.roomBody('Camille');
    assert.match(room, /when this session ends/);
    assert.match(room, /keep your place/);
    assert.match(room, /Nothing you said is attached\./);
    assert.equal(REPORT_COPY.later, 'Report at the end');
    assert.equal(REPORT_COPY.cancel, 'Cancel the report');
    assert.equal(REPORT_COPY.pendingControl, 'Report saved for the end of this session');
  });

  test('the failure keeps the address in words', () => {
    assert.match(REPORT_COPY.failed('hello@luvani.app'), /hello@luvani\.app/);
  });
});

describe('openMail', () => {
  const links = stripComments(read('./links.ts'));

  test('never builds a body', () => {
    assert.doesNotMatch(links, /body=/i);
  });

  test('takes a subject only as an encoded query', () => {
    assert.match(links, /\?subject=\$\{encodeURIComponent\(subject\)\}/);
  });
});
