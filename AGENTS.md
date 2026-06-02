# AGENTS.md, LibriHub Implementation Guide

## 1. Project Context

LibriHub is a system for managing book listing, borrowing/exchange transactions, courier coordination, point ledger accounting, reviews, activity logs, admin audit logs, and role-based administration.

The implementation must follow the LibriHub SAD document and the ERD as the source of truth. The table names in the database must match the ERD exactly.

Recommended stack:

- Frontend: Next.js, TypeScript, Tailwind CSS
- Backend: FastAPI
- Database: PostgreSQL
- Object Storage: MinIO
- Authentication: JWT and role-based access control
- Deployment: Docker Compose

Primary actors:

- Guest: register and login only
- Member: manage profile, books, transactions, point ledger, reviews
- Courier: a member with delivery capability
- Admin: global system administration, dispute handling, audit actions

Core business domains:

- User and role profiles
- Book and category catalog
- Transaction state machine
- Delivery state machine
- Point ledger accounting
- Review and trust system
- Activity log and admin audit trail

## 2. ERD Table Naming Contract

Use these physical table names exactly. Do not pluralize, rename, or convert them to lowercase in database migrations.

| ERD table name | Purpose |
|---|---|
| `USER` | Core identity, authentication, global role flag, current point balance |
| `MEMBER_PROFILE` | Member-specific profile linked one-to-one with `USER` |
| `COURIER_PROFILE` | Courier-specific profile linked one-to-one with `USER` |
| `ADMIN_PROFILE` | Admin-specific profile linked one-to-one with `USER` |
| `BOOK` | Book resource metadata and ownership |
| `CATEGORY` | Book category dictionary |
| `TRANSACTION` | Book borrowing/exchange transaction lifecycle |
| `DELIVERY` | Courier delivery lifecycle linked to a transaction |
| `TRANSACTION_POINT_LEDGER` | Append-only point accounting ledger |
| `REVIEW` | Post-transaction review and trust record |
| `ACTIVITY_LOG` | User/system activity log |
| `ADMIN_ACTION` | Admin intervention audit trail |

Implementation notes:

- Python module names may remain lowercase, for example `users`, `books`, `transactions`.
- SQLAlchemy model classes should be singular PascalCase, for example `User`, `Book`, `TransactionPointLedger`.
- SQLAlchemy `__tablename__` must use the exact ERD table name, for example `__tablename__ = "USER"`.
- If quoting becomes necessary because `USER` or `TRANSACTION` may conflict with SQL keywords or conventions, keep the physical table name exactly quoted as `"USER"` and `"TRANSACTION"` in generated SQL.
- API paths may remain lowercase REST style, for example `/api/v1/books`, `/api/v1/transactions`.

## 3. ERD Column Naming Contract

Use the following columns as the baseline schema. Do not rename columns unless the user explicitly approves a schema revision.

### 3.1 `USER`

- `user_id` int PK
- `full_name` string
- `email` string unique
- `phone` string unique
- `password_hash` string
- `role` string
- `current_points` int
- `account_status` string
- `created_at` datetime
- `updated_at` datetime

### 3.2 `MEMBER_PROFILE`

- `member_id` int PK
- `user_id` int FK, unique, references `USER.user_id`
- `student_code` string unique
- `address` string
- `membership_status` string
- `registered_at` datetime

### 3.3 `COURIER_PROFILE`

- `courier_id` int PK
- `user_id` int FK, unique, references `USER.user_id`
- `delivery_area` string
- `courier_status` string
- `successful_delivery_count` int
- `registered_at` datetime

### 3.4 `ADMIN_PROFILE`

- `admin_id` int PK
- `user_id` int FK, unique, references `USER.user_id`
- `admin_level` string
- `admin_status` string
- `assigned_at` datetime

### 3.5 `BOOK`

- `book_id` int PK
- `owner_id` int FK, references `USER.user_id`
- `category_id` int FK, references `CATEGORY.category_id`
- `title` string
- `author` string
- `publication_year` int
- `book_condition` string
- `exchange_mode` string
- `book_status` string
- `created_at` datetime
- `updated_at` datetime
- `cover_image_url` string

### 3.6 `CATEGORY`

- `category_id` int PK
- `category_name` string unique
- `category_description` string
- `is_active` bool
- `created_at` datetime
- `updated_at` datetime

### 3.7 `TRANSACTION`

- `transaction_id` int PK
- `book_id` int FK, references `BOOK.book_id`
- `owner_id` int FK, references `USER.user_id`
- `requester_id` int FK, references `USER.user_id`
- `transaction_type` string
- `delivery_method` string
- `transaction_status` string
- `owner_confirmed` boolean
- `requester_confirmed` boolean
- `courier_confirmed` boolean
- `requested_at` datetime
- `completed_at` datetime nullable

