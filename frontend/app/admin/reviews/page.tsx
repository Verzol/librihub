"use client";

import { useEffect, useState } from "react";
import { reviewsApi } from "@/lib/api";
import { errorMessage } from "@/lib/api/client";
import type { Review } from "@/lib/api/types";
import { useAuth } from "@/lib/auth";
import { Alert, EmptyState, PageHeader } from "@/components/ui";
import { Star } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function AdminReviewsPage() {
  const { token, user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [error, setError] = useState("");

  async function load() {
    if (!token || user?.role !== "ADMIN") return;
    try {
      setReviews(await reviewsApi.list(token));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  useEffect(() => {
    void load();
  }, [token, user?.role]);

  if (user?.role !== "ADMIN") return null;

  return (
    <div className="space-y-6">
      <PageHeader
        hero
        heroIcon={<Star className="h-4 w-4" />}
        title="Quản lý Đánh giá"
        description="Xem các đánh giá mới nhất trên toàn hệ thống LibriHub."
        heroStat={
          <>
            <p className="text-sm font-medium text-blue-200">Tổng đánh giá</p>
            <div className="mt-1 text-4xl font-bold text-white">{reviews.length}</div>
          </>
        }
      />

      {error ? <Alert variant="error">{error}</Alert> : null}

      <div className="grid grid-cols-2 gap-6 max-lg:grid-cols-1">
        {reviews.length === 0 && !error ? (
          <div className="col-span-2">
            <EmptyState title="Chưa có đánh giá nào">
              Hệ thống chưa ghi nhận lượt đánh giá nào từ người dùng.
            </EmptyState>
          </div>
        ) : null}

        {reviews.map((review) => (
          <div key={review.review_id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-500">
                  <Star className="h-5 w-5 fill-current" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">{review.rating_score} / 5 điểm</h3>
                  <p className="text-xs text-slate-500">{formatDate(review.created_at)}</p>
                </div>
              </div>
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                {review.review_type}
              </span>
            </div>

            <div className="flex-1">
              <p className="text-slate-700 italic text-sm">&quot;{review.review_content || "Không có nội dung đánh giá"}&quot;</p>
            </div>

            <div className="mt-6 flex items-center justify-between rounded-xl bg-slate-50 p-3 text-sm border border-slate-100">
              <div>
                <span className="text-slate-500">Người đánh giá:</span> <span className="font-medium text-slate-900">{review.reviewer_full_name || `User #${review.reviewer_user_id}`}</span>
              </div>
              <div>
                <span className="text-slate-500">Người nhận:</span> <span className="font-medium text-slate-900">{review.reviewee_full_name || `User #${review.reviewee_user_id}`}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
