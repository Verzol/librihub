"use client";

import { useEffect, useState } from "react";
import { adminApi } from "@/lib/api";
import { errorMessage } from "@/lib/api/client";
import type { AdminUser } from "@/lib/api/types";
import { useAuth } from "@/lib/auth";
import { Alert, Badge, Button, ConfirmButton, Field, TextInput, PageHeader } from "@/components/ui";
import { FormEvent } from "react";
import { AlertTriangle, X, Users } from "lucide-react";

export default function AdminUsersPage() {
  const { token, user } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState("");
  const [adjustingUser, setAdjustingUser] = useState<AdminUser | null>(null);
  const [adjustError, setAdjustError] = useState("");
  const [adjustSuccess, setAdjustSuccess] = useState("");

  async function load() {
    if (!token || user?.role !== "ADMIN") return;
    try {
      setUsers(await adminApi.users(token));
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

  async function handleAdjustPoints(event: FormEvent) {
    event.preventDefault();
    if (!adjustingUser || !token) return;
    const form = event.target as HTMLFormElement;
    const data = new FormData(form);
    
    try {
      setAdjustError("");
      setAdjustSuccess("");
      await adminApi.adjustPoints(token, adjustingUser.user_id, {
        point_change: Number(data.get("point_change")),
        reason: String(data.get("reason"))
      });
      setAdjustSuccess(`Đã cập nhật điểm cho ${adjustingUser.full_name} thành công.`);
      form.reset();
      await load();
      setTimeout(() => {
        setAdjustingUser(null);
        setAdjustSuccess("");
      }, 2000);
    } catch (err) {
      setAdjustError(errorMessage(err));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        hero
        heroIcon={<Users className="h-4 w-4" />}
        title="Quản lý người dùng"
        description="Xem và quản lý tất cả thành viên trong hệ thống LibriHub."
        heroStat={
          <>
            <p className="text-sm font-medium text-blue-200">Tổng thành viên</p>
            <div className="mt-1 text-4xl font-bold text-white">{users.length}</div>
          </>
        }
      />

      {error ? <Alert variant="error">{error}</Alert> : null}

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col h-[600px]">
        <div className="flex-1 overflow-auto p-0">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="sticky top-0 bg-slate-50 text-slate-500 ring-1 ring-slate-200 shadow-sm z-10">
              <tr>
                <th className="px-6 py-4 font-semibold">ID</th>
                <th className="px-6 py-4 font-semibold">Thành viên</th>
                <th className="px-6 py-4 font-semibold">Vai trò</th>
                <th className="px-6 py-4 font-semibold text-right">Điểm hiện tại</th>
                <th className="px-6 py-4 font-semibold text-right">Trạng thái</th>
                <th className="px-6 py-4 font-semibold text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((item) => (
                <tr key={item.user_id} className="transition-colors hover:bg-slate-50/50">
                  <td className="px-6 py-4 text-slate-500 font-medium">#{item.user_id}</td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-900">{item.full_name}</div>
                    <div className="text-slate-500">{item.email}</div>
                  </td>
                  <td className="px-6 py-4"><Badge value={item.role} /></td>
                  <td className="px-6 py-4 font-bold text-blue-600 text-right">{item.current_points} pt</td>
                  <td className="px-6 py-4 text-right">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${item.account_status === "LOCKED" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
                      {item.account_status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button size="sm" variant="secondary" onClick={() => {
                        setAdjustingUser(item);
                        setAdjustError("");
                        setAdjustSuccess("");
                      }}>Cộng/Trừ điểm</Button>
                      {item.account_status === "LOCKED" ? (
                        <ConfirmButton size="sm" confirm="Bạn có muốn mở khóa người dùng này?" onConfirm={() => run(() => adminApi.unlock(token!, item.user_id))}>
                          Mở khóa
                        </ConfirmButton>
                      ) : (
                        <ConfirmButton size="sm" variant="danger" confirm="Bạn có muốn khóa người dùng này?" onConfirm={() => run(() => adminApi.lock(token!, item.user_id))}>
                          Khóa
                        </ConfirmButton>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && !error && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-slate-500">
                    Không tìm thấy người dùng nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {adjustingUser && (
        <div className="fixed inset-x-0 top-0 z-[130] flex h-[100dvh] items-center justify-center overflow-y-auto bg-slate-950/45 px-5 py-10 backdrop-blur-sm" role="presentation" onMouseDown={() => setAdjustingUser(null)}>
          <section role="dialog" className="my-auto w-full max-w-md overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_32px_90px_rgba(15,23,42,0.24)]" onMouseDown={(e) => e.stopPropagation()}>
            <div className="relative border-b border-slate-100 bg-slate-50/50 px-6 py-5">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-100 shadow-sm">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-bold text-slate-950">Điều chỉnh điểm</h2>
                  <p className="mt-0.5 text-sm font-medium text-slate-500">{adjustingUser.full_name} ({adjustingUser.current_points} pt)</p>
                </div>
              </div>
              <button type="button" onClick={() => setAdjustingUser(null)} className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <form onSubmit={handleAdjustPoints} className="px-6 py-6">
              {adjustError ? <div className="mb-4"><Alert variant="error">{adjustError}</Alert></div> : null}
              {adjustSuccess ? <div className="mb-4"><Alert variant="success">{adjustSuccess}</Alert></div> : null}
              
              <div className="space-y-4">
                <Field label="Điểm thay đổi (±)"><TextInput name="point_change" type="number" required placeholder="Ví dụ: -10, 50" /></Field>
                <Field label="Lý do điều chỉnh"><TextInput name="reason" required placeholder="Ghi chú rõ ràng (VD: ADMIN_ADJUSTMENT)" /></Field>
              </div>
              
              <div className="mt-8 flex justify-end gap-3">
                <Button type="button" variant="secondary" onClick={() => setAdjustingUser(null)}>Đóng</Button>
                <Button type="submit" variant="primary">Xác nhận điều chỉnh</Button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
