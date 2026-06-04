"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Book, History, LayoutDashboard, Loader2, LogOut, Repeat, ShieldCheck, Star, Truck, Users, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui";

const navigation = [
  { name: "Bảng điều khiển", href: "/admin", icon: LayoutDashboard },
  { name: "Người dùng", href: "/admin/users", icon: Users },
  { name: "Sách & Thể loại", href: "/admin/books", icon: Book },
  { name: "Giao dịch", href: "/admin/transactions", icon: Repeat },
  { name: "Duyệt người giao sách", href: "/admin/couriers", icon: Truck },
  { name: "Đánh giá", href: "/admin/reviews", icon: Star },
  { name: "Nhật ký hệ thống", href: "/admin/logs", icon: History }
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`);
    }
  }, [isLoading, pathname, router, user]);

  function onLogout() {
    logout();
    router.replace("/login");
  }

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-600 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
          Đang kiểm tra quyền truy cập
        </div>
      </div>
    );
  }

  // Basic role guard to prevent visual flashing of admin content for non-admins.
  // The actual data is protected by the backend.
  if (user.role !== "ADMIN") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <ShieldCheck className="mx-auto h-12 w-12 text-slate-400" />
          <h2 className="mt-4 text-lg font-semibold text-slate-900">Không có quyền truy cập</h2>
          <p className="mt-2 text-slate-500">Trang này chỉ dành cho Quản trị viên.</p>
          <Link href="/app/books" className="mt-6 inline-flex rounded-full bg-blue-700 px-4 py-2 text-sm font-semibold text-white">Về trang chủ</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 flex w-64 flex-col border-r border-slate-200 bg-white shadow-sm">
        <div className="flex h-16 shrink-0 items-center gap-3 px-6">
          <img src="/logo-icon.png" alt="LibriAdmin Logo" className="h-8 w-8 rounded-lg shadow-sm" />
          <span className="text-lg font-bold tracking-tight text-slate-900">LibriAdmin</span>
        </div>
        
        <div className="flex flex-1 flex-col overflow-y-auto px-4 py-6">
          <nav className="flex-1 space-y-1">
            {navigation.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all",
                    active
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  <item.icon className={cn("h-5 w-5 shrink-0 transition-colors", active ? "text-blue-700" : "text-slate-400 group-hover:text-slate-600")} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
          
          <div className="mt-auto space-y-1 pt-4 border-t border-slate-100">
            <Link
              href="/app/books"
              className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
            >
              <ArrowLeft className="h-5 w-5 shrink-0 text-slate-400 group-hover:text-slate-600" />
              Về LibriHub
            </Link>
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
            >
              <LogOut className="h-5 w-5 shrink-0 text-red-500 group-hover:text-red-600" />
              Đăng xuất
            </button>
          </div>
        </div>
      </aside>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div
          className="fixed inset-x-0 top-0 z-[130] flex h-[100dvh] items-center justify-center overflow-y-auto bg-slate-950/45 px-5 py-10 backdrop-blur-sm"
          role="presentation"
          onMouseDown={() => setShowLogoutConfirm(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            className="my-auto w-full max-w-md overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_32px_90px_rgba(15,23,42,0.24)]"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="relative border-b border-slate-100 bg-slate-50/50 px-6 py-5">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl ring-1 ring-inset shadow-sm bg-red-50 text-red-600 ring-red-100">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-bold text-slate-950">
                    Xác nhận đăng xuất
                  </h2>
                  <p className="mt-0.5 text-sm font-medium text-slate-500">
                    Đăng xuất khỏi hệ thống
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Đóng"
                onClick={() => setShowLogoutConfirm(false)}
                className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="px-6 py-6">
              <p className="text-base leading-7 text-slate-600">Bạn có chắc chắn muốn đăng xuất khỏi tài khoản Quản trị viên?</p>
              
              <div className="mt-8 flex justify-end gap-3 max-sm:flex-col-reverse max-sm:items-stretch">
                <Button type="button" variant="secondary" onClick={() => setShowLogoutConfirm(false)} className="max-sm:h-12">
                  Hủy
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  onClick={onLogout}
                  className="max-sm:h-12"
                >
                  Đăng xuất
                </Button>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 pl-64">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200 bg-white/80 px-8 backdrop-blur-md">
          <div className="text-sm font-medium text-slate-500">Hệ thống quản trị</div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-700">{user?.full_name}</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700 ring-1 ring-inset ring-blue-200">
              {user?.full_name?.slice(0, 1).toUpperCase()}
            </div>
          </div>
        </header>
        <div className="mx-auto max-w-7xl p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
