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


def register_courier(client: TestClient, headers: dict[str, str]) -> None:
    response = client.post(
        "/api/v1/users/me/courier-profile",
        json={
            "delivery_area": "Ha Noi",
            "contact_name": "Courier User",
            "contact_phone": "0911111111",
            "contact_address": "Ha Noi",
            "vehicle_type": "Bike",
            "document_url": "minio://documents/courier-id.png",
        },
        headers=headers,
    )
    assert response.status_code == 200
    assert response.json()["courier_profile"]["courier_status"] == "PENDING"
    courier_id = response.json()["courier_profile"]["courier_id"]
    approve_response = client.post(
        f"/api/v1/admin/courier-applications/{courier_id}/approve",
        json={"review_note": "Approved for tests."},
        headers={"Authorization": f"Bearer {create_access_token('1')}"},
    )
    assert approve_response.status_code == 200
    assert approve_response.json()["courier_status"] == "AVAILABLE"


def create_book(client: TestClient, owner_headers: dict[str, str]) -> dict:
    response = client.post(
        "/api/v1/books",
        json={
            "category_id": 1,
            "title": "Building Microservices",
            "author": "Sam Newman",
            "publication_year": 2021,
            "book_condition": "GOOD",
            "exchange_mode": "BOTH",
        },
        headers=owner_headers,
    )
    assert response.status_code == 201
    return response.json()


def create_free_courier_transaction(
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
            "delivery_method": "FREE_COURIER",
            "receiver_address": "GD4, UET",
            "receiver_lat": 21.0388,
            "receiver_lng": 105.784,
        },
        headers=requester_headers,
    )
    assert create_response.status_code == 201
    transaction = create_response.json()
    accept_response = client.post(
        f"/api/v1/transactions/{transaction['transaction_id']}/accept",
        json={
            "pickup_address": "GD3, UET",
            "pickup_lat": 21.0379,
            "pickup_lng": 105.7823,
        },
        headers=owner_headers,
    )
    assert accept_response.status_code == 200
    assert accept_response.json()["transaction_status"] == "DELIVERING"
    return accept_response.json()


def accept_delivery(
    client: TestClient,
    courier_headers: dict[str, str],
    transaction_id: int,
) -> dict:
    response = client.post(
        f"/api/v1/deliveries/transactions/{transaction_id}/accept",
        json={
            "expected_delivery_at": "2026-06-02T09:00:00Z",
        },
        headers=courier_headers,
    )
    assert response.status_code == 201
    assert response.json()["expected_delivery_at"] is not None
    return response.json()


def test_courier_accept_pickup_deliver_settles_reward_and_completes_transaction(
    client: TestClient,
) -> None:
    owner_headers = auth_headers(client, "owner@example.com", "0900000001", "SV101")
    requester_headers = auth_headers(client, "requester@example.com", "0900000002", "SV102")
    courier_headers = auth_headers(client, "courier@example.com", "0900000003", "SV103")
    register_courier(client, courier_headers)
    transaction = create_free_courier_transaction(client, owner_headers, requester_headers)

    owner_confirm = client.post(
        f"/api/v1/transactions/{transaction['transaction_id']}/confirm",
        headers=owner_headers,
    )
    requester_confirm = client.post(
        f"/api/v1/transactions/{transaction['transaction_id']}/confirm",
        headers=requester_headers,
    )
    assert owner_confirm.status_code == 200
    assert requester_confirm.status_code == 200
    assert requester_confirm.json()["transaction_status"] == "DELIVERING"

    available_response = client.get("/api/v1/deliveries/available", headers=courier_headers)
    assert available_response.status_code == 200
    assert [task["transaction_id"] for task in available_response.json()] == [
        transaction["transaction_id"]
    ]

    delivery = accept_delivery(client, courier_headers, transaction["transaction_id"])
    assert delivery["delivery_status"] == "ASSIGNED"
    assert delivery["book_id"] == transaction["book_id"]
    assert delivery["owner_id"] == transaction["owner_id"]
    assert delivery["requester_id"] == transaction["requester_id"]
    assert delivery["pickup_address"] == "GD3, UET"
    assert delivery["receiver_address"] == "GD4, UET"
    me_response = client.get("/api/v1/users/me", headers=courier_headers)
    assert me_response.json()["courier_profile"]["courier_status"] == "BUSY"

    pickup_response = client.post(
        f"/api/v1/deliveries/{delivery['delivery_id']}/pickup",
        headers=courier_headers,
    )
    assert pickup_response.status_code == 200
    assert pickup_response.json()["delivery_status"] == "PICKED_UP"

    delivered_response = client.post(
        f"/api/v1/deliveries/{delivery['delivery_id']}/delivered",
        headers=courier_headers,
    )
    assert delivered_response.status_code == 200
    assert delivered_response.json()["delivery_status"] == "DELIVERED"

    courier_profile = client.get("/api/v1/users/me", headers=courier_headers).json()[
        "courier_profile"
    ]
    assert courier_profile["courier_status"] == "AVAILABLE"
    assert courier_profile["successful_delivery_count"] == 1
    assert client.get("/api/v1/points/me", headers=courier_headers).json()["current_points"] == 22

    transactions = client.get("/api/v1/transactions/me", headers=owner_headers).json()
    assert transactions[0]["transaction_status"] == "COMPLETED"
    assert transactions[0]["courier_confirmed"] is True


