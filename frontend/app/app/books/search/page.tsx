"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Search, X } from "lucide-react";
import { booksApi } from "@/lib/api";
import { errorMessage } from "@/lib/api/client";
import type { Book, CategorySummary } from "@/lib/api/types";
import { useAuth } from "@/lib/auth";
import { Badge, Button, Card, EmptyState, Field, LinkButton, PageHeader, Select, TextInput } from "@/components/ui";

export default function BookSearchPage() {
  return (
    <Suspense fallback={<EmptyState title="Đang mở trang tra cứu" />}>
      <BookSearchContent />
    </Suspense>
  );
}

function BookSearchContent() {
  const { token, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [books, setBooks] = useState<Book[]>([]);
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [keyword, setKeyword] = useState(searchParams.get("q") ?? "");
  const [categoryId, setCategoryId] = useState(searchParams.get("category_id") ?? "");
  const [exchangeMode, setExchangeMode] = useState(searchParams.get("exchange_mode") ?? "");
  const [error, setError] = useState("");

  const queryText = searchParams.get("q") ?? "";

  useEffect(() => {
    setKeyword(searchParams.get("q") ?? "");
    setCategoryId(searchParams.get("category_id") ?? "");
    setExchangeMode(searchParams.get("exchange_mode") ?? "");
  }, [searchParams]);

  useEffect(() => {
    const query = searchParams.toString();
    Promise.all([booksApi.list(token, query ? `?${query}` : ""), booksApi.categorySummary()])
      .then(([bookData, categoryData]) => {
        setBooks(bookData);
        setCategories(categoryData);
        setError("");
      })
      .catch((err) => setError(errorMessage(err)));
  }, [token, searchParams]);

  const activeFilterCount = useMemo(() => {
    return [queryText, searchParams.get("category_id"), searchParams.get("exchange_mode")].filter(Boolean).length;
  }, [queryText, searchParams]);

  function buildQuery(next?: { q?: string; category?: string; mode?: string }) {
    const query = new URLSearchParams();
    const q = next?.q ?? keyword;
    const category = next?.category ?? categoryId;
    const mode = next?.mode ?? exchangeMode;
    if (q.trim()) query.set("q", q.trim());
    if (category) query.set("category_id", category);
    if (mode) query.set("exchange_mode", mode);
    return query.toString();
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = buildQuery();
    router.push(query ? `/app/books/search?${query}` : "/app/books/search");
  }

  function clearFilters() {
    setKeyword("");
    setCategoryId("");
    setExchangeMode("");
    router.push("/app/books/search");
  }

  return (
    <>
      <PageHeader
        hero
        heroIcon={<Search className="h-3.5 w-3.5" />}
        title="Kết quả tra cứu"
        description={
          queryText
            ? `${books.length} cuốn phù hợp với “${queryText}”.`
            : `${books.length} cuốn phù hợp với bộ lọc hiện tại.`
        }
        actions={<LinkButton href="/app/books" className="border border-white/30 bg-white/15 text-white hover:bg-white/25"><ArrowLeft className="h-4 w-4" /> Khám phá</LinkButton>}
        heroStat={
          <>
            <p className="text-sm font-medium text-blue-200">Tìm thấy</p>
            <div className="mt-1 text-4xl font-bold text-white">{books.length}</div>
            <p className="mt-1 text-sm text-blue-200">cuốn sách</p>
          </>
        }
      />

      <Card className="mb-5 p-4">
        <form className="grid grid-cols-[minmax(0,1fr)_190px_190px_auto_auto] items-end gap-3 max-xl:grid-cols-2 max-sm:grid-cols-1" onSubmit={submitSearch}>
          <Field label="Từ khóa">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <TextInput
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="Tên sách, tác giả..."
                className="h-12 w-full rounded-2xl border-slate-200 bg-slate-50 pl-11 pr-11 text-base shadow-none transition-colors focus:bg-white focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              />
              {keyword ? (
                <button
                  type="button"
                  onClick={() => {
                    setKeyword("");
                    const query = buildQuery({ q: "" });
                    router.push(query ? `/app/books/search?${query}` : "/app/books/search");
                  }}
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
                  aria-label="Xóa từ khóa tìm kiếm"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </Field>
          <Field label="Danh mục">
            <Select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              className="h-12 rounded-2xl border-slate-200 bg-slate-50 text-base shadow-none transition-colors focus:bg-white focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
            >
              <option value="">Tất cả</option>
              {categories.map((category) => (
                <option key={category.category_id} value={category.category_id}>
                  {category.category_name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Hình thức">
            <Select
              value={exchangeMode}
              onChange={(event) => setExchangeMode(event.target.value)}
              className="h-12 rounded-2xl border-slate-200 bg-slate-50 text-base shadow-none transition-colors focus:bg-white focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
            >
              <option value="">Tất cả</option>
              <option value="PERMANENT_EXCHANGE">Trao đổi</option>
              <option value="BORROW_RETURN">Mượn trả</option>
              <option value="BOTH">Cả hai</option>
            </Select>
          </Field>
          <Button type="submit" className="h-12 rounded-2xl px-6 max-sm:w-full shadow-md shadow-blue-500/20 text-base">
            <Search className="h-4 w-4" />
            Tra cứu
          </Button>
          <button
            type="button"
            onClick={clearFilters}
            className="flex h-12 items-center justify-center rounded-2xl bg-slate-50 px-5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-200 hover:text-slate-900 max-sm:w-full"
          >
            Xóa lọc
          </button>
        </form>
      </Card>

      {activeFilterCount ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-slate-500">Bộ lọc:</span>
          {queryText ? <Badge value={`Từ khóa: ${queryText}`} /> : null}
          {searchParams.get("category_id") ? <Badge value={`Danh mục #${searchParams.get("category_id")}`} /> : null}
          {searchParams.get("exchange_mode") ? <Badge value={String(searchParams.get("exchange_mode"))} /> : null}
        </div>
      ) : null}

      {error ? <p className="mb-4 text-base text-rose-500">{error}</p> : null}

      {books.length === 0 ? (
        <EmptyState title="Không tìm thấy sách phù hợp">
          Thử đổi từ khóa, bỏ bớt bộ lọc hoặc quay lại trang khám phá.
        </EmptyState>
      ) : (
        <div className="grid grid-cols-4 gap-5 max-xl:grid-cols-3 max-lg:grid-cols-2 max-sm:grid-cols-1">
          {books.map((book) => (
            <BookCard key={book.book_id} book={book} />
          ))}
        </div>
      )}
    </>
  );
}

function BookCard({ book }: { book: Book }) {
  return (
    <Link href={`/app/books/${book.book_id}`} className="block h-full">
      <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-blue-200/70 hover:shadow-xl hover:shadow-blue-500/10">
        <div className="relative flex aspect-[4/5] items-center justify-center overflow-hidden bg-gradient-to-b from-slate-50 via-blue-50/30 to-indigo-50/50 border-b border-slate-100">
          {book.cover_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={book.cover_image_url}
              alt={book.title}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
            />
          ) : (
            <div className="flex h-full w-full max-w-32 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 text-4xl shadow-inner">📚</div>
          )}
          <div className="absolute right-3 top-3">
            <Badge value={book.book_status} />
          </div>
        </div>
        <div className="flex flex-1 flex-col p-4">
          <h3 className="line-clamp-2 text-sm font-bold text-slate-900 group-hover:text-blue-700">{book.title}</h3>
          <p className="mt-1 text-xs text-slate-400">{book.author}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge value={book.exchange_mode} />
            <Badge value={book.book_condition} />
          </div>
          <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-400">
            <span className="truncate">👤 {book.owner_full_name ?? `Chủ sách #${book.owner_id}`}</span>
            <span className="font-bold text-blue-600">5 điểm</span>
          </div>
        </div>
      </article>
    </Link>
  );
}
