"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen,
  ClipboardList,
  Bell,
  CheckCircle2,
  CircleDollarSign,
  Library,
  type LucideIcon,
  LogOut,
  Menu,
  MessageSquareText,
  PackageCheck,
  Shield,
  Sparkles,
  UserPlus,
  X,
  Truck,
  Users,
  Gem
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
  { href: "/app/books/mine", label: "Sách của tôi", icon: Library },
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
    <nav className="flex items-center gap-1 rounded-full border border-white/60 bg-white/70 p-1 shadow-sm backdrop-blur-sm max-md:flex-col max-md:items-stretch max-md:rounded-2xl max-md:border-slate-100 max-md:bg-white">
      {items.map((item) => {
        const active = isNavActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            onClick={(event) => {
              if (isGuest && item.href !== "/app/books") {
                event.preventDefault();
                onRequireAuth();
                return;
              }
              onNavigate();
            }}
            className={cn(
              "flex h-9 items-center gap-2 rounded-full px-3.5 text-sm font-medium text-slate-500 transition-all hover:bg-blue-50 hover:text-blue-700 max-lg:px-3 max-md:h-11 max-md:rounded-xl",
              active && "bg-blue-600 text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 hover:text-white"
            )}
          >
            <Icon className={cn("h-4 w-4 shrink-0", active ? "text-white" : "text-slate-400")} />
            <span className="hidden max-md:inline 2xl:inline">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function isNavActive(pathname: string, href: string) {
  if (href === "/app/books") {
    return pathname === "/app/books" || pathname === "/app/books/search" || /^\/app\/books\/\d+$/.test(pathname);
  }
  if (href === "/app/books/mine") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
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
    <div className="absolute right-0 top-12 z-[100] w-[400px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.18)] animate-fade-in-scale origin-top-right">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-4">
        <div>
          <h2 className="text-base font-bold text-slate-950">Thông báo</h2>
          <p className="mt-0.5 text-sm text-slate-500">Những cập nhật mới nhất trong tài khoản của bạn.</p>
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
        <div className="p-3">
          <NotificationState title="Đang tải thông báo" description="LibriHub đang lấy những hoạt động mới nhất." />
        </div>
      ) : error ? (
        <div className="p-3">
          <NotificationState title="Không tải được thông báo" description={error} tone="error" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="p-3">
          <NotificationState title="Chưa có thông báo" description="Khi có giao dịch, điểm hoặc đánh giá mới, bạn sẽ thấy ở đây." />
        </div>
      ) : (
        <>
        <div className="max-h-[380px] overflow-y-auto p-2">
          {previewNotifications.map((notification) => (
            <NotificationItem key={notification.activity_id} notification={notification} onClick={onClose} />
          ))}
        </div>
        <div className="border-t border-slate-100 p-3">
          <button
            type="button"
            onClick={onOpenAll}
            className="flex h-11 w-full items-center justify-center rounded-2xl bg-blue-50 text-sm font-bold text-blue-700 transition-colors hover:bg-blue-100"
          >
            Xem tất cả thông báo
          </button>
        </div>
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
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 p-5 backdrop-blur-sm animate-fade-in">
      <section className="w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_32px_90px_rgba(15,23,42,0.24)] animate-fade-in-scale">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-slate-50/80 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Tất cả thông báo</h2>
            <p className="mt-1 text-sm text-slate-500">Lịch sử các cập nhật quan trọng trong tài khoản LibriHub.</p>
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
          <div className="p-4">
            <NotificationState title="Chưa có thông báo" description="Bạn chưa có hoạt động mới nào trong hệ thống." />
          </div>
        ) : (
          <div className="max-h-[66vh] overflow-y-auto p-3">
            {notifications.map((notification) => (
              <NotificationItem key={notification.activity_id} notification={notification} onClick={onClose} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function NotificationItem({
  notification,
  onClick
}: {
  notification: UserNotification;
  onClick: () => void;
}) {
  const meta = notificationMeta(notification.activity_type);
  const Icon = meta.icon;

  return (
    <Link
      href={notificationHref(notification.activity_type)}
      onClick={onClick}
      className="group flex gap-3 rounded-2xl px-3 py-3 transition-colors hover:bg-blue-50/70"
    >
      <span className={cn("mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ring-1", meta.iconClass)}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-3">
          <span className="block text-sm font-bold text-slate-950 group-hover:text-blue-800">
            {meta.title}
          </span>
          <span className="shrink-0 text-xs font-medium text-slate-400">{formatDate(notification.created_at)}</span>
        </span>
        <span className="mt-1 block text-sm leading-5 text-slate-600">
          {notificationMessage(notification)}
        </span>
        <span className="mt-2 inline-flex text-xs font-semibold text-blue-700 opacity-0 transition-opacity group-hover:opacity-100">
          Xem chi tiết
        </span>
      </span>
    </Link>
  );
}

function NotificationState({
  title,
  description,
  tone = "default"
}: {
  title: string;
  description: string;
  tone?: "default" | "error";
}) {
  return (
    <div className={cn(
      "rounded-2xl px-4 py-7 text-center",
      tone === "error" ? "border border-rose-200 bg-rose-50 text-rose-700" : "bg-slate-50 text-slate-500"
    )}>
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-blue-700 shadow-sm">
        <Bell className="h-5 w-5" />
      </div>
      <h3 className={cn("text-sm font-bold", tone === "error" ? "text-rose-800" : "text-slate-950")}>{title}</h3>
      <p className="mx-auto mt-1 max-w-xs text-sm leading-5">{description}</p>
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

function notificationMeta(activityType: string): { title: string; icon: LucideIcon; iconClass: string } {
  const common = "bg-blue-50 text-blue-700 ring-blue-100";
  if (activityType.includes("BOOK")) {
    return { title: "Sách của bạn", icon: BookOpen, iconClass: common };
  }
  if (activityType.includes("TRANSACTION")) {
    return { title: "Giao dịch", icon: ClipboardList, iconClass: "bg-indigo-50 text-indigo-700 ring-indigo-100" };
  }
  if (activityType.includes("DELIVERY")) {
    return { title: "Giao sách", icon: PackageCheck, iconClass: "bg-emerald-50 text-emerald-700 ring-emerald-100" };
  }
  if (activityType.includes("POINT")) {
    return { title: "LibriPoint", icon: CircleDollarSign, iconClass: "bg-amber-50 text-amber-700 ring-amber-100" };
  }
  if (activityType.includes("REVIEW")) {
    return { title: "Đánh giá", icon: MessageSquareText, iconClass: "bg-violet-50 text-violet-700 ring-violet-100" };
  }
  if (activityType === "LOGIN") {
    return { title: "Đăng nhập", icon: CheckCircle2, iconClass: common };
  }
  if (activityType === "REGISTER") {
    return { title: "Chào mừng", icon: Sparkles, iconClass: common };
  }
  return { title: notificationTitle(activityType), icon: Bell, iconClass: "bg-slate-50 text-slate-600 ring-slate-100" };
}

function notificationMessage(notification: UserNotification) {
  const type = notification.activity_type;
  const raw = notification.activity_description;
  const deliveryId = raw.match(/delivery #?(\d+)/i)?.[1];
  const pointChange = raw.match(/changed by ([+-]?\d+)/i)?.[1];
  const reason = raw.match(/for ([A-Z_]+)/)?.[1];

  if (type === "LOGIN") return "Bạn vừa đăng nhập vào LibriHub.";
  if (type === "REGISTER") return "Chào mừng bạn đã gia nhập cộng đồng LibriHub!";
  if (type === "UPDATE_PROFILE") return "Thông tin hồ sơ của bạn đã được cập nhật.";
  if (type === "CREATE_BOOK") return "Bạn vừa đăng một cuốn sách mới lên thư viện.";
  if (type === "UPDATE_BOOK") return "Thông tin sách đã được cập nhật.";
  if (type === "CREATE_TRANSACTION") return "Bạn vừa nhận được một lời mời giao dịch sách mới.";
  if (type === "CONFIRM_TRANSACTION") return "Giao dịch của bạn vừa có thêm bước tiến triển mới.";
  if (type === "DELIVERY_UPDATE" && deliveryId) return `Vận đơn #${deliveryId} vừa được cập nhật trạng thái.`;
  if (type === "DELIVERY_UPDATE") return "Một vận đơn giao sách vừa được cập nhật trạng thái.";
  if (type === "POINT_UPDATE" && pointChange) {
    const amount = Number(pointChange);
    const direction = amount >= 0 ? "được cộng" : "bị trừ";
    return `Tài khoản của bạn ${direction} ${Math.abs(amount)} LibriPoint${reason ? ` vì ${pointReasonLabel(reason)}` : ""}.`;
  }
  if (type === "CREATE_REVIEW") return "Bạn vừa có một đánh giá mới sau giao dịch.";
  return raw;
}

function pointReasonLabel(reason: string) {
  const labels: Record<string, string> = {
    INITIAL_BONUS: "thưởng thành viên mới",
    EXCHANGE_REWARD: "hoàn tất trao đổi sách",
    EXCHANGE_COST: "nhận sách trao đổi",
    BORROW_REWARD: "hoàn tất lượt mượn trả",
    BORROW_COST: "nhận sách mượn",
    DELIVERY_REWARD: "giao sách thành công",
    ADMIN_ADJUSTMENT: "điều chỉnh từ quản trị"
  };
  return labels[reason] ?? reason.replaceAll("_", " ").toLowerCase();
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
  const router = useRouter();
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
    user?.role === "ADMIN" ? [...navItems, { href: "/admin", label: "Quản trị", icon: Shield }] : navItems;
  const notificationStorageKey = user ? `librihub.notifications.seen.${user.user_id}` : "";
  const hasUnreadNotifications = notifications.some(
    (notification) => !seenNotificationIds.includes(notification.activity_id)
  );

  function closeAuthNotice() {
    if (!user && !isPublicCatalogRoute) {
      router.replace("/app/books");
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
      <div className="min-h-screen overflow-hidden" style={{ background: "#f0f4f9" }}>
        <header className="flex h-16 items-center justify-between border-b border-slate-200/70 bg-white/90 px-8 shadow-sm backdrop-blur-md max-lg:px-5 max-sm:px-4">
          <Link href="/app/books" className="flex items-center gap-2.5">
            <img src="/logo-icon.png" alt="LibriHub Logo" className="h-9 w-9 rounded-xl shadow-md" />
            <span className="text-base font-bold tracking-tight text-slate-900 max-sm:hidden">LibriHub</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href={`/login?returnTo=${encodeURIComponent(pathname)}`} className={cn(buttonStyles({ size: "sm", variant: "secondary" }), "rounded-full")}>
              Đăng nhập
            </Link>
            <Link href={`/register?returnTo=${encodeURIComponent(pathname)}`} className={cn(buttonStyles({ size: "sm" }), "rounded-full bg-blue-600 shadow-md shadow-blue-500/25")}>
              Đăng ký
            </Link>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-8 py-8 blur-sm max-lg:px-5 max-sm:px-4">
          <section className="rounded-3xl bg-gradient-to-br from-blue-700 to-indigo-700 px-8 py-12 text-white shadow-xl shadow-blue-500/20">
            <p className="text-sm font-semibold text-blue-200">LibriHub</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight max-sm:text-3xl">Thế giới sách đang chờ bạn khám phá</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100">
              Dạo quanh thư viện và khám phá những tựa sách thú vị. Để bắt đầu trao đổi hoặc chia sẻ sách của riêng bạn, hãy tham gia cùng cộng đồng LibriHub nhé!
            </p>
          </section>
          <div className="mt-7 grid grid-cols-3 gap-4 max-lg:grid-cols-1">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-36 rounded-2xl border border-slate-200 bg-white shadow-sm" />
            ))}
          </div>
        </main>

        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-5 backdrop-blur-sm"
          role="presentation"
          onMouseDown={closeAuthNotice}
        >
          <div className="w-full max-w-md overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_32px_90px_rgba(15,23,42,0.24)] animate-fade-in-scale" onMouseDown={(event) => event.stopPropagation()}>
            <div className="relative border-b border-slate-100 bg-slate-50/50 px-6 py-5">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-100 shadow-sm">
                  <Shield className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <h1 className="text-lg font-bold text-slate-950">Cần đăng nhập</h1>
                  <p className="mt-0.5 text-sm font-medium text-slate-500">
                    Bảo mật quyền truy cập
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Đóng"
                onClick={closeAuthNotice}
                className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="px-6 py-6 text-left">
              <p className="text-base leading-7 text-slate-600">
                Hãy đăng nhập hoặc tạo tài khoản để có thể đăng sách, trao đổi sách và tham gia các hoạt động thú vị khác cùng cộng đồng LibriHub nhé.
              </p>
              <div className="mt-8 flex justify-end gap-3 max-sm:flex-col-reverse max-sm:items-stretch">
                <LinkButton href={`/register?returnTo=${encodeURIComponent(pathname)}`} variant="secondary" className="max-sm:h-12">Đăng ký thành viên</LinkButton>
                <LinkButton href={`/login?returnTo=${encodeURIComponent(pathname)}`} className="max-sm:h-12">Đăng nhập ngay</LinkButton>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden" style={{ background: "#f0f4f9" }}>
      {open ? (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm md:hidden animate-fade-in" onClick={() => setOpen(false)}>
          <aside className="h-full w-72 border-r border-slate-200/80 bg-white/95 p-4 shadow-2xl animate-fade-in" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-center gap-2.5 px-2 py-3">
              <img src="/logo-icon.png" alt="LibriHub Logo" className="h-9 w-9 rounded-xl shadow-md" />
              <span className="text-base font-bold tracking-tight text-slate-900">LibriHub</span>
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

      <header className="relative z-[90] flex h-16 flex-shrink-0 items-center gap-3 border-b border-slate-200/70 bg-white/90 px-8 shadow-sm backdrop-blur-md max-lg:px-5 max-sm:px-4">
        <Link href="/app/books" className="flex shrink-0 items-center gap-2.5">
          <img src="/logo-icon.png" alt="LibriHub Logo" className="h-9 w-9 rounded-xl shadow-md" />
          <span className="text-base font-bold tracking-tight text-slate-900 max-sm:hidden">LibriHub</span>
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
          <div className="flex items-center gap-2">
            <Link
              href="/app/points"
              className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-50 to-yellow-50 px-3 py-1.5 text-xs font-bold text-amber-700 shadow-sm ring-1 ring-amber-200/70 transition-all hover:shadow-md hover:ring-amber-300 max-sm:hidden"
            >
              <Gem className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
              <span>{user.current_points} điểm</span>
            </Link>
            <div className="relative" ref={notificationRef}>
              <button
                className={cn(
                  "relative flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 bg-white text-slate-500 shadow-sm transition-all hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 hover:shadow-md",
                  notificationOpen && "border-blue-200 bg-blue-50 text-blue-700"
                )}
                aria-label="Thông báo"
                aria-expanded={notificationOpen}
                onClick={() => void toggleNotifications()}
              >
                <Bell className="h-4 w-4" />
                {hasUnreadNotifications ? (
                  <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
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
              className="flex items-center gap-2 rounded-full border border-slate-200/80 bg-white px-2 py-1 shadow-sm transition-all hover:border-blue-200 hover:bg-blue-50 hover:shadow-md"
              title="Xem và chỉnh sửa hồ sơ"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-xs font-bold text-white shadow-inner">
                {user.full_name.slice(0, 1).toUpperCase()}
              </span>
              <span className="max-w-48 truncate pr-1 text-sm font-bold text-slate-700 max-lg:hidden">{user.full_name}</span>
            </Link>
            <Link href="/app/books/new" className={cn(buttonStyles({ size: "sm" }), "rounded-full bg-blue-600 shadow-md shadow-blue-500/25 hover:bg-blue-700")}>
              + Đăng sách
            </Link>
            <ConfirmButton
              variant="ghost"
              confirm="Bạn có muốn đăng xuất khỏi LibriHub không?"
              onConfirm={() => {
                logout();
                window.location.replace("/login");
              }}
              className="text-slate-400 hover:text-slate-700"
            >
              <LogOut className="h-4 w-4" />
            </ConfirmButton>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link href={`/login?returnTo=${encodeURIComponent(pathname)}`} className={cn(buttonStyles({ size: "sm", variant: "secondary" }), "rounded-full")}>
              Đăng nhập
            </Link>
            <Link href={`/register?returnTo=${encodeURIComponent(pathname)}`} className={cn(buttonStyles({ size: "sm" }), "rounded-full bg-blue-600 shadow-md shadow-blue-500/25")}>
              <UserPlus className="h-4 w-4" />
              Đăng ký
            </Link>
          </div>
        )}
      </header>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <main id="app-scroll-container" className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-8 py-8 max-lg:px-5 max-sm:px-4 animate-fade-in-up">{children}</div>
        </main>
      </div>
      {authNoticeOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-5 backdrop-blur-sm"
          role="presentation"
          onWheel={(event) => scrollPageBehind(event.deltaY)}
          onMouseDown={closeAuthNotice}
        >
          <div className="w-full max-w-md overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_32px_90px_rgba(15,23,42,0.24)] animate-fade-in-scale" onMouseDown={(event) => event.stopPropagation()}>
            <div className="relative border-b border-slate-100 bg-slate-50/50 px-6 py-5">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-100 shadow-sm">
                  <Shield className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <h1 className="text-lg font-bold text-slate-950">Cần đăng nhập</h1>
                  <p className="mt-0.5 text-sm font-medium text-slate-500">
                    Bảo mật quyền truy cập
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Đóng"
                onClick={closeAuthNotice}
                className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="px-6 py-6 text-left">
              <p className="text-base leading-7 text-slate-600">
                Khách có thể xem danh mục sách. Để đăng sách, gửi yêu cầu giao dịch hoặc đăng ký giao sách, bạn cần đăng nhập hoặc tạo tài khoản.
              </p>
              <div className="mt-8 flex justify-end gap-3 max-sm:flex-col-reverse max-sm:items-stretch">
                <LinkButton href={`/register?returnTo=${encodeURIComponent(pathname)}`} variant="secondary" className="max-sm:h-12">Đăng ký thành viên</LinkButton>
                <LinkButton href={`/login?returnTo=${encodeURIComponent(pathname)}`} className="max-sm:h-12">Đăng nhập ngay</LinkButton>
              </div>
            </div>
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
