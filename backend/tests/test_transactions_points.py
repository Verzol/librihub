from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models import *  # noqa: F403
from app.models.erd import Category


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


def register_payload(email: str, phone: str, student_code: str, full_name: str) -> dict[str, str]:
    return {
        "full_name": full_name,
        "email": email,
        "phone": phone,
        "password": "password123",
        "student_code": student_code,
        "address": "Ha Noi",
    }


def auth_headers(client: TestClient, email: str, phone: str, student_code: str) -> dict[str, str]:
    response = client.post(
        "/api/v1/auth/register",
        json=register_payload(email, phone, student_code, email.split("@")[0]),
    )
    assert response.status_code == 201
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def book_payload(exchange_mode: str = "BOTH") -> dict[str, object]:
    return {
        "category_id": 1,
        "title": "Domain-Driven Design",
        "author": "Eric Evans",
        "publication_year": 2003,
        "book_condition": "GOOD",
        "exchange_mode": exchange_mode,
    }


def create_book(client: TestClient, owner_headers: dict[str, str], exchange_mode: str = "BOTH") -> dict:
    response = client.post("/api/v1/books", json=book_payload(exchange_mode), headers=owner_headers)
    assert response.status_code == 201
    return response.json()


def create_transaction(
    client: TestClient,
    requester_headers: dict[str, str],
    book_id: int,
    transaction_type: str = "PERMANENT_EXCHANGE",
) -> dict:
    response = client.post(
        "/api/v1/transactions",
        json={
            "book_id": book_id,
            "transaction_type": transaction_type,
            "delivery_method": "DIRECT_CONTACT",
        },
        headers=requester_headers,
    )
    assert response.status_code == 201
    return response.json()


def test_create_transaction_locks_book_and_rejects_concurrent_request(
    client: TestClient,
) -> None:
    owner_headers = auth_headers(client, "owner@example.com", "0900000001", "SV101")
    requester_headers = auth_headers(client, "requester@example.com", "0900000002", "SV102")
    other_headers = auth_headers(client, "other@example.com", "0900000003", "SV103")
    book = create_book(client, owner_headers)

    transaction = create_transaction(client, requester_headers, book["book_id"])

    assert transaction["transaction_status"] == "PENDING"
    mine_response = client.get("/api/v1/books?mine=true", headers=owner_headers)
    assert mine_response.status_code == 200
    assert mine_response.json()[0]["book_status"] == "PENDING_TRANSACTION"

    duplicate_response = client.post(
        "/api/v1/transactions",
        json={
            "book_id": book["book_id"],
            "transaction_type": "PERMANENT_EXCHANGE",
            "delivery_method": "DIRECT_CONTACT",
        },
        headers=other_headers,
    )
    assert duplicate_response.status_code == 409


def test_only_owner_can_accept_and_reject_releases_book(client: TestClient) -> None:
    owner_headers = auth_headers(client, "owner@example.com", "0900000001", "SV101")
    requester_headers = auth_headers(client, "requester@example.com", "0900000002", "SV102")
    book = create_book(client, owner_headers)
    transaction = create_transaction(client, requester_headers, book["book_id"])

    forbidden_response = client.post(
        f"/api/v1/transactions/{transaction['transaction_id']}/accept",
        headers=requester_headers,
    )
    assert forbidden_response.status_code == 403

    reject_response = client.post(
        f"/api/v1/transactions/{transaction['transaction_id']}/reject",
        headers=owner_headers,
    )
    assert reject_response.status_code == 200
    assert reject_response.json()["transaction_status"] == "REJECTED"

    mine_response = client.get("/api/v1/books?mine=true", headers=owner_headers)
    assert mine_response.json()[0]["book_status"] == "AVAILABLE"


