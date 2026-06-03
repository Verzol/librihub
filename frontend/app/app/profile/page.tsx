"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Award,
  BookOpen,
  CalendarDays,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Star,
  Truck,
  UserRound
} from "lucide-react";
import { authApi, booksApi, reviewsApi, transactionsApi } from "@/lib/api";
import { errorMessage } from "@/lib/api/client";
import type { Book, Review, Transaction } from "@/lib/api/types";
import { useAuth } from "@/lib/auth";
import { cn, formatDate } from "@/lib/utils";
import { Alert, Badge, Card, ConfirmButton, Field, PageHeader, TextArea, TextInput } from "@/components/ui";

export default function ProfilePage() {
  const { token, user, refreshUser } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token || !user) return;
    Promise.all([reviewsApi.forUser(token, user.user_id), transactionsApi.list(token), booksApi.forUser(token, user.user_id)])
      .then(([reviewData, transactionData, bookData]) => {
        setReviews(reviewData);
        setTransactions(transactionData);
        setBooks(bookData);
      })
      .catch(() => undefined);
  }, [token, user?.user_id]);

  const averageRating = useMemo(() => {
    if (reviews.length === 0) return 0;
    return reviews.reduce((sum, review) => sum + review.rating_score, 0) / reviews.length;
  }, [reviews]);

  const completedCount = transactions.filter((tx) => tx.transaction_status === "COMPLETED").length;

  if (!user) return null;

  async function submit(form: HTMLFormElement) {
    if (!token) return;
    const data = new FormData(form);
    try {
      setSaving(true);
      setError("");
      setSuccess("");
      await authApi.updateProfile(token, {
        full_name: String(data.get("full_name") ?? ""),
        phone: String(data.get("phone") ?? ""),
        student_code: String(data.get("student_code") ?? ""),
        address: String(data.get("address") ?? "")
      });
      await refreshUser();
      setSuccess("Đã cập nhật thông tin cá nhân.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  return (
    <>
      <PageHeader
        hero
        heroIcon={<UserRound className="h-3.5 w-3.5" />}
        title="Hồ sơ của tôi"
        description="Quản lý thông tin cá nhân, trạng thái thành viên và uy tín giao dịch trên LibriHub."
        heroStat={
          <>
            <p className="text-sm font-medium text-blue-200">LibriPoint hiện tại</p>
            <div className="mt-1 text-4xl font-bold text-white">{user.current_points}</div>
            <p className="mt-1 text-sm text-blue-200">trong ví của bạn</p>
          </>
        }
      />

      <div className="grid grid-cols-[360px_minmax(0,1fr)] gap-5 max-lg:grid-cols-1">
        <div className="flex flex-col gap-5">
          <Card className="overflow-hidden p-0">
            <div className="bg-slate-50/80 px-5 pb-14 pt-5 border-b border-slate-100">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">LibriHub Profile</p>
                  <h2 className="mt-1 text-xl font-bold text-slate-900">{user.full_name}</h2>
                </div>
                <Badge value={user.role} />
              </div>
            </div>
            <div className="-mt-10 px-5 pb-6">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-4 border-white bg-gradient-to-br from-blue-400 to-blue-600 text-3xl font-bold text-white shadow-lg shadow-blue-500/30">
                {user.full_name.slice(0, 1).toUpperCase()}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge value={user.account_status} />
                {user.member_profile ? <Badge value={user.member_profile.membership_status} /> : null}
                {user.courier_profile ? <Badge value={user.courier_profile.courier_status} /> : null}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2.5">
                <Metric icon={Award} label="LibriPoint" value={String(user.current_points)} tone="amber" />
                <Metric icon={Star} label="Đánh giá" value={averageRating ? averageRating.toFixed(1) : "-"} tone="violet" />
                <Metric icon={BookOpen} label="Sách đã đăng" value={String(books.length)} tone="blue" />
                <Metric icon={ShieldCheck} label="Hoàn tất" value={String(completedCount)} tone="emerald" />
                <Metric icon={CalendarDays} label="Tham gia" value={formatDate(user.created_at).split(" ")[0]} tone="slate" />
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="text-base font-semibold text-slate-950">Thông tin hiển thị</h2>
            <div className="mt-4 space-y-3">
              <Info icon={Mail} label="Email" value={user.email} />
              <Info icon={Phone} label="Điện thoại" value={user.phone} />
              <Info icon={UserRound} label="Mã sinh viên" value={user.member_profile?.student_code ?? "-"} />
              <Info icon={MapPin} label="Địa chỉ" value={user.member_profile?.address ?? "-"} />
              {user.courier_profile ? (
                <Info icon={Truck} label="Khu vực giao sách" value={user.courier_profile.delivery_area} />
              ) : null}
            </div>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Card>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">Sách tôi đã đăng</h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  {books.length} cuốn trong thư viện cá nhân của bạn.
                </p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <BookOpen className="h-4 w-4" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5 max-md:grid-cols-1">
              {books.length === 0 ? (
                <div className="col-span-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center text-sm text-slate-500 max-md:col-span-1">
                  Bạn chưa đăng cuốn sách nào.
                </div>
              ) : null}
              {books.map((book) => (
                <Link
                  key={book.book_id}
                  href={`/app/books/${book.book_id}`}
                  className="group flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50/40 hover:shadow-sm"
                >
                  <BookThumb book={book} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-slate-900 group-hover:text-blue-700">{book.title}</div>
                    <div className="truncate text-xs text-slate-500">{book.author}</div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <Badge value={book.book_status} />
                      <Badge value={book.exchange_mode} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </Card>

          <Card>
            <div className="mb-5 flex items-start justify-between gap-4 max-sm:flex-col">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Chỉnh sửa hồ sơ</h2>
                <p className="mt-1 text-base leading-6 text-slate-500">
                  Thay đổi thông tin liên hệ và địa chỉ nhận sách của bạn.
                </p>
              </div>
              <span className="rounded-full bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700">
                ID #{user.user_id}
              </span>
            </div>
            <form id="profile-form" className="grid grid-cols-2 gap-4 max-md:grid-cols-1" onSubmit={onSubmit}>
              {error ? <div className="col-span-2 max-md:col-span-1"><Alert variant="error">{error}</Alert></div> : null}
              {success ? <div className="col-span-2 max-md:col-span-1"><Alert variant="success">{success}</Alert></div> : null}
              <Field label="Họ và tên">
                <TextInput name="full_name" defaultValue={user.full_name} required />
              </Field>
              <Field label="Điện thoại">
                <TextInput name="phone" defaultValue={user.phone} required />
              </Field>
              <Field label="Mã sinh viên">
                <TextInput name="student_code" defaultValue={user.member_profile?.student_code ?? ""} required />
              </Field>
              <Field label="Điểm hiện tại">
                <TextInput value={`${user.current_points} LibriPoint`} disabled />
              </Field>
              <Field label="Địa chỉ" className="col-span-2 max-md:col-span-1">
                <TextArea name="address" defaultValue={user.member_profile?.address ?? ""} required />
              </Field>
              <div className="col-span-2 flex justify-end max-md:col-span-1">
                <ConfirmButton
                  loading={saving}
                  confirm="Bạn có muốn lưu thay đổi hồ sơ không?"
                  onConfirm={() => {
                    const form = document.getElementById("profile-form") as HTMLFormElement | null;
                    if (form?.reportValidity()) void submit(form);
                  }}
                >
                  Lưu thay đổi
                </ConfirmButton>
              </div>
            </form>
          </Card>

          <Card>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">Đánh giá đã nhận</h2>
                <p className="mt-0.5 text-sm text-slate-500">Uy tín từ các giao dịch đã hoàn tất.</p>
              </div>
              <StarSummary value={averageRating} count={reviews.length} />
            </div>
            <div className="mt-4 grid gap-2.5">
              {reviews.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center text-sm text-slate-500">
                  Chưa có đánh giá nào.
                </div>
              ) : null}
              {reviews.slice(0, 5).map((review) => (
                <div key={review.review_id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <StarRow value={review.rating_score} />
                    <Badge value={review.review_type} />
                  </div>
                  <p className="mt-2.5 text-sm leading-6 text-slate-700">
                    {review.review_content || "Không có nội dung đánh giá."}
                  </p>
                  <p className="mt-2 text-xs font-medium text-slate-400">{formatDate(review.created_at)}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

function BookThumb({ book }: { book: Book }) {
  return (
    <div className="flex h-16 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white text-blue-700 shadow-sm ring-1 ring-slate-200">
      {book.cover_image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={book.cover_image_url} alt={book.title} className="h-full w-full object-cover" />
      ) : (
        <BookOpen className="h-5 w-5" />
      )}
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  tone = "blue"
}: {
  icon: typeof UserRound;
  label: string;
  value: string;
  tone?: "blue" | "amber" | "emerald" | "violet" | "slate";
}) {
  const toneMap: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-600",
    emerald: "bg-emerald-50 text-emerald-600",
    violet: "bg-violet-50 text-violet-600",
    slate: "bg-slate-100 text-slate-500"
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${toneMap[tone]}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="mt-2 text-lg font-bold text-slate-900">{value}</div>
      <div className="text-xs font-semibold text-slate-400">{label}</div>
    </div>
  );
}

function Info({
  icon: Icon,
  label,
  value
}: {
  icon: typeof UserRound;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-slate-50 px-3 py-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-blue-700 shadow-sm">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-slate-400">{label}</div>
        <div className="mt-0.5 break-words text-base font-medium text-slate-800">{value}</div>
      </div>
    </div>
  );
}

function StarSummary({ value, count }: { value: number; count: number }) {
  return (
    <div className="text-right">
      <StarRow value={Math.round(value)} />
      <p className="mt-1 text-sm font-semibold text-slate-400">
        {count ? `${value.toFixed(1)}/5 từ ${count} đánh giá` : "Chưa có điểm"}
      </p>
    </div>
  );
}

function StarRow({ value }: { value: number }) {
  return (
    <div className="inline-flex items-center gap-0.5 text-amber-400">
      {[1, 2, 3, 4, 5].map((score) => (
        <Star
          key={score}
          className={cn("h-4 w-4", score <= value ? "fill-amber-400" : "fill-transparent text-slate-300")}
        />
      ))}
    </div>
  );
}
