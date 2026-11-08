import {
  ArrowUpRight,
  CalendarClock,
  CreditCard,
  MessageSquare,
  ReceiptText,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { Overview } from "../../../shared/types";
import { Spinner } from "../../components/ui/Spinner";
import { useToast } from "../../components/ui/Toast";
import { api, formatDateTime, formatEgp } from "../../lib/api";
import { AdminPage, EmptyState, PaymentStatus, StatCard } from "./components";

const MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

function monthLabel(key: string) {
  const [year, month] = key.split("-");
  return `${MONTHS[Number(month) - 1] ?? month} ${year.slice(2)}`;
}

export default function AdminOverview() {
  const toast = useToast();
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const payload = await api<Overview>("/api/admin/overview");
        if (active) setData(payload);
      } catch (cause) {
        toast.error(cause instanceof Error ? cause.message : "تعذر تحميل النظرة العامة.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [toast]);

  const maxMonth = useMemo(() => Math.max(1, ...(data?.monthly.map((item) => item.total) ?? [1])), [data]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner className="size-8 text-lemon" />
      </div>
    );
  }

  if (!data) {
    return (
      <AdminPage title="نظرة عامة">
        <div className="panel">
          <EmptyState icon={ReceiptText} title="تعذر تحميل البيانات" text="جرب تحديث الصفحة." />
        </div>
      </AdminPage>
    );
  }

  return (
    <AdminPage
      kicker="لوحة التحكم"
      title="نظرة عامة على الشغل"
      text="كل أرقام الموقع في مكان واحد: الإيرادات، الاشتراكات، المدفوعات المعلقة، والعملاء."
      actions={
        <>
          <Link
            to="/admin/payments?status=pending"
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-[11px] font-bold text-amber-200 transition-colors hover:bg-amber-400/15"
          >
            <CreditCard className="size-3.5" aria-hidden />
            مراجعة المعلّق ({data.pendingCount})
          </Link>
          <Link
            to="/admin/customers"
            className="inline-flex items-center gap-1.5 rounded-full bg-lemon px-4 py-2 text-[11px] font-bold text-ink transition-transform hover:-translate-y-0.5"
          >
            <UserPlus className="size-3.5" aria-hidden />
            العملاء
          </Link>
        </>
      }
    >
      {data.pendingCount > 0 && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-400/25 bg-amber-400/[0.06] px-4 py-3">
          <p className="flex items-center gap-2 text-xs font-semibold text-amber-100">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-300 opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-amber-300" />
            </span>
            عندك {data.pendingCount} دفعة مستنية المراجعة بقيمة {formatEgp(data.pendingAmount)}.
          </p>
          <Link to="/admin/payments?status=pending" className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-200 hover:underline">
            افتح المدفوعات
            <ArrowUpRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="إجمالي الإيرادات" value={formatEgp(data.revenue)} hint="من كل المدفوعات المقبولة" icon={Wallet} tone="lemon" />
        <StatCard label="إيراد الشهر" value={formatEgp(data.monthRevenue)} hint={`النهاردة: ${formatEgp(data.todayRevenue)}`} icon={TrendingUp} tone="sky" />
        <StatCard label="اشتراكات نشطة" value={String(data.activeSubscriptions)} hint={`${data.expiringSoon} قربوا ينتهوا`} icon={CalendarClock} tone="violet" />
        <StatCard label="العملاء" value={String(data.customers)} hint={`+${data.newCustomers} هذا الشهر`} icon={Users} tone="amber" />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="مدفوعات معلقة" value={String(data.pendingCount)} hint={formatEgp(data.pendingAmount)} icon={CreditCard} tone="amber" />
        <StatCard label="رسائل غير مقروءة" value={String(data.unreadMessages)} hint="من نموذج التواصل" icon={MessageSquare} tone="rose" />
        <StatCard label="موافقات يدوية" value={String(data.totals.approved)} hint="اتقبلت من الإدارة" icon={ReceiptText} tone="lemon" />
        <StatCard label="تفعيل تلقائي" value={String(data.totals.auto)} hint={`${data.totals.rejected} مرفوضة`} icon={TrendingUp} tone="sky" />
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="panel p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base">الإيرادات آخر 6 شهور</h2>
              <p className="mt-1 text-[11px] text-cream/40">إجمالي المدفوعات المقبولة شهريًا.</p>
            </div>
            <span className="rounded-full border border-lemon/25 bg-lemon/5 px-3 py-1 text-[10px] font-bold text-lemon">
              {formatEgp(data.monthly.reduce((sum, item) => sum + item.total, 0))}
            </span>
          </div>

          <div className="mt-6 flex h-44 items-end gap-2.5 sm:gap-4">
            {data.monthly.map((item) => {
              const height = Math.max(4, Math.round((item.total / maxMonth) * 100));
              return (
                <div key={item.month} className="group flex min-w-0 flex-1 flex-col items-center gap-2">
                  <span className="text-[9px] font-bold text-cream/45 opacity-0 transition-opacity group-hover:opacity-100">
                    {formatEgp(item.total)}
                  </span>
                  <div className="flex w-full flex-1 items-end">
                    <div
                      className="w-full rounded-t-lg bg-gradient-to-t from-lemon-deep/50 to-lemon transition-all group-hover:from-lemon group-hover:shadow-[0_0_24px_rgba(212,255,63,0.25)]"
                      style={{ height: `${height}%` }}
                      title={`${monthLabel(item.month)}: ${formatEgp(item.total)}`}
                    />
                  </div>
                  <span className="w-full truncate text-center text-[9px] text-cream/35">{monthLabel(item.month)}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="panel p-5">
          <h2 className="text-base">اختصارات سريعة</h2>
          <div className="mt-4 grid gap-2">
            {[
              { to: "/admin/payments?status=pending", label: "مراجعة المدفوعات", icon: CreditCard, hint: `${data.pendingCount} معلقة` },
              { to: "/admin/customers", label: "إدارة العملاء", icon: Users, hint: `${data.customers} عميل` },
              { to: "/admin/messages", label: "الرسائل", icon: MessageSquare, hint: `${data.unreadMessages} غير مقروءة` },
              { to: "/admin/content", label: "تعديل محتوى الموقع", icon: TrendingUp, hint: "باقات وخدمات ومقالات" },
              { to: "/admin/settings", label: "إعدادات الدفع", icon: Wallet, hint: "أرقام المحافظ" },
            ].map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="group flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2.5 transition-colors hover:border-lemon/30 hover:bg-lemon/[0.04]"
              >
                <span className="flex size-8 items-center justify-center rounded-lg bg-white/5 text-cream/50 group-hover:text-lemon">
                  <item.icon className="size-3.5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] font-semibold text-cream/75">{item.label}</span>
                  <span className="block text-[9px] text-cream/30">{item.hint}</span>
                </span>
                <ArrowUpRight className="size-3.5 text-cream/20 group-hover:text-lemon" aria-hidden />
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="panel mt-5 overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-white/8 px-5 py-4">
          <div>
            <h2 className="text-base">آخر المدفوعات</h2>
            <p className="mt-1 text-[11px] text-cream/40">آخر 6 عمليات تحويل.</p>
          </div>
          <Link to="/admin/payments" className="text-[11px] font-bold text-lemon hover:underline">
            عرض الكل
          </Link>
        </div>
        {data.recentPayments.length === 0 ? (
          <EmptyState icon={ReceiptText} title="لسه مفيش مدفوعات" text="أول ما عميل يرفع إيصال هيظهر هنا." />
        ) : (
          <div className="table-wrap border-0">
            <table>
              <thead>
                <tr>
                  <th>العميل</th>
                  <th>الباقة</th>
                  <th>المبلغ</th>
                  <th>الطريقة</th>
                  <th>الحالة</th>
                  <th>التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {data.recentPayments.map((payment) => (
                  <tr key={payment.id}>
                    <td>
                      <p className="font-semibold text-cream/85">{payment.userName}</p>
                      <p className="text-[10px] text-cream/35" dir="ltr">{payment.userPhone}</p>
                    </td>
                    <td>{payment.programName}</td>
                    <td className="font-semibold text-cream/90">{formatEgp(payment.amount)}</td>
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
    </AdminPage>
  );
}
