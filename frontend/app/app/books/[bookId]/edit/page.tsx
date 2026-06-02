"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { booksApi } from "@/lib/api";
import type { Book } from "@/lib/api/types";
import { useAuth } from "@/lib/auth";
import { BookForm } from "@/components/book-form";
import { LoadingState, PageHeader } from "@/components/ui";

export default function EditBookPage() {
  const { token } = useAuth();
  const params = useParams<{ bookId: string }>();
  const [book, setBook] = useState<Book | null>(null);

  useEffect(() => {
    booksApi.detail(token, Number(params.bookId)).then(setBook).catch(() => setBook(null));
  }, [params.bookId, token]);

  if (!book) return <LoadingState />;
  return (
    <>
      <PageHeader title="Sửa sách" description={book.title} />
      <BookForm book={book} />
    </>
  );
}
