"use client";

import { useEffect, useState } from "react";
import { deliveriesApi } from "@/lib/api";
import { errorMessage } from "@/lib/api/client";
import type { Delivery } from "@/lib/api/types";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { Alert, Badge, Card, ConfirmButton, EmptyState, PageHeader } from "@/components/ui";

export default function MyDeliveriesPage() {
  const { token, refreshUser } = useAuth();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [error, setError] = useState("");

  async function load() {
    if (!token) return;
    try {
      setDeliveries(await deliveriesApi.mine(token));
    } catch (err) {
      setError(errorMessage(err));
    }
  }
  useEffect(() => {
    void load();
  }, [token]);

  async function run(id: number, action: "pickup" | "delivered" | "failed") {
    if (!token) return;
    await deliveriesApi.action(token, id, action);
    await Promise.all([load(), refreshUser()]);
  }

  return (
    <>
      <PageHeader title="Nhiệm vụ của tôi" description="Cập nhật đã lấy, đã giao hoặc thất bại cho nhiệm vụ được gán." />
      {error ? <Alert variant="error">{error}</Alert> : null}
      {deliveries.length === 0 ? <EmptyState title="Chưa có nhiệm vụ được gán" /> : null}
      <div className="flex flex-col gap-3">
        {deliveries.map((delivery) => (
          <Card key={delivery.delivery_id} className="p-4">
            <div className="flex items-start justify-between gap-3 max-md:flex-col">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-semibold text-slate-900">Vận đơn #{delivery.delivery_id}</h2>
                  <Badge value={delivery.delivery_status} />
                </div>
                <p className="mt-2 text-sm text-slate-500">Giao dịch #{delivery.transaction_id}</p>
                <p className="text-sm text-slate-500">Lấy: {delivery.pickup_address ?? "Chưa có điểm lấy"}</p>
                <p className="text-sm text-slate-500">Nhận: {delivery.receiver_address}</p>
                <p className="text-sm text-slate-500">Dự kiến: {formatDate(delivery.expected_delivery_at)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {delivery.delivery_status === "ASSIGNED" ? (
                  <ConfirmButton size="sm" confirm="Bạn xác nhận đã lấy sách?" onConfirm={() => run(delivery.delivery_id, "pickup")}>
                    Đã lấy
                  </ConfirmButton>
                ) : null}
                {delivery.delivery_status === "PICKED_UP" ? (
                  <ConfirmButton size="sm" confirm="Bạn xác nhận đã giao sách? Courier sẽ được cộng điểm." onConfirm={() => run(delivery.delivery_id, "delivered")}>
                    Đã giao
                  </ConfirmButton>
                ) : null}
                {(delivery.delivery_status === "ASSIGNED" || delivery.delivery_status === "PICKED_UP") ? (
                  <ConfirmButton size="sm" variant="danger" confirm="Bạn có muốn đánh dấu giao hàng thất bại không?" onConfirm={() => run(delivery.delivery_id, "failed")}>
                    Thất bại
                  </ConfirmButton>
                ) : null}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
