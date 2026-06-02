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
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-xl font-bold text-slate-950">{book ? "Cập nhật sách" : "Đăng sách mới"}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Sách được hiển thị công khai để cộng đồng có thể yêu cầu khi trạng thái khả dụng.
            </p>
          </div>

          <div className="grid grid-cols-[180px_minmax(0,1fr)] gap-5 px-6 py-5 max-md:grid-cols-1">
            {error ? <div className="col-span-2 max-md:col-span-1"><Alert variant="error">{error}</Alert></div> : null}

            <section className="col-span-2 max-md:col-span-1">
              <StepTitle index={1} title="Hình ảnh bìa sách" />
              <div className="mt-3 grid grid-cols-[180px_minmax(0,1fr)] gap-5 max-md:grid-cols-1">
                <label className="group flex aspect-[3/4] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-center transition-colors hover:border-blue-300 hover:bg-blue-50/60">
                  {coverPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={coverPreview} alt="Ảnh bìa sách" className="h-full w-full object-cover" />
                  ) : (
                    <>
                      <Camera className="h-8 w-8 text-slate-400 transition-colors group-hover:text-blue-700" />
                      <span className="mt-3 px-4 text-xs font-medium leading-5 text-slate-500">
                        Kéo thả hoặc chọn ảnh bìa
                      </span>
                      <span className="text-[11px] text-slate-400">PNG, JPG tối đa 5MB</span>
                      <span className="mt-4 inline-flex h-8 items-center gap-2 rounded-full bg-blue-700 px-3 text-xs font-bold text-white shadow-sm transition-colors group-hover:bg-blue-800">
                        <UploadCloud className="h-3.5 w-3.5" />
                        Chọn ảnh
                      </span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(event) => setCover(event.target.files?.[0] ?? null)}
                  />
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
                className="inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50"
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
        <Card>
          <div className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            <h2 className="text-sm font-bold text-slate-950">Mẹo đăng sách hiệu quả</h2>
          </div>
          <div className="mt-4 space-y-2">
            {[
              "Chụp ảnh bìa rõ nét, đủ ánh sáng",
              "Chọn đúng thể loại để dễ tìm kiếm",
              "Mô tả tình trạng thật chính xác",
              "Hình thức Cả hai nhận nhiều yêu cầu hơn",
              "Sách phổ biến thường trao đổi trong 24h"
            ].map((tip) => (
              <div key={tip} className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-medium leading-5 text-slate-600">
                {tip}
              </div>
            ))}
          </div>
        </Card>

        <Card className="border-emerald-200 bg-emerald-50">
          <div className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-emerald-600" />
            <h2 className="text-sm font-bold text-emerald-900">Bạn có thể nhận được</h2>
          </div>
          <div className="mt-3 space-y-2 text-sm text-emerald-800">
            <p><strong>{selectedExchange.reward} điểm</strong> theo hình thức đã chọn</p>
            <p className="text-xs leading-5 text-emerald-700">
              Điểm chỉ được cộng sau khi giao dịch hoàn tất hợp lệ.
            </p>
          </div>
          <div className="mt-4 rounded-xl bg-white/70 px-3 py-2 text-xs font-semibold text-emerald-800">
            Điểm hiện tại: {user?.current_points ?? 0} {"->"} sau khi hoàn tất có thể tăng theo giao dịch.
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-700" />
            <h2 className="text-sm font-bold text-slate-950">Logic hệ thống</h2>
          </div>
          <ul className="mt-3 space-y-2 text-xs leading-5 text-slate-500">
            <li>• Sách mới luôn bắt đầu ở trạng thái khả dụng.</li>
            <li>• Khi có yêu cầu hợp lệ, sách chuyển sang đang có giao dịch.</li>
            <li>• Sách đã tham gia giao dịch sẽ không bị xóa vật lý.</li>
          </ul>
        </Card>
      </aside>
    </div>
  );
}

function StepTitle({ index, title, required = false }: { index: number; title: string; required?: boolean }) {
  return (
    <h3 className="text-sm font-bold text-slate-950">
      {index}. {title} {required ? <span className="text-blue-700">*</span> : null}
    </h3>
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
        "min-h-16 rounded-xl border px-3 py-2 text-left transition-all",
        active
          ? "border-blue-600 bg-blue-50 text-blue-800 shadow-[0_0_0_3px_rgba(37,99,235,0.10)]"
          : "border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-200 hover:bg-blue-50/40"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold">{title}</span>
        {active ? <Check className="h-4 w-4" /> : null}
      </div>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
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
        "min-h-24 rounded-xl border p-4 text-left transition-all",
        active
          ? "border-blue-600 bg-blue-50 text-blue-800 shadow-[0_0_0_3px_rgba(37,99,235,0.10)]"
          : "border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-200 hover:bg-blue-50/40"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          <span className="text-sm font-bold">{option.label}</span>
        </div>
        {active ? <Check className="h-4 w-4" /> : null}
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-500">{option.detail}</p>
    </button>
  );
}
