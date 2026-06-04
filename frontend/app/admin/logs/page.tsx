"use client";

import { useEffect, useState } from "react";
import { adminApi } from "@/lib/api";
import { errorMessage } from "@/lib/api/client";
import type { AdminLog } from "@/lib/api/types";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { Alert, PageHeader } from "@/components/ui";
import { Button } from "@/components/ui";
import { Activity, ShieldAlert } from "lucide-react";

const PAGE_SIZE = 50;

export default function AdminLogsPage() {
  const { token, user } = useAuth();
  const [activityLogs, setActivityLogs] = useState<AdminLog[]>([]);
  const [adminActions, setAdminActions] = useState<AdminLog[]>([]);
  const [userMap, setUserMap] = useState<Record<number, string>>({});
  const [error, setError] = useState("");
  const [activityOffset, setActivityOffset] = useState(0);
  const [actionOffset, setActionOffset] = useState(0);

  async function load() {
    if (!token || user?.role !== "ADMIN") return;
    try {
      const [activities, actions, usersList] = await Promise.all([
        adminApi.activityLogs(token, { limit: PAGE_SIZE, offset: activityOffset }),
        adminApi.adminActions(token, { limit: PAGE_SIZE, offset: actionOffset }),
        adminApi.users(token)
      ]);
      const map: Record<number, string> = {};
      usersList.forEach(u => map[u.user_id] = u.full_name);
      setUserMap(map);
      setActivityLogs(activities);
      setAdminActions(actions);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  useEffect(() => {
    void load();
  }, [token, user?.role, activityOffset, actionOffset]);

  if (user?.role !== "ADMIN") return null;

  return (
    <div className="space-y-6">
      <PageHeader
        hero
        heroIcon={<Activity className="h-4 w-4" />}
        title="Nhật ký hệ thống"
        description="Giám sát các hoạt động của người dùng và lịch sử can thiệp của Quản trị viên."
      />

      {error ? <Alert variant="error">{error}</Alert> : null}

      <div className="grid grid-cols-2 gap-6 max-xl:grid-cols-1">
        {/* Activity Logs */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col h-[700px]">
          <div className="border-b border-slate-200 bg-slate-50/50 px-6 py-4 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Hoạt động cộng đồng</h2>
            <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
              {activityLogs.length} bản ghi
            </span>
          </div>
          <div className="flex-1 overflow-auto">
            <div className="divide-y divide-slate-100">
              {activityLogs.map((log, index) => (
                <div key={`act-${index}`} className="flex items-start gap-4 p-5 transition-colors hover:bg-slate-50/50">
                  <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 ring-4 ring-white">
                    <Activity className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-slate-900">{log.activity_type}</p>
                      <p className="text-xs font-medium text-slate-400 whitespace-nowrap">{formatDate(log.created_at)}</p>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{log.activity_description}</p>
                    <p className="mt-2 inline-flex text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-md">{userMap[log.user_id ?? 0] || `User #${log.user_id}`}</p>
                  </div>
                </div>
              ))}
              {activityLogs.length === 0 && !error && (
                <div className="p-10 text-center text-slate-500">Chưa có hoạt động nào.</div>
              )}
            </div>
          </div>
          <div className="border-t border-slate-100 px-6 py-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-slate-500">Trang {activityOffset / PAGE_SIZE + 1}</span>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="secondary" disabled={activityOffset === 0} onClick={() => setActivityOffset((value) => Math.max(0, value - PAGE_SIZE))}>
                  Trước
                </Button>
                <Button type="button" size="sm" variant="secondary" disabled={activityLogs.length < PAGE_SIZE} onClick={() => setActivityOffset((value) => value + PAGE_SIZE)}>
                  Sau
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Admin Actions */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col h-[700px]">
          <div className="border-b border-slate-200 bg-slate-50/50 px-6 py-4 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Thao tác Quản trị viên</h2>
            <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-700/10">
              {adminActions.length} bản ghi
            </span>
          </div>
          <div className="flex-1 overflow-auto">
            <div className="divide-y divide-slate-100">
              {adminActions.map((log, index) => (
                <div key={`adm-${index}`} className="flex items-start gap-4 p-5 transition-colors hover:bg-red-50/30">
                  <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 ring-4 ring-white">
                    <ShieldAlert className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-red-900">{log.action_type}</p>
                      <p className="text-xs font-medium text-slate-400 whitespace-nowrap">{formatDate(log.created_at)}</p>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{log.action_description}</p>
                    <div className="mt-2 flex gap-2">
                      <span className="inline-flex text-xs font-medium text-red-700 bg-red-100 px-2 py-1 rounded-md">Admin #{log.admin_id}</span>
                      {log.target_user_id && (
                        <span className="inline-flex text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-md">Mục tiêu: {userMap[log.target_user_id] || `User #${log.target_user_id}`}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {adminActions.length === 0 && !error && (
                <div className="p-10 text-center text-slate-500">Chưa có thao tác quản trị nào.</div>
              )}
            </div>
          </div>
          <div className="border-t border-slate-100 px-6 py-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-slate-500">Trang {actionOffset / PAGE_SIZE + 1}</span>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="secondary" disabled={actionOffset === 0} onClick={() => setActionOffset((value) => Math.max(0, value - PAGE_SIZE))}>
                  Trước
                </Button>
                <Button type="button" size="sm" variant="secondary" disabled={adminActions.length < PAGE_SIZE} onClick={() => setActionOffset((value) => value + PAGE_SIZE)}>
                  Sau
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
