"use client";

import { useEffect, useState } from "react";
import { booksApi, adminApi } from "@/lib/api";
import { errorMessage } from "@/lib/api/client";
import type { Book } from "@/lib/api/types";
import { useAuth } from "@/lib/auth";
import { Alert, Badge, ConfirmButton, EmptyState, PageHeader } from "@/components/ui";
import { Book as BookIcon } from "lucide-react";

export default function AdminBooksPage() {
  const { token, user } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [error, setError] = useState("");

  async function load() {
    if (!token || user?.role !== "ADMIN") return;
    try {
      // Temporary: using public books list until admin endpoint is available
      setBooks(await booksApi.list(token));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  useEffect(() => {
    void load();
  }, [token, user?.role]);

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
        description="Giám sát sách trong hệ thống. (Lưu ý: Chức năng đang dùng danh sách công khai tạm thời)."
        heroStat={
          <>
            <p className="text-sm font-medium text-blue-200">Tổng sách</p>
            <div className="mt-1 text-4xl font-bold text-white">{books.length}</div>
          </>
        }
      />

      {error ? <Alert variant="error">{error}</Alert> : null}

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
                  <td className="px-6 py-4">{item.owner_full_name || `User #${item.owner_id}`}</td>
                  <td className="px-6 py-4"><Badge value={item.book_status} /></td>
                  <td className="px-6 py-4 text-right">
                    <ConfirmButton size="sm" variant="danger" confirm="Bạn có chắc muốn ẩn sách này?" onConfirm={() => run(() => adminApi.hideBook(token!, item.book_id))}>
                      Ẩn sách
                    </ConfirmButton>
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
    </div>
  );
}
