import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { inScope, options, parsePlan, runCommand, runLoop } from './loop.mjs';

const planText = (tasks) => `# A bounded local change\n\n\`\`\`luvani-loop\n${JSON.stringify({ version: 1, tasks }, null, 2)}\n\`\`\`\n`;
const task = (id = 'T1', extra = {}) => ({ id, goal: `Implement ${id}`, dependsOn: [], files: [`${id}.txt`], checks: [ [process.execPath, '-e', `if(require('fs').readFileSync('${id}.txt','utf8')!=='done')process.exit(1)`] ], ...extra });
function fixture(t, tasks = [task()], agentBody = "const task=p.match(/Task (T\\d):/)[1];fs.writeFileSync(task+'.txt','done');") {
  const root = mkdtempSync(path.join(os.tmpdir(), 'luvani-loop-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, 'scripts')); mkdirSync(path.join(root, 'docs')); mkdirSync(path.join(root, 'bin'));
  writeFileSync(path.join(root, '.gitignore'), '.loop/\nbin/\n');
  writeFileSync(path.join(root, 'docs/KNOWN_ISSUES.md'), '# Empty ledger\n');
  writeFileSync(path.join(root, 'scripts/gate.mjs'), "console.log(JSON.stringify({ok:true,failures:[],open:[]}));");
  writeFileSync(path.join(root, 'plan.md'), planText(tasks));
  writeFileSync(path.join(root, 'bin/claude'), `#!/usr/bin/env node\nconst fs=require('fs');const p=process.argv[process.argv.indexOf('-p')+1];\n${agentBody}\n`, { mode: 0o755 });
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-b', 'codex/fixture'); git('add', '.gitignore', 'docs/KNOWN_ISSUES.md', 'scripts/gate.mjs', 'plan.md');
  git('-c', 'user.name=Loop Test', '-c', 'user.email=loop@example.invalid', '-c', 'core.hooksPath=/dev/null', 'commit', '-m', 'fixture');
  const oldPath = process.env.PATH;
  process.env.PATH = `${path.join(root, 'bin')}${path.delimiter}${oldPath}`;
  t.after(() => { process.env.PATH = oldPath; });
  const run = (args = []) => runLoop({ root, argv: ['--plan', 'plan.md', '--minutes', '0.5', ...args], print: () => {} });
  const state = () => { const id = readdirSync(path.join(root, '.loop'))[0]; return { id, ...JSON.parse(readFileSync(path.join(root, '.loop', id, 'state.json'))) }; };
  return { root, run, state, git };
}

test('loop rejects invalid budgets, dependency cycles and unsafe write paths before execution', () => {
  for (const args of [['--max','NaN'],['--max','1.5'],['--minutes','0'],['--patience','-1'],['--yolo'],['--resume','../run'],['--permission-mode','bypassPermissions']]) assert.throws(() => options(args));
  for (const file of ['../outside','/outside','.git/config','src/../../outside','node_modules/package','.env.local','src\\file']) assert.throws(() => parsePlan(planText([task('T1',{ files:[file] })])));
  assert.throws(() => parsePlan(planText([task('T1',{dependsOn:['T2']}),task('T2',{dependsOn:['T1']})])),/cycle/);
  assert.throws(() => parsePlan(planText([task('T1',{dependsOn:['missing']})])),/Unknown dependency/);
  assert.equal(inScope('apps/mobile2/file',['apps/mobile/']), false);
  assert.equal(inScope('apps/mobile/src/file',['apps/mobile/']), true);
});

test('dry run previews a plan on a dirty checkout without model calls, logs or Git mutations', async (t) => {
  const f = fixture(t); writeFileSync(path.join(f.root,'personal.txt'),'keep');
  const before = f.git('status','--porcelain');
  assert.equal(await f.run(['--dry-run','--branch','codex/new']),0);
  assert.equal(f.git('status','--porcelain'),before);
  assert.equal(f.git('branch','--show-current'),'codex/fixture');
  assert.equal(existsSync(path.join(f.root,'.loop')),false);
  assert.equal(existsSync(path.join(f.root,'T1.txt')),false);
  await assert.rejects(f.run(),/clean checkout/);
});

test('a green baseline still builds plan tasks in dependency order and verifies the final gate', async (t) => {
  const f = fixture(t,[task('T2',{dependsOn:['T1']}),task()], "const task=p.match(/Task (T\\d):/)[1];if(task==='T2'&&!fs.existsSync('T1.txt'))process.exit(5);fs.writeFileSync(task+'.txt','done');");
  const head = f.git('rev-parse','HEAD');
  assert.equal(await f.run(),0);
  assert.deepEqual(f.state().done,['T1','T2']); assert.equal(f.state().status,'complete');
  assert.equal(f.git('rev-parse','HEAD'),head); assert.equal(f.git('diff','--cached','--name-only'),'');
  assert.equal(readFileSync(path.join(f.root,'T2.txt'),'utf8'),'done');
});

test('the model cannot complete a task by claiming success or exiting with an error', async (t) => {
  const f = fixture(t,[task()], "fs.writeFileSync('T1.txt','done');process.exit(3);");
  assert.equal(await f.run(['--max','1']),1); assert.deepEqual(f.state().done,[]);
  assert.match(f.state().feedback,/Agent exited 3/);
  assert.equal(readFileSync(path.join(f.root,'T1.txt'),'utf8'),'done');
});

test('failed acceptance preserves partial work and sends its evidence into a bounded repair attempt', async (t) => {
  const f = fixture(t,[task()], "if(fs.existsSync('T1.txt')){if(!p.includes('exited 1'))process.exit(7);fs.writeFileSync('T1.txt','done');}else fs.writeFileSync('T1.txt','partial');");
  assert.equal(await f.run(['--max','2']),0); assert.equal(f.state().attempts,2);
  assert.deepEqual(f.state().done,['T1']);
});

test('out-of-scope edits stop the loop, stay available for review and cannot be resumed blindly', async (t) => {
  const f = fixture(t,[task()], "fs.writeFileSync('outside.txt','preserve');fs.writeFileSync('T1.txt','done');");
  assert.equal(await f.run(),1); assert.equal(f.state().status,'scope-violation');
  assert.equal(readFileSync(path.join(f.root,'outside.txt'),'utf8'),'preserve'); assert.deepEqual(f.state().done,[]);
  await assert.rejects(f.run(['--resume',f.state().id]),/scope violation/);
});

test('resume binds checkpoints to the plan, revision and actual file contents', async (t) => {
  const f = fixture(t,[task(),task('T2',{dependsOn:['T1']})]);
  assert.equal(await f.run(['--max','1']),1); const id = f.state().id;
  assert.deepEqual(f.state().done,['T1']);
  assert.equal(await f.run(['--resume',id]),0); assert.deepEqual(f.state().done,['T1','T2']);
  writeFileSync(path.join(f.root,'T1.txt'),'foreign edit');
  await assert.rejects(f.run(['--resume',id]),/working files changed/);
});

test('the final gate can refuse a plan whose focused checks passed', async (t) => {
  const f = fixture(t);
  writeFileSync(path.join(f.root,'scripts/gate.mjs'),"console.log(JSON.stringify({ok:false,failures:[{check:'full',detail:'red'}],open:[]}));process.exit(1);");
  f.git('add','scripts/gate.mjs'); f.git('-c','user.name=Loop Test','-c','user.email=loop@example.invalid','-c','core.hooksPath=/dev/null','commit','-m','red gate fixture');
  assert.equal(await f.run(),1); assert.deepEqual(f.state().done,['T1']); assert.equal(f.state().status,'gate-failed');
});

test('a command deadline ends a stalled child and records failure', async (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(),'luvani-loop-deadline-')); t.after(()=>rmSync(root,{recursive:true,force:true}));
  const start = Date.now();
  const result = await runCommand(root,[process.execPath,'-e','setInterval(()=>{},100)'],Date.now()+150,new AbortController().signal);
  assert.equal(result.stopped,true); assert.equal(result.code,1); assert.ok(Date.now()-start<3000);
});

