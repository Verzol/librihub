"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import {
  BookMarked,
  BriefcaseBusiness,
  Brain,
  Crown,
  Medal,
  Microscope,
  Palette,
  Search,
  Sparkles,
  Star,
  Trophy,
  Truck,
  type LucideIcon
} from "lucide-react";
import { booksApi } from "@/lib/api";
import { errorMessage } from "@/lib/api/client";
import type { Book, CategorySummary, CommunityLeaderboard } from "@/lib/api/types";
import { useAuth } from "@/lib/auth";
import { Badge, Card, EmptyState, Field, LinkButton, PageHeader, Select, TextInput, Button } from "@/components/ui";

export default function BooksPage() {
  const { token, user } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [leaderboard, setLeaderboard] = useState<CommunityLeaderboard | null>(null);
  const [mine, setMine] = useState(false);
  const [error, setError] = useState("");

  async function load(params = "") {
    try {
      setError("");
      const [bookData, categoryData, leaderboardData] = await Promise.all([
        booksApi.list(token, params),
        booksApi.categorySummary(),
        booksApi.leaderboard()
      ]);
      setBooks(bookData);
      setCategories(categoryData);
      setLeaderboard(leaderboardData);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  function onFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const query = new URLSearchParams();
    if (user && mine) query.set("mine", "true");
    if (data.get("q")) query.set("q", String(data.get("q")));
    if (data.get("category_id")) query.set("category_id", String(data.get("category_id")));
    if (data.get("exchange_mode")) query.set("exchange_mode", String(data.get("exchange_mode")));
    void load(`?${query.toString()}`);
  }

  return (
    <>
      <section className="relative -mx-10 -mt-7 mb-7 overflow-hidden bg-blue-800 px-10 py-12 text-white max-lg:-mx-5 max-lg:px-5 max-sm:-mx-4 max-sm:px-4">
        <div className="absolute inset-y-0 right-0 w-1/2 bg-blue-700/40 [clip-path:polygon(28%_0,100%_0,100%_100%,52%_100%)]" />
        <div className="absolute -bottom-28 -left-24 h-72 w-72 rounded-full bg-blue-600/20 blur-3xl" />
        <div className="relative w-full">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-blue-50 ring-1 ring-white/15">
            <Sparkles className="h-3.5 w-3.5" />
            Cộng đồng chia sẻ sách UET
          </div>
          <h1 className="text-4xl font-bold tracking-tight max-sm:text-3xl">Tìm sách bạn muốn đọc</h1>
          <p className="mt-2 text-base text-blue-100">Kết nối với cộng đồng - Chia sẻ tri thức - Tích lũy điểm thưởng</p>
          <form className="mt-7 grid w-full grid-cols-[minmax(0,1fr)_200px] gap-5 max-lg:grid-cols-[minmax(0,1fr)_170px] max-sm:grid-cols-1" onSubmit={onFilter}>
            <div className="relative w-full">
              <Search className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <TextInput name="q" placeholder="Tìm kiếm theo tên sách, tác giả, ISBN..." className="h-14 w-full rounded-full border-0 pl-12 pr-5 text-slate-900 shadow-[0_18px_36px_rgba(15,23,42,0.18)]" />
            </div>
            <Button className="h-14 rounded-full bg-blue-500 px-12 shadow-[0_18px_36px_rgba(15,23,42,0.18)] hover:bg-blue-400 max-sm:w-full">
              <Search className="h-4 w-4" />
              Tìm kiếm
            </Button>
          </form>
          <p className="mt-4 text-xs text-blue-100/80">Phổ biến: Clean Code · Nhà Giả Kim · Atomic Habits · Deep Work</p>
        </div>
      </section>
      <section className="mb-6">
        <h2 className="mb-3 text-lg font-bold text-slate-900">Danh mục</h2>
        <div className="grid grid-cols-6 gap-4 max-xl:grid-cols-3 max-md:grid-cols-2 max-sm:grid-cols-1">
          {categories.map((category, index) => {
            const icons = [BookMarked, Brain, Microscope, BriefcaseBusiness, Palette, Star];
            const Icon = icons[index % icons.length];
            return (
              <button
                key={category.category_id}
                type="button"
                onClick={() => void load(`?category_id=${category.category_id}`)}
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-[0_10px_28px_rgba(15,23,42,0.05)] transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50/40"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-800">{category.category_name}</div>
                  <div className="text-xs text-slate-400">{category.book_count} sách</div>
                </div>
              </button>
            );
          })}
        </div>
      </section>
      <section className="mb-7">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Bảng xếp hạng cộng đồng</h2>
          <span className="text-xs font-medium text-slate-400">Cập nhật từ dữ liệu hệ thống</span>
        </div>
        <div className="grid grid-cols-3 gap-4 max-lg:grid-cols-1">
          <LeaderboardCard
            title="Top sách được mượn"
            icon={Trophy}
            empty="Chưa có sách hoàn tất giao dịch."
            items={(leaderboard?.top_books ?? []).map((book) => ({
              id: book.book_id,
              title: book.title,
              subtitle: `${book.author}${book.category_name ? ` · ${book.category_name}` : ""}`,
              metric: `${book.borrow_count} lượt`
            }))}
          />
          <LeaderboardCard
            title="Top người giao uy tín"
            icon={Truck}
            empty="Chưa có courier được duyệt."
            items={(leaderboard?.top_couriers ?? []).map((courier) => ({
              id: courier.courier_id,
              title: courier.full_name,
              subtitle: courier.delivery_area,
              metric: `${courier.successful_delivery_count} đơn`
            }))}
          />
          <LeaderboardCard
            title="Top điểm cao"
            icon={Crown}
            empty="Chưa có dữ liệu điểm."
            items={(leaderboard?.top_point_users ?? []).map((user) => ({
              id: user.user_id,
              title: user.full_name,
              subtitle: `Thành viên #${user.user_id}`,
              metric: `${user.current_points} điểm`
            }))}
          />
        </div>
      </section>
      <PageHeader
        title="Sách mới đăng gần đây"
        description="Những cuốn sách đang sẵn sàng để cộng đồng yêu cầu."
        actions={
          user ? (
            <LinkButton href="/app/books/new">+ Đăng sách</LinkButton>
          ) : (
            <div className="flex flex-wrap gap-2">
              <LinkButton href="/login" variant="secondary">Đăng nhập để đăng sách</LinkButton>
              <LinkButton href="/register">Đăng ký</LinkButton>
            </div>
          )
        }
      />
      <Card className="mb-5 p-3">
        <form className="grid grid-cols-[1fr_180px_180px_auto_auto] items-end gap-3 max-lg:grid-cols-2 max-sm:grid-cols-1" onSubmit={onFilter}>
          <Field label="Từ khóa">
            <TextInput name="q" placeholder="Tên sách, tác giả..." />
          </Field>
          <Field label="Danh mục">
            <Select name="category_id">
              <option value="">Tất cả</option>
              {categories.map((category) => (
                <option key={category.category_id} value={category.category_id}>
                  {category.category_name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Hình thức">
            <Select name="exchange_mode">
              <option value="">Tất cả</option>
              <option value="PERMANENT_EXCHANGE">Trao đổi</option>
              <option value="BORROW_RETURN">Mượn trả</option>
              <option value="BOTH">Cả hai</option>
            </Select>
          </Field>
          {user ? (
            <label className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-600">
              <input type="checkbox" checked={mine} onChange={(event) => setMine(event.target.checked)} className="rounded border-slate-300 bg-white text-blue-700" />
              Sách của tôi
            </label>
          ) : (
            <Link href="/login" className="flex items-center justify-center rounded-xl bg-slate-50 px-3 py-2.5 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50">
              Đăng nhập để xem sách của tôi
            </Link>
          )}
          <Button>
            <Search className="h-4 w-4" />
            Lọc
          </Button>
        </form>
      </Card>
      {error ? <p className="mb-4 text-sm text-rose-400">{error}</p> : null}
      {books.length === 0 ? (
        <EmptyState title="Chưa có sách nào">Hãy thử bộ lọc khác hoặc đăng nhập để đăng cuốn sách đầu tiên của bạn.</EmptyState>
      ) : (
        <div className="grid grid-cols-4 gap-5 max-xl:grid-cols-3 max-lg:grid-cols-2 max-sm:grid-cols-1">
          {books.map((book) => (
            <Link key={book.book_id} href={`/app/books/${book.book_id}`} className="block">
              <Card className="group h-full overflow-hidden p-0 transition-all duration-200 hover:-translate-y-1 hover:border-blue-200 hover:shadow-[0_20px_40px_rgba(37,99,235,0.12)]">
                <div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-blue-50">
                  {book.cover_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={book.cover_image_url} alt={book.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                  ) : (
                    <div className="flex h-28 w-20 items-center justify-center rounded-xl bg-blue-100 text-3xl shadow-inner">📚</div>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="line-clamp-2 text-base font-bold text-slate-900">{book.title}</h2>
                      <p className="mt-1 text-sm text-slate-500">{book.author}</p>
                    </div>
                    <Badge value={book.book_status} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge value={book.exchange_mode} />
                    <Badge value={book.book_condition} />
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-400">
                    <span>👤 Chủ sách #{book.owner_id}</span>
                    <span className="font-bold text-blue-700">5 điểm</span>
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

function LeaderboardCard({
  title,
  icon: Icon,
  items,
  empty
}: {
  title: string;
  icon: LucideIcon;
  items: Array<{ id: number; title: string; subtitle: string; metric: string }>;
  empty: string;
}) {
  return (
    <Card className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <Icon className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        </div>
        <Medal className="h-4 w-4 text-amber-500" />
      </div>
      {items.length === 0 ? (
        <p className="rounded-xl bg-slate-50 px-3 py-4 text-sm text-slate-500">{empty}</p>
      ) : (
        <div className="space-y-2">
          {items.slice(0, 5).map((item, index) => (
            <div key={item.id} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-xs font-bold text-blue-700 shadow-sm">
                {index + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-slate-900">{item.title}</div>
                <div className="truncate text-xs text-slate-500">{item.subtitle}</div>
              </div>
              <div className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">{item.metric}</div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
