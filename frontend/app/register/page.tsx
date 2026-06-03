"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, FormEvent, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Coins, MapPin, ShieldCheck, Truck, Users } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/api/client";
import { Alert, Button, Field, TextInput, TextArea } from "@/components/ui";

const benefits = [
  "Quà tặng 20 LibriPoint ngay khi hoàn tất đăng ký.",
  "Dễ dàng chia sẻ tủ sách cá nhân và mượn sách từ bạn bè.",
  "Quản lý toàn diện mọi giao dịch, vận đơn và điểm thưởng."
];

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { register } = useAuth();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const returnTo = searchParams.get("returnTo");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget);
    
    const password = String(data.get("password") ?? "");
    const confirmPassword = String(data.get("confirm_password") ?? "");

    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    try {
      setLoading(true);
      await register({
        full_name: String(data.get("full_name") ?? ""),
        email: String(data.get("email") ?? ""),
        phone: String(data.get("phone") ?? ""),
        student_code: String(data.get("student_code") ?? ""),
        address: String(data.get("address") ?? ""),
        password: password
      });
      router.replace(returnTo || "/app/books");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen grid-cols-2 max-lg:grid-cols-1 animate-fade-in-up">
      <section className="flex items-center justify-center px-6 py-10 sm:px-10 lg:px-14">
        <div className="w-full max-w-2xl">
          <div className="mb-8 flex items-center justify-between gap-4">
            <Link href="/app/books" className="flex w-fit items-center gap-3" aria-label="Về trang khám phá sách">
              <img src="/logo-icon.png" alt="LibriHub Logo" className="h-11 w-11 rounded-2xl shadow-lg shadow-blue-700/20" />
              <span className="text-lg font-semibold">LibriHub</span>
            </Link>
            <Link
              href={returnTo || "/app/books"}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-base font-semibold text-slate-600 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Quay lại
            </Link>
          </div>

          <div className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.10)] sm:p-8">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-base font-semibold text-blue-700">Bắt đầu hành trình mới</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Đăng ký thành viên</h1>
                <p className="mt-2 text-base leading-6 text-slate-500">
                  Chỉ mất vài phút để gia nhập cộng đồng yêu sách UET và nhận ngay điểm thưởng chào mừng.
                </p>
              </div>
              <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 sm:flex">
                <ShieldCheck className="h-5 w-5" />
              </span>
            </div>

            <form className="grid grid-cols-2 gap-4 max-md:grid-cols-1" onSubmit={onSubmit}>
              {error ? (
                <div className="col-span-2 max-md:col-span-1">
                  <Alert variant="error">{error}</Alert>
                </div>
              ) : null}

              <div className="col-span-2 mt-2 mb-1 border-b border-slate-100 pb-2 max-md:col-span-1">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Thông tin cá nhân</h3>
              </div>

              <Field label="Họ và tên">
                <TextInput name="full_name" autoComplete="name" placeholder="VD: Giang Tuấn Minh" required />
              </Field>
              <Field label="Mã sinh viên UET">
                <TextInput name="student_code" placeholder="VD: 2202xxxx" required />
              </Field>

              <div className="col-span-2 mt-4 mb-1 border-b border-slate-100 pb-2 max-md:col-span-1">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Liên hệ & Giao nhận</h3>
              </div>

              <Field label="Email">
                <TextInput name="email" type="email" autoComplete="email" placeholder="minh@uet.edu.vn" required />
              </Field>
              <Field label="Điện thoại">
                <TextInput name="phone" autoComplete="tel" placeholder="09xx xxx xxx" required />
              </Field>
              <Field label="Địa chỉ nhận/giao sách" className="col-span-2 max-md:col-span-1">
                <TextArea name="address" placeholder="VD: Sảnh G2, Khu GĐ3, ĐHQGHN" required />
              </Field>

              <div className="col-span-2 mt-4 mb-1 border-b border-slate-100 pb-2 max-md:col-span-1">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Bảo mật</h3>
              </div>

              <Field label="Mật khẩu">
                <TextInput name="password" type="password" autoComplete="new-password" minLength={8} maxLength={72} placeholder="Tối thiểu 8 ký tự" required />
              </Field>
              <Field label="Xác nhận mật khẩu">
                <TextInput name="confirm_password" type="password" autoComplete="new-password" minLength={8} maxLength={72} placeholder="Nhập lại mật khẩu" required />
              </Field>

              <div className="col-span-2 mt-6 flex items-center justify-between gap-3 pt-4 border-t border-slate-100 max-md:col-span-1 max-sm:flex-col max-sm:items-stretch">
                <Link className="text-base font-semibold text-blue-700 hover:text-blue-800 max-sm:text-center" href={`/login${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`}>
                  Đã có tài khoản?
                </Link>
                <Button className="h-12 px-7" loading={loading}>
                  Tạo tài khoản
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 px-8 py-8 text-white sm:px-12 lg:px-16">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_18%,rgba(255,255,255,0.20),transparent_30%),linear-gradient(135deg,rgba(37,99,235,0),rgba(15,23,42,0.18))]" />
        <div className="absolute left-[-10%] top-[-10%] h-80 w-80 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-[-14%] right-[12%] h-96 w-96 rounded-full bg-sky-300/10 blur-3xl" />

        <div className="relative z-10 flex min-h-full flex-col justify-center py-10">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-sm font-semibold text-blue-50">
            <Coins className="h-3.5 w-3.5" />
            Thành viên mới được cộng 20 điểm
          </div>
          <h2 className="mt-6 max-w-2xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Tất cả tiện ích hội tụ trong một nền tảng duy nhất.
          </h2>
          <p className="mt-5 max-w-xl text-base leading-7 text-blue-50/90">
            Trải nghiệm mượn và trao đổi sách thông minh với hệ thống điểm thưởng minh bạch cùng mạng lưới kết nối rộng khắp cộng đồng UET.
          </p>

          <div className="mt-9 grid gap-3">
            {benefits.map((benefit) => (
              <div key={benefit} className="flex items-start gap-3 rounded-2xl border border-white/15 bg-white/10 p-4 text-base leading-6 text-blue-50/90 backdrop-blur">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-200" />
                <span>{benefit}</span>
              </div>
            ))}
          </div>

          <div className="mt-9 grid grid-cols-3 gap-3 max-sm:grid-cols-1">
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 transition-all hover:bg-white/20">
              <Users className="h-5 w-5 text-blue-100" />
              <p className="mt-3 text-base font-semibold">Hồ sơ cá nhân</p>
              <p className="mt-1 text-sm leading-5 text-blue-50/70">Cập nhật và quản lý dễ dàng thông tin liên lạc của bạn.</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 transition-all hover:bg-white/20">
              <Truck className="h-5 w-5 text-blue-100" />
              <p className="mt-3 text-base font-semibold">Giao nhận thông minh</p>
              <p className="mt-1 text-sm leading-5 text-blue-50/70">Linh hoạt tùy chọn tự giao hoặc đội ngũ hỗ trợ nhiệt tình.</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 transition-all hover:bg-white/20">
              <MapPin className="h-5 w-5 text-blue-100" />
              <p className="mt-3 text-base font-semibold">Mạng lưới rộng khắp</p>
              <p className="mt-1 text-sm leading-5 text-blue-50/70">Tối ưu hóa thời gian với các giao dịch ưu tiên gần bạn nhất.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <main className="min-h-screen bg-[#f3f7fc] text-slate-950">
      <Suspense fallback={<div className="flex h-screen items-center justify-center">Đang tải...</div>}>
        <RegisterContent />
      </Suspense>
    </main>
  );
}
