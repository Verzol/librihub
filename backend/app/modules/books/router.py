from fastapi import APIRouter, File, HTTPException, Query, UploadFile, status

from app.core.dependencies import CurrentUser, DbSession
from app.models.enums import ExchangeMode
from app.modules.books.schemas import (
    BookCoverUploadResponse,
    BookCreateRequest,
    BookResponse,
    BookUpdateRequest,
    CategoryCreateRequest,
    CategoryResponse,
)
from app.modules.books.service import (
    AdminRequiredError,
    BookNotFoundError,
    CategoryNotFoundError,
    DuplicateCategoryError,
    ForbiddenBookActionError,
    InvalidBookStateError,
    create_book,
    create_category,
    get_book,
    list_books,
    list_categories,
    set_book_cover,
    soft_delete_book,
    update_book,
)
from app.services.storage import StorageError, upload_book_cover

router = APIRouter()


@router.get("/categories", response_model=list[CategoryResponse], tags=["books"])
def read_categories(db: DbSession) -> list[CategoryResponse]:
    return [CategoryResponse.model_validate(category) for category in list_categories(db)]


@router.post(
    "/admin/categories",
    response_model=CategoryResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["admin", "books"],
)
def add_category(
    payload: CategoryCreateRequest,
    db: DbSession,
    current_user: CurrentUser,
) -> CategoryResponse:
    try:
        category = create_category(db, current_user, payload)
    except AdminRequiredError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required.") from None
    except DuplicateCategoryError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Category name already exists.",
        ) from None
    return CategoryResponse.model_validate(category)


@router.get("/books", response_model=list[BookResponse], tags=["books"])
def read_books(
    db: DbSession,
    current_user: CurrentUser,
    mine: bool = False,
    q: str | None = Query(default=None, min_length=1, max_length=255),
    category_id: int | None = None,
    exchange_mode: ExchangeMode | None = None,
) -> list[BookResponse]:
    books = list_books(
        db,
        current_user,
        mine=mine,
        query=q,
        category_id=category_id,
        exchange_mode=exchange_mode.value if exchange_mode else None,
    )
    return [BookResponse.model_validate(book) for book in books]


@router.post(
    "/books",
    response_model=BookResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["books"],
)
def add_book(payload: BookCreateRequest, db: DbSession, current_user: CurrentUser) -> BookResponse:
    try:
        book = create_book(db, current_user, payload)
    except CategoryNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Active category not found.",
        ) from None
    return BookResponse.model_validate(book)


@router.get("/books/{book_id}", response_model=BookResponse, tags=["books"])
def read_book(book_id: int, db: DbSession, current_user: CurrentUser) -> BookResponse:
    book = get_book(db, book_id)
    if book is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found.")
    return BookResponse.model_validate(book)


@router.patch("/books/{book_id}", response_model=BookResponse, tags=["books"])
def edit_book(
    book_id: int,
    payload: BookUpdateRequest,
    db: DbSession,
    current_user: CurrentUser,
) -> BookResponse:
    try:
        book = update_book(db, current_user, book_id, payload)
    except CategoryNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Active category not found.",
        ) from None
    except BookNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found.") from None
    except ForbiddenBookActionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the owner can update this book.",
        ) from None
    except InvalidBookStateError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only available books can be updated.",
        ) from None
    return BookResponse.model_validate(book)


@router.delete("/books/{book_id}", response_model=BookResponse, tags=["books"])
def remove_book(book_id: int, db: DbSession, current_user: CurrentUser) -> BookResponse:
    try:
        book = soft_delete_book(db, current_user, book_id)
    except BookNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found.") from None
    except ForbiddenBookActionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the owner can remove this book.",
        ) from None
    except InvalidBookStateError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only available books can be removed.",
        ) from None
    return BookResponse.model_validate(book)


@router.post("/books/{book_id}/cover", response_model=BookCoverUploadResponse, tags=["books"])
async def upload_cover(
    book_id: int,
    db: DbSession,
    current_user: CurrentUser,
    file: UploadFile = File(...),
) -> BookCoverUploadResponse:
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cover upload must be an image file.",
        )

    try:
        cover_url = upload_book_cover(
            await file.read(),
            file.content_type,
            file.filename or "book-cover",
        )
        book = set_book_cover(db, current_user, book_id, cover_url)
    except StorageError as error:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(error)) from error
    except BookNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found.") from None
    except ForbiddenBookActionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the owner can upload a cover for this book.",
        ) from None
    except InvalidBookStateError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only available books can receive a new cover.",
        ) from None

    return BookCoverUploadResponse(
        book=BookResponse.model_validate(book),
        cover_image_url=cover_url,
    )
