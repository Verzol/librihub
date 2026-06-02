"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  Check,
  Clock3,
  Handshake,
  MessageSquareText,
  RotateCcw,
  Star,
  Trophy,
  X
} from "lucide-react";
import { authApi, booksApi, reviewsApi, transactionsApi } from "@/lib/api";
import { errorMessage } from "@/lib/api/client";
import type { Book, PublicUserSummary, Review, ReviewType, Transaction, TransactionStatus } from "@/lib/api/types";
import { useAuth } from "@/lib/auth";
import { DELIVERY_LOCATIONS, FREE_COURIER_RADIUS_LABEL, getDeliveryLocation } from "@/lib/delivery-locations";
import { cn, formatDate } from "@/lib/utils";
import { Alert, Badge, ConfirmButton, EmptyState } from "./ui";

type TransactionAction =
  | "accept"
  | "reject"
  | "cancel"
  | "confirm"
  | "confirm-receipt"
  | "return"
  | "confirm-return";

type TransactionActionPayload = {
  pickup_address?: string;
  pickup_lat?: number;
  pickup_lng?: number;
};

type FilterKey = "all" | "pending" | "active" | "completed" | "closed";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "pending", label: "Chờ phê duyệt" },
  { key: "active", label: "Đang thực hiện" },
  { key: "completed", label: "Hoàn tất" },
  { key: "closed", label: "Đã hủy" }
];

const activeStatuses = new Set<TransactionStatus>([
  "ACCEPTED",
  "DELIVERING",
  "BORROWING",
  "RETURN_PENDING"
]);

const closedStatuses = new Set<TransactionStatus>(["CANCELLED", "REJECTED"]);

