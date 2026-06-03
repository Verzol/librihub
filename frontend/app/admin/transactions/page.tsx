"use client";

import { useAuth } from "@/lib/auth";
import { Alert, ConfirmButton, EmptyState, Field, TextInput, PageHeader } from "@/components/ui";
import { Repeat } from "lucide-react";
import { adminApi } from "@/lib/api";
import { FormEvent, useState } from "react";
import { errorMessage } from "@/lib/api/client";

export default function AdminTransactionsPage() {
  const { token, user } = useAuth();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  if (user?.role !== "ADMIN") return null;

  async function handleCancel(event: FormEvent) {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const id = Number(new FormData(form).get("transaction_id"));
    if (!id || !token) return;
    
    try {
      setError("");
      setSuccess("");
      await adminApi.cancelTransaction(token, id);
      setSuccess(`Giao dịch #${id} đã được hủy thành công.`);
      form.reset();
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
      />

      {error ? <Alert variant="error">{error}</Alert> : null}
      {success ? <Alert variant="success">{success}</Alert> : null}

      <div className="grid grid-cols-2 gap-6 max-xl:grid-cols-1">
        <div className="rounded-2xl border border-red-100 bg-white shadow-sm overflow-hidden p-6">
          <div className="flex items-center gap-3 border-b border-red-100 pb-4 mb-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
              <Repeat className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-red-900">Can thiệp khẩn cấp</h2>
              <p className="text-sm text-red-600/80">Hủy giao dịch theo ID (Dành cho xử lý tranh chấp).</p>
            </div>
          </div>

          <form onSubmit={handleCancel} className="space-y-4">
            <Field label="Nhập ID Giao dịch">
              <TextInput name="transaction_id" type="number" required placeholder="Ví dụ: 12" />
            </Field>
            <ConfirmButton variant="danger" confirm="Bạn có chắc chắn muốn hủy giao dịch này? Hành động này không thể hoàn tác và sẽ ảnh hưởng trực tiếp đến người dùng." onConfirm={() => {
              const form = document.querySelector('form') as HTMLFormElement;
              if (form.reportValidity()) form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
            }}>
              Bắt buộc Hủy giao dịch
            </ConfirmButton>
          </form>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-center p-6 text-center">
          <EmptyState title="Đang xây dựng">
            Tính năng xem toàn bộ danh sách giao dịch toàn hệ thống đang được phát triển ở Backend và sẽ ra mắt trong phiên bản tới.
          </EmptyState>
        </div>
      </div>
    </div>
  );
}
