"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookMarked, BookOpen, CalendarDays, Layers, Plus, Search, X } from "lucide-react";
import { booksApi } from "@/lib/api";
import { errorMessage } from "@/lib/api/client";
import type { Book } from "@/lib/api/types";
import { useAuth } from "@/lib/auth";
import { cn, formatDate } from "@/lib/utils";
import { Alert, Badge, Card, EmptyState, LinkButton, PageHeader, TextInput } from "@/components/ui";

export default function MyBooksPage() {
  const { token, user } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token || !user) return;
    booksApi.forUser(token, user.user_id)
      .then((data) => {
        setBooks(data);
        setError("");
      })
      .catch((err) => setError(errorMessage(err)));
  }, [token, user?.user_id]);

  const filteredBooks = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return books;
    return books.filter((book) =>
      [book.title, book.author, book.book_status, book.exchange_mode]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword))
    );
  }, [books, query]);

  const availableCount = books.filter((book) => book.book_status === "AVAILABLE").length;

  return (
    <>
      <PageHeader
        hero
        heroIcon={<BookMarked className="h-3.5 w-3.5" />}
        title="Sách của tôi"
        description="Theo dõi toàn bộ sách bạn đã đăng, trạng thái hiện tại và mở nhanh trang chi tiết từng cuốn."
        actions={
          <LinkButton href="/app/books/new" className="border border-white/30 bg-white/15 text-white hover:bg-white/25">
            <Plus className="h-4 w-4" /> Đăng sách mới
          </LinkButton>
        }
        heroStat={
          <>
            <p className="text-sm font-medium text-blue-200">Thư viện cá nhân</p>
            <div className="mt-1 text-4xl font-bold text-white">{books.length}</div>
            <p className="mt-1 text-sm text-blue-200">{availableCount} đang khả dụng</p>
          </>
        }
      />

      {error ? <Alert variant="error">{error}</Alert> : null}

      <section className="mb-5 grid grid-cols-3 gap-4 max-lg:grid-cols-1">
        <SummaryCard icon={BookOpen} label="Tổng sách đã đăng" value={String(books.length)} tone="blue" />
        <SummaryCard icon={Layers} label="Đang sẵn sàng" value={String(availableCount)} tone="emerald" />
        <SummaryCard icon={CalendarDays} label="Cập nhật gần nhất" value={books[0] ? formatDate(books[0].updated_at).split(" ")[0] : "-"} tone="violet" />
      </section>

      <Card className="mb-5 p-4">
        <div className="flex items-center gap-3 max-md:flex-col">
          <div className="relative w-full flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <TextInput
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm theo tên sách, tác giả, trạng thái..."
              className="h-12 w-full rounded-2xl border-slate-200 bg-slate-50 pl-12 pr-12 text-base shadow-none transition-colors focus:bg-white focus:ring-4 focus:ring-blue-100"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white hover:text-slate-700"
                aria-label="Xóa từ khóa tìm kiếm"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <div className="flex h-12 shrink-0 items-center rounded-2xl bg-blue-50 px-4 text-sm font-semibold text-blue-700 max-md:w-full max-md:justify-center">
            {filteredBooks.length}/{books.length} cuốn
          </div>
        </div>
      </Card>

      {filteredBooks.length === 0 ? (
        <EmptyState title={books.length === 0 ? "Bạn chưa đăng cuốn sách nào" : "Không tìm thấy sách phù hợp"}>
          {books.length === 0 ? "Đăng cuốn đầu tiên để mọi người có thể gửi yêu cầu mượn hoặc trao đổi." : "Thử đổi từ khóa tìm kiếm trong danh sách sách của bạn."}
        </EmptyState>
      ) : (
        <div className="grid grid-cols-3 gap-5 max-xl:grid-cols-2 max-md:grid-cols-1">
          {filteredBooks.map((book) => (
            <Link
              key={book.book_id}
              href={`/app/books/${book.book_id}`}
              className="group block rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-100"
            >
              <Card className="flex h-full gap-4 p-4 transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_18px_38px_rgba(37,99,235,0.10)]">
                <BookCover book={book} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="line-clamp-2 text-lg font-semibold text-slate-950">{book.title}</h2>
                      <p className="mt-1 truncate text-base text-slate-500">{book.author}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700">
                      #{book.book_id}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge value={book.book_status} />
                    <Badge value={book.exchange_mode} />
                    <Badge value={book.book_condition} />
                  </div>
                  <div className="mt-4 border-t border-slate-100 pt-3 text-sm font-medium text-slate-400">
                    Cập nhật {formatDate(book.updated_at)}
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  tone = "blue"
}: {
  icon: typeof BookOpen;
  label: string;
  value: string;
  tone?: "blue" | "emerald" | "amber" | "violet";
}) {
  const toneMap: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
    amber: "bg-amber-50 text-amber-600 ring-amber-100",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    violet: "bg-violet-50 text-violet-700 ring-violet-100"
  };

  return (
    <Card className="flex flex-col items-start gap-3 p-4 transition-all hover:-translate-y-1 hover:shadow-md">
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ring-1 ring-inset", toneMap[tone])}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 w-full">
        <div className="mt-1 text-2xl font-bold tracking-tight text-slate-950">{value}</div>
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 mt-1">{label}</div>
      </div>
    </Card>
  );
}

function BookCover({ book }: { book: Book }) {
  return (
    <div className="flex h-32 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-blue-50 text-blue-700 ring-1 ring-slate-200">
      {book.cover_image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={book.cover_image_url} alt={book.title} className="h-full w-full object-cover" />
      ) : (
        <BookOpen className="h-8 w-8" />
      )}
    </div>
  );
}
