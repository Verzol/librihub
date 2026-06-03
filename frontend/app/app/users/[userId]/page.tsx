"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, CalendarDays, MapPin, ShieldCheck, Star, Trophy, Truck, UserRound, type LucideIcon } from "lucide-react";
import { authApi, booksApi, deliveriesApi, reviewsApi } from "@/lib/api";
import { errorMessage } from "@/lib/api/client";
import type { Book, Delivery, PublicUserSummary, Review } from "@/lib/api/types";
import { useAuth } from "@/lib/auth";
import { cn, formatDate } from "@/lib/utils";
import { Alert, Badge, Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";

export default function PublicUserProfilePage({ params }: { params: { userId: string } }) {
  const { token, user } = useAuth();
  const userId = Number(params.userId);
  const [profile, setProfile] = useState<PublicUserSummary | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token || Number.isNaN(userId)) return;
    let cancelled = false;
    const authToken = token;

    async function load() {
      try {
        setError("");
        const [summary, userReviews, userBooks, userDeliveries] = await Promise.all([
          authApi.summary(authToken, userId),
          reviewsApi.forUser(authToken, userId),
          booksApi.forUser(authToken, userId),
          deliveriesApi.forUser(authToken, userId)
        ]);
        if (cancelled) return;
        setProfile(summary);
        setReviews(userReviews);
        setBooks(userBooks);
        setDeliveries(userDeliveries);
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [token, userId]);

  const averageRating = useMemo(() => {
    if (reviews.length === 0) return null;
    return reviews.reduce((total, review) => total + review.rating_score, 0) / reviews.length;
  }, [reviews]);

  if (!token) {
    return (
      <EmptyState title="Đăng nhập để xem hồ sơ cộng đồng">
        Trang hồ sơ dùng dữ liệu thành viên và đánh giá trong hệ thống LibriHub.
      </EmptyState>
    );
  }

  if (Number.isNaN(userId)) {
    return <EmptyState title="Không tìm thấy thành viên" />;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {error ? <Alert variant="error">{error}</Alert> : null}

      {profile ? (
        <div className="overflow-hidden rounded-[32px] bg-white shadow-sm ring-1 ring-slate-200">
          <div className="relative bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 px-8 py-12 text-white max-md:px-6">
            <div className="mt-12 flex flex-wrap items-center gap-6 max-sm:mt-8">
              <div className="flex h-24 w-24 items-center justify-center rounded-[24px] bg-white/10 text-4xl font-bold text-white shadow-inner ring-1 ring-inset ring-white/20 backdrop-blur-sm">
                {profile.full_name.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-3xl font-bold tracking-tight text-white max-md:text-2xl">{profile.full_name}</h1>
                <p className="mt-2 text-base text-blue-100">
                  Tham gia {formatDate(profile.joined_at)}
                  {user?.user_id === profile.user_id ? <span className="ml-2 inline-flex items-center rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold text-white">Bạn</span> : null}
                </p>
              </div>
              <div className="flex flex-col items-center justify-center rounded-2xl bg-white/10 px-8 py-4 backdrop-blur-md ring-1 ring-inset ring-white/20 max-sm:w-full">
                <div className="text-3xl font-bold text-white">{profile.current_points}</div>
                <div className="mt-1 text-sm font-medium text-blue-100">LibriPoint</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 divide-x divide-slate-100 border-t border-slate-100 bg-white max-lg:grid-cols-2 max-lg:divide-y max-sm:grid-cols-1">
            <ProfileMetric icon={ShieldCheck} label="Tài khoản" value={<Badge value={profile.account_status} />} />
            <ProfileMetric icon={UserRound} label="Thành viên" value={profile.membership_status ? <Badge value={profile.membership_status} /> : "Chưa có"} />
            <ProfileMetric icon={Truck} label="Người giao" value={profile.courier_status ? <Badge value={profile.courier_status} /> : "Không đăng ký"} />
            <ProfileMetric
              icon={Star}
              label="Đánh giá"
              value={averageRating === null ? "Chưa có" : `${averageRating.toFixed(1)}/5`}
              detail={averageRating !== null ? `${reviews.length} đánh giá` : undefined}
            />
          </div>
        </div>
      ) : (
        <Card className="p-6">
          <p className="text-base font-medium text-slate-500">Đang tải hồ sơ...</p>
        </Card>
      )}

      <section className="grid grid-cols-2 gap-8 max-lg:grid-cols-1">
        <Card className="overflow-hidden p-0">
          <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-5">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-100">
                <BookOpen className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-950">Sách đã đăng</h2>
                <p className="mt-0.5 text-sm font-medium text-slate-500">{books.length} cuốn đang có trong hồ sơ.</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            {books.length === 0 ? (
              <EmptyState title="Chưa đăng sách" />
            ) : (
              <div className="grid gap-4">
                {books.slice(0, 6).map((book) => (
                  <Link
                    key={book.book_id}
                    href={`/app/books/${book.book_id}`}
                    className="group flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md hover:shadow-blue-500/5"
                  >
                    <BookThumb book={book} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-base font-bold text-slate-900 group-hover:text-blue-700">{book.title}</div>
                      <div className="mt-1 truncate text-sm font-medium text-slate-500">{book.author}</div>
                    </div>
                    <div className="shrink-0">
                      <Badge value={book.book_status} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-5">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-100">
                <Truck className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-950">Chuyến đã giao</h2>
                <p className="mt-0.5 text-sm font-medium text-slate-500">{deliveries.length} chuyến giao trong hệ thống.</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            {deliveries.length === 0 ? (
              <EmptyState title="Chưa có chuyến giao" />
            ) : (
              <div className="grid gap-4">
                {deliveries.slice(0, 6).map((delivery) => (
                  <article key={delivery.delivery_id} className="flex flex-col min-w-0 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-colors hover:border-emerald-200 hover:bg-emerald-50/30">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-base font-bold text-slate-900">
                          Chuyến #{delivery.delivery_id}
                        </div>
                        <p className="mt-1.5 flex items-start gap-2 text-sm font-medium text-slate-500">
                          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                          <span className="line-clamp-2">{delivery.receiver_address}</span>
                        </p>
                      </div>
                      <div className="shrink-0">
                        <Badge value={delivery.delivery_status} />
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
                      {delivery.delivered_at ? (
                        <span className="rounded-full bg-slate-50 px-2.5 py-1 text-slate-600">Giao lúc {formatDate(delivery.delivered_at)}</span>
                      ) : delivery.expected_delivery_at ? (
                        <span className="rounded-full bg-slate-50 px-2.5 py-1 text-slate-600">Dự kiến {formatDate(delivery.expected_delivery_at)}</span>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </Card>
      </section>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-100">
              <Trophy className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-950">Đánh giá đã nhận</h2>
              <p className="mt-0.5 text-sm font-medium text-slate-500">Các nhận xét sau giao dịch hoàn tất.</p>
            </div>
          </div>
        </div>
        <div className="p-6">
          {reviews.length === 0 ? (
            <EmptyState title="Chưa có đánh giá" />
          ) : (
            <div className="grid gap-4 max-lg:grid-cols-1 lg:grid-cols-2">
              {reviews.map((review) => (
                <article key={review.review_id} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md hover:shadow-slate-200/50">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Stars value={review.rating_score} />
                        <span className="text-base font-bold text-slate-900">
                          {review.reviewer_full_name ?? "Người đánh giá"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-medium text-slate-500">
                        {review.book_title ?? `Giao dịch #${review.transaction_id}`}
                        {review.book_author ? ` - ${review.book_author}` : ""}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-400">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {formatDate(review.created_at)}
                    </span>
                  </div>
                  <p className="mt-4 text-base leading-7 text-slate-600">
                    “{review.review_content || "Không có nội dung đánh giá."}”
                  </p>
                </article>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function BookThumb({ book }: { book: Book }) {
  return (
    <div className="flex h-16 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-50 text-slate-400 ring-1 ring-inset ring-slate-200/60">
      {book.cover_image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={book.cover_image_url} alt={book.title} className="h-full w-full object-cover" />
      ) : (
        <BookOpen className="h-6 w-6" />
      )}
    </div>
  );
}

function ProfileMetric({
  icon: Icon,
  label,
  value,
  detail
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  detail?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center p-6 text-center transition-colors hover:bg-slate-50">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-100/50">
        <Icon className="h-6 w-6" />
      </div>
      <div className="text-sm font-semibold text-slate-500">{label}</div>
      <div className="mt-1.5 text-base font-bold text-slate-950">{value}</div>
      {detail ? <div className="mt-1 text-sm font-medium text-slate-400">{detail}</div> : null}
    </div>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((item) => (
        <Star
          key={item}
          className={cn("h-4 w-4", item <= value ? "fill-amber-400 text-amber-400" : "text-slate-300")}
        />
      ))}
    </span>
  );
}
