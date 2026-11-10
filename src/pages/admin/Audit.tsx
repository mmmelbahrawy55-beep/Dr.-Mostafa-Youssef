import { ChevronDown, Search, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Spinner } from "../../components/ui/Spinner";
import { useToast } from "../../components/ui/Toast";
import { api, formatDateTime, formatEgp } from "../../lib/api";
import { useSiteData } from "../../lib/site-data";
import { cn } from "../../lib/utils";
import { AdminPage, Badge, EmptyState } from "./components";

interface AuditEntry {
  id: number;
  actorName: string;
  action: string;
  entity: string;
  entityId: string;
  meta: Record<string, unknown>;
  createdAt: string;
}

type Tone = "lemon" | "amber" | "rose" | "sky" | "neutral" | "violet";

/**
 * Every action the server can write to the log, with the Arabic label shown in
 * the table and a plain-language explanation of what that action actually is.
 */
const ACTIONS: Record<string, { label: string; tone: Tone; what: string }> = {
  "payment.submitted": {
    label: "رفع إيصال دفع",
    tone: "sky",
    what: "عميل رفع صورة إشعار تحويل (فودافون كاش أو إنستاباي) وطلب اشتراك. بيتسجل المبلغ وطريقة الدفع والباقة ونتيجة الفحص التلقائي.",
  },
  "payment.auto_approved": {
    label: "تفعيل تلقائي لدفعة",
    tone: "lemon",
    what: "الإيصال اتحقق لوحده (المبلغ وطريقة الدفع مطابقين) فاتفعّل الاشتراك أوتوماتيك من غير مراجعة.",
  },
  "payment.approve": { label: "قبول دفعة", tone: "lemon", what: "المشرف راجع الإيصال ووافق يدويًا فاتفعّل الاشتراك." },
  "payment.reject": { label: "رفض دفعة", tone: "rose", what: "المشرف رفض الإيصال: المبلغ غلط أو الصورة مش واضحة أو البيانات مش متطابقة." },
  "customer.create": { label: "إضافة عميل", tone: "sky", what: "حساب عميل جديد اتعمل (من التسجيل أو بإضافة يدوية من اللوحة)." },
  "customer.update": { label: "تعديل عميل", tone: "amber", what: "بيانات عميل اتغيرت: الاسم أو الموبايل أو الإيميل أو الباسورد." },
  "subscription.grant": { label: "تفعيل اشتراك يدوي", tone: "lemon", what: "المشرف فعّل باقة لعميل من غير دفع (إهداء أو استثناء)." },
  "subscription.status": { label: "تغيير حالة اشتراك", tone: "amber", what: "حالة اشتراك اتغيرت: نشط، ملغي، أو منتهي." },
  "message.delete": { label: "حذف رسالة", tone: "rose", what: "رسالة تواصل من الموقع اتمسحت من صندوق الرسائل." },
  "content.create": { label: "إضافة محتوى", tone: "sky", what: "عنصر جديد اتضاف للموقع: باقة، خدمة، مقال، سؤال، رأي، أو شهادة." },
  "content.update": { label: "تعديل محتوى", tone: "amber", what: "عنصر موجود اتعدّل نصّه أو صورته أو سعره أو ظهوره." },
  "content.delete": { label: "حذف محتوى", tone: "rose", what: "عنصر اتمسح نهائيًا من الموقع." },
  "settings.update": { label: "تحديث إعدادات الموقع", tone: "amber", what: "بيانات التواصل أو محفظة الدفع أو صورة الهيرو أو إعدادات التفعيل اتغيّرت." },
  "copy.update": { label: "تحديث نصوص الموقع", tone: "amber", what: "نصوص الواجهة (عربي/إنجليزي) اتعدّلت من صفحة نصوص الموقع." },
  "media.upload": { label: "رفع صورة", tone: "sky", what: "صورة جديدة اترفعت لمكتبة الصور." },
  "media.delete": { label: "حذف صورة", tone: "rose", what: "صورة اتمسحت من مكتبة الصور ومن التخزين." },
  "export.payments": { label: "تصدير المدفوعات", tone: "violet", what: "تنزيل ملف CSV بكل المدفوعات." },
  "export.customers": { label: "تصدير العملاء", tone: "violet", what: "تنزيل ملف CSV بكل العملاء." },
  "export.subscriptions": { label: "تصدير الاشتراكات", tone: "violet", what: "تنزيل ملف CSV بكل الاشتراكات." },
};

const ENTITIES: Record<string, string> = {
  payment: "دفعة",
  user: "عميل",
  subscription: "اشتراك",
  message: "رسالة",
  settings: "إعدادات",
  media: "صورة",
  programs: "قسم: الباقات",
  services: "قسم: الخدمات",
  testimonials: "قسم: آراء العملاء",
  results: "قسم: النتائج",
  posts: "قسم: المقالات",
  faqs: "قسم: الأسئلة",
  credentials: "قسم: الشهادات",
  copy: "نصوص الواجهة",
  payments: "ملف CSV: المدفوعات",
  users: "ملف CSV: العملاء",
  subscriptions: "ملف CSV: الاشتراكات",
};