### 3.8 `DELIVERY`

- `delivery_id` int PK
- `transaction_id` int FK, unique, references `TRANSACTION.transaction_id`
- `courier_id` int FK, references `COURIER_PROFILE.courier_id`
- `pickup_address` string
- `receiver_address` string
- `delivery_status` string
- `assigned_at` datetime nullable
- `picked_up_at` datetime nullable
- `delivered_at` datetime nullable

### 3.9 `TRANSACTION_POINT_LEDGER`

- `ledger_id` int PK
- `transaction_id` int FK nullable, references `TRANSACTION.transaction_id`
- `user_id` int FK, references `USER.user_id`
- `role_in_transaction` string
- `points_before` int
- `point_change` int
- `points_after` int
- `reason` string
- `created_at` datetime

The `transaction_id` column is nullable only for non-transaction-originated events such as `INITIAL_BONUS` or approved `ADMIN_ADJUSTMENT`.

### 3.10 `REVIEW`

- `review_id` int PK
- `transaction_id` int FK, references `TRANSACTION.transaction_id`
- `reviewer_user_id` int FK, references `USER.user_id`
- `reviewee_user_id` int FK, references `USER.user_id`
- `rating_score` int
- `review_content` string
- `review_type` enum/string
- `created_at` datetime

### 3.11 `ACTIVITY_LOG`

- `activity_id` int PK
- `user_id` int FK, references `USER.user_id`
- `activity_type` string
- `activity_description` string
- `created_at` datetime

### 3.12 `ADMIN_ACTION`

- `admin_action_id` int PK
- `admin_id` int FK, references `ADMIN_PROFILE.admin_id`
- `target_user_id` int FK nullable, references `USER.user_id`
- `action_type` string
- `action_description` string
- `created_at` datetime

## 4. Non-Negotiable Business Rules

Codex must preserve these rules across all generated code.

### 4.1 Identity and Access Control

- Every actor must map to one `USER` record.
- Extended roles are stored through `MEMBER_PROFILE`, `COURIER_PROFILE`, and `ADMIN_PROFILE`.
- A `USER` may hold multiple logical roles.
- Guests cannot search books, create transactions, view points, or access internal resources.
- Members can only modify their own profile, own books, and transactions they participate in.
- Couriers can only update deliveries assigned to them.
- Admin actions must be recorded in `ADMIN_ACTION`.

### 4.2 Book Catalog

- A physical book has exactly one owner at a time.
- A book references one category through `category_id`.
- Cover images are not stored in PostgreSQL. Store the file in MinIO and persist only `cover_image_url` or object key in `BOOK.cover_image_url`.
- When a transaction is created, the book must move from `AVAILABLE` to `PENDING_TRANSACTION`.
- Concurrent transaction requests against the same book must be rejected.
- Do not physically delete books involved in transactions. Use soft state such as `REMOVED`.

### 4.3 Transaction State Machine

Allowed `TRANSACTION.transaction_status` values:

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

### 4.4 Delivery State Machine

Allowed `DELIVERY.delivery_status` values:

- `PENDING`
- `ASSIGNED`
- `PICKED_UP`
- `DELIVERED`
- `FAILED`
- `CANCELLED`

Rules:

- Create a `DELIVERY` only when `TRANSACTION.delivery_method = FREE_COURIER`.
- A transaction can have at most one delivery in the current version.
- Only an available courier can accept a delivery.
- Once a courier accepts a delivery, mark `COURIER_PROFILE.courier_status` as `BUSY`.
- When delivery is completed or cancelled, update courier status accordingly.

### 4.5 Point Ledger

Point rules:

- New member initial bonus: `+20`
- Permanent exchange: owner `+10`, requester `-10`
- Borrow-return: owner `+5`, requester `-5`
- Successful delivery: courier `+2`

Integrity rules:

- Points are updated only after a transaction or delivery reaches a valid completed state.
- Every point change must create an append-only `TRANSACTION_POINT_LEDGER` record.
- `USER.current_points` is a cached balance and must match ledger history.
- Admin point adjustment must create both a ledger entry and an `ADMIN_ACTION` entry.
- Do not update `USER.current_points` without a ledger record.

### 4.6 Review System

- Reviews are allowed only after `TRANSACTION.transaction_status = COMPLETED`.
- A user cannot review themselves.
- Prevent duplicate review with unique constraint: `(transaction_id, reviewer_user_id, reviewee_user_id, review_type)` on `REVIEW`.
- Reviews should be soft-hidden by admin rather than physically deleted. If the current ERD lacks a `review_status` column, add it only after explicit user approval or document it as a future extension.

