"use client";

import { useEffect, useState } from "react";
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
        title="Giao dịch của tôi"
        description="Theo dõi yêu cầu đi và đến, hạn trả sách, xác nhận mượn-trả và quyết toán LibriPoint."
      />
      {error ? <p className="mb-4 text-sm text-rose-400">{error}</p> : null}
      <TransactionList initial={transactions} onChanged={load} />
    </>
  );
}