def test_delivery_requires_courier_profile_and_only_assigned_courier_updates(
    client: TestClient,
) -> None:
    owner_headers = auth_headers(client, "owner@example.com", "0900000001", "SV101")
    requester_headers = auth_headers(client, "requester@example.com", "0900000002", "SV102")
    courier_headers = auth_headers(client, "courier@example.com", "0900000003", "SV103")
    other_courier_headers = auth_headers(client, "other@example.com", "0900000004", "SV104")
    register_courier(client, courier_headers)
    register_courier(client, other_courier_headers)
    transaction = create_free_courier_transaction(client, owner_headers, requester_headers)

    member_available_response = client.get("/api/v1/deliveries/available", headers=requester_headers)
    assert member_available_response.status_code == 403

    delivery = accept_delivery(client, courier_headers, transaction["transaction_id"])
    forbidden_response = client.post(
        f"/api/v1/deliveries/{delivery['delivery_id']}/pickup",
        headers=other_courier_headers,
    )
    assert forbidden_response.status_code == 403


def test_pending_and_rejected_courier_cannot_take_delivery_tasks(client: TestClient) -> None:
    courier_headers = auth_headers(client, "courier@example.com", "0900000003", "SV103")
    submit_response = client.post(
        "/api/v1/users/me/courier-profile",
        json={"delivery_area": "Ha Noi", "vehicle_type": "Bike"},
        headers=courier_headers,
    )
    assert submit_response.status_code == 200
    assert submit_response.json()["courier_profile"]["courier_status"] == "PENDING"
    courier_id = submit_response.json()["courier_profile"]["courier_id"]

    pending_response = client.get("/api/v1/deliveries/available", headers=courier_headers)
    assert pending_response.status_code == 409

    reject_response = client.post(
        f"/api/v1/admin/courier-applications/{courier_id}/reject",
        json={"review_note": "Missing required document."},
        headers={"Authorization": f"Bearer {create_access_token('1')}"},
    )
    assert reject_response.status_code == 200
    assert reject_response.json()["courier_status"] == "INACTIVE"

    rejected_response = client.get("/api/v1/deliveries/available", headers=courier_headers)
    assert rejected_response.status_code == 409


def test_failed_delivery_cancels_transaction_releases_book_and_no_reward(
    client: TestClient,
) -> None:
    owner_headers = auth_headers(client, "owner@example.com", "0900000001", "SV101")
    requester_headers = auth_headers(client, "requester@example.com", "0900000002", "SV102")
    courier_headers = auth_headers(client, "courier@example.com", "0900000003", "SV103")
    register_courier(client, courier_headers)
    transaction = create_free_courier_transaction(client, owner_headers, requester_headers)
    delivery = accept_delivery(client, courier_headers, transaction["transaction_id"])

    failed_response = client.post(
        f"/api/v1/deliveries/{delivery['delivery_id']}/failed",
        headers=courier_headers,
    )

    assert failed_response.status_code == 200
    assert failed_response.json()["delivery_status"] == "FAILED"
    assert client.get("/api/v1/points/me", headers=courier_headers).json()["current_points"] == 20
    transactions = client.get("/api/v1/transactions/me", headers=owner_headers).json()
    assert transactions[0]["transaction_status"] == "CANCELLED"
    books = client.get("/api/v1/books?mine=true", headers=owner_headers).json()
    assert books[0]["book_status"] == "AVAILABLE"