### 4.7 Audit and Soft Delete

- Important business events must create `ACTIVITY_LOG` records.
- Admin operations must create `ADMIN_ACTION` records.
- Do not physically delete financial or audit entities: `TRANSACTION`, `TRANSACTION_POINT_LEDGER`, `REVIEW`, `ACTIVITY_LOG`, `ADMIN_ACTION`.

## 5. ENUM and State Values

Use the following values consistently across backend constants, database checks, seed data, and frontend labels.

- `account_status`: `PENDING`, `ACTIVE`, `LOCKED`, `INACTIVE`
- `role`: `USER`, `MEMBER`, `COURIER`, `ADMIN`
- `membership_status`: `PENDING`, `ACTIVE`, `SUSPENDED`, `INACTIVE`
- `courier_status`: `PENDING`, `AVAILABLE`, `BUSY`, `SUSPENDED`, `INACTIVE`
- `admin_status`: `ACTIVE`, `SUSPENDED`, `INACTIVE`
- `book_status`: `AVAILABLE`, `PENDING_TRANSACTION`, `BORROWED`, `EXCHANGED`, `REMOVED`
- `exchange_mode`: `PERMANENT_EXCHANGE`, `BORROW_RETURN`, `BOTH`
- `transaction_type`: `PERMANENT_EXCHANGE`, `BORROW_RETURN`
- `delivery_method`: `DIRECT_CONTACT`, `FREE_COURIER`
- `transaction_status`: `PENDING`, `ACCEPTED`, `DELIVERING`, `COMPLETED`, `CANCELLED`, `REJECTED`
- `delivery_status`: `PENDING`, `ASSIGNED`, `PICKED_UP`, `DELIVERED`, `FAILED`, `CANCELLED`
- `role_in_transaction`: `OWNER`, `REQUESTER`, `COURIER`, `SYSTEM`, `ADMIN`
- `reason`: `INITIAL_BONUS`, `EXCHANGE_REWARD`, `EXCHANGE_COST`, `BORROW_REWARD`, `BORROW_COST`, `DELIVERY_REWARD`, `ADMIN_ADJUSTMENT`
- `review_type`: `OWNER_REVIEW`, `REQUESTER_REVIEW`, `COURIER_REVIEW`
- `activity_type`: `REGISTER`, `LOGIN`, `UPDATE_PROFILE`, `CREATE_BOOK`, `UPDATE_BOOK`, `CREATE_TRANSACTION`, `CONFIRM_TRANSACTION`, `DELIVERY_UPDATE`, `CREATE_REVIEW`, `POINT_UPDATE`
- `action_type`: `LOCK_USER`, `UNLOCK_USER`, `HIDE_BOOK`, `RESTORE_BOOK`, `CANCEL_TRANSACTION`, `HIDE_REVIEW`, `POINT_ADJUSTMENT`, `OTHER`

## 6. Recommended Repository Structure

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
    DATABASE_SCHEMA.md
  infra/
    minio/
    postgres/
  tests/
  scripts/
