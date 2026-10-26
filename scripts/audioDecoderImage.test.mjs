// Static guard for the self-built decoder image (F805). Docker is not needed to run it.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));
const dockerfile=readFileSync(`${root}deployment/audio-decoder/Dockerfile`,'utf8');
const decodeSource=readFileSync(`${root}services/shared/audioDecode.ts`,'utf8');
const workflow=readFileSync(`${root}.github/workflows/audio-decoder.yml`,'utf8');
const stages=dockerfile.split('\n').filter(line=>/^FROM\s/i.test(line));
const listFlag=name=>{const match=dockerfile.match(new RegExp(`--enable-${name}=([a-z0-9_,]+)`));return match?match[1].split(','):[];};
const argValue=flag=>{const match=decodeSource.match(new RegExp(`'${flag}','([^']+)'`));assert.ok(match,`audioDecode.ts passes ${flag}`);return match[1];};
// ffmpeg's matroska demuxer is named "matroska,webm"; whitelist entries match any part of a demuxer name.
const DEMUXER_NAMES={webm:'matroska'};

test('build stage is pinned by digest and the final stage is scratch with /ffmpeg', () => {
  assert.equal(stages.length,2);
  assert.match(stages[0],/^FROM alpine:3\.\d+@sha256:[a-f0-9]{64} AS build$/);
  assert.equal(stages[1].trim(),'FROM scratch');
  assert.match(dockerfile,/^COPY --from=build \/out\/ffmpeg \/ffmpeg$/m);
  assert.match(dockerfile,/^COPY --from=build \/out\/licenses\/ \/licenses\/$/m);
});

test('the ffmpeg source tarball is fetched from ffmpeg.org and checked against a pinned SHA256', () => {
  assert.match(dockerfile,/^ARG FFMPEG_VERSION=\d+\.\d+\.\d+$/m);
  assert.match(dockerfile,/^ARG FFMPEG_SHA256=[a-f0-9]{64}$/m);
  assert.match(dockerfile,/https:\/\/ffmpeg\.org\/releases\/ffmpeg-\$\{FFMPEG_VERSION\}\.tar\.xz/);
  assert.match(dockerfile,/sha256sum -c -/);
  assert.equal(workflow.match(/FFMPEG_VERSION: '([^']+)'/)?.[1],dockerfile.match(/^ARG FFMPEG_VERSION=(.+)$/m)[1]);
});

test('the build stays LGPL, static, minimal and ships its licence', () => {
  assert.doesNotMatch(dockerfile,/--enable-(gpl|nonfree|version3)\b/);
  for(const flag of ['--disable-everything','--disable-autodetect','--disable-network','--disable-programs','--enable-ffmpeg','--enable-static','--disable-shared','--extra-ldflags=-static'])assert.ok(dockerfile.includes(flag),flag);
  assert.match(dockerfile,/cp COPYING\.LGPLv2\.1 \/out\/licenses\//);
});

test('statically linked musl ships its licence from a hash-pinned release matching the installed package', () => {
  assert.match(dockerfile,/^ARG MUSL_SHA256=[a-f0-9]{64}$/m);
  assert.match(dockerfile,/https:\/\/musl\.libc\.org\/releases\/musl-\$\{MUSL_VERSION\}\.tar\.gz/);
  assert.match(dockerfile,/echo "\$\{MUSL_SHA256\}  musl\.tar\.gz" \| sha256sum -c -/);
  assert.match(dockerfile,/cp COPYRIGHT \/out\/licenses\/COPYRIGHT\.musl/);
  assert.match(dockerfile,/apk info -e -v musl \| grep -qx "musl-\$\{MUSL_VERSION\}-r/);
});

test('NOTICE records the source offer and the exact build toolchain', () => {
  assert.match(dockerfile,/Source offer: .*ffmpeg-\$\{FFMPEG_VERSION\}\.tar\.xz/);
  assert.match(dockerfile,/apk info -v \| sort/);
  assert.match(dockerfile,/gcc --version/);
  assert.match(dockerfile,/cat \/out\/licenses\/TOOLCHAIN; \} > \/out\/licenses\/NOTICE/);
});

test('only the pipe protocol is built, matching the runtime protocol whitelist', () => {
  assert.equal(argValue('-protocol_whitelist'),'pipe');
  assert.deepEqual(listFlag('protocol'),['pipe']);
});

test('every runtime format whitelist name has a demuxer and the output path is built', () => {
  const demuxers=listFlag('demuxer');
  for(const name of argValue('-format_whitelist').split(','))assert.ok(demuxers.includes(DEMUXER_NAMES[name]??name),`demuxer for ${name}`);
  assert.equal(argValue('-f'),'s16le');
  assert.deepEqual(listFlag('muxer'),['pcm_s16le']);
  assert.deepEqual(listFlag('encoder'),['pcm_s16le']);
  for(const decoder of ['aac','opus','vorbis','mp3float','pcm_s16le'])assert.ok(listFlag('decoder').includes(decoder),decoder);
  assert.ok(listFlag('filter').includes('aresample'));
});

test('the workflow proves the binary with the unchanged verifier on the pinned production Node image', () => {
  assert.match(workflow,/node:24\.16\.0-bookworm-slim@sha256:[a-f0-9]{64}/);
  assert.match(workflow,/--network none --user node/);
  assert.match(workflow,/node deployment\/verifyAudioDecoder\.mjs/);
  for(const uses of workflow.match(/uses: \S+/g))assert.match(uses,/@[a-f0-9]{40}$/,uses);
});

test('the workflow pushes by digest only and tags only after the verifier passes', () => {
  assert.match(workflow,/push-by-digest=true,name-canonical=true,push=true/);
  assert.doesNotMatch(workflow,/buildx build[^\n]*(--tag|-t )/);
  assert.doesNotMatch(workflow,/--push\b/);
  const verify=workflow.indexOf('node deployment/verifyAudioDecoder.mjs');
  const check=workflow.indexOf("r.status!=='passed'");
  const tag=workflow.indexOf('imagetools create --tag');
  assert.ok(verify>0 && check>verify && tag>check,'tag step follows verification');
  assert.equal(workflow.match(/imagetools create/g).length,1);
  assert.match(workflow,/AUDIO_DECODER_IMAGE=\$IMAGE/);
  assert.match(workflow,/echo "image=\$REPO@\$DIGEST"/);
});
