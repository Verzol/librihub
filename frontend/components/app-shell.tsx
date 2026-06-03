"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  ClipboardList,
  Bell,
  type LucideIcon,
  LogOut,
  Menu,
  Shield,
  UserPlus,
  X,
  Truck,
  Users
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { authApi } from "@/lib/api";
import { errorMessage } from "@/lib/api/client";
import type { UserNotification } from "@/lib/api/types";
import { useAuth } from "@/lib/auth";
import { cn, formatDate } from "@/lib/utils";
import { Button, Card, ConfirmButton, LinkButton, LoadingState, buttonStyles } from "./ui";

const navItems = [
  { href: "/app/books", label: "Khám phá sách", icon: BookOpen },
  { href: "/app/transactions", label: "Giao dịch của tôi", icon: ClipboardList },
  { href: "/app/deliveries", label: "Giao sách", icon: Truck },
  { href: "/app/reviews", label: "Cộng đồng", icon: Users }
];

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

function NavList({
  items,
  pathname,
  isGuest,
  onRequireAuth,
  onNavigate
}: {
  items: NavItem[];
  pathname: string;
  isGuest: boolean;
  onRequireAuth: () => void;
  onNavigate: () => void;
}) {
  return (
    <nav className="flex items-center gap-2 max-md:flex-col max-md:items-stretch">
      {items.map((item) => {
        const active = pathname === item.href || (item.href !== "/app" && pathname.startsWith(item.href));
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={(event) => {
              if (isGuest && item.href !== "/app/books") {
                event.preventDefault();
                onRequireAuth();
                return;
              }
              onNavigate();
            }}
            className={cn(
              "flex h-11 items-center gap-2 rounded-full px-4 text-sm font-medium text-slate-500 transition-all hover:bg-blue-50 hover:text-blue-700 max-md:h-10 max-md:rounded-xl",
              active && "bg-blue-50 text-blue-700 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.12)]"
            )}
          >
            <Icon className={cn("hidden h-4 w-4 max-md:block", active ? "text-blue-700" : "text-slate-400")} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function NotificationPanel({
  notifications,
  isLoading,
  error,
  onClose,
  onOpenAll
}: {
  notifications: UserNotification[];
  isLoading: boolean;
  error: string;
  onClose: () => void;
  onOpenAll: () => void;
}) {
  const previewNotifications = notifications.slice(0, 5);

  return (
    <div className="absolute right-0 top-12 z-[100] w-[360px] max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_24px_60px_rgba(15,23,42,0.16)]">
      <div className="mb-2 flex items-center justify-between gap-3 px-1">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Thông báo</h2>
          <p className="text-xs text-slate-500">Hoạt động gần đây của bạn</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          aria-label="Đóng thông báo"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {isLoading ? (
        <div className="rounded-xl bg-slate-50 px-3 py-5 text-center text-sm text-slate-500">Đang tải thông báo...</div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">{error}</div>
      ) : notifications.length === 0 ? (
        <div className="rounded-xl bg-slate-50 px-3 py-5 text-center text-sm text-slate-500">
          Chưa có thông báo nào.
        </div>
      ) : (
        <>
        <div className="max-h-80 overflow-y-auto pr-1">
          {previewNotifications.map((notification) => (
            <Link
              key={notification.activity_id}
              href={notificationHref(notification.activity_type)}
              onClick={onClose}
              className="group flex gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-blue-50"
            >
              <span className="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-blue-700 shadow-[0_0_0_4px_rgba(37,99,235,0.10)]" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-slate-900 group-hover:text-blue-800">
                  {notificationTitle(notification.activity_type)}
                </span>
                <span className="mt-0.5 block text-sm leading-5 text-slate-600">
                  {notification.activity_description}
                </span>
                <span className="mt-1 block text-xs text-slate-400">{formatDate(notification.created_at)}</span>
              </span>
            </Link>
          ))}
        </div>
        <button
          type="button"
          onClick={onOpenAll}
          className="mt-2 flex h-10 w-full items-center justify-center rounded-xl bg-blue-50 text-sm font-bold text-blue-700 transition-colors hover:bg-blue-100"
        >
          Xem tất cả thông báo
        </button>
        </>
      )}
    </div>
  );
}

function NotificationModal({
  notifications,
  onClose
}: {
  notifications: UserNotification[];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 p-5 backdrop-blur-sm">
      <section className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_32px_90px_rgba(15,23,42,0.24)]">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Tất cả thông báo</h2>
            <p className="mt-1 text-sm text-slate-500">Lịch sử hoạt động hệ thống của tài khoản này.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Đóng tất cả thông báo"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {notifications.length === 0 ? (
          <div className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">Chưa có thông báo nào.</div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto pr-2">
            {notifications.map((notification) => (
              <Link
                key={notification.activity_id}
                href={notificationHref(notification.activity_type)}
                onClick={onClose}
                className="group flex gap-3 rounded-xl border-b border-slate-100 px-2 py-3 transition-colors last:border-b-0 hover:bg-blue-50"
              >
                <span className="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-blue-700 shadow-[0_0_0_4px_rgba(37,99,235,0.10)]" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-900 group-hover:text-blue-800">
                    {notificationTitle(notification.activity_type)}
                  </span>
                  <span className="mt-0.5 block text-sm leading-5 text-slate-600">
                    {notification.activity_description}
                  </span>
                  <span className="mt-1 block text-xs text-slate-400">{formatDate(notification.created_at)}</span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function notificationTitle(activityType: string) {
  const labels: Record<string, string> = {
    REGISTER: "Tài khoản",
    LOGIN: "Đăng nhập",
    UPDATE_PROFILE: "Hồ sơ",
    CREATE_BOOK: "Sách",
    UPDATE_BOOK: "Sách",
    CREATE_TRANSACTION: "Giao dịch",
    CONFIRM_TRANSACTION: "Xác nhận giao dịch",
    DELIVERY_UPDATE: "Giao sách",
    CREATE_REVIEW: "Đánh giá",
    POINT_UPDATE: "Điểm"
  };
  return labels[activityType] ?? activityType.replaceAll("_", " ");
}

function notificationHref(activityType: string) {
  if (activityType.includes("BOOK")) return "/app/books";
  if (activityType.includes("TRANSACTION")) return "/app/transactions";
  if (activityType.includes("DELIVERY")) return "/app/deliveries";
  if (activityType.includes("REVIEW")) return "/app/reviews";
  if (activityType.includes("POINT")) return "/app/points";
  if (activityType.includes("PROFILE") || activityType === "REGISTER" || activityType === "LOGIN") return "/app/profile";
  return "/app/books";
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { token, user, isLoading, logout } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [authNoticeOpen, setAuthNoticeOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationError, setNotificationError] = useState("");
  const [seenNotificationIds, setSeenNotificationIds] = useState<number[]>([]);
  const [allNotificationsOpen, setAllNotificationsOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement | null>(null);
  const isPublicCatalogRoute = pathname === "/app/books" || /^\/app\/books\/\d+$/.test(pathname);
  const items: NavItem[] =
    user?.role === "ADMIN" ? [...navItems, { href: "/app/admin", label: "Quản trị", icon: Shield }] : navItems;
  const notificationStorageKey = user ? `librihub.notifications.seen.${user.user_id}` : "";
  const hasUnreadNotifications = notifications.some(
    (notification) => !seenNotificationIds.includes(notification.activity_id)
  );

  function closeAuthNotice() {
    if (!user && !isPublicCatalogRoute) {
      window.location.assign("/app/books");
      return;
    }
    setAuthNoticeOpen(false);
  }

  function scrollPageBehind(deltaY: number) {
    const scrollContainer = document.getElementById("app-scroll-container");
    if (scrollContainer) scrollContainer.scrollTop += deltaY;
  }

  function markNotificationsSeen(items: UserNotification[] = notifications) {
    if (!notificationStorageKey) return;
    const ids = items.map((notification) => notification.activity_id);
    setSeenNotificationIds(ids);
    localStorage.setItem(notificationStorageKey, JSON.stringify(ids));
  }

  async function loadNotifications(markSeen = false) {
    if (!token) return;
    try {
      setNotificationsLoading(true);
      setNotificationError("");
      const data = await authApi.notifications(token);
      setNotifications(data);
      if (markSeen) markNotificationsSeen(data);
    } catch (error) {
      setNotificationError(errorMessage(error));
    } finally {
      setNotificationsLoading(false);
    }
  }

  async function toggleNotifications() {
    const nextOpen = !notificationOpen;
    setNotificationOpen(nextOpen);
    if (nextOpen) await loadNotifications(true);
  }

  useEffect(() => {
    setNotificationOpen(false);
    setAllNotificationsOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!notificationStorageKey) {
      setSeenNotificationIds([]);
      return;
    }
    try {
      const raw = localStorage.getItem(notificationStorageKey);
      setSeenNotificationIds(raw ? JSON.parse(raw) : []);
    } catch {
      setSeenNotificationIds([]);
    }
  }, [notificationStorageKey]);

  useEffect(() => {
    if (token && user) void loadNotifications(false);
  }, [token, user?.user_id]);

  useEffect(() => {
    if (!notificationOpen) return;

    function closeOnOutsideClick(event: MouseEvent) {
      const target = event.target;
      if (target instanceof Node && !notificationRef.current?.contains(target)) {
        setNotificationOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setNotificationOpen(false);
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [notificationOpen]);

  if (isLoading) return <LoadingState />;

  if (!user && !isPublicCatalogRoute) {
    return (
      <div className="min-h-screen overflow-hidden bg-[#f3f6fb]">
        <header className="flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/95 px-10 shadow-[0_1px_12px_rgba(15,23,42,0.04)] max-lg:px-5 max-sm:px-4">
          <Link href="/app/books" className="flex items-center gap-2 font-bold text-slate-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-700 text-white shadow-[0_10px_20px_rgba(37,99,235,0.18)]">L</span>
            LibriHub
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/login" className={buttonStyles({ size: "sm", variant: "secondary" })}>
              Đăng nhập
            </Link>
            <Link href="/register" className={buttonStyles({ size: "sm" })}>
              Đăng ký
            </Link>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-10 py-7 blur-sm max-lg:px-5 max-sm:px-4">
          <section className="rounded-3xl bg-blue-800 px-8 py-12 text-white shadow-[0_24px_70px_rgba(37,99,235,0.18)]">
            <p className="text-sm font-semibold text-blue-100">LibriHub</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight max-sm:text-3xl">Khám phá sách trong cộng đồng</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100">
              Khách có thể xem sách và bảng xếp hạng. Các thao tác tạo dữ liệu cần tài khoản thành viên.
            </p>
          </section>
          <div className="mt-7 grid grid-cols-3 gap-4 max-lg:grid-cols-1">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-36 rounded-2xl border border-slate-200 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.06)]" />
            ))}
          </div>
        </main>

        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-5 backdrop-blur-sm"
          role="presentation"
          onMouseDown={closeAuthNotice}
        >
          <div className="w-full max-w-md" onMouseDown={(event) => event.stopPropagation()}>
            <Card className="relative text-center">
              <button
                type="button"
                aria-label="Đóng"
                onClick={closeAuthNotice}
                className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-700 text-lg font-bold text-white shadow-[0_12px_24px_rgba(37,99,235,0.22)]">L</div>
              <h1 className="text-xl font-bold text-slate-900">Cần đăng nhập</h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Khách có thể xem danh mục sách. Để đăng sách, gửi yêu cầu giao dịch hoặc đăng ký giao sách, bạn cần đăng nhập hoặc tạo tài khoản.
              </p>
              <div className="mt-5 flex justify-center gap-2">
                <LinkButton href="/login">Đăng nhập</LinkButton>
                <LinkButton href="/register" variant="secondary">Đăng ký</LinkButton>
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#f3f6fb]">
      {open ? (
        <div className="fixed inset-0 z-50 bg-slate-950/40 md:hidden" onClick={() => setOpen(false)}>
          <aside className="h-full w-72 border-r border-slate-200 bg-white p-3 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center gap-2 px-2 py-3 font-bold text-slate-900">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-700 text-white">L</span>
              LibriHub
            </div>
            <NavList
              items={items}
              pathname={pathname}
              isGuest={!user}
              onRequireAuth={() => setAuthNoticeOpen(true)}
              onNavigate={() => setOpen(false)}
            />
          </aside>
        </div>
      ) : null}

      <header className="relative z-[90] flex h-16 flex-shrink-0 items-center gap-4 border-b border-slate-200/80 bg-white/95 px-10 shadow-[0_1px_12px_rgba(15,23,42,0.04)] backdrop-blur max-lg:px-5 max-sm:px-4">
        <Link href="/app/books" className="flex items-center gap-2 font-bold text-slate-900">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-700 text-white shadow-[0_10px_20px_rgba(37,99,235,0.18)]">L</span>
          LibriHub
        </Link>
        <div className="flex flex-1 justify-center max-md:hidden">
          <NavList
            items={items}
            pathname={pathname}
            isGuest={!user}
            onRequireAuth={() => setAuthNoticeOpen(true)}
            onNavigate={() => setOpen(false)}
          />
        </div>
        <Button variant="ghost" className="hidden px-2 max-md:inline-flex" onClick={() => setOpen(true)} aria-label="Mở menu">
            <Menu className="h-5 w-5" />
          </Button>
          {user ? (
            <>
              <Link href="/app/points" className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 shadow-sm">
                🏆 {user.current_points} điểm
              </Link>
              <div className="relative" ref={notificationRef}>
                <button
                  className={cn(
                    "relative flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:bg-blue-50 hover:text-blue-700",
                    notificationOpen && "bg-blue-50 text-blue-700"
                  )}
                  aria-label="Thông báo"
                  aria-expanded={notificationOpen}
                  onClick={() => void toggleNotifications()}
                >
                  <Bell className="h-4 w-4" />
                  {hasUnreadNotifications ? (
                    <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-blue-700 ring-2 ring-white" />
                  ) : null}
                </button>
                {notificationOpen ? (
                  <NotificationPanel
                    notifications={notifications}
                    isLoading={notificationsLoading}
                    error={notificationError}
                    onClose={() => setNotificationOpen(false)}
                    onOpenAll={() => {
                      markNotificationsSeen();
                      setNotificationOpen(false);
                      setAllNotificationsOpen(true);
                    }}
                  />
                ) : null}
              </div>
              <Link
                href="/app/profile"
                className="flex items-center gap-2 rounded-full px-1.5 py-1 transition-colors hover:bg-blue-50"
                title="Xem và chỉnh sửa hồ sơ"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                  {user.full_name.slice(0, 1).toUpperCase()}
                </span>
                <span className="truncate text-sm font-medium text-slate-700 max-sm:hidden">{user.full_name}</span>
              </Link>
              <Link href="/app/books/new" className={buttonStyles({ size: "sm" })}>
                + Đăng sách
              </Link>
              <ConfirmButton
                variant="ghost"
                confirm="Bạn có muốn đăng xuất khỏi LibriHub không?"
                onConfirm={() => {
                  logout();
                  window.location.replace("/login");
                }}
              >
                <LogOut className="h-4 w-4" />
                Đăng xuất
              </ConfirmButton>
            </>
          ) : (
            <>
              <Link href="/login" className={buttonStyles({ size: "sm", variant: "secondary" })}>
                Đăng nhập
              </Link>
              <Link href="/register" className={buttonStyles({ size: "sm" })}>
                <UserPlus className="h-4 w-4" />
                Đăng ký
              </Link>
            </>
          )}
      </header>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <main id="app-scroll-container" className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-10 py-7 max-lg:px-5 max-sm:px-4">{children}</div>
        </main>
      </div>
      {authNoticeOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-5 backdrop-blur-sm"
          role="presentation"
          onWheel={(event) => scrollPageBehind(event.deltaY)}
          onMouseDown={closeAuthNotice}
        >
          <div className="w-full max-w-md" onMouseDown={(event) => event.stopPropagation()}>
            <Card className="relative text-center">
              <button
                type="button"
                aria-label="Đóng"
                onClick={closeAuthNotice}
                className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-700 text-lg font-bold text-white shadow-[0_12px_24px_rgba(37,99,235,0.22)]">L</div>
              <h1 className="text-xl font-bold text-slate-900">Cần đăng nhập</h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Khách có thể xem danh mục sách. Để đăng sách, gửi yêu cầu giao dịch hoặc đăng ký giao sách, bạn cần đăng nhập hoặc tạo tài khoản.
              </p>
              <div className="mt-5 flex justify-center gap-2">
                <LinkButton href="/login">Đăng nhập</LinkButton>
                <LinkButton href="/register" variant="secondary">Đăng ký</LinkButton>
              </div>
            </Card>
          </div>
        </div>
      ) : null}
      {allNotificationsOpen ? (
        <NotificationModal
          notifications={notifications}
          onClose={() => setAllNotificationsOpen(false)}
        />
      ) : null}
    </div>
  );
}
