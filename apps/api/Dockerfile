# syntax=docker/dockerfile:1
# Build dari root repo: docker build -f apps/api/Dockerfile .

FROM rust:1.99-slim-bookworm AS build
WORKDIR /src
COPY Cargo.toml Cargo.lock rust-toolchain.toml ./
COPY apps/api apps/api
COPY crates crates
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/src/target \
    cargo build --release --locked -p toolland-api \
 && cp target/release/toolland-api /toolland-api

# distroless: tanpa shell dan package manager, berjalan sebagai user non-root.
FROM gcr.io/distroless/cc-debian12:nonroot
COPY --from=build /toolland-api /usr/local/bin/toolland-api
USER nonroot:nonroot
EXPOSE 8082
ENTRYPOINT ["/usr/local/bin/toolland-api"]
