from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.security import create_access_token
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models import *  # noqa: F403
from app.models.enums import AccountStatus, AdminStatus, UserRole
from app.models.erd import AdminProfile, Category, User


@pytest.fixture()
def client() -> Generator[TestClient, None, None]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    Base.metadata.create_all(bind=engine)

    def override_get_db() -> Generator[Session, None, None]:
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    with TestingSessionLocal() as db:
        admin = User(
            full_name="System Admin",
            email="admin@example.com",
            phone="0999999999",
            password_hash="test-only",
            role=UserRole.ADMIN,
            current_points=0,
            account_status=AccountStatus.ACTIVE,
        )
        db.add(admin)
        db.flush()
        db.add(AdminProfile(user_id=admin.user_id, admin_level="GLOBAL", admin_status=AdminStatus.ACTIVE))
        db.add(
            Category(
                category_name="Technology",
                category_description="Software and data books.",
                is_active=True,
            )
        )
        db.commit()

    app.dependency_overrides[get_db] = override_get_db
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()
        Base.metadata.drop_all(bind=engine)


def admin_headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token('1')}"}


def auth_headers(client: TestClient, email: str, phone: str, student_code: str) -> dict[str, str]:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": email.split("@")[0],
            "email": email,
            "phone": phone,
            "password": "password123",
            "student_code": student_code,
            "address": "Ha Noi",
        },
    )
    assert response.status_code == 201
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def create_book(client: TestClient, owner_headers: dict[str, str]) -> dict:
    response = client.post(
        "/api/v1/books",
        json={
            "category_id": 1,
            "title": "Refactoring",
            "author": "Martin Fowler",
            "publication_year": 2018,
            "book_condition": "GOOD",
            "exchange_mode": "BOTH",
        },
        headers=owner_headers,
    )
    assert response.status_code == 201
    return response.json()


def complete_direct_transaction(
    client: TestClient,
    owner_headers: dict[str, str],
    requester_headers: dict[str, str],
) -> dict:
    book = create_book(client, owner_headers)
    create_response = client.post(
        "/api/v1/transactions",
        json={
            "book_id": book["book_id"],
            "transaction_type": "PERMANENT_EXCHANGE",
            "delivery_method": "DIRECT_CONTACT",
        },
        headers=requester_headers,
    )
    assert create_response.status_code == 201
    transaction = create_response.json()
    client.post(f"/api/v1/transactions/{transaction['transaction_id']}/accept", headers=owner_headers)
    client.post(f"/api/v1/transactions/{transaction['transaction_id']}/confirm", headers=owner_headers)
    complete_response = client.post(
        f"/api/v1/transactions/{transaction['transaction_id']}/confirm",
        headers=requester_headers,
    )
    assert complete_response.status_code == 200
    assert complete_response.json()["transaction_status"] == "COMPLETED"
    return complete_response.json()


def register_courier(client: TestClient, headers: dict[str, str]) -> None:
    response = client.post(
        "/api/v1/users/me/courier-profile",
        json={"delivery_area": "Ha Noi", "vehicle_type": "Bike"},
        headers=headers,
    )
    assert response.status_code == 200
    courier_id = response.json()["courier_profile"]["courier_id"]
    approve_response = client.post(
        f"/api/v1/admin/courier-applications/{courier_id}/approve",
        json={"review_note": "Approved."},
        headers=admin_headers(),
    )
    assert approve_response.status_code == 200


