"use client";

import { useEffect, useState } from "react";
import { Repeat2 } from "lucide-react";
import { transactionsApi } from "@/lib/api";
import { errorMessage } from "@/lib/api/client";
import type { Transaction } from "@/lib/api/types";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { TransactionList } from "@/components/transaction-list";

export default function TransactionsPage() {
  const { token } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [error, setError] = useState("");

  async function load() {
    if (!token) return;
    try {
      setTransactions(await transactionsApi.list(token));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  return (
    <>
      <PageHeader
        hero
        heroIcon={<Repeat2 className="h-3.5 w-3.5" />}
        title="Giao dịch của tôi"
        description="Theo dõi yêu cầu đi và đến, hạn trả sách, xác nhận mượn-trả và quyết toán LibriPoint."
        heroStat={
          <>
            <p className="text-sm font-medium text-blue-200">Tổng giao dịch</p>
            <div className="mt-1 text-4xl font-bold text-white">{transactions.length}</div>
            <p className="mt-1 text-sm text-blue-200">Đang quản lý</p>
          </>
        }
      />
      {error ? <p className="mb-4 text-base text-rose-400">{error}</p> : null}
      <TransactionList initial={transactions} onChanged={load} />
    </>
  );
}
