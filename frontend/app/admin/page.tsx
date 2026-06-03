"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminApi } from "@/lib/api";
import { errorMessage } from "@/lib/api/client";
import { useAuth } from "@/lib/auth";
import type { AdminLog } from "@/lib/api/types";
import { Alert, Badge, PageHeader } from "@/components/ui";
import { Activity, Book, ShieldAlert, Truck, UserCheck, UserCog, Users, Repeat } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";

export default function AdminDashboardPage() {
  const { token, user } = useAuth();
  const [stats, setStats] = useState({ users: 0, couriers: 0, activityLogs: 0, adminActions: 0 });
  const [activities, setActivities] = useState<AdminLog[]>([]);
  const [adminActionsList, setAdminActionsList] = useState<AdminLog[]>([]);
  const [userMap, setUserMap] = useState<Record<number, string>>({});
  const [error, setError] = useState("");

  async function load() {
    if (!token || user?.role !== "ADMIN") return;
    try {
      const [userData, appData, activityData, actionsData] = await Promise.all([
        adminApi.users(token),
        adminApi.courierApplications(token),
        adminApi.activityLogs(token),
        adminApi.adminActions(token)
      ]);
      setStats({
        users: userData.length,
        couriers: appData.filter(a => a.courier_status === "PENDING").length,
        activityLogs: activityData.length,
        adminActions: actionsData.length
      });
      const map: Record<number, string> = {};
      userData.forEach(u => map[u.user_id] = u.full_name);
      setUserMap(map);
      setActivities(activityData.slice(0, 8)); // latest 8
      setAdminActionsList(actionsData.slice(0, 8)); // latest 8
    } catch (err) {
      setError(errorMessage(err));
    }
  }
  
  useEffect(() => {
    void load();
  }, [token, user?.role]);

  if (user?.role !== "ADMIN") return null;

  return (
    <div className="space-y-8">
      {error ? <div className="mb-6"><Alert variant="error">{error}</Alert></div> : null}
      
      <PageHeader
        hero
        heroIcon={<Activity className="h-4 w-4" />}
        title="Tổng quan hệ thống"
        description="Giám sát hoạt động và điều hành toàn bộ hệ thống LibriHub."
        heroStat={
          <>
            <p className="text-sm font-medium text-blue-200">Trạng thái hệ thống</p>
            <div className="mt-1 flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse"></div>
              <span className="text-xl font-bold text-white">Hoạt động tốt</span>
            </div>
          </>
        }
      />

      {/* Top Stats Overview */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><UserCheck className="h-6 w-6" /></div>
            <div>
              <p className="text-sm font-semibold text-slate-500">Tổng thành viên</p>
              <p className="text-2xl font-bold text-slate-900">{stats.users}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><Truck className="h-6 w-6" /></div>
            <div>
              <p className="text-sm font-semibold text-slate-500">Chờ duyệt Courier</p>
              <p className="text-2xl font-bold text-slate-900">{stats.couriers}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><Activity className="h-6 w-6" /></div>
            <div>
              <p className="text-sm font-semibold text-slate-500">Hoạt động (24h)</p>
              <p className="text-2xl font-bold text-slate-900">{stats.activityLogs}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-50 text-violet-600"><ShieldAlert className="h-6 w-6" /></div>
            <div>
              <p className="text-sm font-semibold text-slate-500">Thao tác Admin</p>
              <p className="text-2xl font-bold text-slate-900">{stats.adminActions}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <section>
        <h2 className="mb-4 text-base font-bold text-slate-900">Phím tắt quản lý</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Link href="/admin/users" className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-blue-300 hover:shadow-md">
            <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-blue-50 transition-transform group-hover:scale-150"></div>
            <div className="relative z-10 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-700"><Users className="h-6 w-6" /></div>
              <div>
                <h3 className="font-bold text-slate-900 group-hover:text-blue-700">Người dùng</h3>
                <p className="text-sm text-slate-500">Cộng/trừ điểm, Khóa tài khoản</p>
              </div>
            </div>
          </Link>
          <Link href="/admin/books" className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-indigo-300 hover:shadow-md">
            <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-indigo-50 transition-transform group-hover:scale-150"></div>
            <div className="relative z-10 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700"><Book className="h-6 w-6" /></div>
              <div>
                <h3 className="font-bold text-slate-900 group-hover:text-indigo-700">Sách & Thể loại</h3>
                <p className="text-sm text-slate-500">Can thiệp sách vi phạm</p>
              </div>
            </div>
          </Link>
          <Link href="/admin/transactions" className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-rose-300 hover:shadow-md">
            <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-rose-50 transition-transform group-hover:scale-150"></div>
            <div className="relative z-10 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-100 text-rose-700"><Repeat className="h-6 w-6" /></div>
              <div>
                <h3 className="font-bold text-slate-900 group-hover:text-rose-700">Giao dịch</h3>
                <p className="text-sm text-slate-500">Hủy giao dịch khẩn cấp</p>
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* Logs and Activities side by side */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col h-[500px]">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Activity className="h-5 w-5 text-emerald-500" /> Hoạt động hệ thống
            </h2>
            <Link href="/admin/logs" className="text-sm font-semibold text-blue-600 hover:underline">Xem tất cả</Link>
          </div>
          <div className="flex-1 overflow-auto p-2">
            {activities.length > 0 ? (
              <ul className="divide-y divide-slate-100">
                {activities.map((log) => (
                  <li key={log.id ?? Math.random()} className="p-4 hover:bg-slate-50 rounded-xl transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 rounded-full bg-slate-100 p-1.5 text-slate-500">
                          <UserCog className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{userMap[log.user_id ?? 0] || `User #${log.user_id}`}</p>
                          <p className="mt-0.5 text-sm text-slate-500">{log.activity_description || log.action_description}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <Badge value={log.activity_type || log.action_type || ""} />
                        <p className="mt-1 text-xs text-slate-400">
                          {log.created_at ? formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: vi }) : "Vừa xong"}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">Chưa có hoạt động nào</div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col h-[500px]">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-violet-500" /> Thao tác Admin
            </h2>
          </div>
          <div className="flex-1 overflow-auto p-2">
            {adminActionsList.length > 0 ? (
              <ul className="divide-y divide-slate-100">
                {adminActionsList.map((action) => (
                  <li key={action.id ?? Math.random()} className="p-4 hover:bg-slate-50 rounded-xl transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 rounded-full bg-violet-100 p-1.5 text-violet-600">
                          <ShieldAlert className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            Admin #{action.admin_id} 
                            {action.target_user_id ? ` → ${userMap[action.target_user_id] || `User #${action.target_user_id}`}` : ""}
                          </p>
                          <p className="mt-0.5 text-sm text-slate-500">{action.action_description || action.activity_description}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <Badge value={action.action_type || action.activity_type || ""} />
                        <p className="mt-1 text-xs text-slate-400">
                          {action.created_at ? formatDistanceToNow(new Date(action.created_at), { addSuffix: true, locale: vi }) : "Vừa xong"}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">Chưa có thao tác admin nào</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
