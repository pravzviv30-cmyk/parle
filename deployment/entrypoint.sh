#!/bin/sh
set -eu
if [ "${NODE_ENV:-}" != "production" ] || [ "${LUVANI_LOCAL_DEVELOPMENT:-0}" = "1" ] || [ "${LUVANI_NATIVE_EVAL:-0}" = "1" ] || [ "${LUVANI_DEV_UNLIMITED_MINUTES:-0}" = "1" ]; then
  echo 'Production image refuses development/evaluation shortcuts.' >&2
  exit 1
fi
if [ "$(node -p 'process.versions.node')" != '24.16.0' ]; then
  echo 'Production runtime patch differs from reviewed artifact.' >&2
  exit 1
fi
if [ "$#" -ne 1 ]; then
  echo 'Expected exactly one known backend role.' >&2
  exit 1
fi
node /app/deployment/validateEnvironment.mjs "$1"
node /app/deployment/verifyAudioDecoder.mjs
case "$1" in
  api) exec node --experimental-strip-types /app/services/token-server/src/server.ts ;;
  tutor) exec node --experimental-strip-types /app/services/tutor-agent/src/agent.ts start ;;
  practice) exec node --experimental-strip-types /app/services/token-server/src/practiceWorker.ts ;;
  observability) exec node --experimental-strip-types /app/deployment/observability.mjs "$LUVANI_OBSERVABILITY_CONFIG" ;;
  maintenance) exec node --experimental-strip-types /app/services/token-server/src/maintenanceWorker.ts ;;
  *) echo 'Unknown backend role.' >&2; exit 1 ;;
esac