def test_create_review_after_completed_transaction_and_prevent_duplicate(
    client: TestClient,
) -> None:
    owner_headers = auth_headers(client, "owner@example.com", "0900000001", "SV101")
    requester_headers = auth_headers(client, "requester@example.com", "0900000002", "SV102")
    transaction = complete_direct_transaction(client, owner_headers, requester_headers)

    response = client.post(
        "/api/v1/reviews",
        json={
            "transaction_id": transaction["transaction_id"],
            "reviewee_user_id": transaction["owner_id"],
            "rating_score": 5,
            "review_content": "Smooth exchange.",
            "review_type": "OWNER_REVIEW",
        },
        headers=requester_headers,
    )
    assert response.status_code == 201
    assert response.json()["reviewer_user_id"] == transaction["requester_id"]

    duplicate_response = client.post(
        "/api/v1/reviews",
        json={
            "transaction_id": transaction["transaction_id"],
            "reviewee_user_id": transaction["owner_id"],
            "rating_score": 4,
            "review_type": "OWNER_REVIEW",
        },
        headers=requester_headers,
    )
    assert duplicate_response.status_code == 409

    reviews_response = client.get(
        f"/api/v1/users/{transaction['owner_id']}/reviews",
        headers=owner_headers,
    )
    assert reviews_response.status_code == 200
    assert len(reviews_response.json()) == 1


def test_review_requires_completed_transaction_and_valid_participant(client: TestClient) -> None:
    owner_headers = auth_headers(client, "owner@example.com", "0900000001", "SV101")
    requester_headers = auth_headers(client, "requester@example.com", "0900000002", "SV102")
    outsider_headers = auth_headers(client, "outsider@example.com", "0900000003", "SV103")
    book = create_book(client, owner_headers)
    transaction_response = client.post(
        "/api/v1/transactions",
        json={
            "book_id": book["book_id"],
            "transaction_type": "PERMANENT_EXCHANGE",
            "delivery_method": "DIRECT_CONTACT",
        },
        headers=requester_headers,
    )
    transaction = transaction_response.json()

    early_response = client.post(
        "/api/v1/reviews",
        json={
            "transaction_id": transaction["transaction_id"],
            "reviewee_user_id": transaction["owner_id"],
            "rating_score": 5,
            "review_type": "OWNER_REVIEW",
        },
        headers=requester_headers,
    )
    assert early_response.status_code == 409

    completed = complete_direct_transaction(client, owner_headers, requester_headers)
    forbidden_response = client.post(
        "/api/v1/reviews",
        json={
            "transaction_id": completed["transaction_id"],
            "reviewee_user_id": completed["owner_id"],
            "rating_score": 5,
            "review_type": "OWNER_REVIEW",
        },
        headers=outsider_headers,
    )
    assert forbidden_response.status_code == 403


def test_admin_lock_unlock_user_and_requires_admin(client: TestClient) -> None:
    member_headers = auth_headers(client, "member@example.com", "0900000001", "SV101")
    users_response = client.get("/api/v1/admin/users", headers=admin_headers())
    assert users_response.status_code == 200
    member_id = next(user["user_id"] for user in users_response.json() if user["email"] == "member@example.com")

    forbidden_response = client.get("/api/v1/admin/users", headers=member_headers)
    assert forbidden_response.status_code == 403

    lock_response = client.post(f"/api/v1/admin/users/{member_id}/lock", headers=admin_headers())
    assert lock_response.status_code == 200
    assert lock_response.json()["account_status"] == "LOCKED"

    unlock_response = client.post(f"/api/v1/admin/users/{member_id}/unlock", headers=admin_headers())
    assert unlock_response.status_code == 200
    assert unlock_response.json()["account_status"] == "ACTIVE"


def test_admin_hide_restore_book_and_cancel_transaction(client: TestClient) -> None:
    owner_headers = auth_headers(client, "owner@example.com", "0900000001", "SV101")
    requester_headers = auth_headers(client, "requester@example.com", "0900000002", "SV102")
    book = create_book(client, owner_headers)

    hide_response = client.post(f"/api/v1/admin/books/{book['book_id']}/hide", headers=admin_headers())
    assert hide_response.status_code == 200
    assert hide_response.json()["book_status"] == "REMOVED"

    restore_response = client.post(
        f"/api/v1/admin/books/{book['book_id']}/restore",
        headers=admin_headers(),
    )
    assert restore_response.status_code == 200
    assert restore_response.json()["book_status"] == "AVAILABLE"

    transaction_response = client.post(
        "/api/v1/transactions",
        json={
            "book_id": book["book_id"],
            "transaction_type": "PERMANENT_EXCHANGE",
            "delivery_method": "DIRECT_CONTACT",
        },
        headers=requester_headers,
    )
    transaction = transaction_response.json()
    cancel_response = client.post(
        f"/api/v1/admin/transactions/{transaction['transaction_id']}/cancel",
        headers=admin_headers(),
    )
    assert cancel_response.status_code == 200
    assert cancel_response.json()["transaction_status"] == "CANCELLED"