export function TransactionList({
  initial,
  onChanged
}: {
  initial: Transaction[];
  onChanged: () => Promise<void>;
}) {
  const { token, user } = useAuth();
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [books, setBooks] = useState<Record<number, Book>>({});
  const [reviewsByTransaction, setReviewsByTransaction] = useState<Record<number, Review[]>>({});
  const [usersById, setUsersById] = useState<Record<number, PublicUserSummary>>({});

  useEffect(() => {
    if (!token || initial.length === 0) return;
    const missingIds = Array.from(new Set(initial.map((tx) => tx.book_id))).filter(
      (id) => !books[id]
    );
    if (missingIds.length === 0) return;

    let cancelled = false;
    Promise.all(
      missingIds.map((id) => booksApi.detail(token, id).then((book) => [id, book] as const))
    )
      .then((entries) => {
        if (cancelled) return;
        setBooks((current) => ({ ...current, ...Object.fromEntries(entries) }));
      })
      .catch(() => {
        // Transaction data remains usable even if a book detail request is unavailable.
      });

    return () => {
      cancelled = true;
    };
  }, [token, initial, books]);

  useEffect(() => {
    if (!token || initial.length === 0) return;
    const participantIds = Array.from(
      new Set(initial.flatMap((tx) => [tx.owner_id, tx.requester_id]))
    ).filter((id) => !usersById[id]);
    if (participantIds.length === 0) return;

    let cancelled = false;
    Promise.all(
      participantIds.map((id) => authApi.summary(token, id).then((summary) => [id, summary] as const))
    )
      .then((entries) => {
        if (cancelled) return;
        setUsersById((current) => ({ ...current, ...Object.fromEntries(entries) }));
      })
      .catch(() => {
        // Names are a presentation enhancement; IDs remain available as a fallback.
      });

    return () => {
      cancelled = true;
    };
  }, [token, initial, usersById]);

  useEffect(() => {
    if (!token || initial.length === 0) return;
    const bookIds = Array.from(new Set(initial.map((tx) => tx.book_id)));
    let cancelled = false;

    Promise.all(bookIds.map((id) => reviewsApi.forBook(token, id)))
      .then((reviewGroups) => {
        if (cancelled) return;
        const transactionIds = new Set(initial.map((tx) => tx.transaction_id));
        const next: Record<number, Review[]> = {};
        const reviewerIds = new Set<number>();
        reviewGroups.flat().forEach((review) => {
          if (!transactionIds.has(review.transaction_id)) return;
          next[review.transaction_id] = [...(next[review.transaction_id] ?? []), review];
          reviewerIds.add(review.reviewer_user_id);
          reviewerIds.add(review.reviewee_user_id);
        });
        setReviewsByTransaction(next);
        const missingReviewerIds = Array.from(reviewerIds).filter((id) => !usersById[id]);
        if (missingReviewerIds.length > 0) {
          Promise.all(
            missingReviewerIds.map((id) =>
              authApi.summary(token, id).then((summary) => [id, summary] as const)
            )
          )
            .then((entries) => {
              if (cancelled) return;
              setUsersById((current) => ({ ...current, ...Object.fromEntries(entries) }));
            })
            .catch(() => undefined);
        }
      })
      .catch(() => {
        // Reviews are supplementary; transactions should remain readable if this fetch fails.
      });

    return () => {
      cancelled = true;
    };
  }, [token, initial, usersById]);

  const counts = useMemo(() => {
    return {
      all: initial.length,
      pending: initial.filter((tx) => tx.transaction_status === "PENDING").length,
      active: initial.filter((tx) => activeStatuses.has(tx.transaction_status)).length,
      completed: initial.filter((tx) => tx.transaction_status === "COMPLETED").length,
      closed: initial.filter((tx) => closedStatuses.has(tx.transaction_status)).length
    };
  }, [initial]);

  const filtered = useMemo(() => {
    if (filter === "all") return initial;
    if (filter === "pending") return initial.filter((tx) => tx.transaction_status === "PENDING");
    if (filter === "active") return initial.filter((tx) => activeStatuses.has(tx.transaction_status));
    if (filter === "completed") {
      return initial.filter((tx) => tx.transaction_status === "COMPLETED");
    }
    return initial.filter((tx) => closedStatuses.has(tx.transaction_status));
  }, [filter, initial]);

  const pendingAsOwner = filtered.filter(
    (tx) => tx.transaction_status === "PENDING" && user?.user_id === tx.owner_id
  );
  const pendingAsRequester = filtered.filter(
    (tx) => tx.transaction_status === "PENDING" && user?.user_id === tx.requester_id
  );
  const active = filtered.filter((tx) => activeStatuses.has(tx.transaction_status));
  const completed = filtered.filter((tx) => tx.transaction_status === "COMPLETED");
  const closed = filtered.filter((tx) => closedStatuses.has(tx.transaction_status));

  async function run(id: number, action: TransactionAction, payload?: TransactionActionPayload) {
    if (!token) return;
    try {
      setError("");
      await transactionsApi.action(token, id, action, payload);
      await onChanged();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (initial.length === 0) {
    return (
      <EmptyState title="Chưa có giao dịch">
        Các yêu cầu mượn trả và trao đổi sẽ xuất hiện ở đây sau khi bạn gửi hoặc nhận yêu cầu
        từ người dùng khác.
      </EmptyState>
    );
  }

  return (
    <div className="grid grid-cols-[240px_minmax(0,1fr)] gap-5 max-lg:grid-cols-1">
      <aside className="flex flex-col gap-3">
        <StatCard icon={<RotateCcw className="h-4 w-4" />} value={counts.all} label="Tổng giao dịch" />
        <StatCard
          icon={<Clock3 className="h-4 w-4" />}
          value={counts.active + counts.pending}
          label="Đang xử lý"
        />
        <StatCard icon={<Check className="h-4 w-4" />} value={counts.completed} label="Hoàn tất" />
        <StatCard
          icon={<Trophy className="h-4 w-4" />}
          value={estimateEarnedPoints(initial, user?.user_id)}
          label="Điểm đã nhận"
          signed
        />
      </aside>

      <section className="min-w-0">
        <div className="mb-4 flex gap-2 overflow-x-auto border-b border-slate-200">
          {FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              className={cn(
                "relative whitespace-nowrap px-4 py-3 text-sm font-semibold text-slate-500 transition-colors hover:text-blue-700",
                filter === item.key && "text-blue-700"
              )}
            >
              {item.label} ({counts[item.key]})
              {filter === item.key ? (
                <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-blue-700" />
              ) : null}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-5">
          {error ? <Alert variant="error">{error}</Alert> : null}

          <TransactionSection
            title="Chờ phê duyệt: bạn là chủ sách"
            items={pendingAsOwner}
            books={books}
            reviewsByTransaction={reviewsByTransaction}
            usersById={usersById}
            onAction={run}
            onReviewCreated={(transactionId, review) =>
              setReviewsByTransaction((current) => ({
                ...current,
                [transactionId]: [...(current[transactionId] ?? []), review]
              }))
            }
          />
          <TransactionSection
            title="Chờ phản hồi từ chủ sách"
            items={pendingAsRequester}
            books={books}
            reviewsByTransaction={reviewsByTransaction}
            usersById={usersById}
            onAction={run}
            onReviewCreated={(transactionId, review) =>
              setReviewsByTransaction((current) => ({
                ...current,
                [transactionId]: [...(current[transactionId] ?? []), review]
              }))
            }
          />
          <TransactionSection
            title="Đang thực hiện"
            items={active}
            books={books}
            reviewsByTransaction={reviewsByTransaction}
            usersById={usersById}
            onAction={run}
            onReviewCreated={(transactionId, review) =>
              setReviewsByTransaction((current) => ({
                ...current,
                [transactionId]: [...(current[transactionId] ?? []), review]
              }))
            }
          />
          <TransactionSection
            title="Hoàn tất gần đây"
            items={completed}
            books={books}
            reviewsByTransaction={reviewsByTransaction}
            usersById={usersById}
            onAction={run}
            onReviewCreated={(transactionId, review) =>
              setReviewsByTransaction((current) => ({
                ...current,
                [transactionId]: [...(current[transactionId] ?? []), review]
              }))
            }
            compact
          />
          <TransactionSection
            title="Đã hủy hoặc từ chối"
            items={closed}
            books={books}
            reviewsByTransaction={reviewsByTransaction}
            usersById={usersById}
            onAction={run}
            onReviewCreated={(transactionId, review) =>
              setReviewsByTransaction((current) => ({
                ...current,
                [transactionId]: [...(current[transactionId] ?? []), review]
              }))
            }
            compact
          />

          {filtered.length === 0 ? (
            <EmptyState title="Không có giao dịch trong nhóm này">
              Chọn tab khác để xem các giao dịch ở trạng thái còn lại.
            </EmptyState>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function TransactionSection({
  title,
  items,
  books,
  reviewsByTransaction,
  usersById,
  onAction,
  onReviewCreated,
  compact = false
}: {
  title: string;
  items: Transaction[];
  books: Record<number, Book>;
  reviewsByTransaction: Record<number, Review[]>;
  usersById: Record<number, PublicUserSummary>;
  onAction: (id: number, action: TransactionAction, payload?: TransactionActionPayload) => Promise<void>;
  onReviewCreated: (transactionId: number, review: Review) => void;
  compact?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <section>
      <h2 className="mb-3 text-sm font-bold text-slate-900">{title}</h2>
      <div className="flex flex-col gap-3">
        {items.map((tx) => (
          <TransactionCard
            key={tx.transaction_id}
            transaction={tx}
            book={books[tx.book_id]}
            reviews={reviewsByTransaction[tx.transaction_id] ?? []}
            usersById={usersById}
            onAction={onAction}
            onReviewCreated={(review) => onReviewCreated(tx.transaction_id, review)}
            compact={compact}
          />
        ))}
      </div>
    </section>
  );
}

function TransactionCard({
  transaction,
  book,
  reviews,
  usersById,
  onAction,
  onReviewCreated,
  compact
}: {
  transaction: Transaction;
  book?: Book;
  reviews: Review[];
  usersById: Record<number, PublicUserSummary>;
  onAction: (id: number, action: TransactionAction, payload?: TransactionActionPayload) => Promise<void>;
  onReviewCreated: (review: Review) => void;
  compact: boolean;
}) {
  const { token, user } = useAuth();
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewContent, setReviewContent] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [reviewMessage, setReviewMessage] = useState("");
  const [reviewsOpen, setReviewsOpen] = useState(false);
  const isOwner = user?.user_id === transaction.owner_id;
  const isRequester = user?.user_id === transaction.requester_id;
  const pointDelta = estimateTransactionPointDelta(transaction, user?.user_id);
  const ownerName = usersById[transaction.owner_id]?.full_name ?? `Người dùng #${transaction.owner_id}`;
  const requesterName = usersById[transaction.requester_id]?.full_name ?? `Người dùng #${transaction.requester_id}`;
  const counterpartName = isOwner ? requesterName : ownerName;
  const title = book?.title ?? `Sách #${transaction.book_id}`;
  const myReviewTarget = user ? getReviewTarget(transaction, user.user_id) : null;
  const myReview = myReviewTarget
    ? reviews.find(
        (review) =>
          review.reviewer_user_id === user?.user_id &&
          review.reviewee_user_id === myReviewTarget.revieweeUserId &&
          review.review_type === myReviewTarget.reviewType
      )
    : undefined;

  async function submitReview() {
    if (!token || !user) return;
    const target = getReviewTarget(transaction, user.user_id);
    if (!target) return;
    try {
      setReviewError("");
      setReviewMessage("");
      const review = await reviewsApi.create(token, {
        transaction_id: transaction.transaction_id,
        reviewee_user_id: target.revieweeUserId,
        rating_score: reviewRating,
        review_content: reviewContent.trim() || null,
        review_type: target.reviewType
      });
      onReviewCreated(review);
      setReviewOpen(false);
      setReviewsOpen(true);
      setReviewContent("");
      setReviewRating(5);
      setReviewMessage("Đã gửi đánh giá cho giao dịch này.");
    } catch (err) {
      setReviewError(errorMessage(err));
    }
  }

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_26px_rgba(15,23,42,0.06)]">
      <div className="grid grid-cols-[56px_minmax(0,1fr)_auto] gap-4 max-md:grid-cols-[48px_minmax(0,1fr)]">
        <BookThumb book={book} />

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-bold text-slate-950">{title}</h3>
            <Badge value={transaction.transaction_status} />
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Với {counterpartName} · {transaction.transaction_type === "BORROW_RETURN" ? "Mượn trả" : "Trao đổi"} ·{" "}
            {transaction.delivery_method === "DIRECT_CONTACT"
              ? "Tự liên hệ"
              : "Dịch vụ giao sách"}{" "}
            · yêu cầu {formatDate(transaction.requested_at)}
          </p>

          {!compact ? <ProgressLine transaction={transaction} /> : null}

          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <PersonPill label="Chủ sách" name={ownerName} active={isOwner} />
            <PersonPill label="Người yêu cầu" name={requesterName} active={isRequester} />
            {transaction.borrow_duration_days ? (
              <InfoPill icon={<CalendarClock className="h-3.5 w-3.5" />}>
                Mượn {transaction.borrow_duration_days} ngày · hạn trả{" "}
                {formatDate(transaction.expected_return_at)}
              </InfoPill>
            ) : null}
            {transaction.return_requested_at ? (
              <InfoPill icon={<RotateCcw className="h-3.5 w-3.5" />}>
                Đã báo trả {formatDate(transaction.return_requested_at)}
              </InfoPill>
            ) : null}
            {transaction.late_days > 0 ? (
              <InfoPill danger>
                Trễ {transaction.late_days} ngày · phí {transaction.late_fee_points} điểm
              </InfoPill>
            ) : null}
          </div>
        </div>

        <div className="flex min-w-36 flex-col items-end gap-2 max-md:col-span-2 max-md:items-start">
          <PointDelta value={pointDelta} completed={transaction.transaction_status === "COMPLETED"} />
          <ActionButtons
            transaction={transaction}
            isOwner={isOwner}
            isRequester={isRequester}
            onAction={onAction}
          />
        </div>
      </div>
      {reviewMessage ? <div className="mt-3"><Alert variant="success">{reviewMessage}</Alert></div> : null}
      {transaction.transaction_status === "COMPLETED" && (isOwner || isRequester) ? (
        <div className="mt-4 border-t border-slate-200 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            {myReview ? (
              <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-700">
                <Check className="h-3.5 w-3.5" />
                Bạn đã đánh giá
              </span>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setReviewOpen(true);
                  setReviewError("");
                  setReviewMessage("");
                }}
                className="inline-flex h-8 items-center justify-center rounded-full border border-amber-200 bg-amber-50 px-3 text-xs font-bold text-amber-700 transition-colors hover:bg-amber-100"
              >
                Đánh giá giao dịch
              </button>
            )}
            {reviews.length > 0 ? (
              <button
                type="button"
                onClick={() => setReviewsOpen((value) => !value)}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50"
              >
                <MessageSquareText className="h-3.5 w-3.5" />
                {reviewsOpen ? "Ẩn đánh giá" : `Xem đánh giá (${reviews.length})`}
              </button>
            ) : null}
          </div>

          {reviewOpen && !myReview ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3">
              <div className="flex items-center justify-between gap-3 max-sm:flex-col max-sm:items-start">
                <div>
                  <h4 className="text-sm font-bold text-slate-950">Đánh giá sau giao dịch</h4>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    {isOwner
                      ? `Bạn đang đánh giá ${requesterName}.`
                      : `Bạn đang đánh giá ${ownerName}.`}
                  </p>
                </div>
                <StarRatingInput value={reviewRating} onChange={setReviewRating} />
              </div>
              <textarea
                value={reviewContent}
                onChange={(event) => setReviewContent(event.target.value)}
                className="mt-3 min-h-24 w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-amber-400 focus:ring-4 focus:ring-amber-500/10"
                placeholder="Ghi vài dòng về trải nghiệm giao dịch, giao nhận, giữ sách hoặc mức độ đúng hẹn..."
                maxLength={5000}
              />
              {reviewError ? <p className="mt-2 text-xs font-semibold text-red-600">{reviewError}</p> : null}
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setReviewOpen(false);
                    setReviewError("");
                  }}
                  className="inline-flex h-8 items-center justify-center rounded-full border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Để sau
                </button>
                <ConfirmButton
                  size="sm"
                  confirm="Bạn có muốn gửi đánh giá này không?"
                  onConfirm={submitReview}
                >
                  Gửi đánh giá
                </ConfirmButton>
              </div>
            </div>
          ) : null}

          {reviewsOpen ? <ReviewList reviews={reviews} currentUserId={user?.user_id} usersById={usersById} /> : null}
        </div>
      ) : null}
    </article>
  );
}

