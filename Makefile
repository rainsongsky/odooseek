.PHONY: dev prod build up down clean

# ── Development ──────────────────────────────
dev:
	cd apps/oweb && bun run build
	cargo run -p odoo-web-server

dev-frontend:
	cd apps/oweb && bun dev

# ── Production ─────────────────────────────────
build:
	cd apps/oweb && bun run build
	cargo build --release -p odoo-web-server

up:
	docker compose -f docker/docker-compose.yml up -d

down:
	docker compose -f docker/docker-compose.yml down

prod: build
	docker compose -f docker/docker-compose.yml up -d --build server

# ── Maintenance ─────────────────────────────────
clean:
	cargo clean
	cd apps/oweb && rm -rf dist node_modules/.vite

test:
	cargo test --workspace
	cd apps/oweb && bun run test

check:
	cargo fmt --check --all
	cargo clippy --all-targets --no-deps
	cd apps/oweb && bun run lint
