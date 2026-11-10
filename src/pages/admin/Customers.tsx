import {
  Ban,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Mail,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { AdminCustomer, CustomerDetail, PaymentDTO } from "../../../shared/types";
import { Spinner } from "../../components/ui/Spinner";
import { useToast } from "../../components/ui/Toast";
import { api, formatDate, formatDateTime, formatEgp } from "../../lib/api";
import { useLang } from "../../lib/i18n";
import { cn } from "../../lib/utils";
import { AdminField, AdminPage, Badge, EmptyState, Modal, PaymentStatus } from "./components";

export default function AdminCustomers() {
  const toast = useToast();
  const { t } = useLang();
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
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
    async (id: number) => {
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
    if (detail) await openDetail(detail.customer.id);
  }, [detail, load, openDetail, query]);

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
                {customers.map((customer) => (
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
                { label: "الاشتراكات النشطة", value: String(detail.customer.activeSubscriptions), icon: CheckCircle2 },
                { label: "إجمالي المدفوع", value: formatEgp(detail.customer.spent), icon: Wallet },
                { label: "آخر انتهاء", value: detail.customer.endsAt ? formatDate(detail.customer.endsAt) : "—", icon: CalendarClock },
                { label: "عضو من", value: formatDate(detail.customer.createdAt), icon: UserRound },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
                  <item.icon className="size-4 text-lemon/70" aria-hidden />
                  <p className="mt-1.5 text-[9px] text-cream/35">{item.label}</p>
                  <p className="mt-0.5 truncate text-[11px] font-bold text-cream/85">{item.value}</p>
                </div>
              ))}
            </div>

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
                    </li>
                  ))}
                </ul>
              )}
            </div>

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
                        <th>الحالة</th>
                        <th>التاريخ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.payments.map((payment: PaymentDTO) => (
                        <tr key={payment.id}>
                          <td>{payment.programName}</td>
                          <td>{formatEgp(payment.amount)}</td>
                          <td>{payment.method === "vodafone" ? "فودافون كاش" : "إنستاباي"}</td>
                          <td><PaymentStatus status={payment.status} /></td>
                          <td className="whitespace-nowrap text-[11px] text-cream/40">{formatDateTime(payment.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
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
