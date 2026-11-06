# syntax=docker/dockerfile:1
# Build dari root repo: docker build -f apps/api/Dockerfile .

FROM rust:1.99-slim-bookworm AS build
WORKDIR /src
COPY Cargo.toml Cargo.lock rust-toolchain.toml ./
COPY apps/api apps/api
COPY crates crates
# Pakai toolchain bawaan image (versi sama dengan rust-toolchain.toml "stable" saat image dibuat).
ENV RUSTUP_TOOLCHAIN=1.99.1-x86_64-unknown-linux-gnu
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/src/target \
    cargo build --release --locked -p toolland-api \
 && cp target/release/toolland-api /toolland-api

# Debian slim (bukan distroless) karena API menjalankan Ghostscript sebagai proses.
# ca-certificates untuk HTTPS ke server RDAP (WHOIS).
# Tetap minimal: tanpa shell login, user non-root, root filesystem read-only di compose.
FROM debian:bookworm-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends ghostscript ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --uid 65532 --user-group --no-create-home --shell /usr/sbin/nologin nonroot
COPY --from=build /toolland-api /usr/local/bin/toolland-api
ENV TOOLLAND_TMP=/run/tools \
    TMPDIR=/run/tools
USER 65532:65532
EXPOSE 8082
ENTRYPOINT ["/usr/local/bin/toolland-api"]
