import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import { X } from "lucide-react";

/* ------------------------------- page header ------------------------------- */

export function AdminPage({
  kicker,
  title,
  text,
  actions,
  children,
}: {
  kicker?: string;
  title: string;
  text?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          {kicker && <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-lemon">{kicker}</p>}
          <h1 className="mt-1.5 font-display text-2xl font-bold text-cream md:text-3xl">{title}</h1>
          {text && <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-cream/45">{text}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}

/* --------------------------------- stat card -------------------------------- */

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "lemon",
}: {
  label: string;
  value: string;
  hint?: string;
  icon: typeof X;
  tone?: "lemon" | "sky" | "amber" | "rose" | "violet";
}) {
  const tones: Record<string, string> = {
    lemon: "bg-lemon/10 text-lemon border-lemon/20",
    sky: "bg-sky-400/10 text-sky-300 border-sky-400/20",
    amber: "bg-amber-400/10 text-amber-200 border-amber-400/20",
    rose: "bg-rose-400/10 text-rose-200 border-rose-400/20",
    violet: "bg-violet-400/10 text-violet-200 border-violet-400/20",
  };
  return (
    <div className="panel-soft p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold text-cream/45">{label}</p>
          <p className="mt-2 truncate font-display text-xl font-bold text-cream md:text-2xl">{value}</p>
          {hint && <p className="mt-1 truncate text-[10px] text-cream/30">{hint}</p>}
        </div>
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl border", tones[tone])}>
          <Icon className="size-4" aria-hidden />
        </span>
      </div>
    </div>
  );
}

/* ---------------------------------- badge ---------------------------------- */

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "lemon" | "amber" | "rose" | "sky" | "violet";
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "border-white/12 bg-white/[0.04] text-cream/55",
    lemon: "border-lemon/30 bg-lemon/10 text-lemon",
    amber: "border-amber-400/30 bg-amber-400/10 text-amber-200",
    rose: "border-rose-400/30 bg-rose-500/10 text-rose-200",
    sky: "border-sky-400/30 bg-sky-400/10 text-sky-200",
    violet: "border-violet-400/30 bg-violet-400/10 text-violet-200",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[9px] font-bold",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function PaymentStatus({ status }: { status: string }) {
  const map: Record<string, { label: string; tone: "lemon" | "amber" | "rose" | "neutral" }> = {
    auto_approved: { label: "تلقائي", tone: "lemon" },
    approved: { label: "مقبول", tone: "lemon" },
    pending: { label: "قيد المراجعة", tone: "amber" },
    rejected: { label: "مرفوض", tone: "rose" },
    active: { label: "نشط", tone: "lemon" },
    expired: { label: "منتهي", tone: "neutral" },
    cancelled: { label: "ملغي", tone: "rose" },
  };
  const meta = map[status] ?? { label: status, tone: "neutral" as const };
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

/* ---------------------------------- modal ---------------------------------- */

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  if (!open) return null;
  const sizes = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" };
  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-ink/80 p-4 backdrop-blur-sm md:items-center" onClick={onClose}>
      <div
        className={cn("w-full overflow-hidden rounded-2xl border border-white/12 bg-ink-3 shadow-2xl", sizes[size])}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="font-display text-base font-bold text-cream">{title}</h2>
            {description && <p className="mt-1 text-[11px] text-cream/40">{description}</p>}
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1 text-cream/40 hover:bg-white/5 hover:text-cream" aria-label="إغلاق">
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <div className="max-h-[72vh] overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-white/10 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

/* -------------------------------- form field ------------------------------- */

export function AdminField({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-[11px] font-semibold text-cream/55">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[10px] text-cream/30">{hint}</span>}
    </label>
  );
}

export function EmptyState({ icon: Icon, title, text, action }: { icon: typeof X; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-white/[0.04] text-cream/30">
        <Icon className="size-5" aria-hidden />
      </span>
      <p className="mt-3 text-sm font-semibold text-cream/70">{title}</p>
      {text && <p className="mt-1 max-w-sm text-[11px] leading-relaxed text-cream/35">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
