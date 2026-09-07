# Developer helpers for the Monolito Lab.
# Requires the stack to be running: `docker compose up --build`.

COMPOSE ?= docker compose
DB_USER ?= postgres
DB_NAME ?= monolith

.PHONY: help up down seed test logs

help:
	@echo "make up     - build and start the stack"
	@echo "make down   - stop the stack (keeps data)"
	@echo "make seed   - DEV-ONLY: wipe + insert 100 users and 1000 sales"
	@echo "make test   - run the backend test suite"
	@echo "make logs   - follow all container logs"

up:
	$(COMPOSE) up --build

down:
	$(COMPOSE) down

# DEV-ONLY. Runs database/seed.sql directly in the postgres container.
# This DELETES existing users/sales before inserting the seed data.
seed:
	$(COMPOSE) exec -T postgres psql -U $(DB_USER) -d $(DB_NAME) < database/seed.sql

test:
	$(COMPOSE) exec backend pytest

logs:
	$(COMPOSE) logs -f
