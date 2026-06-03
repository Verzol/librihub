"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Award, CalendarDays, Coins, History, ReceiptText } from "lucide-react";
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

  const summary = useMemo(() => {
    return ledger.reduce(
      (total, entry) => {
        if (entry.point_change >= 0) total.earned += entry.point_change;
        else total.spent += Math.abs(entry.point_change);
        return total;
      },
      { earned: 0, spent: 0 }
    );
  }, [ledger]);

  const latestEntry = ledger[0];

  return (
    <>
      <PageHeader
        hero
        heroIcon={<Coins className="h-3.5 w-3.5" />}
        title="Điểm thưởng"
        description="Theo dõi số dư LibriPoint và toàn bộ biến động điểm từ giao dịch, giao sách hoặc điều chỉnh hệ thống."
        heroStat={
          <>
            <p className="text-sm font-medium text-blue-200">Số dư hiện tại</p>
            <div className="mt-1 text-4xl font-bold text-white">{user?.current_points ?? 0}</div>
            <p className="mt-1 text-sm text-blue-200">LibriPoint</p>
          </>
        }
      />

      <section className="mb-6 grid grid-cols-3 gap-4 max-sm:grid-cols-1">
        <SummaryCard
          icon={ArrowUpRight}
          label="Điểm đã nhận"
          value={`+${summary.earned}`}
          tone="emerald"
        />
        <SummaryCard
          icon={ArrowDownLeft}
          label="Điểm đã dùng"
          value={`-${summary.spent}`}
          tone="rose"
        />
        <SummaryCard
          icon={History}
          label="Lần thay đổi"
          value={String(ledger.length)}
          tone="blue"
        />
      </section>

      {ledger.length === 0 ? (
        <EmptyState title="Chưa có biến động điểm" />
      ) : (
        <Card className="p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-100">
                <History className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Lịch sử điểm</h2>
                <p className="text-sm text-slate-500">Các thay đổi gần đây nhất sẽ hiển thị trên cùng.</p>
              </div>
            </div>
            <Badge value={`${ledger.length} mục`} />
          </div>

          <div className="divide-y divide-slate-100">
            {ledger.map((entry) => (
              <LedgerRow key={entry.ledger_id} entry={entry} />
            ))}
          </div>
        </Card>
      )}
    </>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  tone
}: {
  icon: typeof Award;
  label: string;
  value: string;
  tone: "emerald" | "rose" | "blue";
}) {
  const config =
    tone === "emerald"
      ? { bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-100", val: "text-emerald-700" }
      : tone === "rose"
      ? { bg: "bg-rose-50", text: "text-rose-700", ring: "ring-rose-100", val: "text-rose-600" }
      : { bg: "bg-blue-50", text: "text-blue-700", ring: "ring-blue-100", val: "text-blue-700" };

  return (
    <Card className="flex items-center gap-4 p-5 transition-all hover:-translate-y-1 hover:shadow-md">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ring-1 ring-inset ${config.bg} ${config.text} ${config.ring}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className={`text-2xl font-bold ${config.val}`}>{value}</div>
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      </div>
    </Card>
  );
}

function LedgerRow({ entry }: { entry: PointLedger }) {
  const positive = entry.point_change >= 0;
  const details = reasonDetail(entry.reason);
  const amount = `${positive ? "+" : ""}${entry.point_change}`;

  return (
    <article className="grid grid-cols-[minmax(0,1fr)_150px_110px] items-center gap-4 px-5 py-4 transition-colors hover:bg-blue-50/40 max-lg:grid-cols-1">
      <div className="flex min-w-0 items-start gap-3">
        <div
          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
            positive ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
          }`}
        >
          {positive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900">{details.title}</h3>
            <Badge value={entry.role_in_transaction} />
          </div>
          <p className="mt-0.5 text-xs leading-5 text-slate-500">{details.description}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              {formatDate(entry.created_at)}
            </span>
            {entry.transaction_id ? (
              <Link href="/app/transactions" className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-700">
                <ReceiptText className="h-3.5 w-3.5" />
                Giao dịch #{entry.transaction_id}
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
        <div className="flex items-center justify-between gap-3">
          <span>Trước</span>
          <span className="font-semibold text-slate-700">{entry.points_before}</span>
        </div>
        <div className="mt-1 flex items-center justify-between gap-3">
          <span>Sau</span>
          <span className="font-bold text-slate-900">{entry.points_after}</span>
        </div>
      </div>

      <div className={`text-right text-xl font-bold max-lg:text-left ${positive ? "text-emerald-600" : "text-rose-600"}`}>
        {amount}
      </div>
    </article>
  );
}

function reasonDetail(reason: string) {
  const labels: Record<string, { title: string; description: string }> = {
    INITIAL_BONUS: {
      title: "Thưởng thành viên mới",
      description: "Quà tặng chào mừng bạn gia nhập cộng đồng LibriHub."
    },
    EXCHANGE_REWARD: {
      title: "Thưởng trao đổi sách",
      description: "Điểm thưởng khi bạn trao đổi sách thành công với người khác."
    },
    EXCHANGE_COST: {
      title: "Chi phí trao đổi sách",
      description: "Điểm sử dụng để nhận sách từ người khác."
    },
    BORROW_REWARD: {
      title: "Thưởng mượn trả",
      description: "Điểm thưởng khi bạn cho người khác mượn sách xong."
    },
    BORROW_COST: {
      title: "Chi phí mượn sách",
      description: "Điểm sử dụng để mượn sách của người khác."
    },
    DELIVERY_REWARD: {
      title: "Thưởng giao sách",
      description: "Quà tặng cảm ơn bạn đã giao sách thành công đến người nhận."
    },
    ADMIN_ADJUSTMENT: {
      title: "Hỗ trợ từ quản trị viên",
      description: "Điểm được điều chỉnh bởi ban quản trị LibriHub."
    }
  };

  return labels[reason] ?? {
    title: reason.replaceAll("_", " "),
    description: "Lịch sử thay đổi điểm thưởng của bạn."
  };
}
