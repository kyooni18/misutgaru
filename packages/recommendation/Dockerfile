FROM rust:1.96-bookworm AS builder

WORKDIR /src
COPY Cargo.toml ./Cargo.toml
COPY src ./src
RUN cargo build --release

FROM debian:bookworm-slim

RUN apt-get update \
	&& apt-get install -y --no-install-recommends ca-certificates curl \
	&& rm -rf /var/lib/apt/lists/* \
	&& useradd --system --uid 10001 --create-home recommendation \
	&& mkdir -p /data \
	&& chown recommendation:recommendation /data

COPY --from=builder /src/target/release/misutgaru-recommendation /usr/local/bin/misutgaru-recommendation

USER recommendation
EXPOSE 3080
VOLUME ["/data"]

ENTRYPOINT ["/usr/local/bin/misutgaru-recommendation"]

