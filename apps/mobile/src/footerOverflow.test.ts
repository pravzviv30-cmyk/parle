import assert from 'node:assert/strict';
import { test } from 'node:test';
import { footerOverflow } from './footerOverflow.ts';

test('a footer hairline appears only when the content scrolls under it', () => {
  assert.equal(footerOverflow(0, 0, 0), false);
  assert.equal(footerOverflow(800, 0, 0), false, 'wait for viewport measurement');
  assert.equal(footerOverflow(400, 600, 0), false);
  assert.equal(footerOverflow(600, 600, 0), false);
  assert.equal(footerOverflow(600.5, 600, 0), false, 'ignore subpoint rounding');
  assert.equal(footerOverflow(900, 600, 0), true);
  assert.equal(footerOverflow(900, 600, 150), true);
  assert.equal(footerOverflow(900, 600, 299.5), false);
  assert.equal(footerOverflow(900, 600, 330), false, 'bottom bounce');
  assert.equal(footerOverflow(900, 600, -30), true, 'top bounce');
  assert.equal(footerOverflow(900, 1000, 0), false, 'rotation removes overflow');
  assert.equal(footerOverflow(900, 400, 300), true, 'keyboard leaves more below');
});
