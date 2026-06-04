"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Award,
  BookOpen,
  Check,
  Clock,
  MessageSquareText,
  Send,
  ShieldCheck,
  Star,
  Trophy,
  Truck,
  Users
} from "lucide-react";
import { booksApi, reviewsApi, transactionsApi } from "@/lib/api";
import { errorMessage } from "@/lib/api/client";
import type { CommunityLeaderboard, Review, ReviewType, Transaction } from "@/lib/api/types";
import { useAuth } from "@/lib/auth";
import { cn, formatDate } from "@/lib/utils";
import { Alert, Badge, Button, Card, EmptyState, Field, PageHeader, Select, TextArea } from "@/components/ui";

const quickTags = ["Đúng hẹn", "Thân thiện", "Giữ sách tốt", "Phản hồi nhanh"];

export default function ReviewsPage() {
  const { token, user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [leaderboard, setLeaderboard] = useState<CommunityLeaderboard | null>(null);
  const [rating, setRating] = useState(5);
  const [reviewContent, setReviewContent] = useState("");
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

  const receivedReviews = useMemo(
    () => reviews.filter((review) => review.reviewee_user_id === user?.user_id),
    [reviews, user?.user_id]
  );
  const sentReviewKeys = useMemo(
    () =>
      new Set(
        reviews
          .filter((review) => review.reviewer_user_id === user?.user_id)
          .map((review) => reviewKey(review.transaction_id, review.reviewee_user_id, review.review_type))
      ),
    [reviews, user?.user_id]
  );
  const reviewable = useMemo(
    () =>
      transactions.filter((tx) => {
        if (!user) return false;
        if (tx.owner_id !== user.user_id && tx.requester_id !== user.user_id) return false;
        const revieweeId = tx.owner_id === user.user_id ? tx.requester_id : tx.owner_id;
        const type: ReviewType = tx.owner_id === user.user_id ? "REQUESTER_REVIEW" : "OWNER_REVIEW";
        return !sentReviewKeys.has(reviewKey(tx.transaction_id, revieweeId, type));
      }),
    [transactions, user, sentReviewKeys]
  );

  const averageReceivedRating = receivedReviews.length
    ? receivedReviews.reduce((total, review) => total + review.rating_score, 0) / receivedReviews.length
    : null;
  const communityAverage = reviews.length
    ? reviews.reduce((total, review) => total + review.rating_score, 0) / reviews.length
    : null;
  const completedCount = transactions.length;
  const onTimeTransactions = transactions.filter((tx) => tx.late_days === 0).length;
  const onTimeRate = completedCount ? Math.round((onTimeTransactions / completedCount) * 100) : null;

  async function submit(form: HTMLFormElement) {
    if (!token || !user) return;
    const transactionId = Number(new FormData(form).get("transaction_id"));
    const tx = transactions.find((item) => item.transaction_id === transactionId);
    if (!tx) return;

    const revieweeId = tx.owner_id === user.user_id ? tx.requester_id : tx.owner_id;
    const reviewType: ReviewType = tx.owner_id === user.user_id ? "REQUESTER_REVIEW" : "OWNER_REVIEW";

    try {
      setError("");
      await reviewsApi.create(token, {
        transaction_id: transactionId,
        reviewee_user_id: revieweeId,
        rating_score: rating,
        review_content: reviewContent.trim() || null,
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
        hero
        heroIcon={<Users className="h-3.5 w-3.5" />}
        title="Uy tín & Đánh giá"
        description="Đánh giá sau mỗi giao dịch, xem độ uy tín của thành viên và khám phá những cuốn sách được quan tâm nhất trong thư viện."
        heroStat={
          <>
            <p className="text-sm font-medium text-blue-200">Trung bình cộng đồng</p>
            <div className="mt-1 text-4xl font-bold text-white">
              {communityAverage === null ? "-" : communityAverage.toFixed(1)}
            </div>
            <p className="mt-1 text-sm text-blue-200">{reviews.length} đánh giá hệ thống</p>
          </>
        }
      />
      <div className="space-y-5">
      {error ? <Alert variant="error">{error}</Alert> : null}

      <section className="mb-6 grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1">
        <MetricCard
          title="Điểm hiện tại"
          value={user ? `${user.current_points}` : "-"}
          suffix=""
          detail={user ? "LibriPoint trong ví" : "Chưa đăng nhập"}
          icon={ShieldCheck}
          tone="blue"
        />
        <MetricCard
          title="Uy tín của bạn"
          value={averageReceivedRating === null ? "-" : averageReceivedRating.toFixed(1)}
          suffix={averageReceivedRating === null ? "" : "/5"}
          detail={receivedReviews.length ? `${receivedReviews.length} đánh giá đã nhận` : "Chưa nhận đánh giá"}
          icon={Star}
          tone="amber"
          rating={averageReceivedRating ?? undefined}
        />
        <MetricCard
          title="Đã giao dịch"
          value={String(completedCount)}
          detail="Giao dịch thành công"
          icon={Award}
          tone="emerald"
        />
        <MetricCard
          title="Tỷ lệ đúng hạn"
          value={onTimeRate === null ? "-" : `${onTimeRate}`}
          suffix={onTimeRate === null ? "" : "%"}
          detail={completedCount ? `${onTimeTransactions}/${completedCount} đúng hạn` : "Chưa có giao dịch"}
          icon={Clock}
          tone="violet"
        />
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3 max-sm:flex-col max-sm:items-start">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Bảng xếp hạng cộng đồng</h2>
            <p className="mt-1 text-base text-slate-500">Sách được quan tâm, người giao uy tín và thành viên có LibriPoint nổi bật.</p>
          </div>
          <span className="text-sm font-medium text-slate-400">Cập nhật từ dữ liệu hệ thống</span>
        </div>
        <div className="grid grid-cols-3 gap-4 max-xl:grid-cols-1">
          <LeaderboardPanel
            title="Top sách được mượn"
            icon={BookOpen}
            items={(leaderboard?.top_books ?? []).map((book) => ({
              id: book.book_id,
              title: book.title,
              subtitle: `${book.author}${book.category_name ? ` - ${book.category_name}` : ""}`,
              metric: `${book.borrow_count} lượt`,
              imageUrl: book.cover_image_url,
              href: `/app/books/${book.book_id}`
            }))}
            empty="Chưa có sách hoàn tất giao dịch."
          />
          <LeaderboardPanel
            title="Top người giao uy tín"
            icon={Truck}
            items={(leaderboard?.top_couriers ?? []).map((courier) => ({
              id: courier.user_id,
              title: courier.full_name,
              subtitle: courier.delivery_area,
              metric: `${courier.successful_delivery_count} đơn`,
              href: `/app/users/${courier.user_id}`
            }))}
            empty="Chưa có courier được duyệt."
          />
          <LeaderboardPanel
            title="Top điểm cao"
            icon={Trophy}
            items={(leaderboard?.top_point_users ?? []).map((member) => ({
              id: member.user_id,
              title: member.full_name,
              metric: `${member.current_points} điểm`,
              href: `/app/users/${member.user_id}`
            }))}
            empty="Chưa có dữ liệu thành viên."
          />
        </div>
      </section>

      <section className="grid grid-cols-[380px_minmax(0,1fr)] gap-5 max-xl:grid-cols-1">
        <div className="space-y-5">
          <ReviewComposer
            token={token}
            reviewable={reviewable}
            rating={rating}
            reviewContent={reviewContent}
            onRatingChange={setRating}
            onReviewContentChange={setReviewContent}
            onSubmit={submit}
            userId={user?.user_id}
          />
          <ReviewableList transactions={reviewable} currentUserId={user?.user_id} />
        </div>

        <div className="space-y-5">
          <CommunityFeed reviews={reviews} communityAverage={communityAverage} />
        </div>
      </section>
      </div>
    </>
  );
}

function ReviewComposer({
  token,
  reviewable,
  rating,
  reviewContent,
  onRatingChange,
  onReviewContentChange,
  onSubmit,
  userId
}: {
  token: string | null;
  reviewable: Transaction[];
  rating: number;
  reviewContent: string;
  onRatingChange: (value: number) => void;
  onReviewContentChange: (value: string) => void;
  onSubmit: (form: HTMLFormElement) => Promise<void>;
  userId?: number;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-100">
          <MessageSquareText className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-medium text-slate-950">Tạo đánh giá</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Chỉ các giao dịch đã hoàn tất và bạn chưa đánh giá mới xuất hiện ở đây.
          </p>
        </div>
      </div>

      <form
        id="community-review-form"
        className="mt-5 flex flex-col gap-4"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          void onSubmit(event.currentTarget);
        }}
      >
        <Field label="Giao dịch">
          <Select
            name="transaction_id"
            required
            disabled={!token || reviewable.length === 0}
            className="h-12 rounded-2xl border-slate-200 bg-slate-50/70 px-4 text-sm shadow-sm transition-colors focus:bg-white"
          >
            <option value="">
              {token ? "Chọn giao dịch chưa đánh giá" : "Đăng nhập để chọn giao dịch"}
            </option>
            {reviewable.map((tx) => (
              <option key={tx.transaction_id} value={tx.transaction_id}>
                {transactionLabel(tx, userId)}
              </option>
            ))}
          </Select>
        </Field>

        <div>
          <p className="text-sm font-medium text-slate-700">Điểm đánh giá</p>
          <div className="mt-2 flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((item) => (
              <button
                key={item}
                type="button"
                aria-label={`${item} sao`}
                onClick={() => onRatingChange(item)}
                className="flex h-9 w-9 items-center justify-center rounded-xl transition-colors hover:bg-amber-50"
              >
                <Star className={cn("h-6 w-6", item <= rating ? "fill-amber-400 text-amber-400" : "text-slate-300")} />
              </button>
            ))}
            <span className="ml-1 text-base font-medium text-slate-900">{rating}/5</span>
          </div>
        </div>

        <Field label="Nội dung">
          <TextArea
            name="review_content"
            placeholder="Chia sẻ trải nghiệm thật về việc giữ sách, đúng hẹn, giao nhận hoặc thái độ trao đổi..."
            value={reviewContent}
            onChange={(event) => onReviewContentChange(event.target.value)}
            disabled={!token || reviewable.length === 0}
            className="min-h-32 rounded-2xl border-slate-200 bg-slate-50/70 text-sm leading-7 shadow-sm transition-colors focus:bg-white"
          />
        </Field>

        <div className="flex flex-wrap gap-2">
          {quickTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => onReviewContentChange(appendQuickTag(reviewContent, tag))}
              className="inline-flex h-8 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
            >
              <Check className="h-4 w-4" />
              {tag}
            </button>
          ))}
        </div>

        <Button disabled={!token || reviewable.length === 0} className="h-11 text-sm">
          <Send className="h-5 w-5" />
          Gửi đánh giá
        </Button>
      </form>
    </Card>
  );
}

