"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  Edit3,
  Handshake,
  LibraryBig,
  PackageCheck,
  RotateCcw,
  Send,
  Star,
  Trash2,
  Truck,
  UserRound,
  Wallet,
  type LucideIcon
} from "lucide-react";
import { authApi, booksApi, reviewsApi, transactionsApi } from "@/lib/api";
import { errorMessage } from "@/lib/api/client";
import type { Book, DeliveryMethod, PublicUserSummary, Review, TransactionType } from "@/lib/api/types";
import { useAuth } from "@/lib/auth";
import {
  DELIVERY_LOCATIONS,
  FREE_COURIER_RADIUS_LABEL,
  distanceFromUetKm,
  getDeliveryLocation
} from "@/lib/delivery-locations";
import { cn, formatDate } from "@/lib/utils";
import { Alert, Badge, ConfirmButton, LinkButton, LoadingState } from "@/components/ui";

export default function BookDetailPage() {
  const params = useParams<{ bookId: string }>();
  const router = useRouter();
  const { token, user } = useAuth();
  const bookId = Number(params.bookId);
  const [book, setBook] = useState<Book | null>(null);
  const [owner, setOwner] = useState<PublicUserSummary | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [relatedBooks, setRelatedBooks] = useState<Book[]>([]);
  const [selectedTransactionType, setSelectedTransactionType] = useState<TransactionType>("BORROW_RETURN");
  const [selectedDeliveryMethod, setSelectedDeliveryMethod] = useState<DeliveryMethod>("DIRECT_CONTACT");
  const [selectedReceiverLocationId, setSelectedReceiverLocationId] = useState(DELIVERY_LOCATIONS[0].id);
  const [borrowDays, setBorrowDays] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    try {
      setError("");
      const [bookData, reviewData] = await Promise.all([
        booksApi.detail(token, bookId),
        token ? reviewsApi.forBook(token, bookId) : Promise.resolve([])
      ]);
      setBook(bookData);
      setReviews(reviewData);

      if (token) {
        authApi.summary(token, bookData.owner_id).then(setOwner).catch(() => setOwner(null));
      }

      booksApi
        .list(token, `?category_id=${bookData.category_id}`)
        .then((items) => setRelatedBooks(items.filter((item) => item.book_id !== bookData.book_id).slice(0, 3)))
        .catch(() => setRelatedBooks([]));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  useEffect(() => {
    void load();
  }, [bookId, token]);

  useEffect(() => {
    if (!book) return;
    setSelectedTransactionType(
      book.exchange_mode === "PERMANENT_EXCHANGE" ? "PERMANENT_EXCHANGE" : "BORROW_RETURN"
    );
  }, [book?.exchange_mode]);

  const averageRating = useMemo(() => {
    if (reviews.length === 0) return null;
    return reviews.reduce((sum, review) => sum + review.rating_score, 0) / reviews.length;
  }, [reviews]);

  if (!book) return <LoadingState />;

  const isOwner = user?.user_id === book.owner_id;
  const requestable = Boolean(token && !isOwner && book.book_status === "AVAILABLE");
  const requestCost = selectedTransactionType === "PERMANENT_EXCHANGE" ? 10 : 5;
  const remainingPoints = (user?.current_points ?? 0) - requestCost;
  const canExchange = book.exchange_mode !== "BORROW_RETURN";
  const canBorrow = book.exchange_mode !== "PERMANENT_EXCHANGE";
  const selectedReceiverLocation = getDeliveryLocation(selectedReceiverLocationId);
  const ownerName = owner?.full_name ?? book.owner_full_name ?? `Thành viên #${book.owner_id}`;
  const ownerJoinedAt = owner ? formatDateOnly(owner.joined_at) : null;
  const ownerPoints = owner?.current_points;

  async function removeBook() {
    if (!token) return;
    await booksApi.remove(token, bookId);
    router.push("/app/books");
  }

  async function publishBook() {
    if (!token) return;
    const updated = await booksApi.publish(token, bookId);
    setBook(updated);
  }

  async function requestTransaction(form: HTMLFormElement) {
    if (!token) return;
    const data = new FormData(form);
    try {
      setError("");
      setMessage("");
      await transactionsApi.create(token, {
        book_id: bookId,
        transaction_type: String(data.get("transaction_type")) as TransactionType,
        delivery_method: String(data.get("delivery_method")) as DeliveryMethod,
        borrow_duration_days: data.get("borrow_duration_days") ? Number(data.get("borrow_duration_days")) : null,
        ...(String(data.get("delivery_method")) === "FREE_COURIER"
          ? {
              receiver_address: getDeliveryLocation(String(data.get("receiver_location_id"))).address,
              receiver_lat: getDeliveryLocation(String(data.get("receiver_location_id"))).lat,
              receiver_lng: getDeliveryLocation(String(data.get("receiver_location_id"))).lng
            }
          : {})
      });
      setMessage("Đã gửi yêu cầu giao dịch.");
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  return (
    <div className="space-y-7">
      <nav className="flex flex-wrap items-center gap-1 text-sm font-semibold text-slate-400">
        <Link href="/app/books" className="transition-colors hover:text-blue-700">
          Khám phá sách
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        {book.category ? (
          <>
            <span>{book.category.category_name}</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </>
        ) : null}
        <span className="text-slate-500">{book.title}</span>
      </nav>

      {error ? <Alert variant="error">{error}</Alert> : null}
      {message ? <Alert variant="success">{message}</Alert> : null}

      <section className="grid grid-cols-[240px_minmax(0,1fr)_320px] items-start gap-8 max-xl:grid-cols-[220px_minmax(0,1fr)_320px] max-lg:grid-cols-1">
        <aside className="max-lg:row-span-1">
          <div className="overflow-hidden rounded-[24px] border border-slate-200/80 bg-white shadow-sm">
            <div className="flex aspect-[3/4] items-center justify-center overflow-hidden bg-slate-50">
              {book.cover_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={book.cover_image_url}
                  alt={book.title}
                  className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
                  <BookOpen className="h-16 w-16" />
                </div>
              )}
            </div>
            <div className="grid gap-2 border-t border-slate-100 bg-white p-4">
              <div className="flex flex-wrap gap-2 justify-center">
                <Badge value={book.book_status} />
                <Badge value={book.exchange_mode} />
                <Badge value={book.book_condition} />
              </div>
            </div>
          </div>
        </aside>

        <main className="min-w-0 space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="mb-3 flex flex-wrap gap-2">
                  <Badge value={book.book_status} />
                  {book.category ? <SoftPill>{book.category.category_name}</SoftPill> : null}
                  <SoftPill tone="blue">{exchangeModeText(book.exchange_mode)}</SoftPill>
                  <SoftPill tone="emerald">{conditionText(book.book_condition)}</SoftPill>
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-950 max-md:text-2xl">{book.title}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-base text-slate-500">
                  <span className="font-medium text-slate-700">{book.author}</span>
                  {book.publication_year ? (
                    <>
                      <span>•</span>
                      <span>Năm {book.publication_year}</span>
                    </>
                  ) : null}
                  {averageRating ? (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Stars value={Math.round(averageRating)} size="sm" />
                        <span className="ml-1">({reviews.length} đánh giá)</span>
                      </span>
                    </>
                  ) : null}
                </div>
              </div>

              {isOwner ? (
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/app/books/${bookId}/edit`}
                    className="inline-flex h-9 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                  >
                    <Edit3 className="h-4 w-4" />
                    Sửa
                  </Link>
                  {book.book_status === "UNLISTED" ? (
                    <ConfirmButton size="sm" confirm="Bạn có muốn đăng lại sách này không?" onConfirm={publishBook}>
                      <RotateCcw className="h-4 w-4" />
                      Đăng lại
                    </ConfirmButton>
                  ) : null}
                  {book.book_status === "AVAILABLE" ? (
                    <ConfirmButton
                      size="sm"
                      variant="danger"
                      confirm="Bạn có muốn gỡ sách này khỏi danh sách không?"
                      onConfirm={removeBook}
                    >
                      <Trash2 className="h-4 w-4" />
                      Gỡ sách
                    </ConfirmButton>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="mt-8 rounded-2xl border border-slate-100 bg-slate-50/50 p-6">
              <h3 className="text-lg font-bold text-slate-950">Thông tin chi tiết</h3>
              <div className="mt-6 grid grid-cols-2 gap-x-8 gap-y-5 text-sm max-sm:grid-cols-1">
                <div className="flex flex-col gap-1 border-b border-slate-200/60 pb-3">
                  <span className="text-slate-500">Danh mục</span>
                  <span className="font-semibold text-slate-900">{book.category?.category_name || "-"}</span>
                </div>
                <div className="flex flex-col gap-1 border-b border-slate-200/60 pb-3">
                  <span className="text-slate-500">Chủ sách</span>
                  <span className="font-semibold text-blue-700">{ownerName}</span>
                </div>
                <div className="flex flex-col gap-1 border-b border-slate-200/60 pb-3">
                  <span className="text-slate-500">Tình trạng sách</span>
                  <span className="font-semibold text-slate-900">{conditionText(book.book_condition)}</span>
                </div>
                <div className="flex flex-col gap-1 border-b border-slate-200/60 pb-3">
                  <span className="text-slate-500">Điểm chủ sách</span>
                  <span className="font-semibold text-slate-900">{ownerPoints !== undefined ? `${ownerPoints} điểm` : "-"}</span>
                </div>
                <div className="flex flex-col gap-1 border-b border-slate-200/60 pb-3">
                  <span className="text-slate-500">Hình thức giao dịch</span>
                  <span className="font-semibold text-slate-900">{exchangeModeLongText(book.exchange_mode)}</span>
                </div>
                <div className="flex flex-col gap-1 border-b border-slate-200/60 pb-3">
                  <span className="text-slate-500">Ngày đăng</span>
                  <span className="font-semibold text-slate-900">{formatDateOnly(book.created_at)}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50/50 p-6">
              <h3 className="text-lg font-bold text-slate-950">Mô tả sách</h3>
              <div className="mt-4 text-base leading-relaxed text-slate-600 whitespace-pre-line">
                {book.book_description || "Chủ sách chưa thêm mô tả."}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-950">Đánh giá về chủ sách</h2>
              {reviews.length > 2 ? (
                <span className="text-sm font-semibold text-blue-700 hover:underline cursor-pointer">
                  Xem tất cả {reviews.length} đánh giá
                </span>
              ) : null}
            </div>
            {reviews.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                Chưa có đánh giá cho sách này.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
                {reviews.slice(0, 2).map((review, index) => (
                  <ReviewCard key={review.review_id} review={review} index={index} />
                ))}
              </div>
            )}
          </div>
        </main>

        <aside className="sticky top-24 max-lg:static max-lg:col-span-1">
          <RequestPanel
            token={token}
            isOwner={isOwner}
            requestable={requestable}
            canExchange={canExchange}
            canBorrow={canBorrow}
            selectedTransactionType={selectedTransactionType}
            selectedDeliveryMethod={selectedDeliveryMethod}
            selectedReceiverLocationId={selectedReceiverLocationId}
            selectedReceiverLocation={selectedReceiverLocation}
            borrowDays={borrowDays}
            requestCost={requestCost}
            remainingPoints={remainingPoints}
            onTransactionTypeChange={setSelectedTransactionType}
            onDeliveryMethodChange={setSelectedDeliveryMethod}
            onReceiverLocationChange={setSelectedReceiverLocationId}
            onBorrowDaysChange={setBorrowDays}
            onSubmit={onSubmit}
            onConfirmRequest={() => {
              const form = document.getElementById("request-form") as HTMLFormElement | null;
              if (form?.reportValidity()) void requestTransaction(form);
            }}
          />
        </aside>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-950">Sách tương tự</h2>
        {relatedBooks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-base text-slate-500">
            Chưa có sách tương tự trong cùng danh mục.
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1">
            {relatedBooks.map((item) => (
              <Link
                key={item.book_id}
                href={`/app/books/${item.book_id}`}
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50/40"
              >
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-blue-50 text-blue-700">
                  {item.cover_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.cover_image_url} alt={item.title} className="h-full w-full object-contain p-1" />
                  ) : (
                    <BookOpen className="h-5 w-5" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-base font-semibold text-slate-900">{item.title}</div>
                  <div className="truncate text-sm text-slate-500">{item.author}</div>
                  <div className="mt-1">
                    <Badge value={item.book_status} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function RequestPanel({
  token,
  isOwner,
  requestable,
  canExchange,
  canBorrow,
  selectedTransactionType,
  selectedDeliveryMethod,
  selectedReceiverLocationId,
  selectedReceiverLocation,
  borrowDays,
  requestCost,
  remainingPoints,
  onTransactionTypeChange,
  onDeliveryMethodChange,
  onReceiverLocationChange,
  onBorrowDaysChange,
  onSubmit,
  onConfirmRequest
}: {
  token: string | null;
  isOwner: boolean;
  requestable: boolean;
  canExchange: boolean;
  canBorrow: boolean;
  selectedTransactionType: TransactionType;
  selectedDeliveryMethod: DeliveryMethod;
  selectedReceiverLocationId: string;
  selectedReceiverLocation: ReturnType<typeof getDeliveryLocation>;
  borrowDays: string;
  requestCost: number;
  remainingPoints: number;
  onTransactionTypeChange: (value: TransactionType) => void;
  onDeliveryMethodChange: (value: DeliveryMethod) => void;
  onReceiverLocationChange: (value: string) => void;
  onBorrowDaysChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onConfirmRequest: () => void;
}) {
  if (!token) {
    return (
      <Panel>
        <h2 className="text-base font-semibold text-slate-950">Yêu cầu giao dịch</h2>
        <p className="mt-3 text-base leading-6 text-slate-500">
          Đăng nhập để gửi yêu cầu mượn hoặc trao đổi sách với thành viên đang sở hữu.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <LinkButton href="/login">Đăng nhập</LinkButton>
          <LinkButton href="/register" variant="secondary">
            Đăng ký
          </LinkButton>
        </div>
      </Panel>
    );
  }

  if (isOwner) {
    return (
      <Panel>
        <h2 className="text-base font-semibold text-slate-950">Sách của bạn</h2>
        <p className="mt-3 text-base leading-6 text-slate-500">
          Bạn là chủ sách nên không thể gửi yêu cầu giao dịch cho chính sách này.
        </p>
      </Panel>
    );
  }

  if (!requestable) {
    return (
      <Panel>
        <h2 className="text-base font-semibold text-slate-950">Yêu cầu giao dịch</h2>
        <p className="mt-3 text-base leading-6 text-slate-500">
          Sách hiện chưa khả dụng để tạo yêu cầu mới.
        </p>
      </Panel>
    );
  }

  return (
    <Panel>
      <h2 className="text-base font-semibold text-slate-950">Yêu cầu giao dịch</h2>
      <form id="request-form" className="mt-4 space-y-5" onSubmit={onSubmit}>
        <input type="hidden" name="transaction_type" value={selectedTransactionType} />
        <input type="hidden" name="delivery_method" value={selectedDeliveryMethod} />
        <input type="hidden" name="receiver_location_id" value={selectedReceiverLocationId} />

        <div>
          <Label>Chọn hình thức</Label>
          <div className="mt-2 grid gap-2">
            {canExchange ? (
              <ChoiceCard
                active={selectedTransactionType === "PERMANENT_EXCHANGE"}
                icon={<PackageCheck className="h-4 w-4" />}
                title="Trao đổi vĩnh viễn"
                subtitle="-10 điểm của bạn"
                onClick={() => onTransactionTypeChange("PERMANENT_EXCHANGE")}
              />
            ) : null}
            {canBorrow ? (
              <ChoiceCard
                active={selectedTransactionType === "BORROW_RETURN"}
                icon={<BookOpen className="h-4 w-4" />}
                title="Cho mượn"
                subtitle="-5 điểm của bạn"
                onClick={() => onTransactionTypeChange("BORROW_RETURN")}
              />
            ) : null}
          </div>
        </div>

        {selectedTransactionType === "BORROW_RETURN" ? (
          <div>
            <Label>Số ngày mượn</Label>
            <input
              name="borrow_duration_days"
              type="number"
              min={1}
              required
              value={borrowDays}
              onChange={(event) => onBorrowDaysChange(event.target.value)}
              placeholder="Ví dụ: 14"
              className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
            />
          </div>
        ) : null}

        <div>
          <Label>Phương thức nhận</Label>
          <div className="mt-2 grid gap-2">
            <ChoiceCard
              active={selectedDeliveryMethod === "DIRECT_CONTACT"}
              icon={<Handshake className="h-4 w-4" />}
              title="Tự giao"
              subtitle="Liên hệ trực tiếp"
              onClick={() => onDeliveryMethodChange("DIRECT_CONTACT")}
            />
            <ChoiceCard
              active={selectedDeliveryMethod === "FREE_COURIER"}
              icon={<Truck className="h-4 w-4" />}
              title="Dịch vụ giao sách"
              subtitle="+2 điểm cho người giao"
              tone="emerald"
              onClick={() => onDeliveryMethodChange("FREE_COURIER")}
            />
          </div>
        </div>

        {selectedDeliveryMethod === "FREE_COURIER" ? (
          <div>
            <Label>Điểm giao mong muốn</Label>
            <select
              name="receiver_location_id_select"
              value={selectedReceiverLocationId}
              onChange={(event) => onReceiverLocationChange(event.target.value)}
              className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
            >
              {DELIVERY_LOCATIONS.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.label}
                </option>
              ))}
            </select>
            <p className="mt-2 text-sm leading-5 text-slate-500">
              {FREE_COURIER_RADIUS_LABEL} · {distanceFromUetKm(selectedReceiverLocation).toFixed(2)} km từ UET
            </p>
            <p className="mt-2 text-sm leading-5 text-emerald-700">
              Chủ sách sẽ chọn điểm lấy khi duyệt yêu cầu. Courier chỉ thấy nhiệm vụ nếu cả hai điểm nằm trong khu vực họ đăng ký.
            </p>
          </div>
        ) : null}

        <div className="space-y-2 border-t border-slate-200 pt-4 text-base">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 text-slate-500">
              <Wallet className="h-4 w-4" />
              Điểm của bạn
            </span>
            <strong className="text-slate-950">{remainingPoints + requestCost} điểm</strong>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-500">Sau giao dịch</span>
            <strong className={cn(remainingPoints < 0 ? "text-red-600" : "text-blue-700")}>{remainingPoints} điểm</strong>
          </div>
        </div>

        {remainingPoints < 0 ? (
          <button
            type="button"
            disabled
            className="flex h-10 w-full items-center justify-center gap-2 rounded-full bg-slate-100 px-4 text-sm font-semibold text-slate-400 cursor-not-allowed"
          >
            Điểm không đủ
          </button>
        ) : (
          <ConfirmButton
            className="w-full"
            confirm="Bạn có muốn gửi yêu cầu giao dịch cho sách này không?"
            onConfirm={onConfirmRequest}
          >
            <Send className="h-4 w-4" />
            Gửi yêu cầu giao dịch
          </ConfirmButton>
        )}
        <p className="text-center text-sm leading-5 text-slate-400">
          Yêu cầu sẽ được gửi tới chủ sách để thống nhất điểm lấy và điểm giao trước khi courier nhận nhiệm vụ.
        </p>
      </form>
    </Panel>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_18px_46px_rgba(15,23,42,0.08)]">
      {children}
    </div>
  );
}

function ChoiceCard({
  active,
  icon,
  title,
  subtitle,
  tone = "blue",
  onClick
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  tone?: "blue" | "emerald";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-2xl border bg-slate-50 px-3 py-3 text-left transition-all",
        active && tone === "blue" && "border-blue-500 bg-blue-50 shadow-[0_0_0_3px_rgba(59,130,246,0.10)]",
        active && tone === "emerald" && "border-emerald-500 bg-emerald-50 shadow-[0_0_0_3px_rgba(16,185,129,0.10)]",
        !active && "border-slate-200 hover:border-blue-200 hover:bg-white"
      )}
    >
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          active && tone === "blue" && "bg-blue-700 text-white",
          active && tone === "emerald" && "bg-emerald-600 text-white",
          !active && "bg-white text-slate-400"
        )}
      >
        {active ? <Check className="h-4 w-4" /> : icon}
      </span>
      <span className="min-w-0">
        <span className="block text-base font-semibold text-slate-900">{title}</span>
        <span className="block text-sm text-slate-500">{subtitle}</span>
      </span>
    </button>
  );
}

function ReviewCard({ review, index }: { review: Review; index: number }) {
  const name = review.reviewer_full_name ?? `Thành viên ${index + 1}`;
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-base font-bold text-blue-700">
            {name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900">{name}</div>
            <Stars value={review.rating_score} size="sm" />
          </div>
        </div>
        <span className="text-sm text-slate-400">{formatDate(review.created_at)}</span>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        “{review.review_content || "Không có nội dung đánh giá."}”
      </p>
    </div>
  );
}

function Stars({ value, size = "md" }: { value: number; size?: "sm" | "md" }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-400">
      {[1, 2, 3, 4, 5].map((score) => (
        <Star
          key={score}
          className={cn(
            size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4",
            score <= value ? "fill-amber-400" : "fill-transparent text-slate-300"
          )}
        />
      ))}
    </span>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-sm font-semibold text-slate-500">{children}</div>;
}

function SoftPill({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "blue" | "emerald" }) {
  const styles = {
    slate: "border-slate-200 bg-slate-50 text-slate-600",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700"
  };
  return (
    <span className={cn("inline-flex h-7 items-center rounded-full border px-3 text-sm font-semibold", styles[tone])}>
      {children}
    </span>
  );
}

function conditionText(value: string) {
  const labels: Record<string, string> = {
    NEW: "Mới",
    GOOD: "Tốt",
    FAIR: "Khá",
    WORN: "Cũ"
  };
  return labels[value] ?? value;
}

function exchangeModeText(value: string) {
  const labels: Record<string, string> = {
    PERMANENT_EXCHANGE: "Trao đổi",
    BORROW_RETURN: "Cho mượn",
    BOTH: "Trao đổi / Cho mượn"
  };
  return labels[value] ?? value;
}

function exchangeModeLongText(value: string) {
  const labels: Record<string, string> = {
    PERMANENT_EXCHANGE: "Trao đổi vĩnh viễn",
    BORROW_RETURN: "Cho mượn có trả",
    BOTH: "Trao đổi vĩnh viễn hoặc cho mượn tùy yêu cầu"
  };
  return labels[value] ?? value;
}

function formatDateOnly(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(new Date(value));
}
