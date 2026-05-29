# AGENTS.md, LibriHub Implementation Guide

## 1. Project Context

LibriHub is a system for managing book listing, borrowing/exchange transactions, courier coordination, point ledger accounting, reviews, audit logs, and administration.

The implementation must follow the SAD document as the source of truth. The main stack is:

- Frontend: Next.js, TypeScript, Tailwind CSS
- Backend: FastAPI
- Database: PostgreSQL
- Object Storage: MinIO
- Authentication: JWT and role-based access control
- Deployment: Docker Compose

Primary actors:

- Guest: register and login only
- Member: manage profile, books, transactions, point ledger, reviews
- Courier: member with delivery capability
- Admin: global system administration, dispute handling, audit actions

Core business domains:

- User and role profiles
- Book and category catalog
- Transaction state machine
- Delivery state machine
- Point ledger accounting
- Review and trust system
- Activity log and admin audit trail

## 2. Non-Negotiable Business Rules

Codex must preserve these rules across all generated code.

### 2.1 Identity and Access Control

- Every actor must map to one `users` record.
- Extended roles are stored through profile tables: `member_profiles`, `courier_profiles`, `admin_profiles`.
- A user may hold multiple logical roles.
- Guests cannot search books, create transactions, view points, or access internal resources.
- Members can only modify their own profile, own books, and transactions they participate in.
- Couriers can only update deliveries assigned to them.
- Admin actions must be recorded in `admin_actions`.

### 2.2 Book Catalog

- A physical book has exactly one owner at a time.
- A book references one category through `category_id`.
- Cover images are not stored in PostgreSQL. Store the file in MinIO and persist only `cover_image_url` or object key.
- When a transaction is created, the book must move from `AVAILABLE` to `PENDING_TRANSACTION`.
- Concurrent transaction requests against the same book must be rejected.
- Do not physically delete books involved in transactions. Use soft state such as `REMOVED`.

### 2.3 Transaction State Machine

Allowed transaction statuses:

- `PENDING`
- `ACCEPTED`
- `DELIVERING`
- `COMPLETED`
- `CANCELLED`
- `REJECTED`

Rules:

- A transaction references exactly one book.
- `owner_id` and `requester_id` must be different.
- Only the owner can accept or reject a pending transaction.
- A transaction reaches `COMPLETED` only when all required confirmations are present.
- If `delivery_method = FREE_COURIER`, the delivery flow must complete before transaction completion.
- If a transaction is rejected or cancelled, release the book back to `AVAILABLE`, unless another valid final state applies.

### 2.4 Delivery State Machine

Allowed delivery statuses:

- `PENDING`
- `ASSIGNED`
- `PICKED_UP`
- `DELIVERED`
- `FAILED`
- `CANCELLED`

Rules:

- Create a delivery only when `delivery_method = FREE_COURIER`.
- A transaction can have at most one delivery in the current version.
- Only an available courier can accept a delivery.
- Once a courier accepts a delivery, mark courier status as `BUSY`.
- When delivery is completed or cancelled, update courier status accordingly.

### 2.5 Point Ledger

Point rules:

- New member initial bonus: `+20`
- Permanent exchange: owner `+10`, requester `-10`
- Borrow-return: owner `+5`, requester `-5`
- Successful delivery: courier `+2`

Integrity rules:

- Points are updated only after a transaction or delivery reaches a valid completed state.
- Every point change must create an append-only `transaction_point_ledger` record.
- `users.current_points` is a cached balance and must match ledger history.
- Admin point adjustment must create both a ledger entry and an `admin_actions` entry.
- Do not update `current_points` without a ledger record.

### 2.6 Review System

- Reviews are allowed only after transaction status is `COMPLETED`.
- A user cannot review themselves.
- Prevent duplicate review with unique constraint: `(transaction_id, reviewer_user_id, reviewee_user_id, review_type)`.
- Reviews should be soft-hidden by admin rather than physically deleted.

### 2.7 Audit and Soft Delete

- Important business events must create `activity_logs` records.
- Admin operations must create `admin_actions` records.
- Do not physically delete financial or audit entities: transactions, point ledger, reviews, activity logs, admin actions.

## 3. Recommended Repository Structure

