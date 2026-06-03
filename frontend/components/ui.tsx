"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonStyles = cva(
  "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-full px-5 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        primary:
          "bg-blue-600 text-white shadow-md shadow-blue-500/20 hover:-translate-y-px hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/25 active:translate-y-0",
        secondary:
          "border border-slate-200 bg-white text-slate-700 shadow-sm hover:-translate-y-px hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 active:translate-y-0",
        ghost: "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
        danger:
          "border border-red-200 bg-red-50 text-red-600 hover:-translate-y-px hover:bg-red-100 hover:shadow-sm active:translate-y-0",
        link: "h-auto px-0 text-blue-600 hover:text-blue-700 hover:underline"
      },
      size: {
        sm: "h-8 px-3.5 text-xs",
        md: "h-10 px-5 text-sm",
        lg: "h-11 px-6 text-sm"
      }
    },
    defaultVariants: { variant: "primary", size: "md" }
  }
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonStyles> & { loading?: boolean };

export function Button({ className, variant, size, loading, children, disabled, ...props }: ButtonProps) {
  return (
    <button className={cn(buttonStyles({ variant, size }), className)} disabled={disabled || loading} {...props}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  children,
  variant = "primary",
  size = "md",
  className
}: {
  href: string;
  children: React.ReactNode;
  variant?: VariantProps<typeof buttonStyles>["variant"];
  size?: VariantProps<typeof buttonStyles>["size"];
  className?: string;
}) {
  return (
    <Link href={href} className={cn(buttonStyles({ variant, size }), className)}>
      {children}
    </Link>
  );
}

