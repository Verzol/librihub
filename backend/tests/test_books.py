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


def register_payload(email: str, phone: str, student_code: str) -> dict[str, str]:
    return {
        "full_name": "Book Owner",
        "email": email,
        "phone": phone,
        "password": "password123",
        "student_code": student_code,
        "address": "Ha Noi",
    }


def auth_headers(client: TestClient, email: str, phone: str, student_code: str) -> dict[str, str]:
    response = client.post("/api/v1/auth/register", json=register_payload(email, phone, student_code))
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def book_payload() -> dict[str, object]:
    return {
        "category_id": 1,
        "title": "Clean Architecture",
        "author": "Robert C. Martin",
        "publication_year": 2017,
        "book_condition": "GOOD",
        "exchange_mode": "BOTH",
    }


def test_create_search_update_and_soft_delete_book(client: TestClient) -> None:
    headers = auth_headers(client, "owner@example.com", "0900000001", "SV101")

    create_response = client.post("/api/v1/books", json=book_payload(), headers=headers)
    assert create_response.status_code == 201
    created = create_response.json()
    assert created["title"] == "Clean Architecture"
    assert created["book_status"] == "AVAILABLE"
    assert created["category"]["category_name"] == "Technology"

    list_response = client.get("/api/v1/books?q=Clean", headers=headers)
    assert list_response.status_code == 200
    assert [book["book_id"] for book in list_response.json()] == [created["book_id"]]

    update_response = client.patch(
        f"/api/v1/books/{created['book_id']}",
        json={"book_condition": "FAIR", "title": "Clean Architecture Updated"},
        headers=headers,
    )
    assert update_response.status_code == 200
    assert update_response.json()["book_condition"] == "FAIR"
    assert update_response.json()["title"] == "Clean Architecture Updated"

    delete_response = client.delete(f"/api/v1/books/{created['book_id']}", headers=headers)
    assert delete_response.status_code == 200
    assert delete_response.json()["book_status"] == "REMOVED"

    detail_response = client.get(f"/api/v1/books/{created['book_id']}", headers=headers)
    assert detail_response.status_code == 404


def test_only_owner_can_update_book(client: TestClient) -> None:
    owner_headers = auth_headers(client, "owner@example.com", "0900000001", "SV101")
    other_headers = auth_headers(client, "other@example.com", "0900000002", "SV102")
    created = client.post("/api/v1/books", json=book_payload(), headers=owner_headers).json()

    response = client.patch(
        f"/api/v1/books/{created['book_id']}",
        json={"title": "Other title"},
        headers=other_headers,
    )

    assert response.status_code == 403


def test_create_book_requires_active_category(client: TestClient) -> None:
    headers = auth_headers(client, "owner@example.com", "0900000001", "SV101")
    payload = book_payload() | {"category_id": 999}

    response = client.post("/api/v1/books", json=payload, headers=headers)

    assert response.status_code == 404


def test_upload_cover_updates_cover_url(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    headers = auth_headers(client, "owner@example.com", "0900000001", "SV101")
    created = client.post("/api/v1/books", json=book_payload(), headers=headers).json()

    def fake_upload(content: bytes, content_type: str, original_filename: str) -> str:
        assert content == b"image-bytes"
        assert content_type == "image/png"
        assert original_filename == "cover.png"
        return "http://localhost:9000/book-covers/cover.png"

    monkeypatch.setattr("app.modules.books.router.upload_book_cover", fake_upload)

    response = client.post(
        f"/api/v1/books/{created['book_id']}/cover",
        files={"file": ("cover.png", b"image-bytes", "image/png")},
        headers=headers,
    )

    assert response.status_code == 200
    assert response.json()["cover_image_url"] == "http://localhost:9000/book-covers/cover.png"
    assert response.json()["book"]["cover_image_url"] == "http://localhost:9000/book-covers/cover.png"
