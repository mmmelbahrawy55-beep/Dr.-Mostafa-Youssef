import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  ImageIcon,
  LayoutDashboard,
  LogOut,
  Mail,
  Phone,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  UserRound,
  X,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { PaymentDTO, PublicUser, SubscriptionDTO } from "../../shared/types";
import { SessionsCard } from "../components/account/SessionsCard";
import { MyProgram } from "../components/account/MyProgram";
import { PaymentBadges } from "../components/ui/PaymentBadges";
import { Photo } from "../components/ui/Photo";
import { Spinner } from "../components/ui/Spinner";
import { useToast } from "../components/ui/Toast";
import { api, daysBetween, formatDate, formatDateTime, formatEgp } from "../lib/api";
import { useAuth } from "../lib/auth";
import { images } from "../lib/images";
import { useLang } from "../lib/i18n";
import { localize } from "../lib/localize";
import { cn } from "../lib/utils";

interface AccountPayload {
  user: PublicUser;
  subscriptions: SubscriptionDTO[];
  payments: PaymentDTO[];
}

type Tab = "overview" | "program" | "payments" | "profile";

const STATUS: Record<
  PaymentDTO["status"],
  { label: { ar: string; en: string }; className: string; icon: typeof CheckCircle2 }
> = {
  auto_approved: {
    label: { ar: "تم التحقق تلقائيًا", en: "Auto-verified" },
    className: "border-lemon/30 bg-lemon/10 text-lemon",
    icon: ShieldCheck,
  },
  approved: {
    label: { ar: "تم القبول", en: "Approved" },
    className: "border-lemon/30 bg-lemon/10 text-lemon",
    icon: CheckCircle2,
  },
  pending: {
    label: { ar: "قيد المراجعة", en: "Under review" },
    className: "border-amber-400/30 bg-amber-400/10 text-amber-200",
    icon: Clock3,
  },
  rejected: {
    label: { ar: "مرفوض", en: "Rejected" },
    className: "border-red-400/30 bg-red-500/10 text-red-200",
    icon: XCircle,
  },
};

function StatusBadge({ status, lang }: { status: PaymentDTO["status"]; lang: "ar" | "en" }) {
  const meta = STATUS[status];
  const Icon = meta.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold", meta.className)}>
      <Icon className="size-3" aria-hidden />
      {lang === "ar" ? meta.label.ar : meta.label.en}
    </span>
  );
}

function Stat({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: typeof Sparkles;
}) {
  return (
    <div className="panel-soft p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold text-cream/45">{label}</span>
        <span className="flex size-8 items-center justify-center rounded-xl bg-lemon/10 text-lemon">
          <Icon className="size-4" aria-hidden />
        </span>
      </div>
      <p className="mt-2 font-display text-xl font-bold text-cream sm:text-2xl">{value}</p>
      {hint && <p className="mt-1 text-[10px] text-cream/35">{hint}</p>}
    </div>
  );
}

