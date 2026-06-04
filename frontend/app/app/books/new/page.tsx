"use client";

import { BookPlus } from "lucide-react";
import { BookForm } from "@/components/book-form";
import { PageHeader } from "@/components/ui";

export default function NewBookPage() {
  return (
    <>
      <PageHeader
        hero
        heroIcon={<BookPlus className="h-3.5 w-3.5" />}
        title="Đăng sách mới"
        description="Chia sẻ cuốn sách bạn đã đọc đến cộng đồng — cho mượn hoặc trao đổi. Sách được đăng sẽ xuất hiện ngay trong thư viện."
      />
      <BookForm />
    </>
  );
}
