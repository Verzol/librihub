# LibriHub Implementation Plan

This plan tracks progress against `AGENTS.md`. Table names and baseline schema remain governed by the ERD naming contract.

## Milestone Checklist

- [x] Milestone 0, Repo Bootstrap
  - [x] Root repo structure
  - [x] `README.md`
  - [x] `.env.example`
  - [x] `docker-compose.yml`
  - [x] Backend and frontend folders
  - [x] Implementation plan document
- [x] Milestone 1, Backend Skeleton
  - [x] FastAPI app booting at `/health`
  - [x] Settings loader
  - [x] Database connection setup
  - [x] SQLAlchemy base
  - [x] Alembic initialized
  - [x] Auth utilities placeholder
- [x] Milestone 2, Database Schema
  - [x] SQLAlchemy models for ERD entities
  - [x] Exact uppercase ERD `__tablename__` values
  - [x] Alembic migration chain
  - [x] Seed categories
  - [x] Database constraints and indexes
  - [ ] `docs/DATABASE_SCHEMA.md`
- [x] Milestone 3, Auth and User Module
  - [x] Register
  - [x] Login
  - [x] JWT auth dependency
  - [x] Current user endpoint
  - [x] Member profile creation
  - [x] Initial point ledger record
- [x] Milestone 4, Book Module
  - [x] Category read
  - [x] Book create, update, soft delete
  - [x] Book search and detail
  - [x] MinIO upload integration
- [x] Milestone 5, Transaction and Point Settlement
  - [x] Create request
  - [x] Accept or reject
  - [x] Confirm completion
  - [x] Atomic point settlement
  - [x] Book state update
- [x] Milestone 6, Delivery Module
  - [x] Delivery creation
  - [x] Courier assignment
  - [x] Pickup, delivered, failed state transitions
  - [x] Courier reward settlement
- [x] Milestone 7, Review and Admin Module
  - [x] Review after completed transaction
  - [x] Admin user lock or unlock
  - [x] Book hide or restore
  - [x] Point adjustment with audit log
  - [x] Audit log viewer
- [ ] Milestone 8, Frontend MVP
  - [x] Login and register pages
  - [x] Book catalog
  - [x] Book detail
  - [x] Create book
  - [ ] Transaction screens
  - [ ] Point ledger screen
  - [ ] Basic courier and admin screens

## Current Backend Status

- Alembic migration chain includes ERD schema, borrow-return/courier extensions, book descriptions, delivery coordinates, extra category seeds, and removal of the database-level nonnegative check on `USER.current_points`.
- Point balance changes remain centralized in the point ledger service.
- Financial and audit entities remain append-only/soft-state according to `AGENTS.md`.
- Admin utility endpoints now cover read-only books and transactions, dashboard metrics, user search/filter, paginated logs, and category soft administration.
- System readiness endpoints expose database and object-storage health checks.

## Next Actions

- Add `docs/DATABASE_SCHEMA.md` documenting the implemented schema and approved extensions beyond the baseline ERD.
- Verify the full backend test suite after local test dependencies are installed.
- Continue frontend MVP screens for transaction, point ledger, courier, and admin flows.