test('Ctrl-C cancellation stops an active command without waiting for its deadline', async (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(),'luvani-loop-cancel-')); t.after(()=>rmSync(root,{recursive:true,force:true}));
  const controller = new AbortController(); const running = runCommand(root,[process.execPath,'-e','setInterval(()=>{},100)'],Date.now()+10000,controller.signal);
  controller.abort(); const result = await running;
  assert.equal(result.stopped,true); assert.equal(result.code,1);
});

test('bug mode repairs a red gate locally without staging or discarding the fix', async (t) => {
  const f = fixture(t,[task()], "fs.writeFileSync('T1.txt','done');");
  writeFileSync(path.join(f.root,'scripts/gate.mjs'),"const fs=require('node:fs'); const ok=fs.existsSync('T1.txt')&&fs.readFileSync('T1.txt','utf8')==='done'; console.log(JSON.stringify({ok,failures:ok?[]:[{check:'fixture',detail:'missing fix'}],open:[]}));process.exit(ok?0:1);".replace("const fs=require('node:fs');", "import fs from 'node:fs';"));
  f.git('add','scripts/gate.mjs'); f.git('-c','user.name=Loop Test','-c','user.email=loop@example.invalid','-c','core.hooksPath=/dev/null','commit','-m','bug fixture');
  assert.equal(await runLoop({root:f.root,argv:['--files','T1.txt','--minutes','0.5'],print:()=>{}}),0);
  assert.equal(f.state().status,'complete'); assert.equal(f.git('diff','--cached','--name-only'),'');
  assert.equal(readFileSync(path.join(f.root,'T1.txt'),'utf8'),'done');
});

test('a stuck task stops at its patience limit and keeps its last unsuccessful edits', async (t) => {
  const f = fixture(t,[task()],"fs.writeFileSync('T1.txt','partial');console.log('claimed success');");
  assert.equal(await f.run(['--patience','2','--max','5']),1); assert.equal(f.state().attempts,2);
  assert.deepEqual(f.state().done,[]); assert.equal(readFileSync(path.join(f.root,'T1.txt'),'utf8'),'partial');
});
