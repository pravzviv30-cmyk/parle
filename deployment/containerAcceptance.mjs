/** Offline integrity of actual image captures. Authenticity needs protected independent review. */
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)&&!/^([a-f0-9])\1{63}$/.test(v);
const fail=reason=>{throw new Error(`container-capture-refused:${reason}`);};
const digest=image=>image.split('@sha256:')[1];
function subject(attestation,image){
 if(!attestation||!Array.isArray(attestation.subject)||!attestation.subject.some(s=>s.digest?.sha256===digest(image)))fail('image-subject');
}
export function validateContainerCaptures(candidate,{receipt,provenance,sbom,native,decoder,runtime}){
 const image=candidate.image,base=candidate.baseImage,expected=candidate.audioDecoder,gate=candidate.acceptance.containerArtifact;
 if(receipt?.version!==1||receipt.gitSha!==candidate.gitSha||receipt.platform!==gate.platform||receipt.nodeImage!==base||receipt.audioDecoderImage!==expected.image||receipt.audioDecoderSha256!==expected.sha256||!hash(receipt.ociArchiveSha256)||receipt.buildMetadata?.['containerimage.digest']!==`sha256:${digest(image)}`)fail('build-receipt');
 subject(provenance,image);subject(sbom,image);
 if(runtime?.version!==1||runtime.image!==image||runtime.gitSha!==candidate.gitSha||runtime.platform!==gate.platform||runtime.revision!==candidate.gitSha||runtime.baseImage!==base||runtime.audioDecoder?.image!==expected.image||runtime.audioDecoder?.sha256!==expected.sha256||!runtime.inspectedRepoDigests?.includes(image)||!/^sha256:[a-f0-9]{64}$/.test(runtime.imageId??'')||runtime.nativeSha256!==gate.nativeArtifactsSha256||runtime.decoderSha256!==gate.decoderCaptureSha256||JSON.stringify(runtime.native)!==JSON.stringify(native)||JSON.stringify(runtime.decoder)!==JSON.stringify(decoder))fail('candidate-runtime-binding');
 if(!hash(runtime.sileroSha256)||runtime.silero?.sileroOfflineLoad!=='passed')fail('silero-offline-load');
 const p=provenance.predicate,materials=p?.materials??p?.buildDefinition?.resolvedDependencies;
 if(!String(provenance.predicateType).startsWith('https://slsa.dev/provenance/')||!Array.isArray(materials)||!materials.some(m=>m.digest?.sha1===candidate.gitSha||m.digest?.gitCommit===candidate.gitSha)||![base,expected.image].every(ref=>materials.some(m=>m.digest?.sha256===digest(ref))))fail('source-and-build-materials');
 const s=sbom.predicate;
 if(!s||!((s.spdxVersion&&Array.isArray(s.packages)&&s.packages.length>0)||(s.bomFormat==='CycloneDX'&&Array.isArray(s.components)&&s.components.length>0)))fail('actual-sbom');
 const architecture=gate.platform==='linux/amd64'?'x64':'arm64';
 if(native?.version!==1||native.nodeVersion!==candidate.nodeVersion||native.platform!=='linux'||native.architecture!==architecture||!Array.isArray(native.artifacts)||native.artifacts.length<1||!native.artifacts.some(a=>a.path?.endsWith('.node'))||native.artifacts.some(a=>typeof a.path!=='string'||a.path.startsWith('/')||a.path.split('/').includes('..')||!Number.isSafeInteger(a.bytes)||a.bytes<1||!hash(a.sha256)))fail('native-inventory');
 if(native.decoder?.path!=='/usr/local/bin/luvani-ffmpeg'||native.decoder.sha256!==expected.sha256||!Number.isSafeInteger(native.decoder.bytes)||native.decoder.bytes<1)fail('native-decoder');
 if(decoder?.version!==1||decoder.status!=='passed'||decoder.platform!=='linux'||decoder.architecture!==architecture||decoder.decoderSha256!==expected.sha256||!hash(decoder.versionOutputSha256)||decoder.syntheticMillis!==1000||JSON.stringify(decoder.compressedFixtures)!==JSON.stringify(['fragmentedM4a','webm'])||decoder.over30SecondsRefused!==true||decoder.paidCalls!==0)fail('decoder-runtime');
 return {integrityValidated:true,authenticityIndependentlyVerified:false};
}
