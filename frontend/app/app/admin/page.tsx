"use client";

import { FormEvent, useEffect, useState } from "react";
import { adminApi } from "@/lib/api";
import { errorMessage } from "@/lib/api/client";
import type { AdminLog, AdminUser, CourierProfile } from "@/lib/api/types";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { Alert, Badge, Card, ConfirmButton, EmptyState, Field, PageHeader, TextArea, TextInput } from "@/components/ui";

export default function AdminPage() {
  const { token, user } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [applications, setApplications] = useState<CourierProfile[]>([]);
  const [activityLogs, setActivityLogs] = useState<AdminLog[]>([]);
  const [adminActions, setAdminActions] = useState<AdminLog[]>([]);
  const [error, setError] = useState("");

  async function load() {
    if (!token || user?.role !== "ADMIN") return;
    try {
      const [userData, appData, activities, actions] = await Promise.all([
        adminApi.users(token),
        adminApi.courierApplications(token),
        adminApi.activityLogs(token),
        adminApi.adminActions(token)
      ]);
      setUsers(userData);
      setApplications(appData);
      setActivityLogs(activities);
      setAdminActions(actions);
    } catch (err) {
      setError(errorMessage(err));
    }
  }
  useEffect(() => {
    void load();
  }, [token, user?.role]);

  if (user?.role !== "ADMIN") {
    return (
      <>
        <PageHeader title="Admin" description="Khu vuc chi danh cho quan tri vien." />
        <Alert variant="error">Bạn không có quyền truy cập màn hình này.</Alert>
      </>
    );
  }

  async function run(action: () => Promise<unknown>) {
    try {
      setError("");
      await action();
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  function idFrom(formId: string, field: string) {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form?.reportValidity()) return null;
    return Number(new FormData(form).get(field));
  }

  return (
    <>
      <PageHeader title="LibriHub Admin" description="Quản lý người dùng, duyệt courier, sách, giao dịch và nhật ký hệ thống." />
      {error ? <Alert variant="error">{error}</Alert> : null}
      <div className="grid grid-cols-2 gap-4 max-xl:grid-cols-1">
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">Người dùng</h2>
          <div className="mt-4 max-h-96 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">User</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Điểm</th>
                  <th className="px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map((item) => (
                  <tr key={item.user_id} className="border-t border-slate-100">
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-900">#{item.user_id} {item.full_name}</div>
                      <div className="text-xs text-slate-500">{item.email}</div>
                    </td>
                    <td className="px-3 py-2"><Badge value={item.role} /></td>
                    <td className="px-3 py-2">{item.current_points}</td>
                    <td className="px-3 py-2">
                      {item.account_status === "LOCKED" ? (
                        <ConfirmButton size="sm" confirm="Bạn có muốn mở khóa người dùng này?" onConfirm={() => run(() => adminApi.unlock(token!, item.user_id))}>Mở</ConfirmButton>
                      ) : (
                        <ConfirmButton size="sm" variant="danger" confirm="Bạn có muốn khóa người dùng này?" onConfirm={() => run(() => adminApi.lock(token!, item.user_id))}>Khóa</ConfirmButton>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-slate-900">Hồ sơ courier</h2>
          <div className="mt-4 flex flex-col gap-3">
            {applications.length === 0 ? <EmptyState title="Không có hồ sơ courier" /> : null}
            {applications.map((app) => (
              <div key={app.courier_id} className="rounded-2xl border border-slate-200 bg-white p-3 text-sm shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium text-slate-900">Courier #{app.courier_id} · User #{app.user_id}</div>
                  <Badge value={app.courier_status} />
                </div>
                <p className="mt-1 text-slate-500">{app.delivery_area} · {app.vehicle_type || "Chưa có phương tiện"}</p>
                <form id={`courier-${app.courier_id}`} className="mt-3 flex gap-2" onSubmit={(event: FormEvent) => event.preventDefault()}>
                  <TextInput name="review_note" placeholder="Ghi chu duyet" />
                  <ConfirmButton size="sm" confirm="Bạn có muốn duyệt courier này?" onConfirm={() => {
                    const form = document.getElementById(`courier-${app.courier_id}`) as HTMLFormElement;
                    const note = String(new FormData(form).get("review_note") ?? "");
                    void run(() => adminApi.reviewCourier(token!, app.courier_id, "approve", note));
                  }}>Duyệt</ConfirmButton>
                  <ConfirmButton size="sm" variant="danger" confirm="Bạn có muốn từ chối courier này?" onConfirm={() => {
                    const form = document.getElementById(`courier-${app.courier_id}`) as HTMLFormElement;
                    const note = String(new FormData(form).get("review_note") ?? "");
                    void run(() => adminApi.reviewCourier(token!, app.courier_id, "reject", note));
                  }}>Từ chối</ConfirmButton>
                </form>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-slate-900">Tác vụ nhanh</h2>
          <div className="mt-4 grid grid-cols-2 gap-4 max-sm:grid-cols-1">
            <form id="point-form" className="flex flex-col gap-3" onSubmit={(event: FormEvent) => event.preventDefault()}>
              <Field label="User ID"><TextInput name="user_id" type="number" required /></Field>
              <Field label="Điểm thay đổi"><TextInput name="point_change" type="number" required /></Field>
              <Field label="Lý do"><TextArea name="reason" required /></Field>
              <ConfirmButton confirm="Bạn có muốn điều chỉnh điểm người dùng này? Thao tác sẽ ghi ledger và admin action." onConfirm={() => {
                const form = document.getElementById("point-form") as HTMLFormElement | null;
                if (!form?.reportValidity()) return;
                const data = new FormData(form);
                void run(() => adminApi.adjustPoints(token!, Number(data.get("user_id")), { point_change: Number(data.get("point_change")), reason: String(data.get("reason")) }));
              }}>Điều chỉnh điểm</ConfirmButton>
            </form>
            <div className="flex flex-col gap-3">
              <form id="book-admin-form" className="flex gap-2" onSubmit={(event: FormEvent) => event.preventDefault()}>
                <TextInput name="book_id" type="number" placeholder="Book ID" required />
                <ConfirmButton confirm="Bạn có muốn ẩn sách này?" onConfirm={() => {
                  const id = idFrom("book-admin-form", "book_id");
                  if (id) void run(() => adminApi.hideBook(token!, id));
                }}>Ẩn</ConfirmButton>
                <ConfirmButton variant="secondary" confirm="Bạn có muốn khôi phục sách này?" onConfirm={() => {
                  const id = idFrom("book-admin-form", "book_id");
                  if (id) void run(() => adminApi.restoreBook(token!, id));
                }}>Khôi phục</ConfirmButton>
              </form>
              <form id="transaction-admin-form" className="flex gap-2" onSubmit={(event: FormEvent) => event.preventDefault()}>
                <TextInput name="transaction_id" type="number" placeholder="Transaction ID" required />
                <ConfirmButton variant="danger" confirm="Bạn có muốn hủy giao dịch này? Đây là can thiệp của admin." onConfirm={() => {
                  const id = idFrom("transaction-admin-form", "transaction_id");
                  if (id) void run(() => adminApi.cancelTransaction(token!, id));
                }}>Hủy giao dịch</ConfirmButton>
              </form>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-slate-900">Nhật ký gần đây</h2>
          <div className="mt-4 grid grid-cols-2 gap-4 max-sm:grid-cols-1">
            <LogList title="Activity" logs={activityLogs} />
            <LogList title="Admin action" logs={adminActions} />
          </div>
        </Card>
      </div>
    </>
  );
}

function LogList({ title, logs }: { title: string; logs: AdminLog[] }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">{title}</h3>
      <div className="max-h-72 overflow-auto rounded-2xl border border-slate-200 bg-white">
        {logs.map((log, index) => (
          <div key={`${title}-${index}`} className="border-b border-slate-100 p-3 text-sm last:border-b-0">
            <div className="font-medium text-slate-900">{log.activity_type || log.action_type}</div>
            <p className="text-slate-500">{log.activity_description || log.action_description}</p>
            <p className="mt-1 text-xs text-slate-400">{formatDate(log.created_at)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
