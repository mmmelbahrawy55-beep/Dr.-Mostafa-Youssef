import { Search, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Spinner } from "../../components/ui/Spinner";
import { useToast } from "../../components/ui/Toast";
import { api, formatDateTime } from "../../lib/api";
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

const ACTIONS: Record<string, { label: string; tone: "lemon" | "amber" | "rose" | "sky" | "neutral" }> = {
  "payment.auto_approved": { label: "تفعيل تلقائي لدفعة", tone: "lemon" },
  "payment.submitted": { label: "رفع إيصال دفع", tone: "sky" },
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
  "settings.update": { label: "تحديث الإعدادات", tone: "amber" },
  "copy.update": { label: "تحديث النصوص", tone: "amber" },
  "media.upload": { label: "رفع صورة", tone: "sky" },
  "media.delete": { label: "حذف صورة", tone: "rose" },
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
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((entry) =>
      [entry.actorName, entry.action, entry.entity, entry.entityId, ACTIONS[entry.action]?.label]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [entries, query]);

  return (
    <AdminPage
      kicker="السجل"
      title="سجل العمليات"
      text="كل إجراء مهم على النظام بيتسجل هنا: من فعّل دفعة، مين عدّل محتوى، وإمتى."
      actions={
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-[10px] text-cream/45">
          <ShieldCheck className="size-3.5 text-lemon/60" aria-hidden />
          {entries.length} عملية
        </span>
      }
    >
      <div className="relative w-full sm:max-w-xs">
        <Search className="pointer-events-none absolute start-3 top-1/2 size-3.5 -translate-y-1/2 text-cream/30" aria-hidden />
        <input
          className="field py-2 ps-9 text-xs"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="ابحث في السجل…"
        />
      </div>

      <div className="panel mt-4 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner className="size-7 text-lemon" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="السجل فاضي" text="أول إجراء على الموقع هيظهر هنا." />
        ) : (
          <div className="table-wrap border-0">
            <table>
              <thead>
                <tr>
                  <th>الإجراء</th>
                  <th>بواسطة</th>
                  <th>العنصر</th>
                  <th>تفاصيل</th>
                  <th>التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => {
                  const meta = ACTIONS[entry.action] ?? { label: entry.action, tone: "neutral" as const };
                  return (
                    <tr key={entry.id}>
                      <td><Badge tone={meta.tone}>{meta.label}</Badge></td>
                      <td className="text-cream/70">{entry.actorName || "النظام"}</td>
                      <td>
                        <span className="font-latin text-[10px] text-cream/45" dir="ltr">
                          {entry.entity}{entry.entityId ? ` #${entry.entityId}` : ""}
                        </span>
                      </td>
                      <td className="max-w-md">
                        <span className="line-clamp-1 font-latin text-[10px] text-cream/35" dir="ltr" title={JSON.stringify(entry.meta)}>
                          {metaSummary(entry.meta)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap text-[11px] text-cream/40">{formatDateTime(entry.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminPage>
  );
}
