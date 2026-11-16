import {
  Activity,
  ArrowUpRight,
  Ban,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  CreditCard,
  FileDown,
  LayoutDashboard,
  Loader2,
  Mail,
  MessageSquareText,
  MonitorSmartphone,
  Paperclip,
  Phone,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Stethoscope,
  Target,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { AdminCustomer, CustomerActivityDTO, CustomerDetail, PaymentDTO } from "../../../shared/types";
import { Spinner } from "../../components/ui/Spinner";
import { useToast } from "../../components/ui/Toast";
import { api, formatDate, formatDateTime, formatEgp } from "../../lib/api";
import { downloadCustomerPdf } from "../../lib/customer-pdf";
import { useLang } from "../../lib/i18n";
import { cn } from "../../lib/utils";
import { AdminCheckins } from "../../components/account/AdminCheckins";
import { PlanPanel } from "../../components/account/PlanPanel";
import { AssetManager } from "./AssetManager";
import { AdminField, AdminPage, Badge, EmptyState, Modal, PaymentStatus } from "./components";
import { Pager } from "./Pager";

type DetailTab =
  | "overview"
  | "plan"
  | "checkins"
  | "plans"
  | "payments"
  | "chat"
  | "files"
  | "activity"
  | "settings";

const ACTIVITY_ICON: Record<CustomerActivityDTO["kind"], typeof UserRound> = {
  account: UserRound,
  subscription: CalendarClock,
  payment: Wallet,
  chat: Stethoscope,
  message: MessageSquareText,
  session: MonitorSmartphone,
};

const ACTIVITY_TONE: Record<CustomerActivityDTO["kind"], string> = {
  account: "bg-sky-400/10 text-sky-300",
  subscription: "bg-lemon/10 text-lemon",
  payment: "bg-violet-400/10 text-violet-200",
  chat: "bg-emerald-400/10 text-emerald-200",
  message: "bg-amber-400/10 text-amber-200",
  session: "bg-white/5 text-cream/50",
};

function ActivityRow({ item }: { item: CustomerActivityDTO }) {
  const Icon = ACTIVITY_ICON[item.kind];
  return (
    <li className="flex gap-3 rounded-xl border border-white/6 bg-white/[0.018] p-3">
      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", ACTIVITY_TONE[item.kind])}>
        <Icon className="size-3.5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold text-cream/80">{item.title}</p>
        {item.detail && <p className="mt-0.5 line-clamp-2 text-[10px] leading-relaxed text-cream/35">{item.detail}</p>}
        <p className="mt-1 text-[9px] text-cream/25">{formatDateTime(item.at)}</p>
      </div>
    </li>
  );
}

export default function AdminCustomers() {
  const toast = useToast();
  const { t } = useLang();
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 12;

  useEffect(() => {
    setPage(1);
  }, [query]);

  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");
  const [pdfing, setPdfing] = useState(false);
  const [planSaving, setPlanSaving] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [grantProgram, setGrantProgram] = useState("");
  const [grantDays, setGrantDays] = useState("");
  const [granting, setGranting] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(
    async (q: string) => {
      try {
        const data = await api<{ customers: AdminCustomer[] }>(
          `/api/admin/customers${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`
        );
        setCustomers(data.customers);
      } catch (cause) {
        toast.error(cause instanceof Error ? cause.message : "تعذر تحميل العملاء.");
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => void load(query), query ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [load, query]);

  const openDetail = useCallback(
    async (id: number, preserveTab = false) => {
      if (!preserveTab) setDetailTab("overview");
      setDetailLoading(true);
      setDetail(null);
      try {
        const data = await api<CustomerDetail>(`/api/admin/customers/${id}`);
        setDetail(data);
        setEditName(data.customer.name);
        setEditEmail(data.customer.email);
        setEditPhone(data.customer.phone);
        setEditPassword("");
        setGrantProgram(t.programs[0]?.contentId ?? "");
        setGrantDays("");
      } catch (cause) {
        toast.error(cause instanceof Error ? cause.message : "تعذر تحميل بيانات العميل.");
      } finally {
        setDetailLoading(false);
      }
    },
    [t.programs, toast]
  );

  const refresh = useCallback(async () => {
    await load(query);
    if (detail) await openDetail(detail.customer.id, true);
  }, [detail, load, openDetail, query]);

  const exportPdf = async () => {
    if (!detail || pdfing) return;
    setPdfing(true);
    try {
      await downloadCustomerPdf(detail);
      toast.success("تم تحميل بيان العميل PDF.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "تعذر إنشاء ملف PDF.");
    } finally {
      setPdfing(false);
    }
  };

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (!detail) return;
    setSavingProfile(true);
    try {
      await api(`/api/admin/customers/${detail.customer.id}`, {
        method: "PATCH",
        body: {
          name: editName.trim(),
          email: editEmail.trim(),
          phone: editPhone.trim(),
          password: editPassword || undefined,
        },
      });
      toast.success("تم تحديث بيانات العميل.");
      setEditPassword("");
      await refresh();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "تعذر التحديث.");
    } finally {
      setSavingProfile(false);
    }
  };

  const toggleBlock = async () => {
    if (!detail) return;
    const next = !detail.customer.blocked;
    try {
      await api(`/api/admin/customers/${detail.customer.id}`, { method: "PATCH", body: { blocked: next } });
      toast.success(next ? "تم إيقاف حساب العميل." : "تم تفعيل حساب العميل.");
      await refresh();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "تعذر تغيير حالة الحساب.");
    }
  };

  const grant = async (event: FormEvent) => {
    event.preventDefault();
    if (!detail || !grantProgram) return;
    setGranting(true);
    try {
      await api("/api/admin/subscriptions", {
        method: "POST",
        body: {
          userId: detail.customer.id,
          programId: grantProgram,
          days: grantDays ? Number(grantDays) : undefined,
        },
      });
      toast.success("تم إضافة الاشتراك للعميل.");
      setGrantDays("");
      await refresh();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "تعذر إضافة الاشتراك.");
    } finally {
      setGranting(false);
    }
  };

  const create = async (event: FormEvent) => {
    event.preventDefault();
    if (newName.trim().length < 2) return toast.error("اكتب اسم العميل.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(newEmail.trim())) return toast.error("الإيميل مش صحيح.");
    if (newPassword.length < 8) return toast.error("الباسورد لازم 8 حروف على الأقل.");
    setCreating(true);
    try {
      await api("/api/admin/customers", {
        method: "POST",
        body: { name: newName.trim(), email: newEmail.trim(), phone: newPhone.trim(), password: newPassword },
      });
      toast.success("تم إنشاء حساب العميل.");
      setCreateOpen(false);
      setNewName("");
      setNewEmail("");
      setNewPhone("");
      setNewPassword("");
      await load(query);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "تعذر إنشاء الحساب.");
    } finally {
      setCreating(false);
    }
  };

  const visible = useMemo(
    () => customers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [customers, page]
  );

  const totals = useMemo(
    () => ({
      count: customers.length,
      active: customers.filter((item) => item.activeSubscriptions > 0).length,
      spent: customers.reduce((sum, item) => sum + item.spent, 0),
    }),
    [customers]
  );

  return (
    <AdminPage
      kicker="العملاء"
      title="إدارة العملاء"
      text="كل عميل، اشتراكاته، ومدفوعاته. تقدر تعدّل بياناته، توقف حسابه، أو تضيف له اشتراك يدوي."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/api/admin/export/customers.csv"
            className="inline-flex items-center gap-1.5 rounded-full border border-lemon/30 bg-lemon/10 px-4 py-2 text-[11px] font-bold text-lemon transition-colors hover:bg-lemon/15"
          >
            تصدير CSV
          </a>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-lemon px-4 py-2 text-[11px] font-bold text-ink transition-transform hover:-translate-y-0.5"
          >
            <Plus className="size-3.5" aria-hidden />
            إضافة عميل
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-3 gap-3">
        <div className="panel-soft p-3.5">
          <p className="text-[10px] text-cream/40">كل العملاء</p>
          <p className="mt-1 font-display text-lg font-bold text-cream">{totals.count}</p>
        </div>
        <div className="panel-soft p-3.5">
          <p className="text-[10px] text-cream/40">باشتراك نشط</p>
          <p className="mt-1 font-display text-lg font-bold text-lemon">{totals.active}</p>
        </div>
        <div className="panel-soft p-3.5">
          <p className="text-[10px] text-cream/40">إجمالي مدفوعاتهم</p>
          <p className="mt-1 font-display text-lg font-bold text-cream">{formatEgp(totals.spent)}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-3.5 -translate-y-1/2 text-cream/30" aria-hidden />
          <input
            className="field py-2 ps-9 text-xs"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ابحث بالاسم أو الإيميل أو الموبايل…"
          />
        </div>
        <span className="hidden text-[10px] text-cream/30 sm:block">{customers.length} نتيجة</span>
      </div>

      <div className="panel mt-3 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner className="size-7 text-lemon" />
          </div>
        ) : customers.length === 0 ? (
          <EmptyState icon={Users} title="مفيش عملاء" text="أول ما حد يعمل حساب على الموقع هيظهر هنا." />
        ) : (
          <div className="table-wrap border-0">
            <table>
              <thead>
                <tr>
                  <th>العميل</th>
                  <th>الموبايل</th>
                  <th>اشتراكات نشطة</th>
                  <th>المدفوع</th>
                  <th>آخر انتهاء</th>
                  <th>الحالة</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visible.map((customer) => (
                  <tr key={customer.id} className="cursor-pointer" onClick={() => void openDetail(customer.id)}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-lemon/10 text-[11px] font-bold text-lemon">
                          {customer.name.charAt(0)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-cream/85">{customer.name}</p>
                          <p className="truncate text-[10px] text-cream/35" dir="ltr">{customer.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap text-[11px]" dir="ltr">{customer.phone || "—"}</td>
                    <td>
                      <Badge tone={customer.activeSubscriptions > 0 ? "lemon" : "neutral"}>
                        {customer.activeSubscriptions} باقة
                      </Badge>
                    </td>
                    <td className="font-semibold text-cream/85">{formatEgp(customer.spent)}</td>
                    <td className="whitespace-nowrap text-[11px] text-cream/45">
                      {customer.endsAt ? formatDate(customer.endsAt) : "—"}
                    </td>
                    <td>
                      {customer.blocked ? <Badge tone="rose">موقوف</Badge> : <Badge tone="lemon">نشط</Badge>}
                    </td>
                    <td>
                      <span className="text-[10px] font-bold text-lemon">تفاصيل</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pager page={page} pageSize={PAGE_SIZE} total={customers.length} onPage={setPage} />
          </div>
        )}
      </div>

      {/* Customer detail */}
      <Modal
        open={Boolean(detail) || detailLoading}
        onClose={() => setDetail(null)}
        title={detail ? detail.customer.name : "بيانات العميل"}
        description={detail ? detail.customer.email : "بنجهّز البيانات…"}
        size="xl"
      >
        {detailLoading || !detail ? (
          <div className="flex items-center justify-center py-14">
            <Spinner className="size-7 text-lemon" />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                {
                  label: "الباقات النشطة",
                  value: String(detail.stats.activeSubscriptions),
                  hint: `${detail.stats.totalSubscriptions} اشتراك إجمالي`,
                  icon: CheckCircle2,
                },
                {
                  label: "إجمالي المدفوع",
                  value: formatEgp(detail.stats.totalSpent),
                  hint: `${detail.payments.length} دفعة · ${detail.stats.pendingPayments} معلقة`,
                  icon: Wallet,
                },
                {
                  label: "رسائل للدكتور",
                  value: String(detail.stats.unreadCoach),
                  hint: detail.stats.unreadCoach ? "غير مقروءة" : "كلها مقروءة",
                  icon: MessageSquareText,
                },
                {
                  label: "آخر ظهور",
                  value: detail.stats.lastSeen ? formatDateTime(detail.stats.lastSeen) : "—",
                  hint: `${detail.stats.sessions} جهاز مسجل`,
                  icon: Clock3,
                },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
                  <item.icon className="size-4 text-lemon/70" aria-hidden />
                  <p className="mt-1.5 text-[9px] text-cream/35">{item.label}</p>
                  <p className="mt-0.5 truncate text-[11px] font-bold text-cream/85">{item.value}</p>
                  <p className="mt-0.5 truncate text-[9px] text-cream/25">{item.hint}</p>
                </div>
              ))}
            </div>

            <div className="flex gap-1.5 overflow-x-auto border-b border-white/8 pb-2">
              {([
                { key: "overview", label: "نظرة عامة", icon: LayoutDashboard },
                { key: "plan", label: "الخطة", icon: Target },
                { key: "checkins", label: "المتابعة", count: detail.checkins.length, icon: Activity },
                { key: "plans", label: "الباقات", count: detail.subscriptions.length, icon: CalendarDays },
                { key: "payments", label: "المدفوعات", count: detail.payments.length, icon: CreditCard },
                { key: "chat", label: "المحادثات", count: detail.coachMessages.length + detail.contactMessages.length, icon: MessageSquareText },
                { key: "files", label: "الملفات", count: detail.files.length, icon: Paperclip },
                { key: "activity", label: "النشاط", count: detail.activity.length, icon: Activity },
                { key: "settings", label: "الإعدادات", icon: Settings2 },
              ] as { key: DetailTab; label: string; count?: number; icon: typeof UserRound }[]).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setDetailTab(tab.key)}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold transition",
                    detailTab === tab.key
                      ? "bg-lemon text-ink"
                      : "border border-white/8 bg-white/[0.02] text-cream/50 hover:text-cream/80"
                  )}
                >
                  <tab.icon className="size-3.5" aria-hidden />
                  {tab.label}
                  {tab.count !== undefined && (
                    <span className={cn("rounded-full px-1.5 text-[9px]", detailTab === tab.key ? "bg-ink/10" : "bg-white/8")}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => void exportPdf()}
                disabled={pdfing}
                className="inline-flex items-center gap-1.5 rounded-full border border-lemon/30 bg-lemon/10 px-4 py-2 text-[10px] font-bold text-lemon transition-colors hover:bg-lemon/15 disabled:opacity-60"
              >
                {pdfing ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <FileDown className="size-3.5" aria-hidden />}
                {pdfing ? "بنجهز الـ PDF..." : "تحميل بيانات العميل PDF"}
              </button>
              <span className="text-[10px] text-cream/30">ملف PDF كامل بكل بيانات العميل واشتراكاته ومدفوعاته.</span>
            </div>

            {detailTab === "overview" && (
              <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="space-y-4">
                  {detail.currentProgram ? (
                    <div className="panel overflow-hidden">
                      <div className="relative p-4">
                        {detail.currentProgram.image && (
                          <img
                            src={detail.currentProgram.image}
                            alt=""
                            className="pointer-events-none absolute inset-0 size-full object-cover opacity-15"
                          />
                        )}
                        <div className="relative">
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1 rounded-full bg-lemon/15 px-2 py-0.5 text-[9px] font-bold text-lemon">
                              <CheckCircle2 className="size-3" aria-hidden />
                              الباقة الحالية
                            </span>
                            <span className="text-[10px] font-bold text-cream/45">{detail.currentProgram.daysLeft} يوم متبقي</span>
                          </div>
                          <h3 className="mt-2 text-lg font-extrabold text-cream">{detail.currentProgram.name}</h3>
                          {detail.currentProgram.summary && (
                            <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-cream/45">{detail.currentProgram.summary}</p>
                          )}
                          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
                            <div className="h-full rounded-full bg-lemon" style={{ width: `${detail.currentProgram.progress}%` }} />
                          </div>
                          <div className="mt-1.5 flex items-center justify-between text-[9px] text-cream/30">
                            <span>{formatDate(detail.currentProgram.startsAt)}</span>
                            <span>{detail.currentProgram.progress}%</span>
                            <span>{formatDate(detail.currentProgram.endsAt)}</span>
                          </div>
                          <div className="mt-3 grid grid-cols-4 gap-2">
                            {[
                              { label: "أسابيع", value: detail.currentProgram.weeks },
                              { label: "تمارين", value: detail.currentProgram.workouts },
                              { label: "وجبات", value: detail.currentProgram.meals },
                              { label: "متابعة كل", value: detail.currentProgram.checkInEveryDays ? `${detail.currentProgram.checkInEveryDays}ي` : "—" },
                            ].map((item) => (
                              <div key={item.label} className="rounded-lg bg-white/[0.04] p-2 text-center">
                                <p className="text-xs font-bold text-cream/80">{item.value}</p>
                                <p className="mt-0.5 text-[8px] text-cream/30">{item.label}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="panel-soft px-5 py-8 text-center">
                      <CalendarClock className="mx-auto size-7 text-cream/20" aria-hidden />
                      <p className="mt-2 text-sm font-bold text-cream/70">مفيش باقة نشطة حاليًا</p>
                      <p className="mt-1 text-[10px] text-cream/35">تقدر تضيف اشتراك يدوي من الإعدادات في أي وقت.</p>
                      <button
                        type="button"
                        onClick={() => setDetailTab("settings")}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-lemon px-4 py-2 text-[10px] font-bold text-ink"
                      >
                        <Plus className="size-3.5" aria-hidden />
                        إضافة اشتراك
                      </button>
                    </div>
                  )}

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-sm font-bold text-cream">آخر نشاط</h3>
                      <button type="button" onClick={() => setDetailTab("activity")} className="text-[10px] font-bold text-lemon/80">
                        كل النشاط ←
                      </button>
                    </div>
                    {detail.activity.length ? (
                      <ul className="space-y-2">
                        {detail.activity.slice(0, 5).map((item) => (
                          <ActivityRow key={item.id} item={item} />
                        ))}
                      </ul>
                    ) : (
                      <p className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-[11px] text-cream/35">
                        مفيش نشاط مسجل.
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="panel-soft p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-cream">بيانات الحساب</h3>
                      <Badge tone={detail.customer.blocked ? "rose" : "lemon"}>
                        {detail.customer.blocked ? "موقوف" : "نشط"}
                      </Badge>
                    </div>
                    <dl className="mt-3 space-y-2 text-[11px]">
                      {[
                        { label: "الإيميل", value: detail.customer.email, dir: "ltr" },
                        { label: "الموبايل", value: detail.customer.phone || "—", dir: "ltr" },
                        { label: "عضو من", value: formatDate(detail.customer.createdAt) },
                        { label: "آخر ظهور", value: detail.stats.lastSeen ? formatDateTime(detail.stats.lastSeen) : "—" },
                        { label: "آخر انتهاء", value: detail.customer.endsAt ? formatDate(detail.customer.endsAt) : "—" },
                        { label: "رسائل الموقع", value: String(detail.stats.contactMessages) },
                      ].map((row) => (
                        <div key={row.label} className="flex items-center justify-between gap-3 border-b border-white/5 pb-1.5 last:border-0 last:pb-0">
                          <dt className="shrink-0 text-cream/35">{row.label}</dt>
                          <dd className="truncate font-bold text-cream/75" dir={row.dir}>
                            {row.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setDetailTab("chat")}
                        className="inline-flex items-center justify-center gap-1.5 rounded-full border border-lemon/25 bg-lemon/10 py-2 text-[10px] font-bold text-lemon"
                      >
                        <MessageSquareText className="size-3.5" aria-hidden />
                        المحادثات
                      </button>
                      <button
                        type="button"
                        onClick={() => setDetailTab("settings")}
                        className="inline-flex items-center justify-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] py-2 text-[10px] font-bold text-cream/60"
                      >
                        <Settings2 className="size-3.5" aria-hidden />
                        تعديل الحساب
                      </button>
                    </div>
                  </div>

                  <div className="panel-soft p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-cream">الأجهزة والجلسات</h3>
                      <span className="text-[9px] text-cream/30">{detail.sessions.length} جلسة</span>
                    </div>
                    {detail.sessions.length === 0 ? (
                      <p className="mt-3 text-[10px] text-cream/35">مفيش جلسات نشطة حاليًا.</p>
                    ) : (
                      <ul className="mt-3 space-y-2">
                        {detail.sessions.slice(0, 4).map((session) => (
                          <li key={`${session.createdAt}-${session.lastSeen}`} className="rounded-lg border border-white/6 bg-white/[0.02] p-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-cream/70">
                                <MonitorSmartphone className="size-3.5 text-cream/35" aria-hidden />
                                {session.ip || "IP غير معروف"}
                              </span>
                              <span className="text-[9px] text-cream/25">{formatDateTime(session.lastSeen)}</span>
                            </div>
                            {session.userAgent && <p className="mt-1 line-clamp-1 text-[9px] text-cream/25">{session.userAgent}</p>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            )}

            {detailTab === "plan" && (
              <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-cream">خطة العميل</h3>
                  {detail.plan?.updatedAt && (
                    <span className="text-[10px] text-cream/30">آخر تحديث {formatDateTime(detail.plan.updatedAt)}</span>
                  )}
                </div>
                <PlanPanel
                  plan={detail.plan}
                  editable
                  saving={planSaving}
                  onSave={async (next) => {
                    setPlanSaving(true);
                    try {
                      const data = await api<{ plan: CustomerDetail["plan"] }>(
                        `/api/admin/customers/${detail.customer.id}/plan`,
                        { method: "PUT", body: next }
                      );
                      setDetail((prev) => (prev ? { ...prev, plan: data.plan } : prev));
                      toast.success("تم حفظ خطة العميل.");
                    } catch (cause) {
                      toast.error(cause instanceof Error ? cause.message : "تعذر حفظ الخطة.");
                    } finally {
                      setPlanSaving(false);
                    }
                  }}
                />
              </div>
            )}

            {detailTab === "checkins" && (
              <div>
                <h3 className="mb-2 text-sm font-bold text-cream">المتابعات ({detail.checkins.length})</h3>
                <AdminCheckins
                  customerId={detail.customer.id}
                  checkins={detail.checkins}
                  onReviewed={() => void refresh()}
                />
              </div>
            )}

            {detailTab === "chat" && (
              <div className="grid gap-4 lg:grid-cols-2">
                <section className="panel-soft flex flex-col p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h3 className="inline-flex items-center gap-1.5 text-sm font-bold text-cream">
                      <Stethoscope className="size-4 text-lemon/70" aria-hidden />
                      محادثة الدكتور
                      <span className="text-[9px] font-normal text-cream/30">({detail.coachMessages.length})</span>
                    </h3>
                    <Link
                      to={`/admin/chat?user=${detail.customer.id}`}
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-lemon/80"
                    >
                      فتح والرد <ArrowUpRight className="size-3" aria-hidden />
                    </Link>
                  </div>
                  {detail.coachMessages.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-[11px] text-cream/35">
                      العميل لسه مابعتش ولا رسالة.
                    </p>
                  ) : (
                    <div className="max-h-[420px] space-y-2 overflow-y-auto pe-1">
                      {detail.coachMessages.map((message) => (
                        <div
                          key={message.id}
                          className={cn(
                            "rounded-xl border p-2.5",
                            message.sender === "doctor"
                              ? "border-lemon/20 bg-lemon/[0.06]"
                              : "border-white/8 bg-white/[0.03]"
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[9px] font-bold text-cream/45">
                              {message.sender === "doctor" ? "الدكتور" : "العميل"}
                            </span>
                            <span className="text-[9px] text-cream/25">{formatDateTime(message.createdAt)}</span>
                          </div>
                          {message.body && (
                            <p className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed text-cream/70">{message.body}</p>
                          )}
                          {message.mediaKind && message.mediaUrl && (
                            <a
                              href={message.mediaUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold text-lemon/80"
                            >
                              {message.mediaKind === "image" ? "📷 صورة مرفقة" : "🎬 فيديو مرفق"}
                              <ArrowUpRight className="size-3" aria-hidden />
                            </a>
                          )}
                          {message.videoUrl && (
                            <a href={message.videoUrl} target="_blank" rel="noreferrer" className="mt-1 block truncate text-[10px] text-sky-300/80" dir="ltr">
                              {message.videoUrl}
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="panel-soft p-4">
                  <h3 className="mb-3 inline-flex items-center gap-1.5 text-sm font-bold text-cream">
                    <Mail className="size-4 text-lemon/70" aria-hidden />
                    رسائل صفحة التواصل
                    <span className="text-[9px] font-normal text-cream/30">({detail.contactMessages.length})</span>
                  </h3>
                  {detail.contactMessages.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-[11px] text-cream/35">
                      مفيش رسائل من نموذج التواصل.
                    </p>
                  ) : (
                    <ul className="max-h-[420px] space-y-2 overflow-y-auto pe-1">
                      {detail.contactMessages.map((message) => (
                        <li key={message.id} className="rounded-xl border border-white/8 bg-white/[0.03] p-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[9px] font-bold text-cream/45">{message.goal || "استفسار"}</span>
                            <span className="text-[9px] text-cream/25">{formatDateTime(message.createdAt)}</span>
                          </div>
                          <p className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed text-cream/70">{message.body}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            )}

            {detailTab === "activity" && (
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-cream">سجل النشاط الكامل</h3>
                  <span className="text-[10px] text-cream/30">{detail.activity.length} حدث</span>
                </div>
                {detail.activity.length ? (
                  <ul className="space-y-2">
                    {detail.activity.map((item) => (
                      <ActivityRow key={item.id} item={item} />
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-xl border border-dashed border-white/10 px-4 py-10 text-center text-[11px] text-cream/35">
                    مفيش نشاط مسجل.
                  </p>
                )}
              </div>
            )}

            {detailTab === "files" && (
              <AssetManager
                ownerType="customer"
                ownerId={String(detail.customer.id)}
                hint="أي حاجة ترفعها هنا بتظهر للعميل وحده في تبويب «ملفاتي» جوه حسابه."
              />
            )}

            {detailTab === "settings" && (
            <div className="grid gap-5 lg:grid-cols-2">
              <form onSubmit={saveProfile} className="panel-soft space-y-3 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-cream">بيانات الحساب</h3>
                  <Badge tone={detail.customer.blocked ? "rose" : "lemon"}>
                    {detail.customer.blocked ? "موقوف" : "نشط"}
                  </Badge>
                </div>
                <AdminField label="الاسم">
                  <input className="field py-2 text-xs" value={editName} onChange={(event) => setEditName(event.target.value)} />
                </AdminField>
                <AdminField label="الإيميل">
                  <input className="field py-2 text-xs" value={editEmail} onChange={(event) => setEditEmail(event.target.value)} dir="ltr" />
                </AdminField>
                <AdminField label="الموبايل">
                  <input className="field py-2 text-xs" value={editPhone} onChange={(event) => setEditPhone(event.target.value)} dir="ltr" />
                </AdminField>
                <AdminField label="باسورد جديد" hint="اتركه فاضي لو مش هتغيّره.">
                  <input
                    type="password"
                    className="field py-2 text-xs"
                    value={editPassword}
                    onChange={(event) => setEditPassword(event.target.value)}
                    autoComplete="new-password"
                  />
                </AdminField>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-lemon py-2 text-[11px] font-bold text-ink disabled:opacity-60"
                  >
                    {savingProfile ? <Spinner className="text-ink" /> : <ShieldCheck className="size-3.5" aria-hidden />}
                    حفظ
                  </button>
                  <button
                    type="button"
                    onClick={toggleBlock}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-[11px] font-bold",
                      detail.customer.blocked
                        ? "border-lemon/30 bg-lemon/10 text-lemon"
                        : "border-red-400/30 bg-red-500/10 text-red-200"
                    )}
                  >
                    <Ban className="size-3.5" aria-hidden />
                    {detail.customer.blocked ? "تفعيل" : "إيقاف"}
                  </button>
                </div>
              </form>

              <form onSubmit={grant} className="panel-soft space-y-3 p-4">
                <h3 className="text-sm font-bold text-cream">إضافة اشتراك يدوي</h3>
                <AdminField label="الباقة">
                  <div className="relative">
                    <select className="field appearance-none py-2 pe-8 text-xs" value={grantProgram} onChange={(event) => setGrantProgram(event.target.value)}>
                      {t.programs.map((program) => (
                        <option key={program.contentId ?? program.id} value={program.contentId ?? program.id}>
                          {program.name} — {program.price} ج.م
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute end-3 top-1/2 size-3.5 -translate-y-1/2 text-cream/30" aria-hidden />
                  </div>
                </AdminField>
                <AdminField label="عدد الأيام (اختياري)" hint="لو فاضي هياخد مدة الباقة الافتراضية.">
                  <input
                    type="number"
                    min={1}
                    max={365}
                    className="field py-2 text-xs"
                    value={grantDays}
                    onChange={(event) => setGrantDays(event.target.value)}
                    placeholder="30"
                  />
                </AdminField>
                <button
                  type="submit"
                  disabled={granting || !grantProgram}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-lemon py-2 text-[11px] font-bold text-ink disabled:opacity-60"
                >
                  {granting ? <Spinner className="text-ink" /> : <Plus className="size-3.5" aria-hidden />}
                  تفعيل الاشتراك
                </button>
                <p className="text-[10px] leading-relaxed text-cream/30">
                  الاشتراك اليدوي بيضاف فورًا من غير دفعة، وبيتسجل في سجل العمليات.
                </p>
              </form>
            </div>
            )}

            {detailTab === "plans" && (
            <div>
              <h3 className="mb-2 text-sm font-bold text-cream">الاشتراكات ({detail.subscriptions.length})</h3>
              {detail.subscriptions.length === 0 ? (
                <p className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-[11px] text-cream/35">
                  مفيش اشتراكات.
                </p>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {detail.subscriptions.map((subscription) => (
                    <li key={subscription.id} className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-[11px] font-bold text-cream/85">{subscription.programName}</p>
                        <PaymentStatus status={subscription.status} />
                      </div>
                      <p className="mt-1 text-[10px] text-cream/35">
                        {formatDate(subscription.startsAt)} — {formatDate(subscription.endsAt)}
                      </p>
                      <p className="mt-1 text-[9px] text-cream/25">
                        {subscription.status === "active" && String(subscription.endsAt) > new Date().toISOString()
                          ? `نشطة · باقي ${Math.max(0, Math.ceil((new Date(subscription.endsAt).getTime() - Date.now()) / 86_400_000))} يوم`
                          : `مدة ${Math.max(1, Math.ceil((new Date(subscription.endsAt).getTime() - new Date(subscription.startsAt).getTime()) / 86_400_000))} يوم`}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            )}

            {detailTab === "payments" && (
            <div>
              <h3 className="mb-2 text-sm font-bold text-cream">المدفوعات ({detail.payments.length})</h3>
              {detail.payments.length === 0 ? (
                <p className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-[11px] text-cream/35">
                  مفيش مدفوعات.
                </p>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>الباقة</th>
                        <th>المبلغ</th>
                        <th>الطريقة</th>
                        <th>رقم العملية</th>
                        <th>الحالة</th>
                        <th>التاريخ</th>
                        <th>الإيصال</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.payments.map((payment: PaymentDTO) => (
                        <tr key={payment.id}>
                          <td>{payment.programName}</td>
                          <td>{formatEgp(payment.amount)}</td>
                          <td>{payment.method === "vodafone" ? "فودافون كاش" : "إنستاباي"}</td>
                          <td className="max-w-28 truncate text-[10px] text-cream/40" dir="ltr">{payment.reference || "—"}</td>
                          <td><PaymentStatus status={payment.status} /></td>
                          <td className="whitespace-nowrap text-[11px] text-cream/40">{formatDateTime(payment.createdAt)}</td>
                          <td>
                            {payment.hasScreenshot ? (
                              <a
                                href={`/api/payments/${payment.id}/screenshot`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded-full border border-lemon/25 px-2 py-1 text-[9px] font-bold text-lemon/80"
                              >
                                عرض <ArrowUpRight className="size-2.5" aria-hidden />
                              </a>
                            ) : (
                              <span className="text-[9px] text-cream/25">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            )}
          </div>
        )}
      </Modal>

      {/* Create customer */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="إضافة عميل جديد"
        description="هيتعمل حساب للعميل ويقدر يسجل دخول فورًا."
        footer={
          <>
            <button type="button" onClick={() => setCreateOpen(false)} className="rounded-full border border-white/15 px-4 py-2 text-[11px] font-bold text-cream/60">
              إلغاء
            </button>
            <button
              type="submit"
              form="create-customer-form"
              disabled={creating}
              className="inline-flex items-center gap-1.5 rounded-full bg-lemon px-4 py-2 text-[11px] font-bold text-ink disabled:opacity-60"
            >
              {creating ? <Spinner className="text-ink" /> : <Plus className="size-3.5" aria-hidden />}
              إنشاء الحساب
            </button>
          </>
        }
      >
        <form id="create-customer-form" onSubmit={create} className="space-y-3">
          <AdminField label="الاسم الكامل">
            <input className="field py-2 text-xs" value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="اسم العميل" />
          </AdminField>
          <AdminField label="الإيميل">
            <div className="relative">
              <Mail className="pointer-events-none absolute start-3 top-1/2 size-3.5 -translate-y-1/2 text-cream/30" aria-hidden />
              <input className="field py-2 ps-9 text-xs" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} dir="ltr" placeholder="name@email.com" />
            </div>
          </AdminField>
          <AdminField label="الموبايل">
            <div className="relative">
              <Phone className="pointer-events-none absolute start-3 top-1/2 size-3.5 -translate-y-1/2 text-cream/30" aria-hidden />
              <input className="field py-2 ps-9 text-xs" value={newPhone} onChange={(event) => setNewPhone(event.target.value)} dir="ltr" placeholder="01xxxxxxxxx" />
            </div>
          </AdminField>
          <AdminField label="الباسورد" hint="8 حروف على الأقل — قوله للعميل.">
            <input
              type="password"
              className="field py-2 text-xs"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
            />
          </AdminField>
        </form>
      </Modal>
    </AdminPage>
  );
}
