// Run before installing anything. Build args contain public identities only.
import { readFile } from 'node:fs/promises';
const image=process.env.NODE_IMAGE,sha=process.env.GIT_SHA;
if(process.versions.node!=='24.16.0' || !/^node:24\.16\.0-bookworm-slim@sha256:[a-f0-9]{64}$/.test(image??'')
  || /^.*@sha256:([a-f0-9])\1{63}$/.test(image??'') || !/^[a-f0-9]{40}$/.test(sha??'') || /^([a-f0-9])\1{39}$/.test(sha??'')) {
  throw new Error('Build requires Node24.16.0, its exact reviewed image digest, and the actual full git SHA.');
}
const decoderImage=process.env.AUDIO_DECODER_IMAGE,decoderSha=process.env.AUDIO_DECODER_SHA256;
if(!/^[a-z0-9][a-z0-9./:_-]*@sha256:[a-f0-9]{64}$/.test(decoderImage??'') || /^.*@sha256:([a-f0-9])\1{63}$/.test(decoderImage??'') || !/^[a-f0-9]{64}$/.test(decoderSha??'') || /^([a-f0-9])\1{63}$/.test(decoderSha??''))throw new Error('Build requires a reviewed immutable decoder image and actual executable SHA256.');
const lock=JSON.parse(await readFile(new URL('../package-lock.json',import.meta.url),'utf8'));
if(lock.lockfileVersion!==3)throw new Error('Expected reviewed npm lockfile v3');
