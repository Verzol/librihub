import json
from io import BytesIO
from uuid import uuid4

from app.core.config import settings


class StorageError(Exception):
    pass


def upload_book_cover(content: bytes, content_type: str, original_filename: str) -> str:
    try:
        from minio import Minio
        from minio.error import S3Error
    except ImportError as error:
        raise StorageError("MinIO client dependency is not installed.") from error

    if not content:
        raise StorageError("Cover image is empty.")

    safe_filename = original_filename.replace("/", "-").replace("\\", "-")
    object_name = f"{uuid4().hex}-{safe_filename}"
    endpoint = settings.minio_endpoint.removeprefix("http://").removeprefix("https://")
    secure = settings.minio_endpoint.startswith("https://")
    public_endpoint = settings.minio_public_endpoint.rstrip("/")

    client = Minio(
        endpoint,
        access_key=settings.minio_root_user,
        secret_key=settings.minio_root_password,
        secure=secure,
    )

    try:
        if not client.bucket_exists(settings.minio_bucket_book_covers):
            client.make_bucket(settings.minio_bucket_book_covers)
            policy = {
                "Version": "2012-10-17",
                "Statement": [
                    {
                        "Effect": "Allow",
                        "Principal": {"AWS": ["*"]},
                        "Action": ["s3:GetObject"],
                        "Resource": [f"arn:aws:s3:::{settings.minio_bucket_book_covers}/*"]
                    }
                ]
            }
            client.set_bucket_policy(settings.minio_bucket_book_covers, json.dumps(policy))
        client.put_object(
            settings.minio_bucket_book_covers,
            object_name,
            BytesIO(content),
            length=len(content),
            content_type=content_type,
        )
    except S3Error as error:
        raise StorageError("Could not upload cover image to MinIO.") from error

    return f"{public_endpoint}/{settings.minio_bucket_book_covers}/{object_name}"
