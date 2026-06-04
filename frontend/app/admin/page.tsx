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

type DashboardChartPoint = {
  label: string;
  users: number;
  transactions: number;
};

export default function AdminDashboardPage() {
  const { token, user } = useAuth();
  const [stats, setStats] = useState({ users: 0, couriers: 0, activityLogs: 0, adminActions: 0 });
  const [activities, setActivities] = useState<AdminLog[]>([]);
  const [adminActionsList, setAdminActionsList] = useState<AdminLog[]>([]);
  const [chartData, setChartData] = useState<DashboardChartPoint[]>([]);
  const [userMap, setUserMap] = useState<Record<number, string>>({});
  const [error, setError] = useState("");

  async function load() {
    if (!token || user?.role !== "ADMIN") return;
    try {
      const [metrics, userData, activityData, actionsData] = await Promise.all([
        adminApi.dashboardMetrics(token, 14),
        adminApi.users(token),
        adminApi.activityLogs(token),
        adminApi.adminActions(token)
      ]);
      setStats({
        users: metrics.total_users,
        couriers: metrics.pending_courier_applications,
        activityLogs: metrics.activity_log_count,
        adminActions: metrics.admin_action_count
      });
      const map: Record<number, string> = {};
      userData.forEach(u => map[u.user_id] = u.full_name);
      setUserMap(map);
      setChartData(metrics.chart.map((point) => ({
        label: new Date(`${point.date}T00:00:00`).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }),
        users: point.total_users,
        transactions: point.transactions_created
      })));
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

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Biểu đồ tăng trưởng</h2>
            <p className="mt-1 text-sm text-slate-500">Theo dõi tổng số user và số giao dịch được tạo trong 14 ngày gần nhất.</p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm font-medium">
            <span className="inline-flex items-center gap-2 text-blue-700">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
              Tổng user
            </span>
            <span className="inline-flex items-center gap-2 text-emerald-700">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              Giao dịch tạo mới
            </span>
          </div>
        </div>
        <LineChart data={chartData} />
      </section>

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
                {activities.map((log, index) => (
                  <li key={log.activity_id ?? `activity-${log.created_at}-${index}`} className="p-4 hover:bg-slate-50 rounded-xl transition-colors">
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
                {adminActionsList.map((action, index) => (
                  <li key={action.admin_action_id ?? `admin-action-${action.created_at}-${index}`} className="p-4 hover:bg-slate-50 rounded-xl transition-colors">
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

function LineChart({ data }: { data: DashboardChartPoint[] }) {
  const width = 640;
  const height = 220;
  const padding = { top: 18, right: 24, bottom: 36, left: 42 };
  const maxValue = Math.max(1, ...data.flatMap((item) => [item.users, item.transactions]));
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const xStep = data.length > 1 ? plotWidth / (data.length - 1) : plotWidth;
  const yFor = (value: number) => padding.top + plotHeight - (value / maxValue) * plotHeight;
  const xFor = (index: number) => padding.left + index * xStep;
  const userPoints = data.map((item, index) => `${xFor(index)},${yFor(item.users)}`).join(" ");
  const transactionPoints = data.map((item, index) => `${xFor(index)},${yFor(item.transactions)}`).join(" ");
  const yTicks = [0, Math.ceil(maxValue / 2), maxValue];

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl bg-slate-50 text-sm font-medium text-slate-500">
        Chưa có dữ liệu để vẽ biểu đồ.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Biểu đồ đường tổng user và giao dịch tạo mới" className="h-72 min-w-[720px] w-full">
        <rect x="0" y="0" width={width} height={height} rx="18" fill="#f8fafc" />
        {yTicks.map((tick) => (
          <g key={tick}>
            <line x1={padding.left} x2={width - padding.right} y1={yFor(tick)} y2={yFor(tick)} stroke="#e2e8f0" strokeDasharray="4 6" />
            <text x={padding.left - 12} y={yFor(tick) + 4} textAnchor="end" className="fill-slate-500 text-[11px] font-medium">
              {tick}
            </text>
          </g>
        ))}
        <polyline points={userPoints} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points={transactionPoints} fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {data.map((item, index) => (
          <g key={item.label}>
            <circle cx={xFor(index)} cy={yFor(item.users)} r="4" fill="#2563eb">
              <title>{`${item.label}: ${item.users} user`}</title>
            </circle>
            <circle cx={xFor(index)} cy={yFor(item.transactions)} r="4" fill="#10b981">
              <title>{`${item.label}: ${item.transactions} giao dịch`}</title>
            </circle>
            {(index === 0 || index === data.length - 1 || index % 3 === 0) && (
              <text x={xFor(index)} y={height - 14} textAnchor="middle" className="fill-slate-500 text-[11px] font-medium">
                {item.label}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}
