# NODE_IMAGE must include the reviewed official Node patch tag AND digest.
# Resolve the real digest outside this file; an unpinned default is forbidden.
ARG NODE_IMAGE
ARG AUDIO_DECODER_IMAGE
FROM ${AUDIO_DECODER_IMAGE} AS audio-decoder

FROM ${NODE_IMAGE} AS dependencies
ARG NODE_IMAGE
ARG AUDIO_DECODER_IMAGE
ARG AUDIO_DECODER_SHA256
# Revision: Railway injects RAILWAY_GIT_COMMIT_SHA into builds; the release
# workflow passes GIT_SHA. Railway's SHA wins when present.
ARG GIT_SHA
ARG RAILWAY_GIT_COMMIT_SHA
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json ./packages/core/package.json
COPY packages/brain/package.json ./packages/brain/package.json
COPY services/token-server/package.json ./services/token-server/package.json
COPY services/tutor-agent/package.json ./services/tutor-agent/package.json
COPY services/brain-playground/package.json ./services/brain-playground/package.json
COPY apps/mobile/package.json ./apps/mobile/package.json
COPY scripts/installHooks.mjs scripts/patchExpoModulesJsi.mjs ./scripts/
COPY deployment/validateBuild.mjs ./deployment/validateBuild.mjs
RUN GIT_SHA="${RAILWAY_GIT_COMMIT_SHA:-$GIT_SHA}" node deployment/validateBuild.mjs
# The lock fixes npm archives. onnxruntime-node's CPU runtime ships in its npm archive;
# its postinstall only downloads CUDA/TensorRT providers from NuGet that a GPU-less host
# cannot use (and that timed out on Railway, F887), so it is skipped.
# nativeArtifacts.mjs still records the native artifacts in image provenance.
RUN LUVANI_SKIP_HOOKS=1 ONNXRUNTIME_NODE_INSTALL=skip npm ci --omit=dev --workspace=@luvani/token-server --workspace=@luvani/tutor-agent --include-workspace-root=false
RUN mkdir -p services/token-server/node_modules services/tutor-agent/node_modules packages/brain/node_modules packages/core/node_modules
COPY deployment/nativeArtifacts.mjs ./deployment/nativeArtifacts.mjs
RUN node deployment/nativeArtifacts.mjs --verify --output /app/native-artifacts.json

FROM ${NODE_IMAGE} AS runtime
ARG AUDIO_DECODER_SHA256
ARG AUDIO_DECODER_IMAGE
ARG NODE_IMAGE
ARG GIT_SHA
ARG RAILWAY_GIT_COMMIT_SHA
LABEL org.opencontainers.image.title="Luvani backend" \
      org.opencontainers.image.revision="${RAILWAY_GIT_COMMIT_SHA:-${GIT_SHA}}" \
      org.opencontainers.image.base.name="${NODE_IMAGE}" \
      io.luvani.audio-decoder.image="${AUDIO_DECODER_IMAGE}" \
      io.luvani.audio-decoder.sha256="${AUDIO_DECODER_SHA256}"
ENV NODE_ENV=production \
    LUVANI_AUDIO_DECODER_PATH=/usr/local/bin/luvani-ffmpeg \
    LUVANI_AUDIO_DECODER_SHA256=${AUDIO_DECODER_SHA256} \
    PORT=8787 \
    TTS_CACHE_DIR=/tmp/luvani-authored-cache \
    LUVANI_LOCAL_DEVELOPMENT=0 \
    LUVANI_NATIVE_EVAL=0 \
    LUVANI_DEV_UNLIMITED_MINUTES=0
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/services/token-server/node_modules ./services/token-server/node_modules
COPY --from=dependencies /app/services/tutor-agent/node_modules ./services/tutor-agent/node_modules
COPY --from=dependencies /app/packages/brain/node_modules ./packages/brain/node_modules
COPY --from=dependencies /app/packages/core/node_modules ./packages/core/node_modules
# The reviewed static decoder image exposes its dependency-free binary at /ffmpeg.
COPY --from=audio-decoder /ffmpeg /usr/local/bin/luvani-ffmpeg
# LGPL notice, source URL and build configuration travel with the binary.
COPY --from=audio-decoder /licenses/ /usr/share/licenses/luvani-ffmpeg/
COPY package.json package-lock.json ./
COPY packages/core ./packages/core
COPY packages/brain ./packages/brain
COPY services/shared ./services/shared
COPY services/token-server/package.json ./services/token-server/package.json
COPY services/token-server/src ./services/token-server/src
COPY services/tutor-agent/package.json ./services/tutor-agent/package.json
COPY services/tutor-agent/src ./services/tutor-agent/src
COPY deployment/entrypoint.sh deployment/nativeArtifacts.mjs deployment/validateEnvironment.mjs deployment/environment-contract.json deployment/verifyAudioDecoder.mjs deployment/observability.mjs ./deployment/
RUN chmod 0755 /usr/local/bin/luvani-ffmpeg && node deployment/verifyAudioDecoder.mjs && node deployment/nativeArtifacts.mjs --verify --output /app/native-artifacts.json
# Image files remain root-owned; the runtime can only write bounded mounts.
USER node
# Repeat the checks as the runtime user on the final filesystem.
# Railway's builder refuses the RUN network flag, so the network-isolated proof of the
# same checks runs in deployment/captureContainerRuntime.mjs (DEPLOY-004).
RUN node deployment/verifyAudioDecoder.mjs \
    && node deployment/nativeArtifacts.mjs --verify \
    && cd services/tutor-agent \
    && node --input-type=module -e "import { VAD } from '@livekit/agents-plugin-silero'; await VAD.load(); console.log('Nonroot Silero model load passed');"
EXPOSE 8787
STOPSIGNAL SIGTERM
ENTRYPOINT ["/bin/sh", "/app/deployment/entrypoint.sh"]
CMD ["api"]
