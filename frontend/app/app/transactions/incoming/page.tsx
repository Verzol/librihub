"use client";

import { useEffect, useState } from "react";
import { Inbox } from "lucide-react";
import { transactionsApi } from "@/lib/api";
import type { Transaction } from "@/lib/api/types";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { TransactionList } from "@/components/transaction-list";

export default function IncomingTransactionsPage() {
  const { token } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  async function load() {
    if (token) setTransactions(await transactionsApi.list(token, "owner"));
  }
  useEffect(() => {
    void load();
  }, [token]);
  return (
    <>
      <PageHeader
        hero
        heroIcon={<Inbox className="h-3.5 w-3.5" />}
        title="Yêu cầu đến"
        description="Các giao dịch mà bạn là chủ sách. Xem xét, chấp nhận hoặc từ chối từng yêu cầu mượn và trao đổi."
        heroStat={
          <>
            <p className="text-sm font-medium text-blue-200">Yêu cầu đến</p>
            <div className="mt-1 text-4xl font-bold text-white">{transactions.length}</div>
            <p className="mt-1 text-sm text-blue-200">Cần xem xét</p>
          </>
        }
      />
      <TransactionList initial={transactions} onChanged={load} />
    </>
  );
}
