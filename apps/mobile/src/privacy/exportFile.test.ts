import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setActiveUser} from '../storage/scope.ts';

test('web export cleanup recovers crash leftovers and retries failed initialization/removal without losing track',async()=>{
  const leftover='luvani-export-123-1-account-data.ndjson';const files=new Set([leftover]);let refused=true;let openingFails=false;let aborts=0;
  const dir={
    entries:async function*(){for(const name of files)yield [name,{}];},
    removeEntry:async(name:string)=>{if(refused)throw new Error('filesystem refused');files.delete(name);},
    getFileHandle:async(name:string)=>{files.add(name);return {createWritable:async()=>{if(openingFails)throw new Error('open refused');return {write:async()=>{},close:async()=>{},abort:async()=>{aborts++;}};},getFile:async()=>new Blob(['verified export'])};},
  };
  const previous=Object.getOwnPropertyDescriptor(globalThis,'navigator');
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{storage:{getDirectory:async()=>({getDirectoryHandle:async()=>dir})}}});
  try {
    const {resetWebExports}=await import('../progress/temporaryExportCache.ts');
    const {createExportFile}=await import('./exportFile.ts');setActiveUser('learner-A');
    await assert.rejects(resetWebExports());assert.equal(files.has(leftover),true);
    refused=false;await resetWebExports();assert.equal(files.size,0,'account cleanup must sweep previous-process files without another export');
    openingFails=true;refused=true;await assert.rejects(createExportFile(40));assert.equal(files.size,1,'failed removal must remain recoverable');
    refused=false;await resetWebExports();assert.equal(files.size,0);
    openingFails=false;const file=await createExportFile(40);assert.equal(files.size,1);
    await file.append(new Uint8Array([1,2,3]));
    await Promise.all([file.discard(),resetWebExports()]);assert.equal(files.size,0);assert.equal(aborts,1,'concurrent finally/reset must share one abort/delete');
    const old=await createExportFile(40);setActiveUser('learner-B');await assert.rejects(old.append(new Uint8Array([1])));await resetWebExports();assert.equal(files.size,0);
  } finally {if(previous)Object.defineProperty(globalThis,'navigator',previous);else Reflect.deleteProperty(globalThis,'navigator');}
});
