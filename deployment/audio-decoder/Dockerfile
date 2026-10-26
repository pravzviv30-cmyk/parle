# syntax=docker/dockerfile:1
# Decode-only, LGPL, static ffmpeg for services/shared/audioDecode.ts (F805).
# Output layout matches the main Dockerfile: a dependency-free executable at /ffmpeg.
# Every input is pinned: Alpine by index digest, ffmpeg by release tarball SHA256.
# Built and verified only by .github/workflows/audio-decoder.yml.

# alpine:3.21 OCI index, resolved from registry-1.docker.io on 2026-10-26.
FROM alpine:3.21@sha256:ee16d92f96db08d9d2d07da48555a27f3a69d8f0759021dbc601195ed0d2b5bd AS build
ARG FFMPEG_VERSION=7.1.5
ARG FFMPEG_SHA256=de668509caf9e35e3cd162473441fdb29538c6d96ed080292b3cf9e6fc5d558f
# musl is statically linked into the binary, so its MIT COPYRIGHT ships beside FFmpeg's licence.
# Alpine's musl packages carry no licence file; take it from the matching hash-pinned release.
ARG MUSL_VERSION=1.2.5
ARG MUSL_SHA256=a9a118bbe84d8764da0ea0d28b3ab3fae8477fc7e4085d90102b8596fc7c75e4
RUN apk add --no-cache build-base pkgconf curl xz tar \
 && mkdir -p /out/licenses \
 && { echo "Build toolchain (alpine:3.21 digest above):"; apk info -v | sort; gcc --version | head -1; \
      echo "musl: $(apk info -e -v musl)"; } > /out/licenses/TOOLCHAIN \
 && apk info -e -v musl | grep -qx "musl-${MUSL_VERSION}-r[0-9]*"
WORKDIR /musl
RUN curl -fsSLo musl.tar.gz "https://musl.libc.org/releases/musl-${MUSL_VERSION}.tar.gz" \
 && echo "${MUSL_SHA256}  musl.tar.gz" | sha256sum -c - \
 && tar -xzf musl.tar.gz --strip-components=1 "musl-${MUSL_VERSION}/COPYRIGHT" \
 && cp COPYRIGHT /out/licenses/COPYRIGHT.musl \
 && rm -rf /musl/*
WORKDIR /src
RUN curl -fsSLo ffmpeg.tar.xz "https://ffmpeg.org/releases/ffmpeg-${FFMPEG_VERSION}.tar.xz" \
 && echo "${FFMPEG_SHA256}  ffmpeg.tar.xz" | sha256sum -c - \
 && tar -xJf ffmpeg.tar.xz --strip-components=1 \
 && rm ffmpeg.tar.xz
# Demuxers cover every -format_whitelist name (webm is the matroska demuxer, "matroska,webm").
# The ffmpeg program itself selects aformat/anull/atrim; abuffer/abuffersink are always built.
# -f s16le is the pcm_s16le muxer, which needs the pcm_s16le encoder.
RUN ./configure \
      --disable-everything --disable-autodetect --disable-network --disable-doc --disable-debug \
      --disable-programs --enable-ffmpeg \
      --enable-static --disable-shared --enable-small --disable-x86asm \
      --disable-avdevice --enable-swresample \
      --enable-protocol=pipe \
      --enable-demuxer=wav,mov,matroska,ogg,mp3 \
      --enable-decoder=aac,opus,vorbis,mp3,mp3float,pcm_s16le,pcm_s24le,pcm_s32le,pcm_f32le,pcm_u8 \
      --enable-parser=aac,opus,vorbis,mpegaudio \
      --enable-encoder=pcm_s16le \
      --enable-muxer=pcm_s16le \
      --enable-filter=aresample,aformat,anull,atrim \
      --extra-ldflags=-static --pkg-config-flags=--static \
 && make -j"$(nproc)" ffmpeg \
 && strip ffmpeg \
 && ! readelf -l ffmpeg | grep -q 'INTERP' \
 && ! readelf -d ffmpeg | grep -q 'NEEDED' \
 && test "$(stat -c %s ffmpeg)" -le 134217728 \
 && ./ffmpeg -version | head -1 | grep -q '^ffmpeg version ' \
 && install -m 0755 ffmpeg /out/ffmpeg \
 && cp COPYING.LGPLv2.1 /out/licenses/COPYING.LGPLv2.1 \
 && { echo "FFmpeg ${FFMPEG_VERSION}, LGPL-2.1-or-later, decode-only static build for Luvani."; \
      echo "Source offer: the complete corresponding FFmpeg source is https://ffmpeg.org/releases/ffmpeg-${FFMPEG_VERSION}.tar.xz"; \
      echo "Source SHA256: ${FFMPEG_SHA256}"; \
      echo "Statically linked: musl ${MUSL_VERSION} (MIT, see COPYRIGHT.musl), https://musl.libc.org/releases/musl-${MUSL_VERSION}.tar.gz sha256 ${MUSL_SHA256}"; \
      echo "Build recipe: deployment/audio-decoder/Dockerfile in the Luvani repository."; \
      echo "Configuration:"; ./ffmpeg -hide_banner -buildconf; cat /out/licenses/TOOLCHAIN; } > /out/licenses/NOTICE \
 && rm /out/licenses/TOOLCHAIN

FROM scratch
COPY --from=build /out/ffmpeg /ffmpeg
COPY --from=build /out/licenses/ /licenses/
ENTRYPOINT ["/ffmpeg"]
