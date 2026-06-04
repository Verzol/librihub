"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookCheck,
  Camera,
  Check,
  Gift,
  Handshake,
  ImagePlus,
  Lightbulb,
  Repeat2,
  Sparkles,
  UploadCloud
} from "lucide-react";
import { booksApi } from "@/lib/api";
import { errorMessage } from "@/lib/api/client";
import type { Book, BookCondition, Category, ExchangeMode } from "@/lib/api/types";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Alert, Card, ConfirmButton, Field, Select, TextArea, TextInput } from "./ui";

const conditionOptions: {
  value: BookCondition;
  label: string;
  detail: string;
}[] = [
  { value: "NEW", label: "Mới", detail: "Chưa dùng" },
  { value: "GOOD", label: "Tốt", detail: "Sạch, ít dấu vết" },
  { value: "FAIR", label: "Khá", detail: "Có ghi chú nhẹ" },
  { value: "WORN", label: "Cũ", detail: "Bìa hoặc gáy đã mòn" }
];

const exchangeOptions: {
  value: ExchangeMode;
  label: string;
  detail: string;
  icon: typeof Handshake;
  reward: string;
}[] = [
  {
    value: "PERMANENT_EXCHANGE",
    label: "Trao đổi vĩnh viễn",
    detail: "Người yêu cầu trả 10 điểm cho bạn khi hoàn tất.",
    icon: Handshake,
    reward: "+10"
  },
  {
    value: "BORROW_RETURN",
    label: "Cho mượn",
    detail: "Người mượn chốt ngày trả khi gửi yêu cầu.",
    icon: BookCheck,
    reward: "+5"
  },
  {
    value: "BOTH",
    label: "Cả hai hình thức",
    detail: "Người yêu cầu chọn trao đổi hoặc mượn trả.",
    icon: Repeat2,
    reward: "+10 / +5"
  }
];