```text
librihub/
  AGENTS.md
  README.md
  docker-compose.yml
  .env.example
  backend/
    pyproject.toml
    alembic.ini
    app/
      main.py
      core/
        config.py
        security.py
        permissions.py
      db/
        session.py
        base.py
      models/
      schemas/
      services/
      api/
        v1/
      modules/
        users/
        books/
        transactions/
        deliveries/
        points/
        reviews/
        admin/
  frontend/
    # Next.js app generated here
  docs/
    IMPLEMENTATION_PLAN.md
    API_CONTRACT.md
    DATABASE_NOTES.md
  infra/
    minio/
    postgres/
```

## 4. Backend Module Design

Implement backend by modules. Each module should contain router, service, schema, and related model logic.

### 4.1 `users`

Responsibilities:

- Register user
- Hash password
- Create user and member profile
- Add initial `+20` ledger entry
- Login and JWT token issuing
- Get current user profile
- Update member profile
- Register courier profile

Endpoints draft:

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `GET /api/v1/users/me`
- `PATCH /api/v1/users/me/profile`
- `POST /api/v1/users/me/courier-profile`

### 4.2 `books`

Responsibilities:

- CRUD for owned books
- Category management
- Search and filter available books
- Upload cover image via MinIO

Endpoints draft:

- `GET /api/v1/books`
- `POST /api/v1/books`
- `GET /api/v1/books/{book_id}`
- `PATCH /api/v1/books/{book_id}`
- `DELETE /api/v1/books/{book_id}` as soft delete
- `GET /api/v1/categories`
- `POST /api/v1/admin/categories`

### 4.3 `transactions`

Responsibilities:

- Create transaction request
- Lock book on valid request
- Owner accept or reject
- Confirm transaction completion
- Trigger point settlement after full confirmation

Endpoints draft:

- `POST /api/v1/transactions`
- `GET /api/v1/transactions/me`
- `POST /api/v1/transactions/{transaction_id}/accept`
- `POST /api/v1/transactions/{transaction_id}/reject`
- `POST /api/v1/transactions/{transaction_id}/confirm`
- `POST /api/v1/transactions/{transaction_id}/cancel`

### 4.4 `deliveries`

Responsibilities:

- Create delivery when free courier method is selected
- List available delivery tasks
- Courier accepts task
- Courier updates status
- Send delivery result back to transaction service

Endpoints draft:

- `GET /api/v1/deliveries/available`
- `POST /api/v1/deliveries/{delivery_id}/accept`
- `POST /api/v1/deliveries/{delivery_id}/pickup`
- `POST /api/v1/deliveries/{delivery_id}/delivered`
- `POST /api/v1/deliveries/{delivery_id}/failed`

### 4.5 `points`

Responsibilities:

- Read current point balance
- Read ledger history
- Internal settlement service for transaction and delivery flows
- Admin point adjustment with audit trail

Endpoints draft:

- `GET /api/v1/points/me`
- `GET /api/v1/points/me/ledger`
- `POST /api/v1/admin/users/{user_id}/point-adjustments`

### 4.6 `reviews`

Responsibilities:

- Create review after completed transaction
- Validate reviewer and reviewee
- Prevent self-review and duplicate review
- Admin hide review

Endpoints draft:

- `POST /api/v1/reviews`
- `GET /api/v1/users/{user_id}/reviews`
- `POST /api/v1/admin/reviews/{review_id}/hide`

### 4.7 `admin`

Responsibilities:

- Manage users
- Lock or unlock accounts
- Hide or restore books
- Cancel problematic transactions
- View audit logs

Endpoints draft:

- `GET /api/v1/admin/users`
- `POST /api/v1/admin/users/{user_id}/lock`
- `POST /api/v1/admin/users/{user_id}/unlock`
- `POST /api/v1/admin/books/{book_id}/hide`
- `POST /api/v1/admin/transactions/{transaction_id}/cancel`
- `GET /api/v1/admin/activity-logs`
- `GET /api/v1/admin/admin-actions`

## 5. Database Implementation Order

Stage 1, foundation tables:

- `users`
- `member_profiles`
- `courier_profiles`
- `admin_profiles`
- `categories`
- `books`

Stage 2, transaction tables:

- `transactions`
- `deliveries`

Stage 3, trust and audit tables:

- `transaction_point_ledger`
- `reviews`
- `activity_logs`
- `admin_actions`

Stage 4, indexes and constraints:

- Unique index on user email and phone
- Unique index on category name
- Index on `books.title`, `books.category_id`, `books.owner_id`, `books.book_status`
- Index on `transactions.owner_id`, `transactions.requester_id`, `transactions.transaction_status`
- Unique review constraint: `(transaction_id, reviewer_user_id, reviewee_user_id, review_type)`