export default function Account() {
  const { user, logout, setUser } = useAuth();
  const { lang } = useLang();
  const ar = lang === "ar";
  const locale = ar ? "ar-EG" : "en-US";
  const toast = useToast();
  const navigate = useNavigate();

  const [payload, setPayload] = useState<AccountPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");
  const [screenshot, setScreenshot] = useState<PaymentDTO | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api<AccountPayload>("/api/account");
      setPayload(data);
      setName(data.user.name);
      setPhone(data.user.phone);
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? localize(cause.message, lang)
          : ar
            ? "تعذر تحميل بيانات الحساب."
            : "Couldn't load your account."
      );
    } finally {
      setLoading(false);
    }
  }, [toast, lang, ar]);

  useEffect(() => {
    void load();
  }, [load]);

  const subscriptions = payload?.subscriptions ?? [];
  const payments = payload?.payments ?? [];

  const active = useMemo(
    () =>
      subscriptions
        .filter((item) => item.status === "active" && new Date(item.endsAt).getTime() > Date.now())
        .sort((a, b) => new Date(b.endsAt).getTime() - new Date(a.endsAt).getTime()),
    [subscriptions]
  );
  const current = active[0];
  const daysLeft = current ? daysBetween(new Date(), current.endsAt) : 0;
  const totalDays = current ? Math.max(1, daysBetween(current.startsAt, current.endsAt)) : 1;
  const usedDays = current ? Math.max(0, totalDays - daysLeft) : 0;
  const progress = current ? Math.min(100, Math.max(2, Math.round((usedDays / totalDays) * 100))) : 0;
  const spent = payments
    .filter((item) => item.status === "approved" || item.status === "auto_approved")
    .reduce((sum, item) => sum + item.amount, 0);
  const pending = payments.filter((item) => item.status === "pending");
  const firstName = (payload?.user.name || user?.name || "").split(" ")[0];

  const handleLogout = async () => {
    await logout();
    toast.success(ar ? "تم تسجيل الخروج." : "Signed out.");
    navigate("/");
  };

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (name.trim().length < 2) return toast.error(ar ? "اكتب اسمك بالكامل." : "Enter your full name.");
    if (phone.trim() && !/^01[0125]\d{8}$/.test(phone.trim()))
      return toast.error(ar ? "اكتب رقم موبايل مصري صحيح." : "Enter a valid Egyptian mobile number.");
    if (password && password.length < 8)
      return toast.error(ar ? "الباسورد الجديد لازم 8 حروف على الأقل." : "The new password must be at least 8 characters.");
    if (password && password !== confirm)
      return toast.error(ar ? "الباسورد وتأكيده مش متطابقين." : "Passwords don't match.");
    if (password && !currentPassword)
      return toast.error(ar ? "اكتب الباسورد الحالي لتأكيد التغيير." : "Enter your current password to confirm the change.");

    setSaving(true);
    try {
      const result = await api<{ user: PublicUser }>("/api/account", {
        method: "PATCH",
        body: {
          name: name.trim(),
          phone: phone.trim(),
          password: password || undefined,
          currentPassword: password ? currentPassword : undefined,
        },
      });
      setPayload((prev) => (prev ? { ...prev, user: result.user } : prev));
      setUser(result.user);
      setPassword("");
      setCurrentPassword("");
      setConfirm("");
      toast.success(ar ? "تم تحديث بياناتك بنجاح." : "Your details were updated.");
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? localize(cause.message, lang)
          : ar
            ? "تعذر تحديث البيانات."
            : "Couldn't save the changes."
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Spinner className="size-8 text-lemon" />
      </div>
    );
  }

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "overview", label: ar ? "نظرة عامة" : "Overview" },
    ...(current ? [{ key: "program" as Tab, label: ar ? "برنامجي" : "My program" }] : []),
    { key: "payments", label: ar ? "المدفوعات" : "Payments", count: payments.length },
    { key: "profile", label: ar ? "بياناتي" : "Profile" },
  ];

  return (
    <div className="pb-20 pt-24 md:pt-28">
      {/* Header */}
      <section className="relative overflow-hidden border-b border-white/10">
        <Photo src={images.dashboard} alt={ar ? "لوحة حساب العميل" : "Customer dashboard"} wrapperClassName="absolute inset-0" className="opacity-25" />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/70 via-ink/85 to-ink" aria-hidden />
        <div className="container-x relative py-10 md:py-14">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="flex items-center gap-4">
              <span className="flex size-14 items-center justify-center rounded-2xl border border-lemon/30 bg-lemon/15 font-display text-xl font-bold text-lemon">
                {(payload?.user.name || (ar ? "أ" : "M")).charAt(0)}
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-lemon">
                  {ar ? "حسابي" : "My account"}
                </p>
                <h1 className="mt-1 text-2xl md:text-3xl">
                  {ar ? `أهلاً ${firstName || "بيك"} 👋` : `Hello, ${firstName || "there"} 👋`}
                </h1>
                <p className="mt-1 text-xs text-cream/45">
                  {ar ? "كل تفاصيل باقتك ومدفوعاتك في مكان واحد." : "All your plan and payment details in one place."}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {user?.role === "admin" && (
                <Link
                  to="/admin"
                  className="inline-flex items-center gap-2 rounded-full border border-lemon/30 bg-lemon/10 px-4 py-2 text-xs font-bold text-lemon transition-colors hover:bg-lemon/15"
                >
                  <LayoutDashboard className="size-4" aria-hidden />
                  {ar ? "لوحة التحكم" : "Dashboard"}
                </Link>
              )}
              <Link
                to="/programs"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-xs font-bold text-cream/75 transition-colors hover:border-lemon/50 hover:text-lemon"
              >
                <Sparkles className="size-4" aria-hidden />
                {ar ? "اشترك في باقة" : "Get a plan"}
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-xs font-bold text-cream/60 transition-colors hover:border-red-400/50 hover:text-red-200"
              >
                <LogOut className="size-4" aria-hidden />
                {ar ? "خروج" : "Sign out"}
              </button>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              label={ar ? "الباقات النشطة" : "Active plans"}
              value={String(active.length)}
              hint={ar ? "باقة شغالة دلوقتي" : "Running right now"}
              icon={CheckCircle2}
            />
            <Stat
              label={ar ? "الأيام المتبقية" : "Days left"}
              value={current ? String(daysLeft) : "—"}
              hint={current ? (ar ? `من ${totalDays} يوم` : `of ${totalDays} days`) : ar ? "مفيش باقة نشطة" : "No active plan"}
              icon={CalendarDays}
            />
            <Stat
              label={ar ? "إجمالي المدفوع" : "Total paid"}
              value={formatEgp(spent, lang)}
              hint={ar ? "مدفوعات مؤكدة" : "Confirmed payments"}
              icon={ReceiptText}
            />
            <Stat
              label={ar ? "مدفوعات معلقة" : "Pending payments"}
              value={String(pending.length)}
              hint={pending.length ? (ar ? "مستنية المراجعة" : "Awaiting review") : ar ? "مفيش حاجة معلقة" : "Nothing pending"}
              icon={Clock3}
            />
          </div>
        </div>
      </section>

      <div className="container-x mt-8">
        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {tabs.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold transition-colors",
                tab === item.key
                  ? "border-lemon bg-lemon text-ink"
                  : "border-white/12 bg-white/[0.03] text-cream/60 hover:border-lemon/40 hover:text-cream"
              )}
            >
              {item.label}
              {typeof item.count === "number" && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[9px]",
                    tab === item.key ? "bg-ink/15 text-ink" : "bg-white/10 text-cream/50"
                  )}
                >
                  {item.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div key={tab} className="mt-5">
            {tab === "overview" && (
              <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
                <div className="space-y-5">
                  {current ? (
                    <div className="panel overflow-hidden">
                      <div className="relative">
                        <Photo
                          src={images.programTransform}
                          alt={current.programName}
                          wrapperClassName="absolute inset-0"
                          className="opacity-30"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0d08] via-[#0b0d08]/80 to-transparent" aria-hidden />
                        <div className="relative p-6 md:p-7">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-lemon/30 bg-lemon/10 px-3 py-1 text-[10px] font-bold text-lemon">
                              <span className="size-1.5 animate-pulse rounded-full bg-lemon" aria-hidden />
                              {ar ? "باقة نشطة" : "Active plan"}
                            </span>
                            <span className="text-[10px] text-cream/45">
                              {ar
                                ? `تبدأ ${formatDate(current.startsAt, locale)}`
                                : `Starts ${formatDate(current.startsAt, locale)}`}
                            </span>
                          </div>
                          <h2 className="mt-4 font-display text-2xl font-bold text-cream">{current.programName}</h2>
                          <p className="mt-1 text-xs text-cream/45">
                            {ar
                              ? `متبقي ${daysLeft} يوم — تنتهي ${formatDate(current.endsAt, locale)}`
                              : `${daysLeft} days left — ends ${formatDate(current.endsAt, locale)}`}
                          </p>
                          <div className="mt-5">
                            <div className="flex items-center justify-between text-[10px] text-cream/40">
                              <span>{ar ? "التقدم في الباقة" : "Plan progress"}</span>
                              <span>{progress}%</span>
                            </div>
                            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-lemon-deep to-lemon"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>
                          <div className="mt-6 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => setTab("program")}
                              className="inline-flex items-center gap-2 rounded-full bg-lemon px-4 py-2.5 text-xs font-bold text-ink transition-transform hover:-translate-y-0.5"
                            >
                              <Sparkles className="size-4" aria-hidden />
                              {ar ? "افتح برنامجك" : "Open your program"}
                            </button>
                            <Link
                              to={`/subscribe/${current.programId}`}
                              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2.5 text-xs font-bold text-cream/75 transition-colors hover:border-lemon/50 hover:text-lemon"
                            >
                              <Sparkles className="size-4" aria-hidden />
                              {ar ? "جدّد الباقة" : "Renew plan"}
                            </Link>
                            <Link
                              to="/contact"
                              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2.5 text-xs font-bold text-cream/75 transition-colors hover:border-lemon/50 hover:text-lemon"
                            >
                              {ar ? "تواصل مع الفريق" : "Contact the team"}
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="panel p-7 text-center">
                      <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-lemon/10 text-lemon">
                        <Sparkles className="size-6" aria-hidden />
                      </span>
                      <h2 className="mt-4 text-xl">{ar ? "مفيش باقة نشطة لحد دلوقتي" : "No active plan yet"}</h2>
                      <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-cream/45">
                        {ar
                          ? "اختار الباقة اللي تناسب هدفك، حوّل المبلغ، وارفع صورة التحويل — والباقة تتفعّل بعد التحقق."
                          : "Pick the plan that fits your goal, transfer the amount and upload the screenshot — the plan activates after verification."}
                      </p>
                      <Link
                        to="/programs"
                        className="mt-5 inline-flex items-center gap-2 rounded-full bg-lemon px-5 py-3 text-xs font-bold text-ink"
                      >
                        {ar ? "شوف الباقات" : "Browse plans"}
                        <ArrowUpRight className="size-4" aria-hidden />
                      </Link>
                    </div>
                  )}

                  <div className="panel p-5 md:p-6">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-base">{ar ? "آخر المدفوعات" : "Recent payments"}</h3>
                      <button type="button" onClick={() => setTab("payments")} className="text-[11px] font-bold text-lemon hover:underline">
                        {ar ? "عرض الكل" : "View all"}
                      </button>
                    </div>
                    {payments.length === 0 ? (
                      <p className="mt-4 rounded-xl border border-dashed border-white/12 px-4 py-8 text-center text-xs text-cream/40">
                        {ar ? "لسه مفيش مدفوعات مسجلة على حسابك." : "No payments recorded on your account yet."}
                      </p>
                    ) : (
                      <ul className="mt-4 space-y-2.5">
                        {payments.slice(0, 4).map((payment) => (
                          <li key={payment.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] px-3.5 py-3">
                            <span className="flex size-9 items-center justify-center rounded-xl bg-white/5 text-cream/50">
                              <CreditCard className="size-4" aria-hidden />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-semibold text-cream">{payment.programName}</p>
                              <p className="mt-0.5 text-[10px] text-cream/35">{formatDateTime(payment.createdAt, locale)}</p>
                            </div>
                            <span className="text-xs font-bold text-cream/80">{formatEgp(payment.amount, lang)}</span>
                            <StatusBadge status={payment.status} lang={lang} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="panel p-5 md:p-6">
                    <h3 className="flex items-center gap-2 text-base">
                      <UserRound className="size-4 text-lemon" aria-hidden />
                      {ar ? "بيانات الحساب" : "Account details"}
                    </h3>
                    <ul className="mt-4 space-y-3 text-xs text-cream/60">
                      <li className="flex items-center gap-2.5">
                        <Mail className="size-4 shrink-0 text-cream/30" aria-hidden />
                        <span dir="ltr" className="truncate">{payload?.user.email}</span>
                      </li>
                      <li className="flex items-center gap-2.5">
                        <Phone className="size-4 shrink-0 text-cream/30" aria-hidden />
                        <span dir="ltr">{payload?.user.phone || (ar ? "مفيش رقم مسجل" : "No number on file")}</span>
                      </li>
                      <li className="flex items-center gap-2.5">
                        <CalendarDays className="size-4 shrink-0 text-cream/30" aria-hidden />
                        {ar
                          ? `عضو من ${formatDate(payload?.user.createdAt ?? new Date(), locale)}`
                          : `Member since ${formatDate(payload?.user.createdAt ?? new Date(), locale)}`}
                      </li>
                    </ul>
                    <button
                      type="button"
                      onClick={() => setTab("profile")}
                      className="mt-5 w-full rounded-full border border-white/15 py-2.5 text-xs font-bold text-cream/70 transition-colors hover:border-lemon/50 hover:text-lemon"
                    >
                      {ar ? "تعديل البيانات" : "Edit details"}
                    </button>
                  </div>

                  <div className="panel p-5 md:p-6">
                    <h3 className="text-base">{ar ? "طرق الدفع" : "Payment methods"}</h3>
                    <p className="mt-2 text-[11px] leading-relaxed text-cream/40">
                      {ar
                        ? "التحويل عبر فودافون كاش أو إنستاباي، والتحقق من الإيصال بيتم تلقائيًا في أغلب الحالات."
                        : "Transfer via Vodafone Cash or InstaPay — receipts are verified automatically in most cases."}
                    </p>
                    <PaymentBadges className="mt-4" />
                  </div>

                  <div className="panel bg-lemon/[0.06] p-5 md:p-6">
                    <h3 className="flex items-center gap-2 text-sm font-bold text-lemon">
                      <ShieldCheck className="size-4" aria-hidden />
                      {ar ? "حسابك آمن" : "Your account is secure"}
                    </h3>
                    <p className="mt-2 text-[11px] leading-relaxed text-cream/50">
                      {ar
                        ? "بياناتك مشفرة، وصور التحويل بتتشاف منك ومن فريق الدكتور بس."
                        : "Your data is encrypted — transfer screenshots are visible only to you and the clinic team."}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {tab === "program" && current && (
              <MyProgram subscription={current} daysLeft={daysLeft} totalDays={totalDays} />
            )}

            {tab === "payments" && (
              <div className="panel overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
                  <div>
                    <h2 className="text-base">{ar ? "سجل المدفوعات" : "Payment history"}</h2>
                    <p className="mt-1 text-[11px] text-cream/40">
                      {ar ? "كل تحويلاتك وحالة التحقق منها." : "All your transfers and their verification status."}
                    </p>
                  </div>
                  <Link
                    to="/programs"
                    className="inline-flex items-center gap-1.5 rounded-full bg-lemon px-4 py-2 text-[11px] font-bold text-ink"
                  >
                    {ar ? "دفع جديد" : "New payment"}
                    <ArrowUpRight className="size-3.5" aria-hidden />
                  </Link>
                </div>

                {payments.length === 0 ? (
                  <div className="px-5 py-16 text-center">
                    <ReceiptText className="mx-auto size-8 text-cream/20" aria-hidden />
                    <p className="mt-3 text-sm text-cream/50">{ar ? "لسه مفيش مدفوعات." : "No payments yet."}</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-white/8">
                    {payments.map((payment) => (
                      <li key={payment.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                        <span className="flex size-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-cream/50">
                          <CreditCard className="size-5" aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-cream">{payment.programName}</p>
                            <StatusBadge status={payment.status} lang={lang} />
                          </div>
                          <p className="mt-1 text-[11px] text-cream/40">
                            {formatDateTime(payment.createdAt, locale)} ·{" "}
                            {payment.method === "vodafone"
                              ? ar
                                ? "فودافون كاش"
                                : "Vodafone Cash"
                              : ar
                                ? "إنستاباي"
                                : "InstaPay"}{" "}
                            · {ar ? "رقم العملية" : "Ref"} {payment.reference}
                          </p>
                          {payment.risk.length > 0 && (
                            <ul className="mt-2 space-y-1">
                              {payment.risk.map((reason) => (
                                <li key={reason} className="flex items-start gap-1.5 text-[10px] leading-relaxed text-amber-200/80">
                                  <span className="mt-1 size-1 shrink-0 rounded-full bg-amber-300" aria-hidden />
                                  {localize(reason, lang)}
                                </li>
                              ))}
                            </ul>
                          )}
                          {payment.note && (
                            <p className="mt-2 rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-1.5 text-[10px] text-cream/50">
                              {ar ? `ملاحظة الفريق: ${payment.note}` : `Team note: ${payment.note}`}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-display text-base font-bold text-cream">{formatEgp(payment.amount, lang)}</span>
                          <button
                            type="button"
                            onClick={() => setScreenshot(payment)}
                            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-2 text-[10px] font-bold text-cream/60 transition-colors hover:border-lemon/50 hover:text-lemon"
                          >
                            <ImageIcon className="size-3.5" aria-hidden />
                            {ar ? "الإيصال" : "Receipt"}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {tab === "profile" && (
              <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="panel p-6">
                  <h2 className="text-lg">{ar ? "بياناتك الشخصية" : "Your details"}</h2>
                  <p className="mt-1 text-[11px] leading-relaxed text-cream/40">
                    {ar ? "خلي بياناتك محدثة عشان نقدر نتواصل معك بسهولة." : "Keep your details current so we can reach you easily."}
                  </p>
                  <form onSubmit={saveProfile} className="mt-5 space-y-4">
                    <div>
                      <label htmlFor="acc-name" className="mb-1.5 block text-[11px] font-semibold text-cream/55">
                        {ar ? "الاسم الكامل" : "Full name"}
                      </label>
                      <input id="acc-name" className="field" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
                    </div>
                    <div>
                      <label htmlFor="acc-email" className="mb-1.5 block text-[11px] font-semibold text-cream/55">
                        {ar ? "الإيميل" : "Email"}
                      </label>
                      <input id="acc-email" className="field opacity-60" value={payload?.user.email ?? ""} dir="ltr" readOnly />
                      <p className="mt-1 text-[10px] text-cream/30">
                        {ar ? "لو محتاج تغيّر الإيميل كلم الدعم." : "Need to change your email? Contact support."}
                      </p>
                    </div>
                    <div>
                      <label htmlFor="acc-phone" className="mb-1.5 block text-[11px] font-semibold text-cream/55">
                        {ar ? "رقم الموبايل" : "Mobile number"}
                      </label>
                      <input
                        id="acc-phone"
                        className="field"
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                        dir="ltr"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="01xxxxxxxxx"
                      />
                    </div>
                    {password && (
                      <div>
                        <label htmlFor="acc-current" className="mb-1.5 block text-[11px] font-semibold text-cream/55">
                          {ar ? "الباسورد الحالي" : "Current password"}
                        </label>
                        <input
                          id="acc-current"
                          type="password"
                          className="field"
                          value={currentPassword}
                          onChange={(event) => setCurrentPassword(event.target.value)}
                          autoComplete="current-password"
                          required
                        />
                      </div>
                    )}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label htmlFor="acc-password" className="mb-1.5 block text-[11px] font-semibold text-cream/55">
                          {ar ? "باسورد جديد" : "New password"}
                        </label>
                        <input
                          id="acc-password"
                          type="password"
                          className="field"
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          autoComplete="new-password"
                          placeholder={ar ? "اتركه فاضي لو مش هتغيّره" : "Leave empty to keep it"}
                        />
                      </div>
                      <div>
                        <label htmlFor="acc-confirm" className="mb-1.5 block text-[11px] font-semibold text-cream/55">
                          {ar ? "تأكيد الباسورد" : "Confirm password"}
                        </label>
                        <input
                          id="acc-confirm"
                          type="password"
                          className="field"
                          value={confirm}
                          onChange={(event) => setConfirm(event.target.value)}
                          autoComplete="new-password"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-lemon px-5 py-3 text-xs font-bold text-ink transition-transform hover:-translate-y-0.5 disabled:opacity-60"
                    >
                      {saving ? <Spinner className="text-ink" /> : <ShieldCheck className="size-4" aria-hidden />}
                      {saving ? (ar ? "بنحفظ…" : "Saving…") : ar ? "حفظ التعديلات" : "Save changes"}
                    </button>
                  </form>
                </div>

                <div className="space-y-5">
                  <div className="panel p-6">
                    <h2 className="text-lg">{ar ? "سجل الاشتراكات" : "Subscription history"}</h2>
                    {subscriptions.length === 0 ? (
                      <p className="mt-4 rounded-xl border border-dashed border-white/12 px-4 py-8 text-center text-xs text-cream/40">
                        {ar ? "مفيش اشتراكات سابقة." : "No previous subscriptions."}
                      </p>
                    ) : (
                      <ul className="mt-4 space-y-2.5">
                        {subscriptions.map((item) => (
                          <li key={item.id} className="rounded-xl border border-white/8 bg-white/[0.02] p-3.5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-xs font-semibold text-cream">{item.programName}</p>
                              <span
                                className={cn(
                                  "rounded-full border px-2 py-0.5 text-[9px] font-bold",
                                  item.status === "active"
                                    ? "border-lemon/30 bg-lemon/10 text-lemon"
                                    : "border-white/12 bg-white/5 text-cream/45"
                                )}
                              >
                                {item.status === "active"
                                  ? ar
                                    ? "نشط"
                                    : "Active"
                                  : item.status === "expired"
                                    ? ar
                                      ? "منتهي"
                                      : "Expired"
                                    : ar
                                      ? "ملغي"
                                      : "Cancelled"}
                              </span>
                            </div>
                            <p className="mt-1.5 text-[10px] text-cream/35">
                              {formatDate(item.startsAt, locale)} — {formatDate(item.endsAt, locale)}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <SessionsCard />

                  <div className="panel-soft p-5">
                    <p className="flex items-center gap-2 text-xs font-bold text-cream/70">
                      <Clock3 className="size-4 text-lemon" aria-hidden />
                      {ar ? "محتاج مساعدة؟" : "Need help?"}
                    </p>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-cream/40">
                      {ar ? "فريقنا بيرد على استفساراتك خلال ساعات العمل." : "Our team replies to your questions during working hours."}
                    </p>
                    <Link to="/contact" className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-lemon hover:underline">
                      {ar ? "تواصل معنا" : "Contact us"}
                      <ArrowUpRight className="size-3.5" aria-hidden />
                    </Link>
                  </div>
                </div>
              </div>
            )}
        </div>
      </div>

      {/* Screenshot modal */}
      <AnimatePresence>
        {screenshot && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center bg-ink/85 p-4 backdrop-blur-sm"
            onClick={() => setScreenshot(null)}
          >
            <motion.div
              initial={{ scale: 0.96, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.97 }}
              onClick={(event) => event.stopPropagation()}
              className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/15 bg-ink-3"
            >
              <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                <p className="text-xs font-bold text-cream">
                  {ar ? `إيصال التحويل #${screenshot.id}` : `Transfer receipt #${screenshot.id}`}
                </p>
                <button
                  type="button"
                  onClick={() => setScreenshot(null)}
                  className="text-cream/50 hover:text-cream"
                  aria-label={ar ? "إغلاق" : "Close"}
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>
              <img
                src={`/api/payments/${screenshot.id}/screenshot`}
                alt={ar ? "صورة التحويل" : "Transfer screenshot"}
                className="max-h-[70vh] w-full bg-ink object-contain"
              />
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-[11px] text-cream/50">
                <span>
                  {screenshot.method === "vodafone"
                    ? ar
                      ? "فودافون كاش"
                      : "Vodafone Cash"
                    : ar
                      ? "إنستاباي"
                      : "InstaPay"}
                </span>
                <span dir="ltr">{screenshot.reference}</span>
                <StatusBadge status={screenshot.status} lang={lang} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
