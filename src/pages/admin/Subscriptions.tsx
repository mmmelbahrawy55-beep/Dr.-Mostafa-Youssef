import { CalendarClock, CheckCircle2, ClipboardList, Plus, UserRound, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { AdminCustomer, SubscriptionDTO } from "../../../shared/types";
import { Spinner } from "../../components/ui/Spinner";
import { useToast } from "../../components/ui/Toast";
import { api, daysBetween, formatDate } from "../../lib/api";
import { useLang } from "../../lib/i18n";
import { cn } from "../../lib/utils";
import { AdminField, AdminPage, Badge, EmptyState, Modal, PaymentStatus } from "./components";

const FILTERS = [
  { key: "", label: "الكل" },
  { key: "active", label: "نشط" },
  { key: "expired", label: "منتهي" },
  { key: "cancelled", label: "ملغي" },
];

export default function AdminSubscriptions() {
  const toast = useToast();
  const { t } = useLang();
  const [items, setItems] = useState<SubscriptionDTO[]>([]);
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState("");
  const [programId, setProgramId] = useState("");
  const [days, setDays] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [subscriptions, customerList] = await Promise.all([
        api<{ subscriptions: SubscriptionDTO[] }>("/api/admin/subscriptions"),
        api<{ customers: AdminCustomer[] }>("/api/admin/customers"),
      ]);
      setItems(subscriptions.subscriptions);
      setCustomers(customerList.customers);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "تعذر تحميل الاشتراكات.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => (filter ? items.filter((item) => item.status === filter) : items), [items, filter]);
  const activeCount = items.filter((item) => item.status === "active" && new Date(item.endsAt).getTime() > Date.now()).length;
  const expiring = items.filter((item) => {
    if (item.status !== "active") return false;
    const left = daysBetween(new Date(), item.endsAt);
    return new Date(item.endsAt).getTime() > Date.now() && left <= 7;
  }).length;

  const openGrant = () => {
    setOpen(true);
    setUserId(customers[0] ? String(customers[0].id) : "");
    setProgramId(t.programs[0]?.contentId ?? "");
    setDays("");
  };

  const grant = async (event: FormEvent) => {
    event.preventDefault();
    if (!userId) return toast.error("اختار العميل.");
    if (!programId) return toast.error("اختار الباقة.");
    setBusy(true);
    try {
      await api("/api/admin/subscriptions", {
        method: "POST",
        body: { userId: Number(userId), programId, days: days ? Number(days) : undefined },
      });
      toast.success("تم تفعيل الاشتراك بنجاح.");
      setOpen(false);
      await load();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "تعذر تفعيل الاشتراك.");
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (id: number, status: "active" | "cancelled" | "expired") => {
    try {
      await api(`/api/admin/subscriptions/${id}/status`, { method: "POST", body: { status } });
      toast.success("تم تحديث حالة الاشتراك.");
      await load();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "تعذر تحديث الحالة.");
    }
  };

  return (
    <AdminPage
      kicker="الاشتراكات"
      title="إدارة الباقات المشترك فيها"
      text="تابع كل الاشتراكات، راجع تواريخ الانتهاء، وأضف اشتراك يدوي لأي عميل."
      actions={
        <button
          type="button"
          onClick={openGrant}
          className="inline-flex items-center gap-1.5 rounded-full bg-lemon px-4 py-2 text-[11px] font-bold text-ink transition-transform hover:-translate-y-0.5"
        >
          <Plus className="size-3.5" aria-hidden />
          إضافة اشتراك
        </button>
      }
    >
      <div className="grid grid-cols-3 gap-3">
        <div className="panel-soft p-3.5">
          <p className="text-[10px] text-cream/40">إجمالي الاشتراكات</p>
          <p className="mt-1 font-display text-lg font-bold text-cream">{items.length}</p>
        </div>
        <div className="panel-soft p-3.5">
          <p className="text-[10px] text-cream/40">نشطة دلوقتي</p>
          <p className="mt-1 font-display text-lg font-bold text-lemon">{activeCount}</p>
        </div>
        <div className="panel-soft p-3.5">
          <p className="text-[10px] text-cream/40">تنتهي خلال 7 أيام</p>
          <p className="mt-1 font-display text-lg font-bold text-amber-200">{expiring}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setFilter(item.key)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-[10px] font-bold transition-colors",
              filter === item.key
                ? "border-lemon bg-lemon text-ink"
                : "border-white/10 bg-white/[0.02] text-cream/55 hover:border-lemon/40"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="panel mt-3 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner className="size-7 text-lemon" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={ClipboardList} title="مفيش اشتراكات" text="الاشتراكات بتتضاف تلقائيًا بعد قبول الدفع أو يدويًا." />
        ) : (
          <div className="table-wrap border-0">
            <table>
              <thead>
                <tr>
                  <th>العميل</th>
                  <th>الباقة</th>
                  <th>البداية</th>
                  <th>النهاية</th>
                  <th>الحالة</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const left = daysBetween(new Date(), item.endsAt);
                  const isActive = item.status === "active" && new Date(item.endsAt).getTime() > Date.now();
                  return (
                    <tr key={item.id}>
                      <td>
                        <p className="font-semibold text-cream/85">{item.userName}</p>
                        <p className="text-[10px] text-cream/35" dir="ltr">{item.userEmail}</p>
                      </td>
                      <td>{item.programName}</td>
                      <td className="whitespace-nowrap text-[11px] text-cream/45">{formatDate(item.startsAt)}</td>
                      <td className="whitespace-nowrap text-[11px]">
                        <span className="text-cream/65">{formatDate(item.endsAt)}</span>
                        {isActive && (
                          <span className={cn("ms-1.5", left <= 7 ? "text-amber-200" : "text-cream/30")}>
                            ({left} يوم)
                          </span>
                        )}
                      </td>
                      <td><PaymentStatus status={item.status} /></td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {item.status !== "active" && (
                            <button
                              type="button"
                              onClick={() => setStatus(item.id, "active")}
                              className="inline-flex items-center gap-1 rounded-full border border-lemon/25 bg-lemon/5 px-2 py-1 text-[9px] font-bold text-lemon"
                            >
                              <CheckCircle2 className="size-3" aria-hidden />
                              تفعيل
                            </button>
                          )}
                          {item.status === "active" && (
                            <button
                              type="button"
                              onClick={() => setStatus(item.id, "cancelled")}
                              className="inline-flex items-center gap-1 rounded-full border border-red-400/25 bg-red-500/5 px-2 py-1 text-[9px] font-bold text-red-200"
                            >
                              <XCircle className="size-3" aria-hidden />
                              إلغاء
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setStatus(item.id, "expired")}
                            className="inline-flex items-center gap-1 rounded-full border border-white/12 px-2 py-1 text-[9px] font-bold text-cream/45"
                          >
                            <CalendarClock className="size-3" aria-hidden />
                            إنهاء
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="إضافة اشتراك يدوي"
        description="الاشتراك بيتفعّل فورًا وبيتسجل في سجل العمليات."
        footer={
          <>
            <button type="button" onClick={() => setOpen(false)} className="rounded-full border border-white/15 px-4 py-2 text-[11px] font-bold text-cream/60">
              إلغاء
            </button>
            <button
              type="submit"
              form="grant-form"
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-full bg-lemon px-4 py-2 text-[11px] font-bold text-ink disabled:opacity-60"
            >
              {busy ? <Spinner className="text-ink" /> : <Plus className="size-3.5" aria-hidden />}
              تفعيل
            </button>
          </>
        }
      >
        <form id="grant-form" onSubmit={grant} className="space-y-3">
          <AdminField label="العميل">
            <select className="field py-2 text-xs" value={userId} onChange={(event) => setUserId(event.target.value)}>
              <option value="">اختار العميل…</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name} — {customer.email}
                </option>
              ))}
            </select>
          </AdminField>
          <AdminField label="الباقة">
            <select className="field py-2 text-xs" value={programId} onChange={(event) => setProgramId(event.target.value)}>
              {t.programs.map((program) => (
                <option key={program.contentId ?? program.id} value={program.contentId ?? program.id}>
                  {program.name} — {program.price} ج.م
                </option>
              ))}
            </select>
          </AdminField>
          <AdminField label="عدد الأيام (اختياري)" hint="لو فاضي هياخد مدة الباقة الافتراضية.">
            <input
              type="number"
              min={1}
              max={365}
              className="field py-2 text-xs"
              value={days}
              onChange={(event) => setDays(event.target.value)}
              placeholder="30"
            />
          </AdminField>
          {customers.length === 0 && (
            <p className="flex items-center gap-1.5 rounded-lg border border-amber-400/25 bg-amber-400/5 px-3 py-2 text-[10px] text-amber-200">
              <UserRound className="size-3.5" aria-hidden />
              مفيش عملاء بعد — أضف عميل الأول من صفحة العملاء.
            </p>
          )}
          <div className="flex items-center gap-1.5 text-[10px] text-cream/30">
            <Badge tone="lemon">ملاحظة</Badge>
            الاشتراك اليدوي مش مرتبط بدفعة.
          </div>
        </form>
      </Modal>
    </AdminPage>
  );
}