export function ConfirmButton({
  confirm,
  onConfirm,
  children,
  variant,
  size,
  className,
  disabled,
  loading,
  ...props
}: ButtonProps & { confirm: string; onConfirm: () => Promise<void> | void }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const handleConfirm = useCallback(async () => {
    if (pending) return;
    try {
      setPending(true);
      await onConfirm();
      setOpen(false);
    } finally {
      setPending(false);
    }
  }, [onConfirm, pending]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Enter") {
        event.preventDefault();
        void handleConfirm();
      }
      if (event.key === "Escape" && !pending) {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleConfirm, open, pending]);

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        disabled={disabled}
        loading={loading}
        onClick={() => setOpen(true)}
        {...props}
      >
        {children}
      </Button>
      {open ? (
        <div
          className="fixed inset-x-0 top-0 z-[130] flex h-[100dvh] items-center justify-center overflow-y-auto bg-slate-950/45 px-5 py-10 backdrop-blur-sm"
          role="presentation"
          onMouseDown={() => setOpen(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            className="my-auto w-full max-w-md overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_32px_90px_rgba(15,23,42,0.24)]"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="relative border-b border-slate-100 bg-slate-50/50 px-6 py-5">
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    "flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl ring-1 ring-inset shadow-sm",
                    variant === "danger" ? "bg-red-50 text-red-600 ring-red-100" : "bg-blue-50 text-blue-700 ring-blue-100"
                  )}
                >
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 id="confirm-dialog-title" className="text-lg font-bold text-slate-950">
                    Xác nhận thao tác
                  </h2>
                  <p className="mt-0.5 text-sm font-medium text-slate-500">
                    {variant === "danger" ? "Cảnh báo" : "Vui lòng xác nhận để tiếp tục"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Đóng"
                onClick={() => setOpen(false)}
                className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="px-6 py-6">
              <p className="text-base leading-7 text-slate-600">{confirm}</p>
              
              <div className="mt-8 flex justify-end gap-3 max-sm:flex-col-reverse max-sm:items-stretch">
                <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={pending} className="max-sm:h-12">
                  Đóng
                </Button>
                <Button
                  type="button"
                  variant={variant === "danger" ? "danger" : "primary"}
                  onClick={handleConfirm}
                  loading={pending}
                  className="max-sm:h-12"
                >
                  {variant === "danger" ? "Vẫn tiếp tục" : "Đồng ý"}
                </Button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

export function Field({
  label,
  error,
  className,
  children
}: {
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-sm font-semibold text-slate-600">{label}</span>
      {children}
      {error ? <span className="text-xs text-rose-500">{error}</span> : null}
    </label>
  );
}

export const inputClass =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60 transition-all duration-150";

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputClass, props.className)} {...props} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputClass, "min-h-28 py-3 leading-6", props.className)} {...props} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(inputClass, props.className)} {...props} />;
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <section className={cn("rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm", className)}>
      {children}
    </section>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  accent,
  hero,
  heroIcon,
  heroStat
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  accent?: boolean;
  /** Render a full-width blue gradient hero banner instead of the plain header */
  hero?: boolean;
  /** Icon element to show inside the hero badge */
  heroIcon?: React.ReactNode;
  /** Optional stat block shown to the right of the hero (desktop only) */
  heroStat?: React.ReactNode;
}) {
  if (hero) {
    return (
      <section className="relative -mx-8 -mt-8 mb-8 overflow-hidden max-lg:-mx-5 max-sm:-mx-4">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700" />
        {/* Decoration circles */}
        <div className="absolute -right-12 -top-12 h-56 w-56 rounded-full bg-white/5" />
        <div className="absolute -bottom-16 -left-8 h-64 w-64 rounded-full bg-white/5" />
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#f0f4f9] to-transparent" />

        <div className="relative px-8 pb-14 pt-9 max-lg:px-5 max-sm:px-4">
          <div className={cn("grid items-start gap-6", heroStat ? "grid-cols-[minmax(0,1fr)_220px] max-lg:grid-cols-1" : "")}>
            <div>
              {heroIcon ? (
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-sm font-semibold text-blue-100 backdrop-blur-sm">
                  {heroIcon}
                  {title}
                </div>
              ) : (
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-sm font-semibold text-blue-100 backdrop-blur-sm">
                  {title}
                </div>
              )}
              {description ? (
                <p className="max-w-2xl text-base leading-7 text-blue-100/90">{description}</p>
              ) : null}
              {actions ? (
                <div className="mt-5 flex flex-wrap items-center gap-3">{actions}</div>
              ) : null}
            </div>
            {heroStat ? (
              <div className="relative rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-sm max-lg:hidden">
                {heroStat}
              </div>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className={cn("mb-7 flex items-start justify-between gap-5 max-md:flex-col", accent && "pl-4 border-l-4 border-blue-500")}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 max-sm:text-xl">{title}</h1>
        {description ? <p className="mt-1.5 text-sm leading-6 text-slate-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Alert({
  children,
  variant = "default"
}: {
  children: React.ReactNode;
  variant?: "default" | "error" | "success" | "info";
}) {
  const classes = {
    default: "border-slate-200 bg-slate-50 text-slate-700",
    error: "border-red-200 bg-red-50 text-red-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    info: "border-blue-200 bg-blue-50 text-blue-700"
  };
  const icons = {
    default: null,
    error: <AlertTriangle className="h-4 w-4 shrink-0" />,
    success: <CheckCircle2 className="h-4 w-4 shrink-0" />,
    info: null
  };
  return (
    <div
      role={variant === "error" ? "alert" : undefined}
      className={cn("flex items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-sm", classes[variant])}
    >
      {icons[variant]}
      {children}
    </div>
  );
}

export function Badge({ value }: { value: string }) {
  const labels: Record<string, string> = {
    ACTIVE: "Đang hoạt động",
    AVAILABLE: "Khả dụng",
    COMPLETED: "Hoàn tất",
    DELIVERED: "Đã giao",
    DELIVERING: "Đang giao sách",
    PENDING: "Chờ xử lý",
    ACCEPTED: "Đã chấp nhận",
    ASSIGNED: "Đã phân công",
    PICKED_UP: "Đã lấy hàng",
    PENDING_TRANSACTION: "Đang có giao dịch",
    BORROWING: "Đang mượn",
    RETURN_PENDING: "Chờ trả sách",
    LOCKED: "Đã khóa",
    INACTIVE: "Không hoạt động",
    SUSPENDED: "Đình chỉ",
    REJECTED: "Đã từ chối",
    FAILED: "Thất bại",
    CANCELLED: "Đã hủy",
    REMOVED: "Đã ẩn",
    UNLISTED: "Chưa đăng lại",
    PERMANENT_EXCHANGE: "Trao đổi vĩnh viễn",
    BORROW_RETURN: "Cho mượn",
    BOTH: "Cả hai hình thức",
    DIRECT_CONTACT: "Tự giao",
    FREE_COURIER: "Dịch vụ giao sách",
    NEW: "Mới",
    GOOD: "Tốt",
    FAIR: "Khá",
    WORN: "Cũ",
    USER: "Người dùng",
    MEMBER: "Thành viên",
    COURIER: "Người giao sách",
    ADMIN: "Quản trị viên",
    OWNER: "Chủ sách",
    REQUESTER: "Người yêu cầu",
    OWNER_REVIEW: "Đánh giá chủ sách",
    REQUESTER_REVIEW: "Đánh giá người mượn",
    COURIER_REVIEW: "Đánh giá người giao"
  };
  const variant = value.includes("DELIVERING") || value === "ASSIGNED" || value === "PICKED_UP"
    ? "border-amber-200 bg-amber-50 text-amber-700"
    : value.includes("ACTIVE") || value === "AVAILABLE" || value === "COMPLETED" || value === "DELIVERED"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : value === "ACCEPTED" || value.includes("PENDING") || value.includes("BORROWING") || value.includes("RETURN")
    ? "border-blue-200 bg-blue-50 text-blue-700"
    : value.includes("LOCKED") || value === "REJECTED" || value === "FAILED" || value === "CANCELLED" || value === "REMOVED" || value === "SUSPENDED"
    ? "border-red-200 bg-red-50 text-red-600"
    : value === "ADMIN"
    ? "border-violet-200 bg-violet-50 text-violet-700"
    : value === "COURIER"
    ? "border-indigo-200 bg-indigo-50 text-indigo-700"
    : "border-slate-200 bg-slate-100 text-slate-600";
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", variant)}>
      {labels[value] ?? value.replaceAll("_", " ")}
    </span>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 px-8 py-14 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-slate-100 text-2xl shadow-sm">
        📭
      </div>
      <h2 className="text-sm font-bold text-slate-800">{title}</h2>
      {children ? <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">{children}</p> : null}
    </div>
  );
}

export function LoadingState() {
  return (
    <div className="flex min-h-64 items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
    </div>
  );
}
