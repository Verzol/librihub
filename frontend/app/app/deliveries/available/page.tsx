"use client";

import { FormEvent, useEffect, useState } from "react";
import { deliveriesApi } from "@/lib/api";
import { errorMessage } from "@/lib/api/client";
import type { DeliveryTask } from "@/lib/api/types";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { Navigation } from "lucide-react";
import { Alert, Card, ConfirmButton, EmptyState, Field, PageHeader, TextInput } from "@/components/ui";

export default function AvailableDeliveriesPage() {
  const { token } = useAuth();
  const [tasks, setTasks] = useState<DeliveryTask[]>([]);
  const [error, setError] = useState("");

  async function load() {
    if (!token) return;
    try {
      setTasks(await deliveriesApi.available(token));
    } catch (err) {
      setError(errorMessage(err));
    }
  }
  useEffect(() => {
    void load();
  }, [token]);

  async function accept(form: HTMLFormElement, transactionId: number) {
    if (!token) return;
    const data = new FormData(form);
    await deliveriesApi.accept(token, transactionId, {
      expected_delivery_at: String(data.get("expected_delivery_at") || "") || null
    });
    await load();
  }

  return (
    <>
      <PageHeader
        hero
        heroIcon={<Navigation className="h-3.5 w-3.5" />}
        title="Nhiệm vụ giao sách khả dụng"
        description="Chỉ courier đã được duyệt và đang sẵn sàng mới thấy danh sách này."
        heroStat={
          <>
            <p className="text-sm font-medium text-blue-200">Đơn chờ</p>
            <div className="mt-1 text-4xl font-bold text-white">{tasks.length}</div>
            <p className="mt-1 text-sm text-blue-200">nhiệm vụ</p>
          </>
        }
      />
      {error ? <Alert variant="error">{error}</Alert> : null}
      {tasks.length === 0 ? <EmptyState title="Không có nhiệm vụ nào" /> : null}
      <div className="flex flex-col gap-4">
        {tasks.map((task) => (
          <Card key={task.transaction_id}>
            <h2 className="text-base font-semibold text-slate-900">Giao dịch #{task.transaction_id}</h2>
            <p className="mt-1 text-base text-slate-500">
              Sách #{task.book_id} · chủ sách #{task.owner_id} · người yêu cầu #{task.requester_id} · {formatDate(task.requested_at)}
            </p>
            <p className="mt-2 text-base text-slate-500">Lấy: {task.pickup_address ?? "Chưa có điểm lấy"}</p>
            <p className="text-base text-slate-500">Giao: {task.receiver_address}</p>
            <form id={`accept-${task.transaction_id}`} className="mt-4 grid grid-cols-[220px_auto] gap-3 max-sm:grid-cols-1" onSubmit={(event: FormEvent) => event.preventDefault()}>
              <Field label="Dự kiến giao">
                <TextInput name="expected_delivery_at" type="datetime-local" />
              </Field>
              <ConfirmButton
                className="self-end"
                confirm="Bạn có muốn nhận nhiệm vụ giao sách này không?"
                onConfirm={() => {
                  const form = document.getElementById(`accept-${task.transaction_id}`) as HTMLFormElement | null;
                  if (form?.reportValidity()) void accept(form, task.transaction_id);
                }}
              >
                Nhận nhiệm vụ
              </ConfirmButton>
            </form>
          </Card>
        ))}
      </div>
    </>
  );
}
