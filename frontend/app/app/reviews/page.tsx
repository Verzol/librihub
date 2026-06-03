"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { BadgeCheck, BookOpen, Check, ChevronRight, Clock, Flame, MessageSquareText, Send, ShieldCheck, Sparkles, Star, Trophy } from "lucide-react";
import { booksApi, reviewsApi, transactionsApi } from "@/lib/api";
import { errorMessage } from "@/lib/api/client";
import type { CommunityLeaderboard, Review, ReviewType, Transaction } from "@/lib/api/types";
import { useAuth } from "@/lib/auth";
import { cn, formatDate } from "@/lib/utils";
import { Alert, Button, Card, EmptyState, Field, PageHeader, Select, TextArea } from "@/components/ui";

const quickTags = ["Đúng hẹn", "Thân thiện", "Giữ sách tốt", "Phản hồi nhanh"];

export default function ReviewsPage() {
  const { token, user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [leaderboard, setLeaderboard] = useState<CommunityLeaderboard | null>(null);
  const [rating, setRating] = useState(5);
  const [reviewContent, setReviewContent] = useState("");
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [showAllReviewable, setShowAllReviewable] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      setError("");
      const leaderboardData = await booksApi.leaderboard();
      setLeaderboard(leaderboardData);

      if (!token || !user) return;
      const [txData, reviewData] = await Promise.all([
        transactionsApi.list(token),
        reviewsApi.list(token)
      ]);
      setTransactions(txData.filter((tx) => tx.transaction_status === "COMPLETED"));
      setReviews(reviewData);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  useEffect(() => {
    void load();
  }, [token, user?.user_id]);

  const reviewable = useMemo(
    () => transactions.filter((tx) => tx.owner_id === user?.user_id || tx.requester_id === user?.user_id),
    [transactions, user]
  );

  const averageRating = reviews.length
    ? reviews.reduce((total, review) => total + review.rating_score, 0) / reviews.length
    : null;
  const completedCount = transactions.length;
  const trustPoints = user?.current_points ?? null;
  const onTimeTransactions = transactions.filter((tx) => tx.late_days === 0).length;
  const onTimeRate = completedCount ? Math.round((onTimeTransactions / completedCount) * 100) : null;
  const visibleReviews = (showAllReviews ? reviews : reviews.slice(0, 4)).map((review) => ({
    name: review.reviewer_full_name ?? "Người đánh giá",
    book: review.book_title
      ? `${review.book_title}${review.book_author ? ` - ${review.book_author}` : ""}`
      : transactionLabel(transactions.find((tx) => tx.transaction_id === review.transaction_id) ?? null, user?.user_id),
    date: formatDate(review.created_at),
    content: review.review_content || "Không có nội dung đánh giá.",
    rating: review.rating_score
  }));
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
        rating_score: rating,
        review_content: reviewContent || null,
        review_type: reviewType
      });
      form.reset();
      setRating(5);
      setReviewContent("");
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <>
      <PageHeader
        title="Cộng đồng"
        description="Nơi bạn đánh giá lẫn nhau, xây dựng uy tín và chia sẻ về sách."
      />
      {error ? <Alert variant="error">{error}</Alert> : null}

      <section className="grid grid-cols-4 gap-4 max-xl:grid-cols-2 max-md:grid-cols-1">
        <MetricCard
          title="Điểm uy tín"
          value={trustPoints === null ? "-" : `${trustPoints} điểm`}
          detail={user ? "Lấy từ USER.current_points" : "Đăng nhập để xem điểm của bạn"}
          icon={ShieldCheck}
          tone="blue"
        />
        <MetricCard
          title="Đánh giá trung bình"
          value={averageRating === null ? "-" : `${averageRating.toFixed(1)}/5`}
          detail={averageRating === null ? "Chưa có đánh giá từ database" : <Stars value={Math.round(averageRating)} />}
          icon={Star}
          tone="amber"
        />
        <MetricCard
          title="Giao dịch thành công"
          value={String(completedCount)}
          detail="Tổng số giao dịch"
          icon={BadgeCheck}
          tone="emerald"
        />
        <MetricCard
          title="Tỉ lệ đúng hẹn"
          value={onTimeRate === null ? "-" : `${onTimeRate}%`}
          detail={completedCount ? `${onTimeTransactions}/${completedCount} giao dịch không trễ hạn` : "Chưa có giao dịch hoàn tất"}
          icon={Clock}
          tone="violet"
        />
      </section>

      <section className="mt-4 grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-4 max-xl:grid-cols-1">
        <Card>
          <div className="flex items-center gap-2">
            <MessageSquareText className="h-5 w-5 text-blue-700" />
            <h2 className="text-base font-bold text-slate-900">Tạo đánh giá</h2>
          </div>
          <form
            id="community-review-form"
            className="mt-4 flex flex-col gap-3"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              void submit(event.currentTarget);
            }}
          >
            <Field label="Chọn giao dịch">
              <Select name="transaction_id" required disabled={!token || reviewable.length === 0}>
                <option value="">
                  {token ? "Chọn giao dịch đã hoàn tất" : "Đăng nhập để chọn giao dịch"}
                </option>
                {reviewable.map((tx) => (
                  <option key={tx.transaction_id} value={tx.transaction_id}>
                    {transactionLabel(tx, user?.user_id)}
                  </option>
                ))}
              </Select>
            </Field>
            <div>
              <p className="text-xs font-semibold text-slate-600">Đánh giá của bạn</p>
              <div className="mt-2 flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((item) => (
                  <button
                    key={item}
                    type="button"
                    aria-label={`${item} sao`}
                    onClick={() => setRating(item)}
                    className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-amber-50"
                  >
                    <Star
                      className={cn(
                        "h-6 w-6",
                        item <= rating ? "fill-amber-400 text-amber-400" : "text-slate-300"
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>
            <Field label="Nội dung">
              <TextArea
                name="review_content"
                placeholder="Chia sẻ trải nghiệm của bạn về giao dịch này..."
                value={reviewContent}
                onChange={(event) => setReviewContent(event.target.value)}
                disabled={!token || reviewable.length === 0}
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              {quickTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setReviewContent((current) => appendQuickTag(current, tag))}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                >
                  <Check className="h-3.5 w-3.5" />
                  {tag}
                </button>
              ))}
            </div>
            <Button disabled={!token || reviewable.length === 0}>
              <Send className="h-4 w-4" />
              Gửi đánh giá
            </Button>
          </form>
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-slate-900">Đánh giá cộng đồng</h2>
            {reviews.length > 4 ? (
              <button
                className="text-xs font-bold text-blue-700 transition-colors hover:text-blue-900"
                type="button"
                onClick={() => setShowAllReviews((current) => !current)}
              >
                {showAllReviews ? "Thu gọn" : "Xem tất cả"}
              </button>
            ) : null}
          </div>
          <div>
            <div className="max-h-[520px] overflow-y-auto divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
              {visibleReviews.length === 0 ? (
                <div className="p-4">
                  <EmptyState title="Chưa có đánh giá từ database">
                    Khi thành viên tạo đánh giá sau giao dịch hoàn tất, đánh giá sẽ xuất hiện tại đây.
                  </EmptyState>
                </div>
              ) : (
                visibleReviews.map((review, index) => (
                  <div key={`${review.name}-${index}`} className="flex gap-3 p-4">
                    <Avatar name={review.name} index={index} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">{review.name}</h3>
                          <p className="text-xs text-slate-500">{review.book}</p>
                        </div>
                        <div className="text-right">
                          <Stars value={review.rating} size="sm" />
                          <p className="mt-1 text-xs text-slate-400">{review.date}</p>
                        </div>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-700">{review.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>
      </section>

      <section className="mt-4 grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-4 max-xl:grid-cols-1">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-slate-900">Giao dịch chờ đánh giá</h2>
            {reviewable.length > 3 ? (
              <button
                className="text-xs font-bold text-blue-700 transition-colors hover:text-blue-900"
                type="button"
                onClick={() => setShowAllReviewable((current) => !current)}
              >
                {showAllReviewable ? "Thu gọn" : "Xem tất cả"}
              </button>
            ) : null}
          </div>
          <div className="mt-4 space-y-3">
            {reviewable.length === 0 ? (
              <EmptyState title="Chưa có giao dịch chờ đánh giá">
                Các giao dịch đã hoàn tất sẽ xuất hiện tại đây.
              </EmptyState>
            ) : (
              (showAllReviewable ? reviewable : reviewable.slice(0, 3)).map((tx) => (
                <div key={tx.transaction_id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="flex h-12 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-slate-900">{tx.book_title ?? `Sách #${tx.book_id}`}</div>
                    <p className="text-xs text-slate-500">{transactionPartnerLabel(tx, user?.user_id)}</p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Hoàn tất</span>
                  <ChevronRight className="h-4 w-4 text-slate-300" />
                </div>
              ))
            )}
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-4 max-lg:grid-cols-1">
          <LeaderboardPanel
            title="Top thành viên uy tín"
            icon={Trophy}
            initialLimit={3}
            items={(leaderboard?.top_point_users ?? []).map((member) => ({
              id: member.user_id,
              title: member.full_name,
              subtitle: "5.0",
              metric: `${member.current_points} điểm`
            }))}
            empty="Chưa có dữ liệu thành viên."
          />
          <LeaderboardPanel
            title="Sách được quan tâm"
            icon={Flame}
            initialLimit={2}
            items={(leaderboard?.top_books ?? []).map((book) => ({
              id: book.book_id,
              title: book.title,
              subtitle: book.author,
              metric: `${book.borrow_count} giao dịch hoàn tất`,
              imageUrl: book.cover_image_url
            }))}
            empty="Chưa có sách được quan tâm."
          />
        </div>
      </section>

      <footer className="mt-8 flex items-center justify-center gap-3 pb-2 text-sm font-semibold text-slate-500">
        <BookOpen className="h-5 w-5 text-blue-700" />
        LibriHub
        <span className="h-4 w-px bg-slate-300" />
        <span>Kết nối yêu thương qua từng trang sách</span>
        <Sparkles className="h-4 w-4 text-blue-600" />
      </footer>
    </>
  );
}

function MetricCard({
  title,
  value,
  detail,
  icon: Icon,
  tone,
  chip
}: {
  title: string;
  value: string;
  detail: React.ReactNode;
  icon: typeof ShieldCheck;
  tone: string;
  chip?: string;
}) {
  return (
    <Card className="flex items-center gap-4">
      <div className={cn("flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full", toneBg(tone))}>
        <Icon className={cn("h-8 w-8", toneText(tone))} />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-slate-600">{title}</div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <div className="text-2xl font-bold tracking-tight text-slate-950">{value}</div>
          {chip ? <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">{chip}</span> : null}
        </div>
        <div className="mt-1 text-xs text-slate-500">{detail}</div>
      </div>
    </Card>
  );
}

function LeaderboardPanel({
  title,
  icon: Icon,
  items,
  empty,
  initialLimit = 5
}: {
  title: string;
  icon: typeof Trophy;
  items: Array<{ id: number; title: string; subtitle: string; metric: string; imageUrl?: string | null }>;
  empty: string;
  initialLimit?: number;
}) {
  const [showAll, setShowAll] = useState(false);
  const visibleItems = showAll ? items : items.slice(0, initialLimit);

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-blue-700" />
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
        </div>
        {items.length > initialLimit ? (
          <button
            className="text-xs font-bold text-blue-700 transition-colors hover:text-blue-900"
            type="button"
            onClick={() => setShowAll((current) => !current)}
          >
            {showAll ? "Thu gọn" : "Xem tất cả"}
          </button>
        ) : null}
      </div>
      {items.length === 0 ? (
        <EmptyState title={empty} />
      ) : (
        <div className="space-y-3">
          {visibleItems.map((item, index) => (
            <div key={item.id} className="flex items-center gap-3 border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
              {item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.imageUrl} alt={item.title} className="h-12 w-10 rounded-lg object-cover" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                  {index + 1}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-slate-900">{item.title}</div>
                <div className="truncate text-xs text-slate-500">{item.subtitle}</div>
              </div>
              <div className="whitespace-nowrap rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                {item.metric}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function Stars({ value, size = "md" }: { value: number; size?: "sm" | "md" }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((item) => (
        <Star
          key={item}
          className={cn(
            size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4",
            item <= value ? "fill-amber-400 text-amber-400" : "text-slate-300"
          )}
        />
      ))}
    </span>
  );
}

function Avatar({ name, index }: { name: string; index: number }) {
  const colors = ["bg-rose-100 text-rose-700", "bg-blue-100 text-blue-700", "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-700"];
  return (
    <div className={cn("flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold", colors[index % colors.length])}>
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

function toneBg(tone: string) {
  const tones: Record<string, string> = {
    blue: "bg-blue-50",
    amber: "bg-amber-50",
    emerald: "bg-emerald-50",
    violet: "bg-violet-50"
  };
  return tones[tone] ?? tones.blue;
}

function toneText(tone: string) {
  const tones: Record<string, string> = {
    blue: "text-blue-700",
    amber: "text-amber-500",
    emerald: "text-emerald-600",
    violet: "text-violet-600"
  };
  return tones[tone] ?? tones.blue;
}

function transactionLabel(transaction: Transaction | null, currentUserId?: number) {
  if (!transaction) return "Giao dịch không xác định";
  const book = transaction.book_title ?? `Sách #${transaction.book_id}`;
  const author = transaction.book_author ? ` - ${transaction.book_author}` : "";
  const partner = transactionPartnerName(transaction, currentUserId);
  return `Giao dịch #${transaction.transaction_id} - ${book}${author}${partner ? ` - với ${partner}` : ""}`;
}

function transactionPartnerLabel(transaction: Transaction, currentUserId?: number) {
  const partner = transactionPartnerName(transaction, currentUserId);
  if (!partner) return `Giao dịch #${transaction.transaction_id}`;
  return `Giao dịch #${transaction.transaction_id} với ${partner}`;
}

function transactionPartnerName(transaction: Transaction, currentUserId?: number) {
  if (currentUserId === transaction.owner_id) return transaction.requester_full_name;
  if (currentUserId === transaction.requester_id) return transaction.owner_full_name;
  return transaction.requester_full_name ?? transaction.owner_full_name;
}

function appendQuickTag(current: string, tag: string) {
  const clean = current.trim();
  if (!clean) return tag;
  if (clean.split(",").map((item) => item.trim()).includes(tag)) return current;
  return `${clean}, ${tag}`;
}
