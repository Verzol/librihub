from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.v1.router import api_router
from app.core.config import settings
from app.db.session import SessionLocal
from app.services.storage import StorageError, check_storage_ready


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name, version=settings.app_version)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health", tags=["system"])
    def health_check() -> dict[str, str]:
        return {"status": "ok", "service": settings.app_name}

    @app.get("/health/db", tags=["system"])
    def database_health_check() -> dict[str, str]:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "ready"}

    @app.get("/health/storage", tags=["system"])
    def storage_health_check() -> dict[str, str]:
        try:
            check_storage_ready()
        except StorageError as error:
            return {"status": "error", "storage": str(error)}
        return {"status": "ok", "storage": "ready"}

    app.include_router(api_router, prefix=settings.api_v1_prefix)

    return app


app = create_app()
