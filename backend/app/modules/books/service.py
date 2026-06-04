from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.models.enums import AccountStatus, ActivityType, BookStatus, CourierStatus, TransactionStatus, UserRole
from app.models.erd import ActivityLog, Book, Category, CourierProfile, Transaction, User
from app.modules.books.schemas import (
    BookCreateRequest,
    BookUpdateRequest,
    CategoryCreateRequest,
    CategoryUpdateRequest,
)


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


def list_category_summaries(db: Session) -> list[tuple[Category, int]]:
    statement = (
        select(Category, func.count(Book.book_id))
        .outerjoin(
            Book,
            and_(Book.category_id == Category.category_id, Book.book_status != BookStatus.REMOVED),
        )
        .where(Category.is_active.is_(True))
        .group_by(Category.category_id)
        .order_by(Category.category_name)
    )
    return [(category, int(book_count)) for category, book_count in db.execute(statement).all()]


def get_community_leaderboard(db: Session) -> dict[str, list[object]]:
    completed_count = func.count(Transaction.transaction_id)
    top_books_statement = (
        select(Book, Category.category_name, completed_count.label("borrow_count"))
        .join(Category, Category.category_id == Book.category_id)
        .outerjoin(
            Transaction,
            and_(
                Transaction.book_id == Book.book_id,
                Transaction.transaction_status == TransactionStatus.COMPLETED,
            ),
        )
        .where(Book.book_status != BookStatus.REMOVED)
        .group_by(Book.book_id, Category.category_name)
        .order_by(desc("borrow_count"), Book.created_at.desc())
        .limit(5)
    )

    top_couriers_statement = (
        select(CourierProfile, User.full_name)
        .join(User, User.user_id == CourierProfile.user_id)
        .where(CourierProfile.courier_status.in_([CourierStatus.AVAILABLE, CourierStatus.BUSY]))
        .where(User.role != UserRole.ADMIN)
        .order_by(CourierProfile.successful_delivery_count.desc(), CourierProfile.registered_at.asc())
        .limit(5)
    )

    top_users_statement = (
        select(User)
        .where(User.account_status == AccountStatus.ACTIVE)
        .where(User.role != UserRole.ADMIN)
        .order_by(User.current_points.desc(), User.created_at.asc())
        .limit(5)
    )

    return {
        "top_books": list(db.execute(top_books_statement).all()),
        "top_couriers": list(db.execute(top_couriers_statement).all()),
        "top_point_users": list(db.scalars(top_users_statement)),
    }


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


def update_category(
    db: Session,
    current_user: User,
    category_id: int,
    payload: CategoryUpdateRequest,
) -> Category:
    if current_user.role != UserRole.ADMIN:
        raise AdminRequiredError
    category = db.scalar(select(Category).where(Category.category_id == category_id).with_for_update())
    if category is None:
        raise CategoryNotFoundError

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(category, field, value)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise DuplicateCategoryError from error
    db.refresh(category)
    return category


def set_category_active(
    db: Session,
    current_user: User,
    category_id: int,
    *,
    is_active: bool,
) -> Category:
    if current_user.role != UserRole.ADMIN:
        raise AdminRequiredError
    category = db.scalar(select(Category).where(Category.category_id == category_id).with_for_update())
    if category is None:
        raise CategoryNotFoundError
    category.is_active = is_active
    db.commit()
    db.refresh(category)
    return category


def list_books(
    db: Session,
    current_user: User | None = None,
    *,
    mine: bool = False,
    query: str | None = None,
    category_id: int | None = None,
    exchange_mode: str | None = None,
) -> list[Book]:
    statement = (
        select(Book)
        .options(selectinload(Book.category), selectinload(Book.owner))
        .order_by(Book.created_at.desc())
    )

    if mine:
        if not current_user:
            raise ValueError("mine=True requires current_user")
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


def list_user_books(db: Session, user_id: int) -> list[Book]:
    statement = (
        select(Book)
        .options(selectinload(Book.category), selectinload(Book.owner))
        .where(Book.owner_id == user_id, Book.book_status != BookStatus.REMOVED)
        .order_by(Book.created_at.desc())
    )
    return list(db.scalars(statement))


def get_book(db: Session, book_id: int) -> Book | None:
    statement = (
        select(Book)
        .options(selectinload(Book.category), selectinload(Book.owner))
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
        book_description=payload.book_description,
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


def publish_book(db: Session, current_user: User, book_id: int) -> Book:
    book = db.scalar(select(Book).where(Book.book_id == book_id).with_for_update())
    if book is None or book.book_status == BookStatus.REMOVED:
        raise BookNotFoundError
    if book.owner_id != current_user.user_id:
        raise ForbiddenBookActionError
    if book.book_status != BookStatus.UNLISTED:
        raise InvalidBookStateError

    book.book_status = BookStatus.AVAILABLE
    db.add(
        ActivityLog(
            user_id=current_user.user_id,
            activity_type=ActivityType.UPDATE_BOOK,
            activity_description=f"Published book #{book.book_id}: {book.title}.",
        )
    )
    db.commit()
    db.refresh(book)
    return book


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