function CommunityFeed({
  reviews,
  communityAverage
}: {
  reviews: Review[];
  communityAverage: number | null;
}) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium text-slate-950">Đánh giá cộng đồng</h2>
          <p className="mt-1 text-sm text-slate-500">
            {reviews.length} đánh giá gần nhất từ hệ thống
          </p>
        </div>
        <div className="rounded-2xl bg-amber-50 px-3 py-2 text-right">
          <div className="text-base font-medium text-slate-950">
            {communityAverage === null ? "-" : communityAverage.toFixed(1)}
          </div>
          <Stars value={Math.round(communityAverage ?? 0)} size="sm" />
        </div>
      </div>

      <div className="max-h-[520px] overflow-y-auto rounded-2xl border border-slate-200 bg-white">
        {reviews.length === 0 ? (
          <div className="p-5">
            <EmptyState title="Chưa có đánh giá">
              Khi thành viên đánh giá sau giao dịch hoàn tất, dữ liệu sẽ xuất hiện tại đây.
            </EmptyState>
          </div>
        ) : (
          reviews.map((review) => (
            <ReviewRow key={review.review_id} review={review} />
          ))
        )}
      </div>
    </Card>
  );
}

function ReviewRow({ review }: { review: Review }) {
  return (
    <article className="grid grid-cols-[48px_minmax(0,1fr)_auto] gap-3 border-b border-slate-100 p-4 last:border-b-0 max-sm:grid-cols-[44px_minmax(0,1fr)]">
      <Avatar name={review.reviewer_full_name ?? "Người dùng"} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/app/users/${review.reviewer_user_id}`}
            className="text-sm font-medium text-slate-950 transition-colors hover:text-blue-700"
          >
            {review.reviewer_full_name ?? "Người đánh giá"}
          </Link>
          <Link
            href={`/app/users/${review.reviewee_user_id}`}
            className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-sm font-medium text-slate-800 transition-colors hover:border-blue-200 hover:bg-blue-100"
          >
            Đánh giá cho {review.reviewee_full_name ?? `người dùng #${review.reviewee_user_id}`}
          </Link>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {review.book_title ?? `Giao dịch #${review.transaction_id}`}
          {review.book_author ? ` - ${review.book_author}` : ""}
        </p>
        <p className="mt-3 text-sm leading-6 text-slate-700">{review.review_content || "Không có nội dung đánh giá."}</p>
      </div>
      <div className="text-right max-sm:col-span-2 max-sm:text-left">
        <Stars value={review.rating_score} />
        <p className="mt-2 text-sm text-slate-400">{formatDate(review.created_at)}</p>
      </div>
    </article>
  );
}

