"""seed more book categories

Revision ID: 20260602_0005
Revises: 20260602_0004
Create Date: 2026-06-02 16:20:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "20260602_0005"
down_revision: str | None = "20260602_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


CATEGORIES = [
    {
        "category_name": "Khoa học",
        "category_description": "Sách về khoa học tự nhiên, khám phá và nghiên cứu.",
        "is_active": True,
    },
    {
        "category_name": "Kinh tế",
        "category_description": "Sách về kinh tế, tài chính, đầu tư và quản trị.",
        "is_active": True,
    },
    {
        "category_name": "Ngoại ngữ",
        "category_description": "Sách học ngoại ngữ, từ vựng, ngữ pháp và luyện thi.",
        "is_active": True,
    },
    {
        "category_name": "Giáo trình",
        "category_description": "Giáo trình, tài liệu học tập và sách tham khảo môn học.",
        "is_active": True,
    },
    {
        "category_name": "Lịch sử",
        "category_description": "Sách về lịch sử Việt Nam, thế giới và các nhân vật lịch sử.",
        "is_active": True,
    },
    {
        "category_name": "Tâm lý học",
        "category_description": "Sách về tâm lý, hành vi, cảm xúc và phát triển bản thân.",
        "is_active": True,
    },
    {
        "category_name": "Truyện tranh",
        "category_description": "Truyện tranh, manga và sách minh họa giải trí.",
        "is_active": True,
    },
    {
        "category_name": "Văn học Việt Nam",
        "category_description": "Tác phẩm văn học Việt Nam, truyện ngắn, thơ và tùy bút.",
        "is_active": True,
    },
    {
        "category_name": "Thiếu nhi",
        "category_description": "Sách dành cho thiếu nhi, truyện kể và sách giáo dục trẻ em.",
        "is_active": True,
    },
]


def upgrade() -> None:
    category_table = sa.table(
        "CATEGORY",
        sa.column("category_name", sa.String),
        sa.column("category_description", sa.Text),
        sa.column("is_active", sa.Boolean),
    )

    connection = op.get_bind()
    existing_names = {
        row[0]
        for row in connection.execute(sa.text('SELECT category_name FROM "CATEGORY"')).all()
    }
    new_categories = [
        category for category in CATEGORIES if category["category_name"] not in existing_names
    ]
    if new_categories:
        op.bulk_insert(category_table, new_categories)


def downgrade() -> None:
    category_table = sa.table("CATEGORY", sa.column("category_name", sa.String))
    op.execute(
        category_table.delete().where(
            category_table.c.category_name.in_(
                [category["category_name"] for category in CATEGORIES]
            )
        )
    )
