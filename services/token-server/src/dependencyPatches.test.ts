import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const require = createRequire(new URL('../../../package.json', import.meta.url));

test('October dependency patches reject shell line injection and unbounded indexed source maps', () => {
  const lock = JSON.parse(readFileSync(new URL('../../../package-lock.json', import.meta.url), 'utf8'));
  for (const [name, version] of Object.entries({ compression: '1.8.2', 'shell-quote': '1.11.0', 'source-map-js': '1.2.2' })) {
    assert.equal(lock.packages[`node_modules/${name}`].version, version);
    assert.equal(require(`${name}/package.json`).version, version);
  }
  const { quote } = require('shell-quote');
  for (const separator of ['\n', '\r', '\u2028', '\u2029']) {
    assert.throws(() => quote(['echo', 'ok', { comment: 'fixture' }, `value${separator}unexpected-command`]), TypeError);
  }
  assert.equal(quote(['echo', 'ordinary value']), "echo 'ordinary value'");
  execFileSync(process.execPath, ['-e', `
    const assert=require('node:assert/strict');
    const {SourceMapConsumer}=require('source-map-js');
    const map={version:3,sources:['fixture.js'],names:[],mappings:'AAAA'};
    for(const line of [NaN,Infinity,-1,Number.MAX_SAFE_INTEGER])
      assert.throws(()=>new SourceMapConsumer({version:3,sections:[{offset:{line,column:0},map}]}));
    const valid=new SourceMapConsumer(map);
    assert.equal(valid.originalPositionFor({line:1,column:0}).source,'fixture.js');
  `], { cwd: root, timeout: 3000, stdio: ['ignore', 'pipe', 'pipe'] });
});

test('patched Sharp retains the tutor RGB resize and PNG encoding path', async () => {
  const tutorRequire = createRequire(new URL('../../tutor-agent/package.json', import.meta.url));
  const sharp = tutorRequire('sharp');
  assert.equal(sharp.versions.sharp, '0.35.5');
  assert.equal(sharp.versions.rsvg, '2.63.2');
  const png = await sharp(Buffer.from([255, 0, 0, 0, 255, 0]), { raw: { width: 2, height: 1, channels: 3 } })
    .resize(4, 2).png().toBuffer();
  const metadata = await sharp(png).metadata();
  assert.equal(metadata.format, 'png');
  assert.equal(metadata.width, 4);
  assert.equal(metadata.height, 2);
});
