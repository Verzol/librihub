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

    app.dependency_overrides[get_db] = override_get_db
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()
        Base.metadata.drop_all(bind=engine)


def registration_payload() -> dict[str, str]:
    return {
        "full_name": "Giang Tuan Minh",
        "email": "giang@example.com",
        "phone": "0900000000",
        "password": "password123",
        "student_code": "SV001",
        "address": "Ha Noi",
    }


def test_register_creates_member_and_initial_points(client: TestClient) -> None:
    response = client.post("/api/v1/auth/register", json=registration_payload())

    assert response.status_code == 201
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]
    assert body["user"]["email"] == "giang@example.com"
    assert body["user"]["role"] == "MEMBER"
    assert body["user"]["current_points"] == 20
    assert body["user"]["account_status"] == "ACTIVE"
    assert body["user"]["member_profile"]["student_code"] == "SV001"
    assert body["user"]["member_profile"]["membership_status"] == "ACTIVE"


def test_register_rejects_duplicate_identity(client: TestClient) -> None:
    payload = registration_payload()
    first_response = client.post("/api/v1/auth/register", json=payload)
    second_response = client.post("/api/v1/auth/register", json=payload)

    assert first_response.status_code == 201
    assert second_response.status_code == 409


def test_login_and_current_user(client: TestClient) -> None:
    payload = registration_payload()
    register_response = client.post("/api/v1/auth/register", json=payload)
    login_response = client.post(
        "/api/v1/auth/login",
        json={"login": payload["email"], "password": payload["password"]},
    )

    assert register_response.status_code == 201
    assert login_response.status_code == 200

    token = login_response.json()["access_token"]
    me_response = client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert me_response.status_code == 200
    assert me_response.json()["email"] == payload["email"]


def test_user_summary_exposes_public_profile_without_contact_fields(client: TestClient) -> None:
    payload = registration_payload()
    register_response = client.post("/api/v1/auth/register", json=payload)
    token = register_response.json()["access_token"]
    user_id = register_response.json()["user"]["user_id"]

    response = client.get(
        f"/api/v1/users/{user_id}/summary",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["full_name"] == payload["full_name"]
    assert body["role"] == "MEMBER"
    assert body["membership_status"] == "ACTIVE"
    assert "email" not in body
    assert "phone" not in body


def test_login_rejects_bad_password(client: TestClient) -> None:
    payload = registration_payload()
    client.post("/api/v1/auth/register", json=payload)

    response = client.post(
        "/api/v1/auth/login",
        json={"login": payload["email"], "password": "not-the-password"},
    )

    assert response.status_code == 401
