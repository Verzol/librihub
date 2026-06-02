"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { reviewsApi, transactionsApi } from "@/lib/api";
import { errorMessage } from "@/lib/api/client";
import type { Review, ReviewType, Transaction } from "@/lib/api/types";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { Alert, Badge, Card, ConfirmButton, EmptyState, Field, PageHeader, Select, TextArea, TextInput } from "@/components/ui";

export default function ReviewsPage() {
  const { token, user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [error, setError] = useState("");

  async function load() {
    if (!token || !user) return;
    try {
      const [txData, reviewData] = await Promise.all([transactionsApi.list(token), reviewsApi.forUser(token, user.user_id)]);
      setTransactions(txData.filter((tx) => tx.transaction_status === "COMPLETED"));
      setReviews(reviewData);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  useEffect(() => {
    void load();
  }, [token, user?.user_id]);

  const reviewable = useMemo(() => transactions.filter((tx) => tx.owner_id === user?.user_id || tx.requester_id === user?.user_id), [transactions, user]);

  async function submit(form: HTMLFormElement) {
    if (!token || !user) return;
    const data = new FormData(form);
    const transactionId = Number(data.get("transaction_id"));
    const tx = transactions.find((item) => item.transaction_id === transactionId);
    if (!tx) return;
    const reviewee = tx.owner_id === user.user_id ? tx.requester_id : tx.owner_id;
    const reviewType: ReviewType = tx.owner_id === user.user_id ? "REQUESTER_REVIEW" : "OWNER_REVIEW";
    try {
      setError("");
      await reviewsApi.create(token, {
        transaction_id: transactionId,
        reviewee_user_id: reviewee,
        rating_score: Number(data.get("rating_score")),
        review_content: String(data.get("review_content") ?? "") || null,
        review_type: reviewType
      });
      form.reset();
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <>
      <PageHeader title="Đánh giá cộng đồng" description="Đánh giá người tham gia sau khi giao dịch hoàn tất." />
      {error ? <Alert variant="error">{error}</Alert> : null}
      <div className="grid grid-cols-[1fr_1fr] gap-4 max-lg:grid-cols-1">
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">Tạo đánh giá</h2>
          <form id="review-form" className="mt-4 flex flex-col gap-3" onSubmit={(event: FormEvent) => event.preventDefault()}>
            <Field label="Giao dịch">
              <Select name="transaction_id" required>
                <option value="">Chọn giao dịch</option>
                {reviewable.map((tx) => (
                  <option key={tx.transaction_id} value={tx.transaction_id}>
                    #{tx.transaction_id} - sach #{tx.book_id}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Điểm">
              <TextInput name="rating_score" type="number" min={1} max={5} defaultValue={5} required />
            </Field>
            <Field label="Nội dung">
              <TextArea name="review_content" />
            </Field>
            <ConfirmButton
              confirm="Bạn có muốn gửi đánh giá này không?"
              onConfirm={() => {
                const form = document.getElementById("review-form") as HTMLFormElement | null;
                if (form?.reportValidity()) void submit(form);
              }}
            >
              Gửi đánh giá
            </ConfirmButton>
          </form>
        </Card>
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">Đánh giá đã nhận</h2>
          <div className="mt-4 flex flex-col gap-3">
            {reviews.length === 0 ? <EmptyState title="Chưa có đánh giá" /> : null}
            {reviews.map((review) => (
              <div key={review.review_id} className="rounded-2xl border border-slate-200 bg-white p-3 text-sm shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-amber-500">{review.rating_score}/5</span>
                  <Badge value={review.review_type} />
                </div>
                <p className="mt-2 text-slate-700">{review.review_content || "Không có nội dung"}</p>
                <p className="mt-1 text-xs text-slate-500">{formatDate(review.created_at)}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