export function BookForm({ book }: { book?: Book }) {
  const { token, user } = useAuth();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cover, setCover] = useState<File | null>(null);
  const [condition, setCondition] = useState<BookCondition>(book?.book_condition ?? "GOOD");
  const [exchangeMode, setExchangeMode] = useState<ExchangeMode>(book?.exchange_mode ?? "BOTH");
  const [coverPreview, setCoverPreview] = useState<string | null>(book?.cover_image_url ?? null);

  useEffect(() => {
    booksApi.categories().then(setCategories).catch((err) => setError(errorMessage(err)));
  }, []);

  useEffect(() => {
    if (!cover) {
      setCoverPreview(book?.cover_image_url ?? null);
      return;
    }
    const url = URL.createObjectURL(cover);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [book?.cover_image_url, cover]);

  const selectedExchange = useMemo(
    () => exchangeOptions.find((option) => option.value === exchangeMode) ?? exchangeOptions[2],
    [exchangeMode]
  );

  async function submit(form: HTMLFormElement) {
    if (!token) return;
    const data = new FormData(form);
    const payload = {
      category_id: Number(data.get("category_id")),
      title: String(data.get("title") ?? ""),
      author: String(data.get("author") ?? ""),
      book_description: String(data.get("book_description") ?? "").trim() || null,
      publication_year: data.get("publication_year") ? Number(data.get("publication_year")) : null,
      book_condition: condition,
      exchange_mode: exchangeMode,
      cover_image_url: book?.cover_image_url ?? null
    };
    setLoading(true);
    setError("");
    try {
      const saved = book ? await booksApi.update(token, book.book_id, payload) : await booksApi.create(token, payload);
      if (cover) await booksApi.uploadCover(token, saved.book_id, cover);
      router.push(`/app/books/${saved.book_id}`);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_320px] gap-5 max-lg:grid-cols-1">
      <Card className="p-0">
        <form id="book-form" onSubmit={onSubmit}>
          <div className="relative overflow-hidden border-b border-slate-100 bg-slate-50/80 px-8 py-5">
            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-500 shadow-sm">
                <BookCheck className="h-3.5 w-3.5 text-blue-500" />
                {book ? "Chỉnh sửa thông tin" : "Tạo bài đăng mới"}
              </div>
              <h2 className="mt-3 text-xl font-bold tracking-tight text-slate-900">
                {book ? "Cập nhật sách" : "Đăng sách mới"}
              </h2>
              <p className="mt-1 max-w-xl text-sm leading-6 text-slate-500">
                Sách của bạn sẽ ngay lập tức được đưa lên thư viện để mọi người có thể tìm thấy.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-[180px_minmax(0,1fr)] gap-5 px-6 py-5 max-md:grid-cols-1">
            {error ? <div className="col-span-2 max-md:col-span-1"><Alert variant="error">{error}</Alert></div> : null}

            <section className="col-span-2 max-md:col-span-1">
              <StepTitle index={1} title="Hình ảnh bìa sách" />
              <div className="mt-4 grid grid-cols-[180px_minmax(0,1fr)] gap-6 max-md:grid-cols-1">
                <label className="group relative flex aspect-[3/4] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[1.5rem] border-2 border-dashed border-slate-200 bg-slate-50 text-center transition-all hover:border-blue-400 hover:bg-blue-50/50 hover:shadow-md">
                  {coverPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={coverPreview} alt="Ảnh bìa sách" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  ) : (
                    <div className="flex flex-col items-center p-4">
                      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                        <Camera className="h-6 w-6" />
                      </div>
                      <span className="text-sm font-bold text-slate-700">Tải ảnh lên</span>
                      <span className="mt-1 px-2 text-xs font-medium leading-5 text-slate-400">
                        Kéo thả hoặc nhấp để chọn ảnh bìa
                      </span>
                      <span className="mt-1 text-[11px] font-semibold text-slate-400">PNG, JPG (Tối đa 5MB)</span>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(event) => setCover(event.target.files?.[0] ?? null)}
                  />
                  {coverPreview ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
                      <span className="inline-flex h-9 items-center gap-2 rounded-full bg-white px-4 text-sm font-bold text-slate-900 shadow-sm">
                        <UploadCloud className="h-4 w-4" /> Đổi ảnh khác
                      </span>
                    </div>
                  ) : null}
                </label>

                <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
                  <Field label="Tên sách">
                    <TextInput name="title" defaultValue={book?.title} placeholder="Clean Code" required />
                  </Field>
                  <Field label="Tác giả">
                    <TextInput name="author" defaultValue={book?.author} placeholder="Robert C. Martin" required />
                  </Field>
                  <Field label="Thể loại">
                    <Select name="category_id" defaultValue={book?.category_id ?? ""} required>
                      <option value="">Chọn danh mục</option>
                      {categories.map((category) => (
                        <option key={category.category_id} value={category.category_id}>
                          {category.category_name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Năm xuất bản">
                    <TextInput
                      name="publication_year"
                      type="number"
                      min={0}
                      max={9999}
                      defaultValue={book?.publication_year ?? ""}
                      placeholder="Ví dụ: 2008"
                    />
                  </Field>
                  <Field label="Mô tả sách" className="col-span-2 max-md:col-span-1">
                    <TextArea
                      name="book_description"
                      defaultValue={book?.book_description ?? ""}
                      placeholder="Mô tả ngắn về nội dung, tình trạng thực tế, ghi chú bên trong sách..."
                    />
                  </Field>
                </div>
              </div>
            </section>

            <SectionDivider />

            <section className="col-span-2 max-md:col-span-1">
              <StepTitle index={2} title="Tình trạng vật lý" required />
              <div className="mt-3 grid grid-cols-4 gap-3 max-xl:grid-cols-2 max-sm:grid-cols-1">
                {conditionOptions.map((option) => (
                  <ChoiceButton
                    key={option.value}
                    active={condition === option.value}
                    title={option.label}
                    detail={option.detail}
                    onClick={() => setCondition(option.value)}
                  />
                ))}
              </div>
            </section>

            <SectionDivider />

            <section className="col-span-2 max-md:col-span-1">
              <StepTitle index={3} title="Hình thức giao dịch" required />
              <div className="mt-3 grid grid-cols-3 gap-3 max-xl:grid-cols-1">
                {exchangeOptions.map((option) => (
                  <ExchangeChoice
                    key={option.value}
                    active={exchangeMode === option.value}
                    option={option}
                    onClick={() => setExchangeMode(option.value)}
                  />
                ))}
              </div>
            </section>

            <div className="col-span-2 flex justify-end gap-3 border-t border-slate-200 pt-5 max-md:col-span-1 max-sm:flex-col">
              <button
                type="button"
                onClick={() => router.back()}
                className="inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-base font-semibold text-slate-600 transition-colors hover:bg-slate-50"
              >
                Hủy
              </button>
              <ConfirmButton
                loading={loading}
                confirm={book ? "Bạn có muốn cập nhật sách này không?" : "Bạn có muốn đăng sách này không?"}
                onConfirm={() => {
                  const form = document.getElementById("book-form") as HTMLFormElement | null;
                  if (form?.reportValidity()) void submit(form);
                }}
              >
                {book ? "Lưu thay đổi" : "Đăng sách"}
              </ConfirmButton>
            </div>
          </div>
        </form>
      </Card>

      <aside className="flex flex-col gap-4">
        <Card className="border-amber-100 bg-gradient-to-br from-amber-50 to-orange-50 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-100">
              <Lightbulb className="h-5 w-5" />
            </div>
            <h2 className="text-base font-bold text-amber-900">Mẹo đăng sách hiệu quả</h2>
          </div>
          <div className="mt-4 space-y-2">
            {[
              "Chụp ảnh bìa sách thật rõ nét và sáng sủa",
              "Chọn đúng thể loại để bạn đọc dễ dàng tìm thấy",
              "Miêu tả chân thực tình trạng thực tế của sách",
              "Bật 'Cả hai hình thức' sẽ thu hút nhiều lượt mượn hơn",
              "Những cuốn sách hay thường được đổi chỉ trong vòng 24 giờ"
            ].map((tip) => (
              <div key={tip} className="rounded-xl bg-white/60 px-3 py-2 text-sm font-medium leading-5 text-amber-800 backdrop-blur-sm">
                {tip}
              </div>
            ))}
          </div>
        </Card>

        <Card className="border-emerald-100 bg-gradient-to-br from-emerald-50 to-teal-50 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-100">
              <Gift className="h-5 w-5" />
            </div>
            <h2 className="text-base font-bold text-emerald-900">Bạn có thể nhận được</h2>
          </div>
          <div className="mt-4 space-y-2 text-base text-emerald-800">
            <div className="rounded-xl bg-white/60 px-4 py-3 backdrop-blur-sm">
              <p className="font-bold text-emerald-700">
                <span className="text-lg">{selectedExchange.reward}</span> LibriPoint
              </p>
              <p className="mt-0.5 text-sm font-medium leading-5 text-emerald-600">
                theo hình thức đã chọn sau khi giao dịch hoàn tất hợp lệ.
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-inner">
            <span>Điểm hiện tại</span>
            <span className="text-base">{user?.current_points ?? 0}</span>
          </div>
        </Card>

        <Card className="border-indigo-100 bg-gradient-to-br from-indigo-50 to-blue-50 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-100">
              <Sparkles className="h-5 w-5" />
            </div>
            <h2 className="text-base font-bold text-indigo-900">Thông tin cần biết</h2>
          </div>
          <ul className="mt-4 space-y-3 text-sm font-medium leading-5 text-indigo-800">
            <li className="flex gap-2">
              <span className="text-indigo-400">•</span>
              <span>Sách của bạn sẽ ngay lập tức được đưa lên thư viện để mọi người có thể tìm thấy.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-indigo-400">•</span>
              <span>Khi có người mượn hoặc trao đổi, sách sẽ tạm thời được khóa lại để chờ bạn xác nhận.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-indigo-400">•</span>
              <span>Những cuốn sách đã từng được mượn sẽ luôn được lưu trữ lại như một phần lịch sử của cộng đồng.</span>
            </li>
          </ul>
        </Card>
      </aside>
    </div>
  );
}

function StepTitle({ index, title, required = false }: { index: number; title: string; required?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
        {index}
      </div>
      <h3 className="text-base font-bold text-slate-900">
        {title} {required ? <span className="text-rose-500">*</span> : null}
      </h3>
    </div>
  );
}

function SectionDivider() {
  return <div className="col-span-2 border-t border-slate-200 max-md:col-span-1" />;
}

function ChoiceButton({
  active,
  title,
  detail,
  onClick
}: {
  active: boolean;
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-16 rounded-xl border-2 px-4 py-3 text-left transition-all",
        active
          ? "border-blue-500 bg-blue-50/50 text-blue-900 shadow-sm"
          : "border-slate-100 bg-white text-slate-700 hover:border-blue-200 hover:bg-slate-50"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-base font-bold">{title}</span>
        {active ? <Check className="h-4 w-4 text-blue-600" /> : null}
      </div>
      <p className="mt-1 text-sm font-medium text-slate-500">{detail}</p>
    </button>
  );
}

function ExchangeChoice({
  active,
  option,
  onClick
}: {
  active: boolean;
  option: (typeof exchangeOptions)[number];
  onClick: () => void;
}) {
  const Icon = option.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-24 rounded-xl border-2 p-5 text-left transition-all",
        active
          ? "border-blue-500 bg-blue-50/50 text-blue-900 shadow-sm"
          : "border-slate-100 bg-white text-slate-700 hover:border-blue-200 hover:bg-slate-50"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", active ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-500")}>
            <Icon className="h-4 w-4" />
          </div>
          <span className="text-base font-bold">{option.label}</span>
        </div>
        {active ? <Check className="h-5 w-5 text-blue-600" /> : null}
      </div>
      <p className="mt-3 text-sm font-medium leading-5 text-slate-500">{option.detail}</p>
    </button>
  );
}
