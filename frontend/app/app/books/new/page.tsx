import { BookForm } from "@/components/book-form";
import { PageHeader } from "@/components/ui";

export default function NewBookPage() {
  return (
    <>
      <PageHeader title="Đăng sách mới" description="Tạo listing sách mới cho tài khoản của bạn." />
      <BookForm />
    </>
  );
}
