"""fix category seed encoding

Revision ID: 20260604_0007
Revises: 20260604_0006
Create Date: 2026-06-04 18:55:00
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260604_0007"
down_revision: str | None = "20260604_0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


CATEGORY_FIXES = [
    (
        "CÃ´ng nghá»‡ thÃ´ng tin",
        "Công nghệ thông tin",
        "Danh mục sách về công nghệ thông tin.",
    ),
    (
        "Tiá»ƒu thuyáº¿t",
        "Tiểu thuyết",
        "Danh mục sách tiểu thuyết và văn học.",
    ),
    (
        "Ká»¹ nÄƒng má»m",
        "Kỹ năng mềm",
        "Danh mục sách về kỹ năng mềm.",
    ),
    (
        "Khoa há»c",
        "Khoa học",
        "Sách về khoa học tự nhiên, khám phá và nghiên cứu.",
    ),
    (
        "Kinh táº¿",
        "Kinh tế",
        "Sách về kinh tế, tài chính, đầu tư và quản trị.",
    ),
    (
        "Ngoáº¡i ngá»¯",
        "Ngoại ngữ",
        "Sách học ngoại ngữ, từ vựng, ngữ pháp và luyện thi.",
    ),
    (
        "GiÃ¡o trÃ¬nh",
        "Giáo trình",
        "Giáo trình, tài liệu học tập và sách tham khảo môn học.",
    ),
    (
        "Lá»‹ch sá»­",
        "Lịch sử",
        "Sách về lịch sử Việt Nam, thế giới và các nhân vật lịch sử.",
    ),
    (
        "TÃ¢m lÃ½ há»c",
        "Tâm lý học",
        "Sách về tâm lý, hành vi, cảm xúc và phát triển bản thân.",
    ),
    (
        "Truyá»‡n tranh",
        "Truyện tranh",
        "Truyện tranh, manga và sách minh họa giải trí.",
    ),
    (
        "VÄƒn há»c Viá»‡t Nam",
        "Văn học Việt Nam",
        "Tác phẩm văn học Việt Nam, truyện ngắn, thơ và tùy bút.",
    ),
    (
        "Thiáº¿u nhi",
        "Thiếu nhi",
        "Sách dành cho thiếu nhi, truyện kể và sách giáo dục trẻ em.",
    ),
]


def upgrade() -> None:
    connection = op.get_bind()
    for broken_name, fixed_name, fixed_description in CATEGORY_FIXES:
        connection.execute(
            sa.text(
                """
            UPDATE "CATEGORY"
            SET category_name = :fixed_name,
                category_description = :fixed_description
            WHERE category_name = :broken_name
            """
            ),
            {
                "broken_name": broken_name,
                "fixed_name": fixed_name,
                "fixed_description": fixed_description,
            },
        )


def downgrade() -> None:
    connection = op.get_bind()
    for broken_name, fixed_name, _fixed_description in CATEGORY_FIXES:
        connection.execute(
            sa.text(
                """
            UPDATE "CATEGORY"
            SET category_name = :broken_name
            WHERE category_name = :fixed_name
            """
            ),
            {"broken_name": broken_name, "fixed_name": fixed_name},
        )
