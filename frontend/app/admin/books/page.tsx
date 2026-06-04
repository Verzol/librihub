"use client";

import { useEffect, useState } from "react";
import { booksApi, adminApi } from "@/lib/api";
import { errorMessage } from "@/lib/api/client";
import type { AdminBook, Category } from "@/lib/api/types";
import { useAuth } from "@/lib/auth";
import { Alert, Badge, Button, ConfirmButton, EmptyState, PageHeader, Select, TextInput } from "@/components/ui";
import { Book as BookIcon } from "lucide-react";

const PAGE_SIZE = 50;

export default function AdminBooksPage() {
  const { token, user } = useAuth();
  const [books, setBooks] = useState<AdminBook[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [bookStatus, setBookStatus] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [page, setPage] = useState(0);

  async function load() {
    if (!token || user?.role !== "ADMIN") return;
    try {
      setBooks(await adminApi.books(token, {
        q: query.trim(),
        book_status: bookStatus,
        category_id: categoryId,
        owner_id: ownerId,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE
      }));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  useEffect(() => {
    void load();
  }, [token, user?.role, query, bookStatus, categoryId, ownerId, page]);

  useEffect(() => {
    booksApi.categories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  if (user?.role !== "ADMIN") return null;

  async function run(action: () => Promise<unknown>) {
    try {
      setError("");
      await action();
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        hero
        heroIcon={<BookIcon className="h-4 w-4" />}
        title="Quản lý Sách & Thể loại"
        description="Giám sát sách trong hệ thống và xử lý sách vi phạm bằng trạng thái mềm."
        heroStat={
          <>
            <p className="text-sm font-medium text-blue-200">Tổng sách</p>
            <div className="mt-1 text-4xl font-bold text-white">{books.length}</div>
          </>
        }
      />

      {error ? <Alert variant="error">{error}</Alert> : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-[minmax(220px,1fr)_180px_180px_150px_auto] gap-3 max-xl:grid-cols-3 max-md:grid-cols-2 max-sm:grid-cols-1">
          <TextInput
            value={query}
            onChange={(event) => {
              setPage(0);
              setQuery(event.target.value);
            }}
            placeholder="Tìm theo tên sách hoặc tác giả"
          />
          <Select
            value={bookStatus}
            onChange={(event) => {
              setPage(0);
              setBookStatus(event.target.value);
            }}
            aria-label="Lọc trạng thái sách"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="AVAILABLE">Có sẵn</option>
            <option value="PENDING_TRANSACTION">Đang có giao dịch</option>
            <option value="BORROWED">Đang mượn</option>
            <option value="EXCHANGED">Đã trao đổi</option>
            <option value="REMOVED">Đã ẩn</option>
          </Select>
          <Select
            value={categoryId}
            onChange={(event) => {
              setPage(0);
              setCategoryId(event.target.value);
            }}
            aria-label="Lọc thể loại"
          >
            <option value="">Tất cả thể loại</option>
            {categories.map((category) => (
              <option key={category.category_id} value={category.category_id}>
                {category.category_name}
              </option>
            ))}
          </Select>
          <TextInput
            value={ownerId}
            onChange={(event) => {
              setPage(0);
              setOwnerId(event.target.value);
            }}
            type="number"
            min="1"
            placeholder="Owner ID"
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setQuery("");
              setBookStatus("");
              setCategoryId("");
              setOwnerId("");
              setPage(0);
            }}
          >
            Xóa lọc
          </Button>
        </div>
      </section>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col h-[600px]">
        <div className="flex-1 overflow-auto p-0">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="sticky top-0 bg-slate-50 text-slate-500 ring-1 ring-slate-200 shadow-sm z-10">
              <tr>
                <th className="px-6 py-4 font-semibold">Sách</th>
                <th className="px-6 py-4 font-semibold">Chủ sở hữu</th>
                <th className="px-6 py-4 font-semibold">Trạng thái</th>
                <th className="px-6 py-4 font-semibold text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {books.map((item) => (
                <tr key={item.book_id} className="transition-colors hover:bg-slate-50/50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                        <BookIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-900">#{item.book_id} {item.title}</div>
                        <div className="text-slate-500">{item.author}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">User #{item.owner_id}</td>
                  <td className="px-6 py-4"><Badge value={item.book_status} /></td>
                  <td className="px-6 py-4 text-right">
                    {item.book_status === "REMOVED" ? (
                      <ConfirmButton size="sm" confirm="Bạn có muốn khôi phục sách này?" onConfirm={() => run(() => adminApi.restoreBook(token!, item.book_id))}>
                        Khôi phục
                      </ConfirmButton>
                    ) : (
                      <ConfirmButton
                        size="sm"
                        variant="danger"
                        disabled={item.book_status === "PENDING_TRANSACTION"}
                        confirm={
                          item.book_status === "PENDING_TRANSACTION"
                            ? "Sách đang có giao dịch nên backend sẽ không cho ẩn."
                            : "Bạn có chắc muốn ẩn sách này?"
                        }
                        onConfirm={() => run(() => adminApi.hideBook(token!, item.book_id))}
                      >
                        Ẩn sách
                      </ConfirmButton>
                    )}
                  </td>
                </tr>
              ))}
              {books.length === 0 && !error && (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-slate-500">
                    <EmptyState title="Không có sách nào" />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">
          Trang {page + 1} · Hiển thị tối đa {PAGE_SIZE} sách
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>
            Trước
          </Button>
          <Button type="button" variant="secondary" disabled={books.length < PAGE_SIZE} onClick={() => setPage((value) => value + 1)}>
            Sau
          </Button>
        </div>
      </div>
    </div>
  );
}