## 6. Frontend Implementation Order

Stage 1, app shell:

- Routing layout
- Authentication pages
- Role-aware navigation
- API client wrapper

Stage 2, member flow:

- Book catalog page
- Book detail page
- Create or update book form
- My books page
- Transaction request flow

Stage 3, transaction flow:

- My requests
- Incoming requests
- Accept or reject flow
- Confirmation flow
- Point ledger page

Stage 4, courier flow:

- Courier registration page
- Available delivery tasks page
- My delivery tasks page
- Delivery status update UI

Stage 5, admin flow:

- User management
- Book moderation
- Transaction dispute handling
- Point adjustment
- Audit log viewer

## 7. Coding Standards

Backend:

- Use Python type hints everywhere.
- Keep routers thin. Business logic belongs in services.
- Use SQLAlchemy models and Alembic migrations.
- Use Pydantic schemas for request and response contracts.
- Wrap multi-table state transitions in database transactions.
- Never settle points outside the point ledger service.
- Add tests for every state transition.

Frontend:

- Use TypeScript strict mode.
- Keep API types aligned with backend schemas.
- Use server actions or API client functions consistently.
- Components should be role-aware but not permission-authoritative. Backend remains the source of truth.
- Display transaction and delivery states with clear labels.

Testing:

- Unit test service logic.
- Integration test API endpoints.
- Prioritize transaction, delivery, point settlement, and permission tests.
- Include negative tests for unauthorized access and invalid state transitions.

## 8. Codex Working Protocol

When generating code, Codex must follow this protocol:

1. Read `AGENTS.md` first.
2. Check existing files before creating new ones.
3. Implement one stage at a time.
4. Prefer small, reviewable commits.
5. Do not invent business rules that conflict with the SAD document.
6. When unsure, add a TODO comment and ask for clarification.
7. After each stage, update `docs/IMPLEMENTATION_PLAN.md` with completed tasks and next actions.
8. Never hard-code secrets. Use environment variables.
9. Never bypass backend permission checks because frontend already hides a button.
10. Do not delete financial or audit records physically.

## 9. Initial Milestones for Codex

### Milestone 0, Repo Bootstrap

Output:

- Root repo structure
- `README.md`
- `.env.example`
- `docker-compose.yml`
- Empty backend and frontend folders
- `docs/IMPLEMENTATION_PLAN.md`

### Milestone 1, Backend Skeleton

Output:

- FastAPI app booting at `/health`
- Settings loader
- Database connection setup
- SQLAlchemy base
- Alembic initialized
- Auth utilities placeholder

### Milestone 2, Database Schema

Output:

- SQLAlchemy models for all SAD entities
- Alembic migration
- Seed categories
- Database constraints and indexes

### Milestone 3, Auth and User Module

Output:

- Register
- Login
- JWT auth dependency
- Current user endpoint
- Member profile creation
- Initial point ledger record

### Milestone 4, Book Module

Output:

- Category read
- Book create, update, soft delete
- Book search and detail
- MinIO upload integration

### Milestone 5, Transaction and Point Settlement

Output:

- Create request
- Accept or reject
- Confirm completion
- Atomic point settlement
- Book state update

### Milestone 6, Delivery Module

Output:

- Delivery creation
- Courier assignment
- Pickup, delivered, failed state transitions
- Courier reward settlement

### Milestone 7, Review and Admin Module

Output:

- Review after completed transaction
- Admin user lock or unlock
- Book hide or restore
- Point adjustment with audit log
- Audit log viewer

### Milestone 8, Frontend MVP

Output:

- Login and register pages
- Book catalog
- Book detail
- Create book
- Transaction screens
- Point ledger screen
- Basic courier and admin screens

## 10. First Prompt to Codex

Use this prompt after placing `AGENTS.md` at the repo root:

```text
Read AGENTS.md and the LibriHub SAD document if available. Start with Milestone 0 and Milestone 1 only.

Create the repository skeleton for a monorepo with FastAPI backend, Next.js frontend, PostgreSQL, MinIO, and Docker Compose.

Deliver:
1. Root README.md with setup instructions.
2. docker-compose.yml for postgres, minio, backend, and frontend placeholders.
3. .env.example with all required variables.
4. backend FastAPI skeleton with /health endpoint.
5. docs/IMPLEMENTATION_PLAN.md with milestones copied from AGENTS.md and a checklist.

Do not implement business modules yet. Keep the first commit small and runnable.
```
