from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.models.enums import ActivityType, BookStatus, UserRole
from app.models.erd import ActivityLog, Book, Category, User
from app.modules.books.schemas import BookCreateRequest, BookUpdateRequest, CategoryCreateRequest


class CategoryNotFoundError(Exception):
    pass


class DuplicateCategoryError(Exception):
    pass


class BookNotFoundError(Exception):
    pass


class ForbiddenBookActionError(Exception):
    pass


class InvalidBookStateError(Exception):
    pass


class AdminRequiredError(Exception):
    pass


def list_categories(db: Session, include_inactive: bool = False) -> list[Category]:
    statement = select(Category).order_by(Category.category_name)
    if not include_inactive:
        statement = statement.where(Category.is_active.is_(True))
    return list(db.scalars(statement))


def create_category(db: Session, current_user: User, payload: CategoryCreateRequest) -> Category:
    if current_user.role != UserRole.ADMIN:
        raise AdminRequiredError

    category = Category(
        category_name=payload.category_name,
        category_description=payload.category_description,
        is_active=payload.is_active,
    )
    db.add(category)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise DuplicateCategoryError from error
    db.refresh(category)
    return category


def list_books(
    db: Session,
    current_user: User,
    *,
    mine: bool = False,
    query: str | None = None,
    category_id: int | None = None,
    exchange_mode: str | None = None,
) -> list[Book]:
    statement = select(Book).options(selectinload(Book.category)).order_by(Book.created_at.desc())

    if mine:
        statement = statement.where(Book.owner_id == current_user.user_id)
        statement = statement.where(Book.book_status != BookStatus.REMOVED)
    else:
        statement = statement.where(Book.book_status == BookStatus.AVAILABLE)

    if query:
        pattern = f"%{query.strip()}%"
        statement = statement.where(or_(Book.title.ilike(pattern), Book.author.ilike(pattern)))
    if category_id is not None:
        statement = statement.where(Book.category_id == category_id)
    if exchange_mode:
        statement = statement.where(Book.exchange_mode == exchange_mode)

    return list(db.scalars(statement))


def get_book(db: Session, book_id: int) -> Book | None:
    statement = (
        select(Book)
        .options(selectinload(Book.category))
        .where(Book.book_id == book_id, Book.book_status != BookStatus.REMOVED)
    )
    return db.scalar(statement)


def create_book(db: Session, current_user: User, payload: BookCreateRequest) -> Book:
    ensure_active_category(db, payload.category_id)
    book = Book(
        owner_id=current_user.user_id,
        category_id=payload.category_id,
        title=payload.title,
        author=payload.author,
        publication_year=payload.publication_year,
        book_condition=payload.book_condition,
        exchange_mode=payload.exchange_mode,
        book_status=BookStatus.AVAILABLE,
        cover_image_url=payload.cover_image_url,
    )
    db.add(book)
    db.flush()
    db.add(
        ActivityLog(
            user_id=current_user.user_id,
            activity_type=ActivityType.CREATE_BOOK,
            activity_description=f"Created book #{book.book_id}: {book.title}.",
        )
    )
    db.commit()
    created = get_book(db, book.book_id)
    if created is None:
        raise RuntimeError("Created book could not be reloaded.")
    return created


def update_book(db: Session, current_user: User, book_id: int, payload: BookUpdateRequest) -> Book:
    book = get_owned_mutable_book(db, current_user, book_id)
    updates = payload.model_dump(exclude_unset=True)
    if "category_id" in updates:
        ensure_active_category(db, updates["category_id"])

    for field, value in updates.items():
        setattr(book, field, value)

    db.add(
        ActivityLog(
            user_id=current_user.user_id,
            activity_type=ActivityType.UPDATE_BOOK,
            activity_description=f"Updated book #{book.book_id}: {book.title}.",
        )
    )
    db.commit()
    updated = get_book(db, book.book_id)
    if updated is None:
        raise RuntimeError("Updated book could not be reloaded.")
    return updated


def soft_delete_book(db: Session, current_user: User, book_id: int) -> Book:
    book = get_owned_mutable_book(db, current_user, book_id)
    book.book_status = BookStatus.REMOVED
    db.add(
        ActivityLog(
            user_id=current_user.user_id,
            activity_type=ActivityType.UPDATE_BOOK,
            activity_description=f"Removed book #{book.book_id}: {book.title}.",
        )
    )
    db.commit()
    db.refresh(book)
    return book


def set_book_cover(db: Session, current_user: User, book_id: int, cover_image_url: str) -> Book:
    book = get_owned_mutable_book(db, current_user, book_id)
    book.cover_image_url = cover_image_url
    db.add(
        ActivityLog(
            user_id=current_user.user_id,
            activity_type=ActivityType.UPDATE_BOOK,
            activity_description=f"Updated cover image for book #{book.book_id}.",
        )
    )
    db.commit()
    updated = get_book(db, book.book_id)
    if updated is None:
        raise RuntimeError("Book cover update could not be reloaded.")
    return updated


def ensure_active_category(db: Session, category_id: int) -> Category:
    category = db.scalar(
        select(Category).where(Category.category_id == category_id, Category.is_active.is_(True))
    )
    if category is None:
        raise CategoryNotFoundError
    return category


def get_owned_mutable_book(db: Session, current_user: User, book_id: int) -> Book:
    book = get_book(db, book_id)
    if book is None:
        raise BookNotFoundError
    if book.owner_id != current_user.user_id:
        raise ForbiddenBookActionError
    if book.book_status != BookStatus.AVAILABLE:
        raise InvalidBookStateError
    return book
