"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import {
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { booksApi } from "@/lib/api";
import { errorMessage } from "@/lib/api/client";
import type { Book, CategorySummary } from "@/lib/api/types";
import { useAuth } from "@/lib/auth";
import { Badge, EmptyState, LinkButton, Button } from "@/components/ui";

export default function BooksPage() {
  const { token, user } = useAuth();
  const router = useRouter();
  const [books, setBooks] = useState<Book[]>([]);
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [keyword, setKeyword] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function load(params = "") {
    try {
      setError("");
      const [bookData, categoryData] = await Promise.all([
        booksApi.list(token, params),
        booksApi.categorySummary()
      ]);
      setBooks(bookData);
      setCategories(categoryData);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  function buildQuery(next?: { q?: string; categoryId?: number | null }) {
    const query = new URLSearchParams();
    const q = next?.q ?? keyword;
    const categoryId = next?.categoryId ?? selectedCategoryId;
    if (q.trim()) query.set("q", q.trim());
    if (categoryId) query.set("category_id", String(categoryId));
    return query.toString();
  }

  function openSearch(next?: { q?: string; categoryId?: number | null }) {
    const query = buildQuery(next);
    router.push(query ? `/app/books/search?${query}` : "/app/books/search");
  }

  function onFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    openSearch();
  }

  return (
    <>
      {/* Hero Section */}
      <section className="relative -mx-8 -mt-8 mb-8 max-lg:-mx-5 max-sm:-mx-4">
        {/* Background with gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djZoNnYtNmgtNnptNiA2aDZ2Nmg2di02aC02em0tMTIgMGg2djZoLTZ2LTZ6bS0xMiAwaDZ2Nmg2di02aC02em0yNCAwaC02di02aDZ2NnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-60" />
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#f0f4f9] to-transparent" />
        <div className="relative px-8 pb-16 pt-10 max-lg:px-5 max-sm:px-4">
          <div className="grid grid-cols-[minmax(0,1fr)_220px] items-start gap-6 max-lg:grid-cols-1">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-sm font-semibold text-blue-100 backdrop-blur-sm">
                <Sparkles className="h-3.5 w-3.5" />
                Thư viện chia sẻ UET
              </div>
              <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-white max-sm:text-2xl">
                Tìm cuốn sách tiếp theo bạn muốn mượn
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-blue-100">
                Tra cứu theo tên sách hoặc tác giả, rồi mở trang kết quả để xem những cuốn đang sẵn sàng trong cộng đồng.
              </p>
            </div>
            <div className="relative rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-sm max-lg:hidden">
              <p className="text-sm font-medium text-blue-200">Sách đang có</p>
              <div className="mt-1 text-4xl font-bold text-white">{books.length}</div>
              <p className="mt-1 text-sm text-blue-200">Đang khả dụng</p>
            </div>
          </div>

          <form
            className="relative mt-6 flex max-w-3xl items-center gap-2 rounded-2xl border border-white/20 bg-white/15 p-2 shadow-xl shadow-blue-900/20 backdrop-blur-sm max-sm:flex-col"
            onSubmit={onFilter}
          >
            <div className="relative w-full">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60" />
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="Tìm kiếm theo tên sách, tác giả..."
                className="h-11 w-full rounded-xl border-0 bg-white/20 pl-10 pr-11 text-sm text-white placeholder:text-white/50 outline-none focus:bg-white/30 focus:ring-2 focus:ring-white/40"
              />
              {keyword ? (
                <button
                  type="button"
                  onClick={() => {
                    setKeyword("");
                    openSearch({ q: "" });
                  }}
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/20 hover:text-white"
                  aria-label="Xóa từ khóa tìm kiếm"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
            <Button className="h-11 shrink-0 rounded-xl bg-white px-6 text-blue-700 shadow-lg hover:bg-blue-50 hover:shadow-xl max-sm:w-full">
              <Search className="h-4 w-4" />
              Tìm kiếm
            </Button>
          </form>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-blue-200">Gợi ý nhanh:</span>
            {["Clean Code", "Nhà Giả Kim", "Atomic Habits", "Deep Work"].map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => {
                  setKeyword(suggestion);
                  openSearch({ q: suggestion });
                }}
                className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm font-medium text-white/80 backdrop-blur-sm transition-all hover:border-white/40 hover:bg-white/20 hover:text-white"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </section>
      {/* Categories Section */}
      <section className="mb-8">
        <div className="mb-4 flex items-end justify-between gap-3 max-sm:flex-col max-sm:items-start">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Danh mục</h2>
            <p className="mt-1 text-sm text-slate-500">Lướt nhanh theo nhóm sách, bấm để mở trang kết quả của danh mục đó.</p>
          </div>
          <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">{categories.length} danh mục</span>
        </div>
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-3">
          {categories.map((category) => {
            const selected = selectedCategoryId === category.category_id;
            return (
              <button
                key={category.category_id}
                type="button"
                onClick={() => {
                  setSelectedCategoryId(category.category_id);
                  openSearch({ categoryId: category.category_id });
                }}
                className={`group relative flex min-h-24 w-[180px] shrink-0 flex-col justify-between overflow-hidden rounded-2xl border bg-white px-4 py-3.5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                  selected
                    ? "border-blue-400 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-md ring-2 ring-blue-500/20"
                    : "border-slate-200 hover:border-blue-200 hover:bg-blue-50/30"
                }`}
              >
                <div className={`h-1.5 w-10 rounded-full transition-all duration-300 ${ selected ? "w-14 bg-blue-500" : "bg-slate-200 group-hover:bg-blue-300" }`} />
                <div>
                  <div className={`text-sm font-bold leading-5 ${ selected ? "text-blue-700" : "text-slate-900" }`}>{category.category_name}</div>
                  <div className="mt-0.5 text-xs font-medium text-slate-400">{category.book_count} sách</div>
                </div>
              </button>
            );
          })}
        </div>
      </section>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Sách mới đăng gần đây</h2>
          <p className="mt-1 text-sm text-slate-500">{books.length} cuốn đang sẵn sàng để cộng đồng yêu cầu.</p>
        </div>
        {user ? (
          <LinkButton href="/app/books/new" className="shrink-0">
            + Đăng sách
          </LinkButton>
        ) : (
          <div className="flex shrink-0 flex-wrap gap-2">
            <LinkButton href="/login" variant="secondary">Đăng nhập để đăng sách</LinkButton>
            <LinkButton href="/register">Đăng ký</LinkButton>
          </div>
        )}
      </div>
      {error ? <p className="mb-4 text-sm text-rose-500">{error}</p> : null}
      {books.length === 0 ? (
        <EmptyState title="Chưa có sách nào">Hãy thử bộ lọc khác hoặc đăng nhập để đăng cuốn sách đầu tiên của bạn.</EmptyState>
      ) : (
        <div className="grid grid-cols-4 gap-5 max-xl:grid-cols-3 max-lg:grid-cols-2 max-sm:grid-cols-1">
          {books.map((book) => (
            <Link key={book.book_id} href={`/app/books/${book.book_id}`} className="block">
              <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-blue-200/70 hover:shadow-xl hover:shadow-blue-500/10">
                <div className="relative flex aspect-[3/4] items-center justify-center overflow-hidden bg-gradient-to-b from-slate-50 via-blue-50/30 to-indigo-50/50 border-b border-slate-100">
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
          ))}
        </div>
      )}
    </>
  );
}