def test_admin_point_adjustment_writes_ledger_and_admin_action(client: TestClient) -> None:
    member_headers = auth_headers(client, "member@example.com", "0900000001", "SV101")
    users_response = client.get("/api/v1/admin/users", headers=admin_headers())
    member_id = next(user["user_id"] for user in users_response.json() if user["email"] == "member@example.com")

    adjustment_response = client.post(
        f"/api/v1/admin/users/{member_id}/point-adjustments",
        json={"point_change": 7, "reason": "Manual compensation"},
        headers=admin_headers(),
    )
    assert adjustment_response.status_code == 200
    assert adjustment_response.json()["points_after"] == 27
    assert adjustment_response.json()["reason"] == "ADMIN_ADJUSTMENT"

    ledger_response = client.get("/api/v1/points/me/ledger", headers=member_headers)
    assert ledger_response.json()[0]["reason"] == "ADMIN_ADJUSTMENT"
    assert ledger_response.json()[0]["role_in_transaction"] == "ADMIN"

    action_response = client.get("/api/v1/admin/admin-actions", headers=admin_headers())
    assert action_response.status_code == 200
    assert action_response.json()[0]["action_type"] == "POINT_ADJUSTMENT"

    activity_response = client.get("/api/v1/admin/activity-logs", headers=admin_headers())
    assert activity_response.status_code == 200
    assert any(log["activity_type"] == "POINT_UPDATE" for log in activity_response.json())


def test_admin_cancel_free_courier_transaction_releases_courier(client: TestClient) -> None:
    owner_headers = auth_headers(client, "owner@example.com", "0900000001", "SV101")
    requester_headers = auth_headers(client, "requester@example.com", "0900000002", "SV102")
    courier_headers = auth_headers(client, "courier@example.com", "0900000003", "SV103")
    register_courier(client, courier_headers)
    book = create_book(client, owner_headers)
    transaction_response = client.post(
        "/api/v1/transactions",
        json={
            "book_id": book["book_id"],
            "transaction_type": "PERMANENT_EXCHANGE",
            "delivery_method": "FREE_COURIER",
            "receiver_address": "Thu vien UET",
            "receiver_lat": 21.03792,
            "receiver_lng": 105.78219,
        },
        headers=requester_headers,
    )
    transaction = transaction_response.json()
    client.post(
        f"/api/v1/transactions/{transaction['transaction_id']}/accept",
        json={
            "pickup_address": "Sanh E3 UET",
            "pickup_lat": 21.03823,
            "pickup_lng": 105.78292,
        },
        headers=owner_headers,
    )
    client.post(f"/api/v1/transactions/{transaction['transaction_id']}/confirm", headers=owner_headers)
    client.post(f"/api/v1/transactions/{transaction['transaction_id']}/confirm", headers=requester_headers)
    delivery_response = client.post(
        f"/api/v1/deliveries/transactions/{transaction['transaction_id']}/accept",
        json={},
        headers=courier_headers,
    )
    assert delivery_response.status_code == 201

    cancel_response = client.post(
        f"/api/v1/admin/transactions/{transaction['transaction_id']}/cancel",
        headers=admin_headers(),
    )

    assert cancel_response.status_code == 200
    assert cancel_response.json()["transaction_status"] == "CANCELLED"
    courier_profile = client.get("/api/v1/users/me", headers=courier_headers).json()["courier_profile"]
    assert courier_profile["courier_status"] == "AVAILABLE"
    deliveries = client.get("/api/v1/deliveries/me", headers=courier_headers).json()
    assert deliveries[0]["delivery_status"] == "CANCELLED"
