# LibriHub

LibriHub is a monorepo for a book listing, borrowing/exchange, courier coordination, point ledger, review, audit, and administration system.

The implementation follows `AGENTS.md` and the SAD document in `docs/LibriHub_SAD.pdf` as the source of truth.

## Stack

- Frontend: Next.js, TypeScript, Tailwind CSS
- Backend: FastAPI, SQLAlchemy, Alembic
- Database: PostgreSQL
- Object storage: MinIO
- Deployment: Docker Compose

## Repository Layout

```text
backend/   FastAPI application and Alembic setup
frontend/  Next.js placeholder application
docs/      SAD and implementation documentation
infra/     Infrastructure notes and future service config
```

## Team Workflow

After the foundation milestones, LibriHub is built as vertical slices: backend, tests, frontend, manual verification, and docs for one module before moving to the next. See `docs/WORKFLOW.md`.

## Quick Start

1. Copy environment defaults:

   ```powershell
   Copy-Item .env.example .env
   ```

2. Start the stack:

   ```powershell
   docker compose up --build
   ```

3. Open the services:

   - Backend health: http://localhost:8000/health
   - API docs: http://localhost:8000/docs
   - Frontend: http://localhost:3000
   - MinIO console: http://localhost:9001

## Local Backend Development

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

The backend reads configuration from environment variables. See `.env.example` for the current list.

## Bootstrap Admin

Admin screens and courier approval require an active `ADMIN_PROFILE`. After migrations are applied, create the first local admin from inside the backend container:

```powershell
docker compose exec backend python -m app.cli.bootstrap_admin
```

By default this uses `admin@librihub.local` and generates a one-time password. Set `LIBRIHUB_ADMIN_PASSWORD` in `.env` or pass `--password` if you want a fixed local development password.

## Current Scope

Completed:

- Repo bootstrap
- FastAPI skeleton with `/health`
- SQLAlchemy and Alembic setup
- ERD-aligned PostgreSQL schema
- Auth/User backend slice
- Auth/User frontend slice

Next planned slice:

- Book backend
