"use client";

import { useEffect, useState } from "react";
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
      <PageHeader title="Yêu cầu đến" description="Các giao dịch mà bạn là chủ sách." />
      <TransactionList initial={transactions} onChanged={load} />
    </>
  );
}