function ActionButtons({
  transaction,
  isOwner,
  isRequester,
  onAction
}: {
  transaction: Transaction;
  isOwner: boolean;
  isRequester: boolean;
  onAction: (id: number, action: TransactionAction, payload?: TransactionActionPayload) => Promise<void>;
}) {
  const id = transaction.transaction_id;
  const [pickupLocationId, setPickupLocationId] = useState(DELIVERY_LOCATIONS[0].id);
  const canCancel =
    (isOwner || isRequester) &&
    (transaction.transaction_status === "PENDING" || transaction.transaction_status === "ACCEPTED") &&
    !(isOwner && transaction.transaction_status === "PENDING");
  const alreadyConfirmed =
    (isOwner && transaction.owner_confirmed) || (isRequester && transaction.requester_confirmed);
  const canConfirmExchange =
    transaction.transaction_type === "PERMANENT_EXCHANGE" &&
    (transaction.transaction_status === "ACCEPTED" || transaction.transaction_status === "DELIVERING") &&
    !alreadyConfirmed;
  const canConfirmBorrowReceipt =
    transaction.transaction_type === "BORROW_RETURN" &&
    isRequester &&
    (transaction.transaction_status === "ACCEPTED" ||
      (transaction.transaction_status === "DELIVERING" && transaction.courier_confirmed));
  const pickupLocation = getDeliveryLocation(pickupLocationId);

  return (
    <div className="flex max-w-80 flex-col items-end gap-2 max-md:items-start">
      {isOwner && transaction.transaction_status === "PENDING" ? (
        <div className="flex flex-col items-end gap-2 max-md:items-start">
          {transaction.delivery_method === "FREE_COURIER" ? (
            <div className="w-72 rounded-2xl border border-blue-100 bg-blue-50/70 p-3 text-left max-sm:w-full">
              <label className="text-[11px] font-bold uppercase text-blue-700">Điểm lấy sách</label>
              <select
                value={pickupLocationId}
                onChange={(event) => setPickupLocationId(event.target.value)}
                className="mt-1 h-9 w-full rounded-xl border border-blue-200 bg-white px-3 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              >
                {DELIVERY_LOCATIONS.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] leading-4 text-slate-500">{FREE_COURIER_RADIUS_LABEL}</p>
            </div>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2 max-md:justify-start">
            <ConfirmButton
              size="sm"
              confirm="Chấp nhận yêu cầu giao dịch này?"
              onConfirm={() =>
                onAction(
                  id,
                  "accept",
                  transaction.delivery_method === "FREE_COURIER"
                    ? {
                        pickup_address: pickupLocation.address,
                        pickup_lat: pickupLocation.lat,
                        pickup_lng: pickupLocation.lng
                      }
                    : undefined
                )
              }
            >
              <Check className="h-3.5 w-3.5" />
              Chấp nhận
            </ConfirmButton>
            <ConfirmButton size="sm" variant="danger" confirm="Từ chối yêu cầu giao dịch này?" onConfirm={() => onAction(id, "reject")}>
              <X className="h-3.5 w-3.5" />
              Từ chối
            </ConfirmButton>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2 max-md:justify-start">
        {canCancel ? (
          <ConfirmButton size="sm" variant="secondary" confirm="Hủy giao dịch này?" onConfirm={() => onAction(id, "cancel")}>
            Hủy
          </ConfirmButton>
        ) : null}

        {canConfirmExchange ? (
          <ConfirmButton size="sm" confirm="Xác nhận bạn đã hoàn tất phần giao dịch của mình?" onConfirm={() => onAction(id, "confirm")}>
            <Handshake className="h-3.5 w-3.5" />
            Xác nhận
          </ConfirmButton>
        ) : null}

        {canConfirmBorrowReceipt ? (
          <ConfirmButton size="sm" confirm="Xác nhận bạn đã nhận sách và bắt đầu tính hạn trả?" onConfirm={() => onAction(id, "confirm-receipt")}>
            Tôi đã nhận sách
          </ConfirmButton>
        ) : null}

        {transaction.transaction_type === "BORROW_RETURN" && isRequester && transaction.transaction_status === "BORROWING" ? (
          <ConfirmButton size="sm" confirm="Báo với chủ sách rằng bạn đang trả sách?" onConfirm={() => onAction(id, "return")}>
            Trả sách
            <ArrowRight className="h-3.5 w-3.5" />
          </ConfirmButton>
        ) : null}

        {transaction.transaction_type === "BORROW_RETURN" && isOwner && transaction.transaction_status === "RETURN_PENDING" ? (
          <ConfirmButton size="sm" confirm="Xác nhận đã nhận lại sách? Điểm sẽ được quyết toán." onConfirm={() => onAction(id, "confirm-return")}>
            Xác nhận đã nhận lại
          </ConfirmButton>
        ) : null}
      </div>
    </div>
  );
}

function ProgressLine({ transaction }: { transaction: Transaction }) {
  const steps = getSteps(transaction);
  return (
    <div className="mt-4 grid gap-2">
      <div className="grid" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        {steps.map((step, index) => (
          <div key={step.label} className="flex items-center">
            <span
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                step.done
                  ? "bg-emerald-500 text-white"
                  : step.current
                    ? "bg-blue-700 text-white"
                    : "bg-slate-200 text-slate-500"
              )}
            >
              {step.done ? <Check className="h-3 w-3" /> : index + 1}
            </span>
            {index < steps.length - 1 ? (
              <span className={cn("h-0.5 flex-1", step.done ? "bg-emerald-400" : "bg-slate-200")} />
            ) : null}
          </div>
        ))}
      </div>
      <div className="grid" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        {steps.map((step) => (
          <span
            key={step.label}
            className={cn(
              "truncate text-[11px] font-semibold",
              step.current ? "text-blue-700" : step.done ? "text-emerald-600" : "text-slate-400"
            )}
          >
            {step.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function getSteps(transaction: Transaction) {
  const base =
    transaction.transaction_type === "BORROW_RETURN"
      ? ["Yêu cầu", "Chấp nhận", "Đang mượn", "Trả sách", "Hoàn tất"]
      : ["Yêu cầu", "Chấp nhận", "Chốt giao dịch", "Hoàn tất"];
  const currentIndexByStatus: Record<TransactionStatus, number> = {
    PENDING: 0,
    ACCEPTED: 1,
    DELIVERING: 1,
    BORROWING: 2,
    RETURN_PENDING: 3,
    COMPLETED: base.length - 1,
    CANCELLED: 0,
    REJECTED: 0
  };
  const current = currentIndexByStatus[transaction.transaction_status] ?? 0;
  return base.map((label, index) => ({
    label,
    done: transaction.transaction_status === "COMPLETED" || index < current,
    current: transaction.transaction_status !== "COMPLETED" && index === current
  }));
}

function BookThumb({ book }: { book?: Book }) {
  return (
    <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-blue-50 text-blue-700">
      {book?.cover_image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={book.cover_image_url} alt={book.title} className="h-full w-full object-cover" />
      ) : (
        <BookOpen className="h-5 w-5" />
      )}
    </div>
  );
}

function StatCard({
  icon,
  value,
  label,
  signed = false
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  signed?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_26px_rgba(15,23,42,0.05)]">
      <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-700">{icon}</div>
      <div className="text-2xl font-bold tabular-nums text-slate-950">
        {signed && value > 0 ? "+" : ""}
        {value}
      </div>
      <p className="text-xs font-medium text-slate-500">{label}</p>
    </div>
  );
}

function InfoPill({
  icon,
  children,
  danger = false
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold",
        danger ? "border-red-200 bg-red-50 text-red-700" : "border-slate-200 bg-slate-50 text-slate-600"
      )}
    >
      {icon}
      {children}
    </span>
  );
}

function PersonPill({ label, name, active }: { label: string; name: string; active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold",
        active ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-slate-50 text-slate-600"
      )}
    >
      <span className="text-slate-400">{label}:</span>
      {active ? "Bạn" : name}
    </span>
  );
}

function PointDelta({ value, completed }: { value: number; completed: boolean }) {
  const positive = value > 0;
  if (value === 0) return null;
  return (
    <div className={cn("text-right text-sm font-bold", positive ? "text-emerald-600" : "text-blue-700")}>
      {positive ? "+" : ""}
      {value} điểm
      <div className="text-[11px] font-medium text-slate-400">
        {completed ? "đã quyết toán" : "khi hoàn tất"}
      </div>
    </div>
  );
}

function StarRatingInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-amber-200 bg-white px-2 py-1" aria-label="Điểm đánh giá">
      {[1, 2, 3, 4, 5].map((score) => (
        <button
          key={score}
          type="button"
          onClick={() => onChange(score)}
          className="p-0.5 text-amber-400 transition-transform hover:scale-110"
          aria-label={`${score} sao`}
        >
          <Star className={cn("h-5 w-5", score <= value ? "fill-amber-400" : "fill-transparent text-slate-300")} />
        </button>
      ))}
      <span className="ml-1 min-w-8 text-xs font-bold text-slate-700">{value}/5</span>
    </div>
  );
}

