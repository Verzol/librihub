"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Coins, ShieldCheck, Sparkles, Truck, Users } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/api/client";
import { Alert, Button, Field, TextInput } from "@/components/ui";

const highlights = [
  { icon: BookOpen, title: "Khám phá sách UET", text: "Tìm sách đang sẵn sàng trao đổi hoặc cho mượn trong cộng đồng." },
  { icon: Truck, title: "Giao sách nội bộ", text: "Theo dõi vận đơn, xác nhận nhận sách và tích điểm cho courier." },
  { icon: Coins, title: "Điểm thưởng minh bạch", text: "Mỗi giao dịch đều đi qua ledger để điểm số luôn rõ ràng." }
];

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const returnTo = searchParams.get("returnTo");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      setLoading(true);
      const currentUser = await login({ login: String(data.get("login") ?? ""), password: String(data.get("password") ?? "") });
      if (currentUser.role === "ADMIN") {
        router.replace(returnTo || "/admin");
      } else {
        router.replace(returnTo?.startsWith("/admin") ? "/app/books" : returnTo || "/app/books");
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f3f7fc] text-slate-950">
      <div className="grid min-h-screen grid-cols-[1.08fr_0.92fr] max-lg:grid-cols-1">
        <section className="relative overflow-hidden bg-blue-700 px-8 py-8 text-white sm:px-12 lg:px-16">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(255,255,255,0.18),transparent_28%),linear-gradient(135deg,rgba(37,99,235,0),rgba(15,23,42,0.18))]" />
          <div className="absolute right-[-12%] top-[-8%] h-80 w-80 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-[-18%] left-[20%] h-96 w-96 rounded-full bg-sky-300/10 blur-3xl" />
          <div className="relative z-10 flex min-h-full flex-col">
            <Link href="/app/books" className="flex w-fit items-center gap-3" aria-label="Về trang khám phá sách">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-blue-700 shadow-lg shadow-blue-950/10">
                <BookOpen className="h-5 w-5" />
              </span>
              <span className="text-lg font-bold">LibriHub</span>
            </Link>

            <div className="flex flex-1 flex-col justify-center py-14">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-blue-50">
                <Sparkles className="h-3.5 w-3.5" />
                Cộng đồng chia sẻ sách UET
              </div>
              <h1 className="mt-6 max-w-2xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
                Tìm sách, gửi yêu cầu và theo dõi giao dịch trong một nơi.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-blue-50/90">
                LibriHub giúp thành viên đăng sách, mượn hoặc trao đổi sách, dùng dịch vụ giao sách nội bộ và tích lũy điểm thưởng sau mỗi giao dịch hợp lệ.
              </p>

              <div className="mt-9 grid max-w-2xl gap-3">
                {highlights.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.title} className="flex gap-4 rounded-2xl border border-white/15 bg-white/10 p-4 shadow-[0_16px_40px_rgba(15,23,42,0.12)] backdrop-blur">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-blue-700">
                        <Icon className="h-5 w-5" />
                      </span>
                      <div>
                        <h2 className="text-sm font-semibold">{item.title}</h2>
                        <p className="mt-1 text-sm leading-6 text-blue-50/80">{item.text}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-sm max-sm:grid-cols-1">
              <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                <p className="text-2xl font-bold">20</p>
                <p className="mt-1 text-blue-50/75">điểm khởi tạo</p>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                <p className="text-2xl font-bold">3</p>
                <p className="mt-1 text-blue-50/75">luồng giao dịch</p>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                <p className="text-2xl font-bold">24h</p>
                <p className="mt-1 text-blue-50/75">cập nhật vận đơn</p>
              </div>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center px-6 py-10 sm:px-10">
          <div className="w-full max-w-md">
            <button
              type="button"
              onClick={() => router.back()}
              className="mb-6 inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Quay lại
            </button>
            <div className="mb-7 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-blue-700">Chào mừng trở lại</p>
                <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Đăng nhập</h2>
              </div>
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 shadow-sm">
                <ShieldCheck className="h-5 w-5" />
              </span>
            </div>

            <div className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.10)] sm:p-8">
              <p className="text-sm leading-6 text-slate-500">
                Dùng email hoặc số điện thoại đã đăng ký để tiếp tục quản lý sách, yêu cầu giao dịch và điểm thưởng.
              </p>
              <form className="mt-6 flex flex-col gap-4" onSubmit={onSubmit}>
                {error ? <Alert variant="error">{error}</Alert> : null}
                <Field label="Email hoặc điện thoại">
                  <TextInput name="login" autoComplete="username" placeholder="VD: minh@uet.edu.vn" required />
                </Field>
                <Field label="Mật khẩu">
                  <TextInput name="password" type="password" autoComplete="current-password" placeholder="Nhập mật khẩu" required />
                </Field>
                <Button className="mt-2 h-12 w-full" loading={loading}>
                  Đăng nhập
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </form>

              <div className="mt-6 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
                Chưa có tài khoản?{" "}
                <Link className="font-semibold text-blue-700 hover:text-blue-800" href="/register">
                  Tạo tài khoản thành viên
                </Link>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50/80 px-4 py-3 text-sm text-blue-800">
              <Users className="h-4 w-4 shrink-0" />
              Thành viên chỉ thấy tài nguyên nội bộ sau khi đăng nhập thành công.
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#f3f7fc]" />}>
      <LoginContent />
    </Suspense>
  );
}