function ReviewableList({
  transactions,
  currentUserId
}: {
  transactions: Transaction[];
  currentUserId?: number;
}) {
  return (
    <Card className="p-5">
      <h2 className="text-base font-medium text-slate-950">Chờ bạn đánh giá</h2>
      <p className="mt-1 text-sm text-slate-500">{transactions.length} giao dịch đã hoàn tất</p>
      <div className="mt-4 space-y-3">
        {transactions.length === 0 ? (
          <EmptyState title="Không còn giao dịch chờ đánh giá" />
        ) : (
          transactions.slice(0, 4).map((tx) => (
            <div key={tx.transaction_id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3">
              <div className="flex h-11 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                <BookOpen className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-slate-950">{tx.book_title ?? `Sách #${tx.book_id}`}</div>
                <p className="truncate text-sm text-slate-500">{transactionPartnerLabel(tx, currentUserId)}</p>
              </div>
              <Badge value={tx.transaction_type} />
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

function MetricCard({
  title,
  value,
  suffix,
  detail,
  icon: Icon,
  tone,
  rating
}: {
  title: string;
  value: string;
  suffix?: string;
  detail: React.ReactNode;
  icon: typeof ShieldCheck;
  tone: "blue" | "amber" | "emerald" | "violet";
  rating?: number;
}) {
  return (
    <Card className="flex flex-col items-start gap-3 p-4 transition-all hover:-translate-y-1 hover:shadow-md">
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ring-1 ring-inset", toneBg(tone))}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 w-full">
        <div className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
          {value}
          {suffix ? <span className="ml-0.5 text-sm font-medium text-slate-500">{suffix}</span> : null}
        </div>
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 mt-1">{title}</div>
        <div className="mt-2 text-xs leading-5 text-slate-500 truncate">
          {rating ? <Stars value={Math.round(rating)} size="sm" /> : detail}
        </div>
      </div>
    </Card>
  );
}

function LeaderboardPanel({
  title,
  icon: Icon,
  items,
  empty,
  horizontal = false
}: {
  title: string;
  icon: typeof Trophy;
  items: Array<{ id: number; title: string; subtitle?: string; metric: string; imageUrl?: string | null; href?: string }>;
  empty: string;
  horizontal?: boolean;
}) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
          <Icon className="h-5 w-5" />
        </div>
        <h2 className="text-base font-medium text-slate-950">{title}</h2>
      </div>
      {items.length === 0 ? (
        <EmptyState title={empty} />
      ) : (
        <div className={cn(horizontal ? "grid grid-cols-4 gap-3 max-xl:grid-cols-2 max-sm:grid-cols-1" : "space-y-3")}>
          {items.slice(0, horizontal ? 8 : 5).map((item, index) => (
            <LeaderboardItem key={`${item.href ?? item.id}-${index}`} item={item} rank={index + 1} />
          ))}
        </div>
      )}
    </Card>
  );
}

function LeaderboardItem({
  item,
  rank
}: {
  item: { id: number; title: string; subtitle?: string; metric: string; imageUrl?: string | null; href?: string };
  rank: number;
}) {
  const content = (
    <>
      {item.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.imageUrl} alt={item.title} className="h-12 w-10 shrink-0 rounded-xl object-cover" />
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-sm font-medium text-slate-600 ring-1 ring-inset ring-slate-200">
          {rank}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-slate-950">{item.title}</div>
        {item.subtitle ? <div className="truncate text-sm text-slate-500">{item.subtitle}</div> : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <div className="whitespace-nowrap rounded-full bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700">
          {item.metric}
        </div>
        {item.href ? <ArrowRight className="h-4 w-4 text-slate-300 transition-colors group-hover:text-blue-600" /> : null}
      </div>
    </>
  );

  if (item.href) {
    return (
      <Link
        href={item.href}
        className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 transition-colors hover:border-blue-200 hover:bg-blue-50/45"
      >
        {content}
      </Link>
    );
  }

  return <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3">{content}</div>;
}

function Stars({ value, size = "md" }: { value: number; size?: "sm" | "md" }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((item) => (
        <Star
          key={item}
          className={cn(
            size === "sm" ? "h-4 w-4" : "h-5 w-5",
            item <= value ? "fill-amber-400 text-amber-400" : "text-slate-300"
          )}
        />
      ))}
    </span>
  );
}

function Avatar({ name }: { name: string }) {
  const colors = ["bg-rose-100 text-rose-700", "bg-blue-100 text-blue-700", "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-700"];
  const color = colors[stableNameIndex(name, colors.length)];
  return (
    <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-sm font-medium", color)}>
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

function stableNameIndex(name: string, length: number) {
  const normalized = name.trim().toLocaleLowerCase("vi-VN");
  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash * 31 + normalized.charCodeAt(index)) % length;
  }
  return hash;
}

function toneBg(tone: string) {
  const tones: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
    amber: "bg-amber-50 text-amber-600 ring-amber-100",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    violet: "bg-violet-50 text-violet-700 ring-violet-100"
  };
  return tones[tone] ?? tones.blue;
}

function reviewKey(transactionId: number, revieweeId: number, type: ReviewType) {
  return `${transactionId}:${revieweeId}:${type}`;
}

function transactionLabel(transaction: Transaction, currentUserId?: number) {
  const book = transaction.book_title ?? `Sách #${transaction.book_id}`;
  const partner = transactionPartnerName(transaction, currentUserId);
  return `${book}${partner ? ` - với ${partner}` : ""}`;
}

function transactionPartnerLabel(transaction: Transaction, currentUserId?: number) {
  const partner = transactionPartnerName(transaction, currentUserId);
  if (!partner) return `Giao dịch #${transaction.transaction_id}`;
  return `Với ${partner}`;
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