```

## 7. Backend Module Design

Implement backend by modules. Each module should contain router, service, schema, and related model logic.

### 7.1 `users`

Responsibilities:

- Register user
- Hash password
- Create `USER` and `MEMBER_PROFILE`
- Add initial `+20` ledger entry in `TRANSACTION_POINT_LEDGER`
- Login and JWT token issuing
- Get current user profile
- Update member profile
- Register courier profile in `COURIER_PROFILE`

Endpoints draft:

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `GET /api/v1/users/me`
- `PATCH /api/v1/users/me/profile`
- `POST /api/v1/users/me/courier-profile`

### 7.2 `books`

Responsibilities:

- CRUD for owned books in `BOOK`
- Category management through `CATEGORY`
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

### 7.3 `transactions`

Responsibilities:

- Create transaction request in `TRANSACTION`
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

### 7.4 `deliveries`

Responsibilities:

- Create `DELIVERY` when free courier method is selected
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

### 7.5 `points`

Responsibilities:

- Read current point balance from `USER.current_points`
- Read ledger history from `TRANSACTION_POINT_LEDGER`
- Internal settlement service for transaction and delivery flows
- Admin point adjustment with audit trail

Endpoints draft:

- `GET /api/v1/points/me`
- `GET /api/v1/points/me/ledger`
- `POST /api/v1/admin/users/{user_id}/point-adjustments`

### 7.6 `reviews`

Responsibilities:

- Create review after completed transaction in `REVIEW`
- Validate reviewer and reviewee
- Prevent self-review and duplicate review
- Admin hide review if the schema is extended with a soft-hide status

Endpoints draft:

- `POST /api/v1/reviews`
- `GET /api/v1/users/{user_id}/reviews`
- `POST /api/v1/admin/reviews/{review_id}/hide`

### 7.7 `admin`

Responsibilities:

- Manage users
- Lock or unlock accounts
- Hide or restore books
- Cancel problematic transactions
- View `ACTIVITY_LOG` and `ADMIN_ACTION`

Endpoints draft:

- `GET /api/v1/admin/users`
- `POST /api/v1/admin/users/{user_id}/lock`
- `POST /api/v1/admin/users/{user_id}/unlock`
- `POST /api/v1/admin/books/{book_id}/hide`
- `POST /api/v1/admin/transactions/{transaction_id}/cancel`
- `GET /api/v1/admin/activity-logs`
- `GET /api/v1/admin/admin-actions`

## 8. Database Implementation Order

Stage 1, foundation tables:

- `USER`
- `MEMBER_PROFILE`
- `COURIER_PROFILE`
- `ADMIN_PROFILE`
- `CATEGORY`
- `BOOK`

Stage 2, transaction tables:

- `TRANSACTION`
- `DELIVERY`

Stage 3, trust and audit tables:

- `TRANSACTION_POINT_LEDGER`
- `REVIEW`
- `ACTIVITY_LOG`
- `ADMIN_ACTION`

Stage 4, indexes and constraints:

- Unique index on `USER.email` and `USER.phone`
- Unique index on `MEMBER_PROFILE.student_code`
- Unique index on `CATEGORY.category_name`
- Index on `BOOK.title`, `BOOK.category_id`, `BOOK.owner_id`, `BOOK.book_status`
- Index on `TRANSACTION.owner_id`, `TRANSACTION.requester_id`, `TRANSACTION.transaction_status`
- Unique constraint on `DELIVERY.transaction_id`
- Unique review constraint on `REVIEW(transaction_id, reviewer_user_id, reviewee_user_id, review_type)`

## 9. Frontend Implementation Order

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

## 10. Coding Standards

Backend:

- Use Python type hints everywhere.
- Keep routers thin. Business logic belongs in services.
- Use SQLAlchemy models and Alembic migrations.
- SQLAlchemy `__tablename__` values must match the ERD uppercase table names.
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

## 11. Codex Working Protocol

When generating code, Codex must follow this protocol:

1. Read `AGENTS.md` first.
2. Check existing files before creating new ones.
3. Implement one stage at a time.
4. Prefer small, reviewable commits.
5. Do not invent business rules that conflict with the SAD document or ERD.
6. Preserve exact database table names from the ERD.
7. When unsure, add a TODO comment and ask for clarification.
8. After each stage, update `docs/IMPLEMENTATION_PLAN.md` with completed tasks and next actions.
9. Never hard-code secrets. Use environment variables.
10. Never bypass backend permission checks because frontend already hides a button.
11. Do not delete financial or audit records physically.

## 12. Initial Milestones for Codex

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

- SQLAlchemy models for all SAD/ERD entities
- SQLAlchemy `__tablename__` values exactly: `USER`, `MEMBER_PROFILE`, `COURIER_PROFILE`, `ADMIN_PROFILE`, `BOOK`, `CATEGORY`, `TRANSACTION`, `DELIVERY`, `TRANSACTION_POINT_LEDGER`, `REVIEW`, `ACTIVITY_LOG`, `ADMIN_ACTION`
- Alembic migration
- Seed categories
- Database constraints and indexes
- `docs/DATABASE_SCHEMA.md`

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

## 13. First Prompt to Codex

Use this prompt after placing `AGENTS.md` at the repo root:

```text
Read AGENTS.md and the LibriHub SAD document if available. Start with Milestone 0 and Milestone 1 only.

Create the repository skeleton for a monorepo with FastAPI backend, Next.js frontend, PostgreSQL, MinIO, and Docker Compose.

Important database rule:
- Preserve exact ERD table names in future migrations: USER, MEMBER_PROFILE, COURIER_PROFILE, ADMIN_PROFILE, BOOK, CATEGORY, TRANSACTION, DELIVERY, TRANSACTION_POINT_LEDGER, REVIEW, ACTIVITY_LOG, ADMIN_ACTION.
- Do not convert ERD table names to lowercase plural table names.

Deliver:
1. Root README.md with setup instructions.
2. docker-compose.yml for postgres, minio, backend, and frontend placeholders.
3. .env.example with all required variables.
4. backend FastAPI skeleton with /health endpoint.
5. docs/IMPLEMENTATION_PLAN.md with milestones copied from AGENTS.md and a checklist.

Do not implement business modules yet. Keep the first commit small and runnable.
```
