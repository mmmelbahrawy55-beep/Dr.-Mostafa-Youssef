import { Eye, ExternalLink, Search, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Spinner } from "../../components/ui/Spinner";
import { useToast } from "../../components/ui/Toast";
import { api, formatDateTime, formatEgp } from "../../lib/api";
import { useSiteData } from "../../lib/site-data";
import { cn } from "../../lib/utils";
import { AdminPage, Badge, EmptyState, Modal } from "./components";

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
 * the table. The plain-language story of each entry is built by narrate().
 */
const ACTIONS: Record<string, { label: string; tone: Tone }> = {
  "payment.submitted": { label: "رفع إيصال دفع", tone: "sky" },
  "payment.auto_approved": { label: "تفعيل تلقائي لدفعة", tone: "lemon" },
  "payment.approve": { label: "قبول دفعة", tone: "lemon" },
  "payment.reject": { label: "رفض دفعة", tone: "rose" },
  "customer.create": { label: "إضافة عميل", tone: "sky" },
  "customer.update": { label: "تعديل عميل", tone: "amber" },
  "subscription.grant": { label: "تفعيل اشتراك يدوي", tone: "lemon" },
  "subscription.status": { label: "تغيير حالة اشتراك", tone: "amber" },
  "message.delete": { label: "حذف رسالة", tone: "rose" },
  "content.create": { label: "إضافة محتوى", tone: "sky" },
  "content.update": { label: "تعديل محتوى", tone: "amber" },
  "content.delete": { label: "حذف محتوى", tone: "rose" },
  "settings.update": { label: "تحديث إعدادات الموقع", tone: "amber" },
  "copy.update": { label: "تحديث نصوص الموقع", tone: "amber" },
  "media.upload": { label: "رفع صورة", tone: "sky" },
  "media.delete": { label: "حذف صورة", tone: "rose" },
  "auth.login": { label: "دخول الدكتور", tone: "lemon" },
  "auth.login_2fa": { label: "دخول بكود التحقق", tone: "lemon" },
  "admin.2fa_enabled": { label: "تفعيل التحقق بخطوتين", tone: "lemon" },
  "admin.2fa_disabled": { label: "إيقاف التحقق بخطوتين", tone: "amber" },
  "admin.2fa_backup_codes": { label: "توليد أكواد احتياطية", tone: "amber" },
  "account.password_change": { label: "تغيير باسورد", tone: "amber" },
  "session.revoke": { label: "إخراج جهاز", tone: "amber" },
  "session.revoke_others": { label: "إخراج الأجهزة التانية", tone: "amber" },
  "backup.download": { label: "تنزيل نسخة احتياطية", tone: "violet" },
  "export.payments": { label: "تصدير المدفوعات", tone: "violet" },
  "export.customers": { label: "تصدير العملاء", tone: "violet" },
  "export.subscriptions": { label: "تصدير الاشتراكات", tone: "violet" },
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
  backup: "نسخة احتياطية",
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

/** The admin page where the thing that was logged actually lives. */
function previewTarget(entry: AuditEntry) {
  if (entry.action.startsWith("payment")) return { href: "/admin/payments", label: "فتح المدفوعات" };
  if (entry.action.startsWith("customer")) return { href: "/admin/customers", label: "فتح العملاء" };
  if (entry.action.startsWith("subscription")) return { href: "/admin/subscriptions", label: "فتح الاشتراكات" };
  if (entry.action.startsWith("content")) return { href: "/admin/content", label: "فتح محتوى الموقع" };
  if (entry.action.startsWith("media")) return { href: "/admin/media", label: "فتح مكتبة الصور" };
  if (entry.action.startsWith("message")) return { href: "/admin/messages", label: "فتح الرسائل" };
  if (entry.action === "copy.update") return { href: "/admin/copy", label: "فتح نصوص الموقع" };
  if (entry.action.startsWith("settings")) return { href: "/admin/settings", label: "فتح الإعدادات" };
  if (entry.action.startsWith("export")) return { href: "/admin/payments", label: "فتح المدفوعات" };
  return null;
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/5 py-2 last:border-0">
      <span className="shrink-0 text-[11px] text-cream/45">{label}</span>
      <span className="min-w-0 break-words text-end text-[11px] text-cream/75">{children}</span>
    </div>
  );
}

