import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { DAILY_WORDS, DAILY_PHRASES } from '@luvani/core';
test('every word, example and phrase has a content-matched bundled recording without a runtime API',()=>{
 const manifest=readFileSync(new URL('./audioManifest.ts',import.meta.url),'utf8');
 const rows=[...manifest.matchAll(/"([^"]+)": require\('\.\.\/\.\.\/assets\/daily-kokoro\/([a-f0-9]+\.m4a)'\)/g)];
 assert.equal(rows.length,3000); const files=new Map(rows.map(m=>[m[1]!,m[2]!]));
 const entries=[...DAILY_WORDS.map(w=>[w.id,w.fr]),...DAILY_WORDS.map(w=>[w.id+':example',w.exampleFr]),...DAILY_PHRASES.map(p=>[p.id,p.fr])];
 for(const [id,text] of entries) {
  const name=createHash('sha256').update(`Kokoro-82M-v1:ff_siwis:1:${text}`).digest('hex').slice(0,20)+'.m4a';
  assert.equal(files.get(id!),name,id); const file=new URL(`../../assets/daily-kokoro/${name}`,import.meta.url);
  assert.ok(statSync(file).size>1000,`${id} has empty audio`); assert.equal(readFileSync(file).subarray(4,8).toString(),'ftyp');
 }
 for(const source of ['DailyCard.tsx','DailyPracticeScreen.tsx']) assert.doesNotMatch(readFileSync(new URL(source,import.meta.url),'utf8'),/fetch\(|Speech\.speak|speechace|openai/i);
});
