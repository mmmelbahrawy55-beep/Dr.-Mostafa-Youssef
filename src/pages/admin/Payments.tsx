import { CheckCircle2, CreditCard, Download, ImageIcon, ReceiptText, Search, ShieldAlert, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { PaymentDTO } from "../../../shared/types";
import { Spinner } from "../../components/ui/Spinner";
import { useToast } from "../../components/ui/Toast";
import { api, formatDateTime, formatEgp } from "../../lib/api";
import { cn } from "../../lib/utils";
import { AdminField, AdminPage, Badge, EmptyState, Modal, PaymentStatus } from "./components";

const FILTERS = [
  { key: "", label: "الكل" },
  { key: "pending", label: "قيد المراجعة" },
  { key: "auto_approved", label: "تلقائي" },
  { key: "approved", label: "مقبول" },
  { key: "rejected", label: "مرفوض" },
];

export default function AdminPayments() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "";
  const [payments, setPayments] = useState<PaymentDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<PaymentDTO | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ payments: PaymentDTO[] }>("/api/admin/payments");
      setPayments(data.payments);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "تعذر تحميل المدفوعات.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return payments.filter((item) => {
      if (status && item.status !== status) return false;
      if (!q) return true;
      return [item.userName, item.userEmail, item.userPhone, item.programName, item.reference, item.sender]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
  }, [payments, query, status]);

  const counts = useMemo(() => {
    const result: Record<string, number> = {};
    for (const item of payments) result[item.status] = (result[item.status] ?? 0) + 1;
    return result;
  }, [payments]);

  const open = (payment: PaymentDTO) => {
    setSelected(payment);
    setNote(payment.note ?? "");
  };

  const decide = async (action: "approve" | "reject") => {
    if (!selected) return;
    setBusy(true);
    try {
      const result = await api<{ status: string; subscriptionId: number | null }>(
        `/api/admin/payments/${selected.id}/decision`,
        { method: "POST", body: { action, note: note.trim() } }
      );
      toast.success(
        action === "approve"
          ? result.subscriptionId
            ? "تم قبول الدفعة وتفعيل الاشتراك."
            : "تم قبول الدفعة."
          : "تم رفض الدفعة."
      );
      setSelected(null);
      await load();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "تعذر تنفيذ الإجراء.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminPage
      kicker="المدفوعات"
      title="مراجعة التحويلات"
      text="راجع الإيصالات، أكّد المبلغ ورقم العملية، وقرر التفعيل أو الرفض. كل إجراء بيتسجل في سجل العمليات."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-[10px] text-cream/45">
            <CreditCard className="size-3.5 text-lemon/60" aria-hidden />
            {filtered.length} دفعة
          </span>
          <a
            href="/api/admin/export/payments.csv"
            className="inline-flex items-center gap-1.5 rounded-full border border-lemon/30 bg-lemon/10 px-3 py-1.5 text-[10px] font-bold text-lemon transition-colors hover:bg-lemon/15"
          >
            <Download className="size-3.5" aria-hidden />
            تصدير CSV
          </a>
        </div>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => {
                if (filter.key) setParams({ status: filter.key });
                else setParams({});
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-bold transition-colors",
                status === filter.key
                  ? "border-lemon bg-lemon text-ink"
                  : "border-white/10 bg-white/[0.02] text-cream/55 hover:border-lemon/40 hover:text-cream"
              )}
            >
              {filter.label}
              {filter.key && counts[filter.key] > 0 && (
                <span className={cn("rounded-full px-1.5 text-[9px]", status === filter.key ? "bg-ink/15" : "bg-white/10")}>
                  {counts[filter.key]}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-3.5 -translate-y-1/2 text-cream/30" aria-hidden />
          <input
            className="field py-2 ps-9 text-xs"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ابحث بالاسم أو رقم العملية…"
          />
        </div>
      </div>

      <div className="panel mt-4 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner className="size-7 text-lemon" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={ReceiptText}
            title="مفيش مدفوعات هنا"
            text={status ? "جرب فلتر تاني أو عرض الكل." : "أول ما عميل يرفع إيصال هيظهر في القائمة."}
          />
        ) : (
          <div className="table-wrap border-0">
            <table>
              <thead>
                <tr>
                  <th>العميل</th>
                  <th>الباقة</th>
                  <th>المبلغ</th>
                  <th>الطريقة</th>
                  <th>رقم العملية</th>
                  <th>الحالة</th>
                  <th>التاريخ</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((payment) => (
                  <tr key={payment.id} className="cursor-pointer" onClick={() => open(payment)}>
                    <td>
                      <p className="font-semibold text-cream/85">{payment.userName}</p>
                      <p className="text-[10px] text-cream/35" dir="ltr">{payment.userPhone || payment.userEmail}</p>
                    </td>
                    <td>
                      <p>{payment.programName}</p>
                      <p className="text-[10px] text-cream/30">{payment.days} يوم</p>
                    </td>
                    <td className="font-semibold text-cream/90">{formatEgp(payment.amount)}</td>
                    <td>
                      <Badge tone={payment.method === "vodafone" ? "rose" : "violet"}>
                        {payment.method === "vodafone" ? "فودافون كاش" : "إنستاباي"}
                      </Badge>
                    </td>
                    <td className="max-w-32 truncate font-latin text-[11px] text-cream/55" dir="ltr">{payment.reference}</td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <PaymentStatus status={payment.status} />
                        {payment.risk.length > 0 && (
                          <span title={payment.risk.join("\n")} className="text-amber-300">
                            <ShieldAlert className="size-3.5" aria-hidden />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap text-[11px] text-cream/40">{formatDateTime(payment.createdAt)}</td>
                    <td>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-lemon">
                        <ImageIcon className="size-3" aria-hidden />
                        إيصال
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected ? `دفعة #${selected.id} — ${selected.programName}` : "دفعة"}
        description={selected ? `${selected.userName} · ${selected.userEmail}` : undefined}
        size="xl"
        footer={
          selected && selected.status !== "approved" && selected.status !== "auto_approved" ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => decide("reject")}
                className="inline-flex items-center gap-1.5 rounded-full border border-red-400/30 bg-red-500/10 px-4 py-2 text-[11px] font-bold text-red-200 disabled:opacity-50"
              >
                <XCircle className="size-3.5" aria-hidden />
                رفض
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => decide("approve")}
                className="inline-flex items-center gap-1.5 rounded-full bg-lemon px-4 py-2 text-[11px] font-bold text-ink disabled:opacity-50"
              >
                {busy ? <Spinner className="text-ink" /> : <CheckCircle2 className="size-3.5" aria-hidden />}
                قبول وتفعيل
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="rounded-full border border-white/15 px-4 py-2 text-[11px] font-bold text-cream/60"
            >
              إغلاق
            </button>
          )
        }
      >
        {selected && (
          <div className="grid gap-5 md:grid-cols-[1fr_1fr]">
            <div>
              <div className="overflow-hidden rounded-xl border border-white/10 bg-ink">
                <img
                  src={`/api/payments/${selected.id}/screenshot`}
                  alt="إيصال التحويل"
                  className="max-h-[52vh] w-full object-contain"
                />
              </div>
              <p className="mt-2 text-center text-[10px] text-cream/30">
                {selected.screenshotWidth && selected.screenshotHeight
                  ? `${selected.screenshotWidth}×${selected.screenshotHeight}px`
                  : "أبعاد الصورة غير متاحة"}{" "}
                · الإيصال محفوظ بأمان
              </p>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "المبلغ", value: formatEgp(selected.amount) },
                  { label: "المدة", value: `${selected.days} يوم` },
                  { label: "الطريقة", value: selected.method === "vodafone" ? "فودافون كاش" : "إنستاباي" },
                  { label: "التاريخ", value: formatDateTime(selected.createdAt) },
                  { label: "المُحوّل منه", value: selected.sender },
                  { label: "رقم العملية", value: selected.reference },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg border border-white/8 bg-white/[0.02] px-2.5 py-2">
                    <p className="text-[9px] text-cream/30">{item.label}</p>
                    <p className="mt-0.5 truncate text-[11px] font-semibold text-cream/80" dir="auto">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2.5">
                <p className="text-[9px] text-cream/30">حالة التحقق</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <PaymentStatus status={selected.status} />
                  {selected.risk.length === 0 ? (
                    <span className="text-[10px] text-lemon/80">كل الفحوصات سليمة</span>
                  ) : (
                    <span className="text-[10px] text-amber-200">{selected.risk.length} ملاحظة</span>
                  )}
                </div>
                {selected.risk.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {selected.risk.map((reason) => (
                      <li key={reason} className="flex items-start gap-1.5 text-[10px] leading-relaxed text-cream/50">
                        <span className="mt-1.5 size-1 shrink-0 rounded-full bg-amber-300" aria-hidden />
                        {reason}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <AdminField label="ملاحظة للعميل (اختياري)" hint="بتظهر للعميل في صفحة المدفوعات بحسابه.">
                <textarea
                  className="field min-h-20 resize-y text-xs"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="مثال: تم التحقق من التحويل وتفعيل الباقة."
                />
              </AdminField>
            </div>
          </div>
        )}
      </Modal>
    </AdminPage>
  );
}
