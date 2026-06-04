"use client";

import Link from "next/link";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonStyles = cva(
  "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-full px-5 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        primary: "bg-blue-700 text-white shadow-[0_10px_24px_rgba(37,99,235,0.22)] hover:-translate-y-0.5 hover:bg-blue-800",
        secondary: "border border-slate-200 bg-white text-slate-700 shadow-sm hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50/60 hover:text-blue-800",
        ghost: "text-slate-600 hover:bg-blue-50 hover:text-blue-800",
        danger: "border border-red-200 bg-red-50 text-red-600 hover:-translate-y-0.5 hover:bg-red-100",
        link: "h-auto px-0 text-blue-700 hover:text-blue-800"
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
  variant = "secondary",
  className
}: {
  href: string;
  children: React.ReactNode;
  variant?: VariantProps<typeof buttonStyles>["variant"];
  className?: string;
}) {
  return (
    <Link href={href} className={cn(buttonStyles({ variant }), className)}>
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
            className="my-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_32px_90px_rgba(15,23,42,0.24)]"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <div
                className={cn(
                  "flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl",
                  variant === "danger" ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-700"
                )}
              >
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <h2 id="confirm-dialog-title" className="text-lg font-bold text-slate-950">
                    Xác nhận thao tác
                  </h2>
                  <button
                    type="button"
                    aria-label="Đóng"
                    onClick={() => setOpen(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{confirm}</p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
                Hủy
              </Button>
              <Button type="button" variant={variant === "danger" ? "danger" : "primary"} onClick={handleConfirm} loading={pending}>
                Xác nhận
              </Button>
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
      <span className="text-xs font-semibold text-slate-600">{label}</span>
      {children}
      {error ? <span className="text-xs text-rose-400">{error}</span> : null}
    </label>
  );
}

export const inputClass =
  "h-11 w-full rounded-xl border border-slate-200 bg-white/95 px-4 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-40";

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputClass, props.className)} {...props} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputClass, "min-h-28 py-3", props.className)} {...props} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(inputClass, props.className)} {...props} />;
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn("rounded-2xl border border-slate-200/80 bg-white/95 p-5 shadow-[0_12px_32px_rgba(15,23,42,0.06)]", className)}>{children}</section>;
}

export function PageHeader({
  title,
  description,
  actions,
  hero,
  heroIcon,
  heroStat
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  hero?: boolean;
  heroIcon?: React.ReactNode;
  heroStat?: React.ReactNode;
}) {
  if (hero) {
    return (
      <section className="relative -mx-8 -mt-8 mb-8 overflow-hidden max-lg:-mx-5 max-sm:-mx-4">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700" />
        <div className="absolute -right-12 -top-12 h-56 w-56 rounded-full bg-white/5" />
        <div className="absolute -bottom-16 -left-8 h-64 w-64 rounded-full bg-white/5" />
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#f0f4f9] to-transparent" />

        <div className="relative px-8 pb-14 pt-9 max-lg:px-5 max-sm:px-4">
          <div className="flex items-center justify-between gap-6 max-md:flex-col max-md:items-start">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-sm font-semibold text-white shadow-sm">
                {heroIcon}
                {title}
              </div>
              {description ? <p className="mt-5 max-w-3xl text-base leading-7 text-blue-50/85">{description}</p> : null}
            </div>
            {heroStat ? (
              <div className="w-60 rounded-2xl border border-white/20 bg-white/10 p-5 text-white shadow-[0_20px_50px_rgba(15,23,42,0.16)] backdrop-blur max-md:w-full">
                {heroStat}
              </div>
            ) : null}
          </div>
          {actions ? <div className="mt-6 flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      </section>
    );
  }

  return (
    <div className="mb-6 flex items-center justify-between gap-4 max-md:flex-col max-md:items-start">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950">{title}</h1>
        {description ? <p className="mt-1.5 text-sm leading-6 text-slate-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Alert({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "error" | "success" }) {
  const classes = {
    default: "border-slate-200 bg-white text-slate-700",
    error: "border-red-200 bg-red-50 text-red-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700"
  };
  return (
    <div role={variant === "error" ? "alert" : undefined} className={cn("rounded-2xl border px-4 py-3 text-sm shadow-sm", classes[variant])}>
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
    PENDING: "Chờ xử lý",
    PENDING_TRANSACTION: "Đang có giao dịch",
    BORROWING: "Đang mượn",
    RETURN_PENDING: "Chờ trả sách",
    LOCKED: "Đã khóa",
    REJECTED: "Đã từ chối",
    FAILED: "Thất bại",
    CANCELLED: "Đã hủy",
    REMOVED: "Đã ẩn",
    UNLISTED: "Chưa đăng lại",
    PERMANENT_EXCHANGE: "Trao đổi",
    BORROW_RETURN: "Cho mượn",
    BOTH: "Cả hai",
    DIRECT_CONTACT: "Tự giao",
    FREE_COURIER: "Dịch vụ giao sách",
    NEW: "Mới",
    GOOD: "Tốt",
    FAIR: "Khá",
    WORN: "Cũ",
    OWNER_REVIEW: "Đánh giá chủ sách",
    REQUESTER_REVIEW: "Đánh giá người mượn",
    COURIER_REVIEW: "Đánh giá người giao"
  };
  const variant = value.includes("ACTIVE") || value.includes("AVAILABLE") || value.includes("COMPLETED") || value.includes("DELIVERED")
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : value.includes("PENDING") || value.includes("BORROWING") || value.includes("RETURN")
      ? "border-blue-200 bg-blue-50 text-blue-700"
      : value.includes("LOCKED") || value.includes("REJECTED") || value.includes("FAILED") || value.includes("CANCELLED") || value.includes("REMOVED")
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-slate-200 bg-slate-100 text-slate-700";
  return <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold", variant)}>{labels[value] ?? value.replaceAll("_", " ")}</span>;
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/80 p-8 text-center shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      {children ? <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">{children}</p> : null}
    </div>
  );
}

export function LoadingState() {
  return (
    <div className="flex min-h-64 items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-blue-700" />
    </div>
  );
}
