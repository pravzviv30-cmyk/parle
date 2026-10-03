import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reviewPhraseFor } from './language.ts';

test('kept French follows the card kind, never whichever face is called front',()=>{
 assert.deepEqual(reviewPhraseFor({kind:'vocab',front:'  un café ',back:'a coffee'}),{fr:'un café',en:'a coffee'});
 assert.deepEqual(reviewPhraseFor({kind:'turn',front:'a coffee, please',back:'Un café, s’il vous plaît.'}),{fr:'Un café, s’il vous plaît.',en:'a coffee, please'});
 for (const card of [{kind:'phoneme',front:'/y/',back:'rounded lips'},{kind:'vocab',front:' ',back:'coffee'},{kind:'turn',front:'coffee',back:''},{kind:'turn',front:'coffee',back:123},{kind:'unknown',front:'café',back:'coffee'}]) assert.equal(reviewPhraseFor(card as Parameters<typeof reviewPhraseFor>[0]),null);
});
