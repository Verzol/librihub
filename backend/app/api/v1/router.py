from fastapi import APIRouter

from app.modules.admin.router import router as admin_router
from app.modules.books.router import router as books_router
from app.modules.deliveries.router import router as deliveries_router
from app.modules.points.router import router as points_router
from app.modules.reviews.router import router as reviews_router
from app.modules.transactions.router import router as transactions_router
from app.modules.users.router import router as users_router

api_router = APIRouter()
api_router.include_router(users_router)
api_router.include_router(books_router)
api_router.include_router(transactions_router)
api_router.include_router(points_router)
api_router.include_router(deliveries_router)
api_router.include_router(reviews_router)
api_router.include_router(admin_router)
