/** The cost aggregator reads numbers only: parser, stats, prefix handling and the refusal. */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { costReportLines, parseCostLog } from './costNumbers.ts';

export const FIXTURE = [
  '2026-10-28T10:00:00Z info {"event":"session_cost","session":"aaaaaaaa","usd":0.01,"priceExact":true,"calls":4,"abandoned":0,"activities":{"turn":{"calls":3,"abandoned":0,"usd":0.004},"drills":{"calls":1,"abandoned":0,"usd":0.006}}}',
  '{"event":"session_cost","session":"bbbbbbbb","usd":0.03,"priceExact":true,"calls":2,"abandoned":1,"activities":{"turn":{"calls":2,"abandoned":1,"usd":0.03}}}',
  '2026-10-28T10:00:01Z [luvani:cost] session=aaaaaaaa ttsCharsBilled=400 ttsCharsCached=50 ttsCharsReplayed=0 ttsSpeed=1 sttSec=120.5',
  '[luvani:cost] session=bbbbbbbb ttsCharsBilled=200 ttsCharsCached=0 ttsCharsReplayed=0 ttsSpeed=0.9 sttSec=60.0',
  '{"event":"drill_validation","path":"live","proposed":6,"accepted":5}',
  '{"event":"drill_validation","path":"live","proposed":4,"accepted":4}',
  'app[worker.1]: {"event":"practice_usage","inputTokens":1000,"outputTokens":500,"cacheReadTokens":0,"cacheWriteTokens":0,"usdEstimate":0.02,"priceExact":true}',
  'app[worker.1]: {"event":"practice_job","result":"complete","proposed":8,"accepted":6,"failure":null,"generationMs":20000,"sinceSessionEndMs":45000,"usdEstimate":0.02}',
  '{"event":"practice_job","result":"retry","proposed":null,"accepted":null,"failure":"parse","generationMs":15000,"sinceSessionEndMs":null,"usdEstimate":0.01}',
  '{"event":"practice_job","result":"superseded"}',
  '[luvani:judge] answered by jev-1.13.0: 858 input, 20 output, $0.000036',
  '[luvani:judge] answered by claude-haiku: 900 input, 30 output, $0.000964 (estimated)',
  '[luvani:judge] memo hit drill',
  '[luvani] something unrelated',
  '{"event":"practice_worker_failure","name":"Error"}',
].join('\n');

test('reads the fixture into sums, joining voice by prefix and skipping the rest', () => {
  const parsed = parseCostLog(FIXTURE);
  assert.ok(parsed.ok);
  const lines = costReportLines(parsed.log);
  const text = lines.join('\n');
  assert.match(text, /conversations counted: 2/);
  assert.match(text, /brain cost per conversation: p50 \$0\.010000, p95 \$0\.030000, mean \$0\.020000/);
  assert.match(text, /turn: mean \$0\.017000 over 2/);
  assert.match(text, /joined 2 of 2\): ttsCharsBilled mean 300\.0, sttSec mean 90\.3/);
  assert.match(text, /cost per practice set \(1 completed with a price\): p50 \$0\.020000/);
  assert.match(text, /ready after session end \(estimate\): p50 45000ms/);
  assert.match(text, /live 10\.0% \(9 of 10 kept\), worker 25\.0% \(6 of 8 kept\)/);
  assert.match(text, /practice jobs: 3 \(complete 1, retry 1, superseded 1\); retry rate 33\.3%/);
  assert.match(text, /reasons: parse 1/);
  assert.match(text, /judge checks answered: 2, cost per check \$0\.000500; memo hits 1, hit rate 33\.3%/);
  assert.match(text, /lines skipped: 2/);
});

test('a metric with no data says not measured, never 0', () => {
  const parsed = parseCostLog('[luvani:judge] memo hit drill');
  assert.ok(parsed.ok);
  const text = costReportLines(parsed.log).join('\n');
  assert.match(text, /brain cost per conversation: p50 not measured/);
  assert.match(text, /validation rejection rate: live not measured/);
  assert.match(text, /cost per check not measured/);
});

test('an unknown field refuses the whole file, naming the field and never the value', () => {
  const bad = FIXTURE + '\n{"event":"practice_job","result":"complete","transcript":"je voudrais secret"}';
  const parsed = parseCostLog(bad);
  assert.equal(parsed.ok, false);
  assert.ok(!parsed.ok && /line 16 practice_job has an unknown field "transcript"/.test(parsed.message));
  assert.ok(!parsed.ok && !parsed.message.includes('secret'));
  const wrongType = parseCostLog('{"event":"session_cost","session":"aaaaaaaa","usd":"lots","priceExact":true,"calls":1,"abandoned":0,"activities":{}}');
  assert.ok(!wrongType.ok && !wrongType.message.includes('lots'));
  const room = parseCostLog('[luvani:cost] session=aaaaaaaa room=secret-room');
  assert.ok(!room.ok && !room.message.includes('secret-room'));
});
