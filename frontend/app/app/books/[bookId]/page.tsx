"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { booksApi, reviewsApi, transactionsApi } from "@/lib/api";
import { errorMessage } from "@/lib/api/client";
import type { Book, DeliveryMethod, Review, TransactionType } from "@/lib/api/types";
import { useAuth } from "@/lib/auth";
import { DELIVERY_LOCATIONS, FREE_COURIER_RADIUS_LABEL, getDeliveryLocation } from "@/lib/delivery-locations";
import { formatDate } from "@/lib/utils";
import { Alert, Badge, Card, ConfirmButton, Field, LinkButton, LoadingState, PageHeader, Select, TextInput } from "@/components/ui";

export default function BookDetailPage() {
  const params = useParams<{ bookId: string }>();
  const router = useRouter();
  const { token, user } = useAuth();
  const bookId = Number(params.bookId);
  const [book, setBook] = useState<Book | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [selectedTransactionType, setSelectedTransactionType] = useState<TransactionType>(
    book?.exchange_mode === "PERMANENT_EXCHANGE" ? "PERMANENT_EXCHANGE" : "BORROW_RETURN"
  );
  const [selectedDeliveryMethod, setSelectedDeliveryMethod] = useState<DeliveryMethod>("DIRECT_CONTACT");
  const [selectedReceiverLocationId, setSelectedReceiverLocationId] = useState(DELIVERY_LOCATIONS[0].id);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    try {
      const [bookData, reviewData] = await Promise.all([booksApi.detail(token, bookId), token ? reviewsApi.forBook(token, bookId) : Promise.resolve([])]);
      setBook(bookData);
      setReviews(reviewData);
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

  if (!book) return <LoadingState />;

  const isOwner = user?.user_id === book.owner_id;
  const requestable = Boolean(token && !isOwner && book.book_status === "AVAILABLE");

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
    <>
      <PageHeader
        title={book.title}
        description={`${book.author} ${book.publication_year ? `- ${book.publication_year}` : ""}`}
        actions={
          isOwner ? (
            <>
              <Link className="text-sm font-semibold text-blue-700 hover:text-blue-800" href={`/app/books/${bookId}/edit`}>
                Sửa
              </Link>
              {book.book_status === "UNLISTED" ? (
                <ConfirmButton confirm="Bạn có muốn đăng lại sách này không?" onConfirm={publishBook}>
                  Đăng lại
                </ConfirmButton>
              ) : null}
              {book.book_status === "AVAILABLE" ? (
                <ConfirmButton variant="danger" confirm="Bạn có muốn gỡ sách này khỏi danh sách không?" onConfirm={removeBook}>
                  Gỡ sách
                </ConfirmButton>
              ) : null}
            </>
          ) : null
        }
      />
      <div className="grid grid-cols-[2fr_1fr] gap-4 max-lg:grid-cols-1">
        <Card>
          <div className="mb-4 flex aspect-[16/9] items-center justify-center overflow-hidden rounded-2xl bg-blue-50">
            {book.cover_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={book.cover_image_url} alt={book.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-5xl">📚</div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge value={book.book_status} />
            <Badge value={book.exchange_mode} />
            <Badge value={book.book_condition} />
            {book.category ? <Badge value={book.category.category_name} /> : null}
          </div>
          <div className="mt-5 rounded-2xl bg-slate-50 p-4">
            <h2 className="text-sm font-bold text-slate-950">Mô tả sách</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">
              {book.book_description || "Chủ sách chưa thêm mô tả."}
            </p>
          </div>
        </Card>
        <div className="flex flex-col gap-4">
          {!token ? (
            <Card>
              <h2 className="text-sm font-semibold text-slate-900">Muốn yêu cầu cuốn sách này?</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Khách có thể xem thông tin sách. Để gửi yêu cầu mượn hoặc trao đổi, bạn cần đăng nhập hoặc tạo tài khoản thành viên.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <LinkButton href="/login">Đăng nhập</LinkButton>
                <LinkButton href="/register" variant="secondary">Đăng ký</LinkButton>
              </div>
            </Card>
          ) : requestable ? (
            <Card>
              <h2 className="text-sm font-semibold text-slate-900">Yêu cầu giao dịch</h2>
              <form id="request-form" className="mt-4 flex flex-col gap-3" onSubmit={onSubmit}>
                {error ? <Alert variant="error">{error}</Alert> : null}
                {message ? <Alert variant="success">{message}</Alert> : null}
                <Field label="Loại giao dịch">
                  <Select
                    name="transaction_type"
                    value={selectedTransactionType}
                    onChange={(event) => setSelectedTransactionType(event.target.value as TransactionType)}
                  >
                    {book.exchange_mode !== "BORROW_RETURN" ? <option value="PERMANENT_EXCHANGE">Trao đổi vĩnh viễn</option> : null}
                    {book.exchange_mode !== "PERMANENT_EXCHANGE" ? <option value="BORROW_RETURN">Mượn trả</option> : null}
                  </Select>
                </Field>
                <Field label="Số ngày mượn">
                  <TextInput
                    name="borrow_duration_days"
                    type="number"
                    min={1}
                    required={selectedTransactionType === "BORROW_RETURN"}
                    disabled={selectedTransactionType !== "BORROW_RETURN"}
                    placeholder={selectedTransactionType === "BORROW_RETURN" ? "Ví dụ: 14" : "Không áp dụng cho trao đổi"}
                  />
                  <span className="text-xs leading-5 text-slate-500">
                    Mượn trả luôn cần hạn trả, kể cả khi hai bên tự liên hệ và giao sách trực tiếp.
                  </span>
                </Field>
                <Field label="Giao nhận">
                  <Select
                    name="delivery_method"
                    value={selectedDeliveryMethod}
                    onChange={(event) => setSelectedDeliveryMethod(event.target.value as DeliveryMethod)}
                  >
                    <option value="DIRECT_CONTACT">Liên hệ trực tiếp</option>
                    <option value="FREE_COURIER">Dịch vụ giao sách miễn phí</option>
                  </Select>
                </Field>
                {selectedDeliveryMethod === "FREE_COURIER" ? (
                  <Field label="Điểm nhận sách">
                    <Select
                      name="receiver_location_id"
                      value={selectedReceiverLocationId}
                      onChange={(event) => setSelectedReceiverLocationId(event.target.value)}
                    >
                      {DELIVERY_LOCATIONS.map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.label}
                        </option>
                      ))}
                    </Select>
                    <span className="text-xs leading-5 text-slate-500">
                      {FREE_COURIER_RADIUS_LABEL}. Nếu muốn giao ngoài khu vực này, hai bên nên tự liên hệ hoặc đặt ship ngoài.
                    </span>
                  </Field>
                ) : null}
                <ConfirmButton
                  confirm="Bạn có muốn gửi yêu cầu giao dịch cho sách này không?"
                  onConfirm={() => {
                    const form = document.getElementById("request-form") as HTMLFormElement | null;
                    if (form?.reportValidity()) void requestTransaction(form);
                  }}
                >
                  Gửi yêu cầu
                </ConfirmButton>
              </form>
            </Card>
          ) : null}
          <Card>
            <h2 className="text-sm font-semibold text-slate-900">Đánh giá sách</h2>
            <div className="mt-3 flex flex-col gap-3">
              {reviews.length === 0 ? <p className="text-sm text-slate-500">Chưa có đánh giá.</p> : null}
              {reviews.map((review) => (
                <div key={review.review_id} className="rounded-2xl border border-slate-200 bg-white p-3 text-sm shadow-sm">
                  <div className="font-medium text-amber-500">{review.rating_score}/5 sao</div>
                  <p className="mt-1 text-slate-700">{review.review_content || "Không có nội dung"}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatDate(review.created_at)}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
