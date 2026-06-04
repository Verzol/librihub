"use client";

import { useEffect, useState } from "react";
import { Send } from "lucide-react";
import { transactionsApi } from "@/lib/api";
import type { Transaction } from "@/lib/api/types";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { TransactionList } from "@/components/transaction-list";

export default function OutgoingTransactionsPage() {
  const { token } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  async function load() {
    if (token) setTransactions(await transactionsApi.list(token, "requester"));
  }
  useEffect(() => {
    void load();
  }, [token]);
  return (
    <>
      <PageHeader
        hero
        heroIcon={<Send className="h-3.5 w-3.5" />}
        title="Yêu cầu đi"
        description="Các giao dịch mà bạn là người yêu cầu. Theo dõi tiến trình và xác nhận khi nhận được sách."
        heroStat={
          <>
            <p className="text-sm font-medium text-blue-200">Yêu cầu đi</p>
            <div className="mt-1 text-4xl font-bold text-white">{transactions.length}</div>
            <p className="mt-1 text-sm text-blue-200">Đã gửi</p>
          </>
        }
      />
      <TransactionList initial={transactions} onChanged={load} />
    </>
  );
}