def test_confirm_direct_transaction_settles_points_and_final_book_state(
    client: TestClient,
) -> None:
    owner_headers = auth_headers(client, "owner@example.com", "0900000001", "SV101")
    requester_headers = auth_headers(client, "requester@example.com", "0900000002", "SV102")
    book = create_book(client, owner_headers)
    transaction = create_transaction(client, requester_headers, book["book_id"])

    accept_response = client.post(
        f"/api/v1/transactions/{transaction['transaction_id']}/accept",
        headers=owner_headers,
    )
    assert accept_response.status_code == 200
    assert accept_response.json()["transaction_status"] == "ACCEPTED"

    owner_confirm_response = client.post(
        f"/api/v1/transactions/{transaction['transaction_id']}/confirm",
        headers=owner_headers,
    )
    assert owner_confirm_response.status_code == 200
    assert owner_confirm_response.json()["transaction_status"] == "ACCEPTED"
    assert owner_confirm_response.json()["owner_confirmed"] is True

    requester_confirm_response = client.post(
        f"/api/v1/transactions/{transaction['transaction_id']}/confirm",
        headers=requester_headers,
    )
    assert requester_confirm_response.status_code == 200
    completed = requester_confirm_response.json()
    assert completed["transaction_status"] == "COMPLETED"
    assert completed["completed_at"] is not None

    owner_points = client.get("/api/v1/points/me", headers=owner_headers).json()
    requester_points = client.get("/api/v1/points/me", headers=requester_headers).json()
    assert owner_points["current_points"] == 30
    assert requester_points["current_points"] == 10

    owner_ledger = client.get("/api/v1/points/me/ledger", headers=owner_headers).json()
    requester_ledger = client.get("/api/v1/points/me/ledger", headers=requester_headers).json()
    assert owner_ledger[0]["reason"] == "EXCHANGE_REWARD"
    assert owner_ledger[0]["point_change"] == 10
    assert requester_ledger[0]["reason"] == "EXCHANGE_COST"
    assert requester_ledger[0]["point_change"] == -10


def test_cancel_accepted_transaction_releases_book(client: TestClient) -> None:
    owner_headers = auth_headers(client, "owner@example.com", "0900000001", "SV101")
    requester_headers = auth_headers(client, "requester@example.com", "0900000002", "SV102")
    book = create_book(client, owner_headers)
    transaction = create_transaction(client, requester_headers, book["book_id"])
    client.post(f"/api/v1/transactions/{transaction['transaction_id']}/accept", headers=owner_headers)

    cancel_response = client.post(
        f"/api/v1/transactions/{transaction['transaction_id']}/cancel",
        headers=requester_headers,
    )

    assert cancel_response.status_code == 200
    assert cancel_response.json()["transaction_status"] == "CANCELLED"
    mine_response = client.get("/api/v1/books?mine=true", headers=owner_headers)
    assert mine_response.json()[0]["book_status"] == "AVAILABLE"


def test_borrow_return_settlement_uses_borrow_points(client: TestClient) -> None:
    owner_headers = auth_headers(client, "owner@example.com", "0900000001", "SV101")
    requester_headers = auth_headers(client, "requester@example.com", "0900000002", "SV102")
    book = create_book(client, owner_headers, exchange_mode="BORROW_RETURN")
    transaction = create_transaction(
        client,
        requester_headers,
        book["book_id"],
        transaction_type="BORROW_RETURN",
    )
    client.post(f"/api/v1/transactions/{transaction['transaction_id']}/accept", headers=owner_headers)
    client.post(f"/api/v1/transactions/{transaction['transaction_id']}/confirm", headers=owner_headers)
    response = client.post(
        f"/api/v1/transactions/{transaction['transaction_id']}/confirm",
        headers=requester_headers,
    )

    assert response.status_code == 200
    assert client.get("/api/v1/points/me", headers=owner_headers).json()["current_points"] == 25
    assert client.get("/api/v1/points/me", headers=requester_headers).json()["current_points"] == 15


def test_transaction_persistence_has_final_book_state(client: TestClient) -> None:
    owner_headers = auth_headers(client, "owner@example.com", "0900000001", "SV101")
    requester_headers = auth_headers(client, "requester@example.com", "0900000002", "SV102")
    book = create_book(client, owner_headers)
    transaction = create_transaction(client, requester_headers, book["book_id"])
    client.post(f"/api/v1/transactions/{transaction['transaction_id']}/accept", headers=owner_headers)
    client.post(f"/api/v1/transactions/{transaction['transaction_id']}/confirm", headers=owner_headers)
    client.post(f"/api/v1/transactions/{transaction['transaction_id']}/confirm", headers=requester_headers)

    mine_response = client.get("/api/v1/books?mine=true", headers=owner_headers)
    assert mine_response.status_code == 200
    assert mine_response.json()[0]["book_status"] == "EXCHANGED"
