import { CalendarClock, Download, Percent, TrendingUp, Users, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReportSummary } from "../../../shared/types";
import { Spinner } from "../../components/ui/Spinner";
import { api } from "../../lib/api";
import { useToast } from "../../components/ui/Toast";

const egp = (value: number) => `${Math.round(value).toLocaleString("en-US")} ج.م`;

const METHOD_LABEL: Record<string, string> = {
  vodafone: "فودافون كاش",
  instapay: "إنستا باي",
  bank: "تحويل بنكي",
  cash: "كاش",
  other: "أخرى",
};

/** Revenue, subscribers and coupon usage, all from approved payments. */
export default function Reports() {
  const toast = useToast();
  const [data, setData] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setData(await api<ReportSummary>("/api/admin/reports"));
      } catch (cause) {
        toast.error(cause instanceof Error ? cause.message : "تعذر تحميل التقارير.");
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="size-8" />
      </div>
    );
  }
  if (!data) return <p className="py-16 text-center text-sm text-cream/50">مفيش بيانات لعرضها.</p>;

  const peak = Math.max(1, ...data.monthly.map((entry) => entry.total));
  const growth = data.lastMonth > 0 ? Math.round(((data.month - data.lastMonth) / data.lastMonth) * 100) : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-lemon/70">التقارير</p>
          <h1 className="mt-1 text-2xl">أرقام الموقع</h1>
          <p className="mt-1 text-[11px] text-cream/40">كل المبالغ من الدفعات المقبولة، بالجنيه المصري.</p>
        </div>
        <a
          href="/api/admin/export/revenue.csv"
          className="inline-flex items-center gap-1.5 rounded-full border border-lemon/30 bg-lemon/10 px-4 py-2 text-[11px] font-bold text-lemon"
        >
          <Download className="size-3.5" aria-hidden /> تحميل CSV
        </a>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "إجمالي الإيرادات", value: egp(data.revenue), icon: Wallet, tone: "text-lemon" },
          { label: "الشهر الحالي", value: egp(data.month), icon: TrendingUp, tone: "text-emerald-200" },
          { label: "اشتراكات نشطة", value: String(data.activeSubscriptions), icon: Users, tone: "text-sky-200" },
          { label: "قربت تخلص (٧ أيام)", value: String(data.expiringSoon), icon: CalendarClock, tone: "text-amber-200" },
        ].map((card) => (
          <div key={card.label} className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-cream/40">{card.label}</p>
              <card.icon className={`size-4 ${card.tone}`} aria-hidden />
            </div>
            <p className="mt-2 text-xl font-bold text-cream">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold">آخر ١٢ شهر</h2>
            {growth !== null && (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  growth >= 0 ? "bg-emerald-400/15 text-emerald-200" : "bg-red-400/15 text-red-200"
                }`}
              >
                {growth >= 0 ? "+" : ""}
                {growth}%
              </span>
            )}
          </div>
          {data.monthly.length === 0 ? (
            <p className="mt-6 text-center text-[11px] text-cream/35">مفيش إيرادات مسجلة لحد دلوقتي.</p>
          ) : (
            <div className="mt-4 flex h-40 items-end gap-1.5">
              {data.monthly.map((entry) => (
                <div key={entry.month} className="flex flex-1 flex-col items-center gap-1.5">
                  <div
                    className="w-full rounded-t-md bg-lemon/60"
                    style={{ height: `${Math.max(4, (entry.total / peak) * 100)}%` }}
                    title={egp(entry.total)}
                  />
                  <span className="text-[8px] text-cream/30">{entry.month.slice(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <Percent className="size-3.5 text-lemon" aria-hidden /> الإيراد حسب الباقة
          </h2>
          {data.byPlan.length === 0 ? (
            <p className="mt-6 text-center text-[11px] text-cream/35">لسه مفيش دفعات مقبولة.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {data.byPlan.map((entry) => (
                <li key={entry.name} className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2">
                  <span className="truncate text-[11px] text-cream/70">{entry.name}</span>
                  <span className="shrink-0 text-[11px] font-bold text-lemon">
                    {egp(entry.total)} <span className="text-cream/30">({entry.count})</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <h3 className="mt-4 text-[10px] font-bold uppercase tracking-wide text-cream/35">طرق الدفع</h3>
          <ul className="mt-2 space-y-1.5">
            {data.byMethod.length === 0 ? (
              <li className="text-[10px] text-cream/30">—</li>
            ) : (
              data.byMethod.map((entry) => (
                <li key={entry.method} className="flex items-center justify-between text-[11px]">
                  <span className="text-cream/60">{METHOD_LABEL[entry.method] ?? entry.method}</span>
                  <span className="text-cream/80">{egp(entry.total)}</span>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
          <h2 className="text-sm font-bold">أحسن العملاء</h2>
          {data.topCustomers.length === 0 ? (
            <p className="mt-4 text-[11px] text-cream/35">—</p>
          ) : (
            <ol className="mt-3 space-y-2">
              {data.topCustomers.map((customer, index) => (
                <li key={`${customer.email}-${index}`} className="flex items-center gap-3">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-lemon/10 text-[10px] font-bold text-lemon">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-bold text-cream/80">{customer.name}</p>
                    <p className="truncate text-[10px] text-cream/30" dir="ltr">
                      {customer.email}
                    </p>
                  </div>
                  <span className="text-[11px] font-bold text-lemon">{egp(customer.total)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
          <h2 className="text-sm font-bold">ملخص سريع</h2>
          <dl className="mt-3 space-y-2 text-[11px]">
            {[
              { label: "إيراد متوقع من الاشتراكات النشطة", value: egp(data.expected) },
              { label: "الشهر الماضي", value: egp(data.lastMonth) },
              { label: "استخدام الكوبونات", value: `${data.couponsUsed} مرة` },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2">
                <dt className="text-cream/50">{row.label}</dt>
                <dd className="font-bold text-cream/85">{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