/** The actual receipt / uploaded image behind an entry, with a safe fallback. */
function PreviewImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <p className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-center text-[11px] text-cream/35">
        الصورة مش متاحة — يمكن اتمسحت أو الرابط اتغير.
      </p>
    );
  }
  return (
    <img
      key={src}
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      className="max-h-64 w-full rounded-xl border border-white/10 bg-ink object-contain"
    />
  );
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
  const [preview, setPreview] = useState<AuditEntry | null>(null);

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

  /** One Arabic sentence that says exactly what happened in this entry. */
  const narrate = (entry: AuditEntry) => {
    const meta = entry.meta ?? {};
    const who = entry.actorName || "النظام";
    const amount = meta.amount ? formatEgp(Number(meta.amount)) : "";
    const method = meta.method ? (METHODS[String(meta.method)] ?? String(meta.method)) : "";
    const plan = meta.program ? programName(meta.program) : "";
    const risk = Array.isArray(meta.risk) && meta.risk.length ? meta.risk.join("، ") : "";
    const entityLabel = ENTITIES[entry.entity] ?? entry.entity;

    switch (entry.action) {
      case "payment.submitted":
        return `${who} رفع إيصال دفع${amount ? ` بمبلغ ${amount}` : ""}${method ? ` عبر ${method}` : ""}${
          plan ? ` للباقة «${plan}»` : ""
        }، والصورة دخلت النظام ومستنية مراجعة${risk ? ` — الفحص التلقائي قال: ${risk}` : "."}`;
      case "payment.auto_approved":
        return `${who} رفع إيصال دفع${amount ? ` بمبلغ ${amount}` : ""}${method ? ` عبر ${method}` : ""}${
          plan ? ` للباقة «${plan}»` : ""
        }، والفحص التلقائي مطابق${risk ? ` (${risk})` : ""} فاتفعّل الاشتراك فورًا بدون مراجعة.`;
      case "payment.approve":
        return `${who} راجع الإيصال ووافق يدويًا${amount ? ` على مبلغ ${amount}` : ""}، فاتفعّل الاشتراك.${
          meta.note ? ` الملاحظة: ${meta.note}` : ""
        }`;
      case "payment.reject":
        return `${who} رفض الإيصال${amount ? ` بمبلغ ${amount}` : ""}.${meta.note ? ` السبب: ${meta.note}` : ""}`;
      case "customer.create":
        return `اتعمل حساب عميل جديد${meta.email ? ` بالإيميل ${meta.email}` : ""}.`;
      case "customer.update": {
        const fields = Array.isArray(meta.fields) ? meta.fields : [];
        return `${who} عدّل بيانات العميل #${entry.entityId}${
          fields.length ? ` (${fields.map((field) => FIELDS[String(field)] ?? String(field)).join("، ")})` : ""
        }.`;
      }
      case "subscription.grant":
        return `${who} فعّل باقة يدويًا للعميل #${meta.userId ?? "?"}${meta.programId ? ` — باقة «${programName(meta.programId)}»` : ""}${
          meta.days ? ` لمدة ${meta.days} يوم` : ""
        }، بدون عملية دفع.`;
      case "subscription.status":
        return `${who} غيّر حالة الاشتراك #${entry.entityId} إلى «${STATUSES[String(meta.status)] ?? String(meta.status ?? "")}».`;
      case "message.delete":
        return `${who} مسح رسالة واردة${meta.name ? ` من ${meta.name}` : ""}${meta.email ? ` (${meta.email})` : ""}.`;
      case "content.create":
        return `${who} أضاف عنصر جديد في «${entityLabel}» برقم #${entry.entityId}.`;
      case "content.update":
        return `${who} عدّل عنصر في «${entityLabel}» برقم #${entry.entityId}.`;
      case "content.delete":
        return `${who} مسح عنصر من «${entityLabel}» برقم #${entry.entityId}.`;
      case "settings.update":
        return `${who} حدّث إعدادات الموقع: بيانات التواصل، أرقام المحافظ، تعليمات الدفع، صورة الهيرو، أو الموافقة التلقائية.`;
      case "copy.update":
        return `${who} حدّث نصوص الواجهة (عربي/إنجليزي) من صفحة نصوص الموقع.`;
      case "media.upload":
        return `${who} رفع صورة جديدة إلى مكتبة الصور${meta.url ? `: ${meta.url}` : "."}`;
      case "media.delete":
        return `${who} مسح صورة من مكتبة الصور${meta.url ? `: ${meta.url}` : ` برقم #${entry.entityId}`}.`;
      case "export.payments":
      case "export.customers":
      case "export.subscriptions":
        return `${who} نزّل ملف CSV فيه ${entry.entityId} صف من «${entityLabel}».`;
      default:
        return `${who} نفّذ إجراء «${ACTIONS[entry.action]?.label ?? entry.action}» على ${entityLabel}${
          entry.entityId ? ` #${entry.entityId}` : ""
        }.`;
    }
  };

  /** The picture behind an entry: the transfer receipt, or the uploaded file. */
  const previewImage = (entry: AuditEntry) => {
    if (entry.action.startsWith("payment") && entry.entityId) {
      return { src: `/api/payments/${entry.entityId}/screenshot`, alt: "إيصال التحويل" };
    }
    // A deleted image is already gone from storage — loading it would only
    // produce a 404, so we say so instead of showing a broken preview.
    if (entry.action === "media.delete") return null;
    if (entry.action === "media.upload") {
      const url = String(entry.meta?.url ?? "");
      if (url) return { src: url, alt: "الصورة" };
    }
    return null;
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

  const target = preview ? previewTarget(preview) : null;

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
                  <th aria-label="إجراءات" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => {
                  const meta = ACTIONS[entry.action] ?? { label: entry.action, tone: "neutral" as const };
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
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setPreview(entry)}
                            className="inline-flex items-center justify-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[9px] font-bold text-cream/55 hover:border-lemon/40 hover:text-lemon"
                            aria-label="معاينة العملية"
                          >
                            <Eye className="size-3" aria-hidden />
                            معاينة
                          </button>
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
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        title={preview ? (ACTIONS[preview.action]?.label ?? preview.action) : "معاينة العملية"}
        description={preview ? `${formatDateTime(preview.createdAt)} · ${preview.actorName || "النظام"}` : undefined}
        size="lg"
        footer={
          <>
            {target && (
              <Link
                to={target.href}
                onClick={() => setPreview(null)}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-[11px] font-bold text-cream/60 hover:border-lemon/40 hover:text-lemon"
              >
                <ExternalLink className="size-3.5" aria-hidden />
                {target.label}
              </Link>
            )}
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="rounded-full border border-white/15 px-4 py-2 text-[11px] font-bold text-cream/60"
            >
              إغلاق
            </button>
          </>
        }
      >
        {preview && (
          <div className="space-y-4">
            <p className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-[13px] leading-relaxed text-cream/80">
              {narrate(preview)}
            </p>

            {preview.action === "media.delete" && (
              <p className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-[11px] leading-relaxed text-cream/45">
                الصورة نفسها اتمسحت من الخادم وقت الحذف، فمش موجودة للمعاينة — الرابط المتسجّل فوق هو اللي كان متاح.
              </p>
            )}

            {previewImage(preview) && (
              <div>
                <p className="mb-1.5 text-[10px] font-bold text-cream/45">الصورة المرتبطة</p>
                <PreviewImage
                  key={preview.id}
                  src={previewImage(preview)!.src}
                  alt={previewImage(preview)!.alt}
                />
              </div>
            )}

            <div className="grid gap-x-6 md:grid-cols-2">
              <InfoRow label="بواسطة">{preview.actorName || "النظام"}</InfoRow>
              <InfoRow label="التاريخ">{formatDateTime(preview.createdAt)}</InfoRow>
              <InfoRow label="العنصر">{ENTITIES[preview.entity] ?? preview.entity}</InfoRow>
              <InfoRow label="المعرّف">{preview.entityId || "—"}</InfoRow>
              <InfoRow label="رقم العملية">#{preview.id}</InfoRow>
              <InfoRow label="رمز العملية">
                <span className="font-latin" dir="ltr">
                  {preview.action}
                </span>
              </InfoRow>
            </div>

            {describe(preview) !== "—" && (
              <div>
                <p className="mb-1.5 text-[10px] font-bold text-cream/45">تفاصيل إضافية</p>
                <p className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-[11px] leading-relaxed text-cream/60">
                  {describe(preview)}
                </p>
              </div>
            )}

            {Object.keys(preview.meta ?? {}).length > 0 && (
              <details>
                <summary className="cursor-pointer text-[10px] font-bold text-cream/45">البيانات الخام (JSON)</summary>
                <pre
                  className="mt-2 overflow-x-auto rounded-xl border border-white/10 bg-ink p-3 text-[10px] leading-relaxed text-cream/50"
                  dir="ltr"
                >
                  {JSON.stringify(preview.meta, null, 2)}
                </pre>
              </details>
            )}
          </div>
        )}
      </Modal>
    </AdminPage>
  );
}