const METHODS: Record<string, string> = { vodafone: "فودافون كاش", instapay: "إنستاباي" };
const STATUSES: Record<string, string> = { active: "نشط", cancelled: "ملغي", expired: "منتهي" };
const FIELDS: Record<string, string> = {
  name: "الاسم",
  phone: "الموبايل",
  email: "الإيميل",
  password: "الباسورد",
};

function metaSummary(meta: Record<string, unknown>) {
  const entries = Object.entries(meta ?? {}).filter(([, value]) => value !== null && value !== "");
  if (entries.length === 0) return "—";
  return entries
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.length : typeof value === "object" ? "…" : String(value)}`)
    .join(" · ");
}

export default function AdminAudit() {
  const toast = useToast();
  const { data: site } = useSiteData();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await api<{ entries: AuditEntry[] }>("/api/admin/audit");
        if (active) setEntries(data.entries);
      } catch (cause) {
        toast.error(cause instanceof Error ? cause.message : "تعذر تحميل سجل العمليات.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [toast]);

  const programName = (id: unknown) => {
    const key = String(id ?? "");
    const found = site?.programs.find((program) => program.id === key);
    const name = found ? (found.ar.name ?? found.en.name) : "";
    return name ? String(name) : key;
  };

  /** Turns the raw meta object into one readable Arabic sentence. */
  const describe = (entry: AuditEntry) => {
    const meta = entry.meta ?? {};
    switch (entry.action) {
      case "payment.submitted":
      case "payment.auto_approved": {
        const parts: string[] = [];
        if (meta.amount) parts.push(formatEgp(Number(meta.amount)));
        if (meta.method) parts.push(METHODS[String(meta.method)] ?? String(meta.method));
        if (meta.program) parts.push(`الباقة: ${programName(meta.program)}`);
        if (Array.isArray(meta.risk) && meta.risk.length) parts.push(`فحص تلقائي: ${meta.risk.join("، ")}`);
        return parts.join(" · ") || "—";
      }
      case "payment.approve":
      case "payment.reject":
        return meta.note ? `ملاحظة: ${meta.note}` : "بدون ملاحظة";
      case "customer.create":
        return meta.email ? `الإيميل: ${meta.email}` : "—";
      case "customer.update": {
        const fields = Array.isArray(meta.fields) ? meta.fields : [];
        return fields.length ? `الحقول: ${fields.map((field) => FIELDS[String(field)] ?? String(field)).join("، ")}` : "بدون تغيير";
      }
      case "subscription.grant": {
        const parts: string[] = [];
        if (meta.userId) parts.push(`العميل #${meta.userId}`);
        if (meta.programId) parts.push(`الباقة: ${programName(meta.programId)}`);
        if (meta.days) parts.push(`${meta.days} يوم`);
        return parts.join(" · ") || "—";
      }
      case "subscription.status":
        return meta.status ? `الحالة: ${STATUSES[String(meta.status)] ?? String(meta.status)}` : "—";
      case "media.upload":
      case "media.delete":
        return meta.url ? String(meta.url) : "—";
      case "message.delete":
        return [meta.name, meta.email].filter(Boolean).join(" · ") || "—";
      case "content.create":
      case "content.update":
      case "content.delete":
        return entry.entityId ? `رقم العنصر #${entry.entityId}` : "—";
      case "export.payments":
      case "export.customers":
      case "export.subscriptions":
        return `عدد الصفوف: ${entry.entityId}`;
      case "settings.update":
      case "copy.update":
        return "—";
      default:
        return metaSummary(meta);
    }
  };

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of entries) map.set(entry.action, (map.get(entry.action) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [entries]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (actionFilter !== "all" && entry.action !== actionFilter) return false;
      if (!q) return true;
      return [entry.actorName, entry.action, entry.entity, entry.entityId, ACTIONS[entry.action]?.label, describe(entry)]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
    // describe() only depends on entries + site data, both already tracked here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, query, actionFilter, site]);

  const remove = async (id: number) => {
    if (confirmId !== id) {
      setConfirmId(id);
      return;
    }
    try {
      await api(`/api/admin/audit/${id}`, { method: "DELETE" });
      setEntries((prev) => prev.filter((entry) => entry.id !== id));
      setConfirmId(null);
      toast.success("تم حذف العملية من السجل.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "تعذر حذف العملية.");
    }
  };

  const clearAll = async () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    setBusy(true);
    try {
      const result = await api<{ removed: number }>("/api/admin/audit?confirm=1", { method: "DELETE" });
      setEntries([]);
      setConfirmClear(false);
      toast.success(`تم مسح ${result.removed} عملية من السجل.`);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "تعذر مسح السجل.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminPage
      kicker="السجل"
      title="سجل العمليات"
      text="كل إجراء مهم على النظام بيتسجل هنا: مين فعّل دفعة، مين عدّل محتوى، وإمتى. كل صف بيشرح نفسه بالعربي، وتقدر تحذف أي عملية أو تمسح السجل كله."
      actions={
        <>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-[10px] text-cream/45">
            <ShieldCheck className="size-3.5 text-lemon/60" aria-hidden />
            {entries.length >= 200 ? "آخر 200 عملية" : `${entries.length} عملية`}
          </span>
          <button
            type="button"
            onClick={() => void clearAll()}
            disabled={busy || entries.length === 0}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-[11px] font-bold transition-colors disabled:opacity-50",
              confirmClear
                ? "border-red-400/50 bg-red-500/15 text-red-100"
                : "border-white/10 text-cream/55 hover:border-red-400/40 hover:text-red-200"
            )}
          >
            <Trash2 className="size-3.5" aria-hidden />
            {confirmClear ? "اضغط تاني لتأكيد المسح" : "مسح السجل كله"}
          </button>
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-3.5 -translate-y-1/2 text-cream/30" aria-hidden />
          <input
            className="field py-2 ps-9 text-xs"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ابحث في السجل…"
          />
        </div>
        <select className="field w-auto py-2 text-xs" value={actionFilter} onChange={(event) => setActionFilter(event.target.value)}>
          <option value="all">كل الإجراءات</option>
          {Object.entries(ACTIONS).map(([key, meta]) => (
            <option key={key} value={key}>
              {meta.label}
            </option>
          ))}
        </select>
      </div>

      {counts.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {counts.map(([action, count]) => (
            <button
              key={action}
              type="button"
              onClick={() => setActionFilter((current) => (current === action ? "all" : action))}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-bold transition-colors",
                actionFilter === action
                  ? "border-lemon/40 bg-lemon/10 text-lemon"
                  : "border-white/10 text-cream/45 hover:border-lemon/30 hover:text-cream/70"
              )}
            >
              {ACTIONS[action]?.label ?? action}
              <span className="text-cream/35">{count}</span>
            </button>
          ))}
        </div>
      )}

      <div className="panel mt-4 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner className="size-7 text-lemon" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title={entries.length === 0 ? "السجل فاضي" : "مفيش نتائج للبحث"}
            text={entries.length === 0 ? "أول إجراء على الموقع هيظهر هنا." : "غيّر كلمة البحث أو فلتر الإجراء."}
          />
        ) : (
          <div className="table-wrap border-0">
            <table>
              <thead>
                <tr>
                  <th>الإجراء</th>
                  <th>بواسطة</th>
                  <th>العنصر</th>
                  <th>التفاصيل</th>
                  <th>التاريخ</th>
                  <th aria-label="حذف" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => {
                  const meta = ACTIONS[entry.action] ?? { label: entry.action, tone: "neutral" as const, what: "" };
                  return (
                    <tr key={entry.id}>
                      <td>
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                      </td>
                      <td className="text-cream/70">{entry.actorName || "النظام"}</td>
                      <td>
                        <span className="text-[11px] text-cream/50">
                          {ENTITIES[entry.entity] ?? entry.entity}
                          {entry.entityId && !ENTITIES[entry.entity]?.startsWith("ملف CSV") ? ` #${entry.entityId}` : ""}
                        </span>
                      </td>
                      <td className="max-w-md">
                        <span className="line-clamp-2 text-[11px] text-cream/55" title={JSON.stringify(entry.meta)}>
                          {describe(entry)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap text-[11px] text-cream/40">{formatDateTime(entry.createdAt)}</td>
                      <td className="text-end">
                        <button
                          type="button"
                          onClick={() => void remove(entry.id)}
                          className={cn(
                            "inline-flex items-center justify-center gap-1 rounded-lg border px-2 py-1 text-[9px] font-bold",
                            confirmId === entry.id
                              ? "border-red-400/50 bg-red-500/15 text-red-100"
                              : "border-white/10 text-cream/40 hover:border-red-400/40 hover:text-red-200"
                          )}
                          aria-label="حذف العملية"
                        >
                          <Trash2 className="size-3" aria-hidden />
                          {confirmId === entry.id ? "تأكيد" : "حذف"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <details className="panel mt-4 group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[11px] font-bold text-cream/70">
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="size-3.5 text-lemon/70" aria-hidden />
            إيه اللي بيتسجل في السجل؟ ({Object.keys(ACTIONS).length} نوع إجراء)
          </span>
          <ChevronDown className="size-4 text-cream/40 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="grid gap-3 border-t border-white/10 p-4 sm:grid-cols-2">
          {Object.entries(ACTIONS).map(([key, meta]) => (
            <div key={key} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <div className="flex items-center gap-2">
                <Badge tone={meta.tone}>{meta.label}</Badge>
                <code className="font-latin text-[9px] text-cream/30" dir="ltr">
                  {key}
                </code>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-cream/50">{meta.what}</p>
            </div>
          ))}
        </div>
      </details>
    </AdminPage>
  );
}
