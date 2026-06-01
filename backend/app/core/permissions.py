from typing import NoReturn

from fastapi import HTTPException, status


def deny_for_unimplemented_permissions() -> NoReturn:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Permission checks will be implemented with the auth and user modules.",
    )
