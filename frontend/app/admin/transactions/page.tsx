"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { adminApi } from "@/lib/api";
import { errorMessage } from "@/lib/api/client";
import type { AdminTransaction } from "@/lib/api/types";
import { Alert, Badge, Button, ConfirmButton, EmptyState, PageHeader, Select, TextInput } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { Repeat } from "lucide-react";

const PAGE_SIZE = 50;
const FINAL_STATUSES = ["COMPLETED", "CANCELLED", "REJECTED"];

export default function AdminTransactionsPage() {
  const { token, user } = useAuth();
  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [transactionStatus, setTransactionStatus] = useState("");
  const [transactionType, setTransactionType] = useState("");
  const [userId, setUserId] = useState("");
  const [bookId, setBookId] = useState("");
  const [page, setPage] = useState(0);

  async function load() {
    if (!token || user?.role !== "ADMIN") return;
    try {
      setTransactions(await adminApi.transactions(token, {
        transaction_status: transactionStatus,
        transaction_type: transactionType,
        user_id: userId,
        book_id: bookId,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE
      }));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  useEffect(() => {
    void load();
  }, [token, user?.role, transactionStatus, transactionType, userId, bookId, page]);

  if (user?.role !== "ADMIN") return null;

  async function cancelTransaction(transaction: AdminTransaction) {
    if (!token) return;
    try {
      setError("");
      setSuccess("");
      await adminApi.cancelTransaction(token, transaction.transaction_id);
      setSuccess(`Giao dịch #${transaction.transaction_id} đã được hủy thành công.`);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        hero
        heroIcon={<Repeat className="h-4 w-4" />}
        title="Quản lý giao dịch"
        description="Giám sát và can thiệp khẩn cấp vào các giao dịch của người dùng."
        heroStat={
          <>
            <p className="text-sm font-medium text-blue-200">Đang hiển thị</p>
            <div className="mt-1 text-4xl font-bold text-white">{transactions.length}</div>
          </>
        }
      />

      {error ? <Alert variant="error">{error}</Alert> : null}
      {success ? <Alert variant="success">{success}</Alert> : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-[180px_180px_150px_150px_auto] gap-3 max-xl:grid-cols-3 max-md:grid-cols-2 max-sm:grid-cols-1">
          <Select
            value={transactionStatus}
            onChange={(event) => {
              setPage(0);
              setTransactionStatus(event.target.value);
            }}
            aria-label="Lọc trạng thái giao dịch"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="PENDING">Chờ xử lý</option>
            <option value="ACCEPTED">Đã chấp nhận</option>
            <option value="DELIVERING">Đang giao</option>
            <option value="BORROWING">Đang mượn</option>
            <option value="RETURN_PENDING">Chờ trả sách</option>
            <option value="COMPLETED">Hoàn tất</option>
            <option value="CANCELLED">Đã hủy</option>
            <option value="REJECTED">Đã từ chối</option>
          </Select>
          <Select
            value={transactionType}
            onChange={(event) => {
              setPage(0);
              setTransactionType(event.target.value);
            }}
            aria-label="Lọc loại giao dịch"
          >
            <option value="">Tất cả loại</option>
            <option value="PERMANENT_EXCHANGE">Trao đổi vĩnh viễn</option>
            <option value="BORROW_RETURN">Cho mượn</option>
          </Select>
          <TextInput
            value={userId}
            onChange={(event) => {
              setPage(0);
              setUserId(event.target.value);
            }}
            type="number"
            min="1"
            placeholder="User ID"
          />
          <TextInput
            value={bookId}
            onChange={(event) => {
              setPage(0);
              setBookId(event.target.value);
            }}
            type="number"
            min="1"
            placeholder="Book ID"
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setTransactionStatus("");
              setTransactionType("");
              setUserId("");
              setBookId("");
              setPage(0);
            }}
          >
            Xóa lọc
          </Button>
        </div>
      </section>

      <div className="flex h-[650px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex-1 overflow-auto">
          <table className="min-w-[1180px] w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500 ring-1 ring-slate-200 shadow-sm">
              <tr>
                <th className="px-6 py-4 font-semibold">Giao dịch</th>
                <th className="px-6 py-4 font-semibold">Sách</th>
                <th className="px-6 py-4 font-semibold">Người tham gia</th>
                <th className="px-6 py-4 font-semibold">Loại</th>
                <th className="px-6 py-4 font-semibold">Trạng thái</th>
                <th className="px-6 py-4 font-semibold text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transactions.map((item) => {
                const canCancel = !FINAL_STATUSES.includes(item.transaction_status);
                return (
                  <tr key={item.transaction_id} className="transition-colors hover:bg-slate-50/50">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900">#{item.transaction_id}</div>
                      <div className="text-xs text-slate-500">{formatDate(item.requested_at)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">#{item.book_id} {item.book_title ?? "Không rõ tên sách"}</div>
                      <div className="text-slate-500">{item.book_author ?? "Không rõ tác giả"}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-700">Chủ: {item.owner_full_name ?? `User #${item.owner_id}`}</div>
                      <div className="text-slate-500">Yêu cầu: {item.requester_full_name ?? `User #${item.requester_id}`}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <Badge value={item.transaction_type} />
                        <div><Badge value={item.delivery_method} /></div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-2">
                        <Badge value={item.transaction_status} />
                        <div className="text-xs text-slate-500">
                          Owner {item.owner_confirmed ? "✓" : "-"} · Requester {item.requester_confirmed ? "✓" : "-"} · Courier {item.courier_confirmed ? "✓" : "-"}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <ConfirmButton
                        size="sm"
                        variant="danger"
                        disabled={!canCancel}
                        confirm={
                          canCancel
                            ? "Bạn có chắc chắn muốn hủy giao dịch này? Backend sẽ giải phóng sách và delivery liên quan nếu còn hiệu lực."
                            : "Giao dịch đã ở trạng thái cuối nên không thể hủy."
                        }
                        onConfirm={() => cancelTransaction(item)}
                      >
                        Hủy giao dịch
                      </ConfirmButton>
                    </td>
                  </tr>
                );
              })}
              {transactions.length === 0 && !error ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-slate-500">
                    <EmptyState title="Không có giao dịch nào phù hợp" />
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">
          Trang {page + 1} · Hiển thị tối đa {PAGE_SIZE} giao dịch
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>
            Trước
          </Button>
          <Button type="button" variant="secondary" disabled={transactions.length < PAGE_SIZE} onClick={() => setPage((value) => value + 1)}>
            Sau
          </Button>
        </div>
      </div>
    </div>
  );
}
