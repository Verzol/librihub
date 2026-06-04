"use client";

import { FormEvent, useEffect, useState } from "react";
import { adminApi } from "@/lib/api";
import { errorMessage } from "@/lib/api/client";
import type { CourierProfile, CourierStatus } from "@/lib/api/types";
import { useAuth } from "@/lib/auth";
import { Alert, Badge, Button, ConfirmButton, EmptyState, TextInput, PageHeader } from "@/components/ui";
import { Truck } from "lucide-react";

const STATUS_TABS: Array<{ value: CourierStatus | "ALL"; label: string }> = [
  { value: "PENDING", label: "Chờ duyệt" },
  { value: "AVAILABLE", label: "Đã duyệt" },
  { value: "INACTIVE", label: "Từ chối" },
  { value: "ALL", label: "Tất cả" }
];

export default function AdminCouriersPage() {
  const { token, user } = useAuth();
  const [applications, setApplications] = useState<CourierProfile[]>([]);
  const [userMap, setUserMap] = useState<Record<number, string>>({});
  const [error, setError] = useState("");
  const [statusTab, setStatusTab] = useState<CourierStatus | "ALL">("PENDING");

  async function load() {
    if (!token || user?.role !== "ADMIN") return;
    try {
      const [allApps, usersList] = await Promise.all([
        adminApi.courierApplications(token),
        adminApi.users(token)
      ]);
      const map: Record<number, string> = {};
      usersList.forEach(u => map[u.user_id] = u.full_name);
      setUserMap(map);
      setApplications(allApps);
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
        heroIcon={<Truck className="h-4 w-4" />}
        title="Duyệt người giao sách"
        description="Xem xét và phê duyệt các đăng ký trở thành người giao sách (Courier)."
        heroStat={
          <>
            <p className="text-sm font-medium text-blue-200">Hồ sơ chờ duyệt</p>
            <div className="mt-1 text-4xl font-bold text-white">{applications.filter((app) => app.courier_status === "PENDING").length}</div>
          </>
        }
      />

      {error ? <Alert variant="error">{error}</Alert> : null}

      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <Button
            key={tab.value}
            type="button"
            size="sm"
            variant={statusTab === tab.value ? "primary" : "secondary"}
            onClick={() => setStatusTab(tab.value)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6 max-lg:grid-cols-1">
        {applications.filter((app) => statusTab === "ALL" || app.courier_status === statusTab).length === 0 && !error ? (
          <div className="col-span-2">
            <EmptyState title="Không có hồ sơ nào chờ duyệt">
              Không có hồ sơ courier phù hợp với bộ lọc hiện tại.
            </EmptyState>
          </div>
        ) : null}

        {applications.filter((app) => statusTab === "ALL" || app.courier_status === statusTab).map((app) => (
          <div key={app.courier_id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                  <Truck className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{userMap[app.user_id] || `User #${app.user_id}`}</h3>
                  <p className="text-sm text-slate-500">Đăng ký ngày {new Date(app.registered_at).toLocaleDateString("vi-VN")}</p>
                </div>
              </div>
              <Badge value={app.courier_status} />
            </div>

            <div className="mt-6 flex-1 rounded-xl bg-slate-50 p-4 border border-slate-100">
              <div className="grid gap-3 text-sm">
                <div className="grid grid-cols-[100px_1fr] gap-2">
                  <span className="font-medium text-slate-500">Khu vực:</span>
                  <span className="font-semibold text-slate-900">{app.delivery_area}</span>
                </div>
                <div className="grid grid-cols-[100px_1fr] gap-2">
                  <span className="font-medium text-slate-500">Phương tiện:</span>
                  <span className="font-semibold text-slate-900">{app.vehicle_type || "Chưa cập nhật"}</span>
                </div>
                <div className="grid grid-cols-[100px_1fr] gap-2">
                  <span className="font-medium text-slate-500">Liên hệ:</span>
                  <span className="font-semibold text-slate-900">{app.contact_name || userMap[app.user_id] || `User #${app.user_id}`}</span>
                </div>
                <div className="grid grid-cols-[100px_1fr] gap-2">
                  <span className="font-medium text-slate-500">SĐT:</span>
                  <span className="font-semibold text-slate-900">{app.contact_phone || "Chưa cập nhật"}</span>
                </div>
                <div className="grid grid-cols-[100px_1fr] gap-2">
                  <span className="font-medium text-slate-500">Địa chỉ:</span>
                  <span className="font-semibold text-slate-900">{app.contact_address || "Chưa cập nhật"}</span>
                </div>
                <div className="grid grid-cols-[100px_1fr] gap-2">
                  <span className="font-medium text-slate-500">Ghi chú:</span>
                  <span className="font-semibold text-slate-900">{app.application_note || "Không có"}</span>
                </div>
                {app.document_url ? (
                  <div className="grid grid-cols-[100px_1fr] gap-2">
                    <span className="font-medium text-slate-500">Tài liệu:</span>
                    <a href={app.document_url} target="_blank" rel="noreferrer" className="font-semibold text-blue-600 hover:underline">
                      Xem minh chứng
                    </a>
                  </div>
                ) : null}
                {app.review_note ? (
                  <div className="grid grid-cols-[100px_1fr] gap-2">
                    <span className="font-medium text-slate-500">Review:</span>
                    <span className="font-semibold text-slate-900">{app.review_note}</span>
                  </div>
                ) : null}
              </div>
            </div>

            {app.courier_status === "PENDING" ? (
              <form id={`courier-${app.courier_id}`} className="mt-6 space-y-4" onSubmit={(event: FormEvent) => event.preventDefault()}>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Ghi chú (Tùy chọn)</label>
                  <TextInput name="review_note" placeholder="Ví dụ: Đã xác minh xe máy..." />
                </div>
                <div className="flex gap-3 pt-2">
                  <ConfirmButton className="flex-1" confirm="Bạn có muốn duyệt courier này?" onConfirm={() => {
                    const form = document.getElementById(`courier-${app.courier_id}`) as HTMLFormElement;
                    const note = String(new FormData(form).get("review_note") ?? "");
                    void run(() => adminApi.reviewCourier(token!, app.courier_id, "approve", note));
                  }}>Phê duyệt</ConfirmButton>
                  <ConfirmButton className="flex-1 bg-red-50 text-red-700 hover:bg-red-100 ring-1 ring-inset ring-red-200" variant="secondary" confirm="Bạn có muốn từ chối courier này?" onConfirm={() => {
                    const form = document.getElementById(`courier-${app.courier_id}`) as HTMLFormElement;
                    const note = String(new FormData(form).get("review_note") ?? "");
                    void run(() => adminApi.reviewCourier(token!, app.courier_id, "reject", note));
                  }}>Từ chối</ConfirmButton>
                </div>
              </form>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
