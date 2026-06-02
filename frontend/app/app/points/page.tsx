"use client";

import { useEffect, useState } from "react";
import { pointsApi } from "@/lib/api";
import type { PointLedger } from "@/lib/api/types";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";

export default function PointsPage() {
  const { token, user } = useAuth();
  const [ledger, setLedger] = useState<PointLedger[]>([]);

  useEffect(() => {
    if (token) pointsApi.ledger(token).then(setLedger).catch(() => setLedger([]));
  }, [token]);

  return (
    <>
      <PageHeader title="Điểm thưởng" description="Số dư hiện tại và lịch sử ledger append-only." />
      <Card className="mb-5">
        <div className="text-xs uppercase text-slate-500">Số dư hiện tại</div>
        <div className="mt-1 text-3xl font-bold text-slate-950">{user?.current_points ?? 0}</div>
      </Card>
      {ledger.length === 0 ? (
        <EmptyState title="Chưa có biến động điểm" />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Lý do</th>
                  <th className="px-4 py-3">Thay doi</th>
                  <th className="px-4 py-3">Truoc</th>
                  <th className="px-4 py-3">Sau</th>
                  <th className="px-4 py-3">Thời gian</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((entry) => (
                  <tr key={entry.ledger_id} className="border-t border-slate-100">
                    <td className="px-4 py-3"><Badge value={entry.reason} /></td>
                    <td className={entry.point_change >= 0 ? "px-4 py-3 text-emerald-400" : "px-4 py-3 text-rose-400"}>{entry.point_change}</td>
                    <td className="px-4 py-3 text-slate-600">{entry.points_before}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{entry.points_after}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(entry.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