function StarRatingDisplay({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-400" aria-label={`${value}/5 sao`}>
      {[1, 2, 3, 4, 5].map((score) => (
        <Star key={score} className={cn("h-3.5 w-3.5", score <= value ? "fill-amber-400" : "fill-transparent text-slate-300")} />
      ))}
    </span>
  );
}

function ReviewList({
  reviews,
  currentUserId,
  usersById
}: {
  reviews: Review[];
  currentUserId: number | undefined;
  usersById: Record<number, PublicUserSummary>;
}) {
  if (reviews.length === 0) return null;
  return (
    <div className="mt-3 grid gap-2">
      {reviews.map((review) => (
        <div key={review.review_id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <StarRatingDisplay value={review.rating_score} />
              <Badge value={review.review_type} />
            </div>
            <span className="text-xs font-semibold text-slate-400">
              {review.reviewer_user_id === currentUserId
                ? "Bạn đã gửi"
                : usersById[review.reviewer_user_id]?.full_name ?? `Người dùng #${review.reviewer_user_id}`}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-700">{review.review_content || "Không có nội dung đánh giá."}</p>
        </div>
      ))}
    </div>
  );
}

function estimateEarnedPoints(transactions: Transaction[], userId: number | undefined) {
  if (!userId) return 0;
  return transactions
    .filter((tx) => tx.transaction_status === "COMPLETED")
    .reduce((sum, tx) => {
      const delta = estimateTransactionPointDelta(tx, userId);
      return delta > 0 ? sum + delta : sum;
    }, 0);
}

function estimateTransactionPointDelta(transaction: Transaction, userId: number | undefined) {
  if (!userId) return 0;
  const isOwner = userId === transaction.owner_id;
  const isRequester = userId === transaction.requester_id;
  if (transaction.transaction_type === "PERMANENT_EXCHANGE") {
    if (isOwner) return 10;
    if (isRequester) return -10;
  }
  if (transaction.transaction_type === "BORROW_RETURN") {
    if (isOwner) return 5;
    if (isRequester) return -5 - (transaction.late_fee_points || 0);
  }
  return 0;
}

function getReviewTarget(transaction: Transaction, userId: number): { revieweeUserId: number; reviewType: ReviewType } | null {
  if (userId === transaction.owner_id) {
    return { revieweeUserId: transaction.requester_id, reviewType: "REQUESTER_REVIEW" };
  }
  if (userId === transaction.requester_id) {
    return { revieweeUserId: transaction.owner_id, reviewType: "OWNER_REVIEW" };
  }
  return null;
}
