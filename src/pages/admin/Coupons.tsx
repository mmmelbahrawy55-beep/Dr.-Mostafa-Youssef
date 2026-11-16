import { Loader2, Plus, Tag, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { CouponDTO } from "../../../shared/types";
import { Spinner } from "../../components/ui/Spinner";
import { api, formatDateTime } from "../../lib/api";
import { useToast } from "../../components/ui/Toast";

/** Percent or fixed-amount discount codes the doctor can hand out. */
export default function Coupons() {
  const toast = useToast();
  const [coupons, setCoupons] = useState<CouponDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [form, setForm] = useState({ code: "", kind: "percent", value: "10", maxUses: "0", expiresAt: "" });

  const load = useCallback(async () => {
    try {
      const data = await api<{ coupons: CouponDTO[] }>("/api/admin/coupons");
      setCoupons(data.coupons);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "تعذر تحميل الكوبونات.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    setSaving(true);
    try {
      await api("/api/admin/coupons", {
        method: "POST",
        body: {
          code: form.code,
          kind: form.kind,
          value: Number(form.value) || 0,
          maxUses: Number(form.maxUses) || 0,
          expiresAt: form.expiresAt || null,
        },
      });
      setForm({ code: "", kind: "percent", value: "10", maxUses: "0", expiresAt: "" });
      toast.success("تم إنشاء الكوبون.");
      await load();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "تعذر إنشاء الكوبون.");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (coupon: CouponDTO) => {
    try {
      const data = await api<{ coupon: CouponDTO }>(`/api/admin/coupons/${coupon.id}`, {
        method: "PATCH",
        body: { active: !coupon.active },
      });
      setCoupons((prev) => prev.map((row) => (row.id === coupon.id ? data.coupon : row)));
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "تعذر تحديث الكوبون.");
    }
  };

  const remove = async (id: number) => {
    if (confirmId !== id) {
      setConfirmId(id);
      return;
    }
    try {
      await api(`/api/admin/coupons/${id}`, { method: "DELETE" });
      setCoupons((prev) => prev.filter((row) => row.id !== id));
      setConfirmId(null);
      toast.success("تم حذف الكوبون.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "تعذر حذف الكوبون.");
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-lemon/70">الكوبونات</p>
        <h1 className="mt-1 text-2xl">أكواد الخصم</h1>
        <p className="mt-1 text-[11px] text-cream/40">
          العميل بيكتب الكود في صفحة الاشتراك قبل ما يحوّل، والخصم بيتطبق على سعر الباقة.
        </p>
      </div>

      <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
        <div className="grid gap-2 md:grid-cols-5">
          <input
            className="field py-2 text-[11px] uppercase"
            placeholder="الكود (مثال: EID25)"
            value={form.code}
            onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value.toUpperCase() }))}
          />
          <select
            className="field py-2 text-[11px]"
            value={form.kind}
            onChange={(event) => setForm((prev) => ({ ...prev, kind: event.target.value }))}
          >
            <option value="percent">نسبة %</option>
            <option value="amount">مبلغ ثابت</option>
          </select>
          <input
            className="field py-2 text-[11px]"
            type="number"
            min={1}
            placeholder={form.kind === "percent" ? "النسبة" : "المبلغ"}
            value={form.value}
            onChange={(event) => setForm((prev) => ({ ...prev, value: event.target.value }))}
          />
          <input
            className="field py-2 text-[11px]"
            type="number"
            min={0}
            placeholder="عدد الاستخدامات (0 = مفتوح)"
            value={form.maxUses}
            onChange={(event) => setForm((prev) => ({ ...prev, maxUses: event.target.value }))}
          />
          <input
            className="field py-2 text-[11px]"
            type="date"
            value={form.expiresAt}
            onChange={(event) => setForm((prev) => ({ ...prev, expiresAt: event.target.value }))}
          />
        </div>
        <button
          type="button"
          onClick={() => void create()}
          disabled={saving || form.code.trim().length < 3}
          className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-lemon px-4 py-2 text-[11px] font-bold text-ink disabled:opacity-50"
        >
          {saving ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Plus className="size-3.5" aria-hidden />}
          إنشاء كوبون
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner className="size-7" />
        </div>
      ) : coupons.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/10 py-12 text-center text-[11px] text-cream/35">
          مفيش كوبونات لحد دلوقتي.
        </p>
      ) : (
        <ul className="space-y-2">
          {coupons.map((coupon) => (
            <li
              key={coupon.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.02] p-3"
            >
              <span className="flex size-9 items-center justify-center rounded-xl bg-lemon/10 text-lemon">
                <Tag className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-latin text-[12px] font-bold tracking-wider text-cream" dir="ltr">
                  {coupon.code}
                </p>
                <p className="mt-0.5 text-[10px] text-cream/40">
                  {coupon.kind === "percent" ? `${coupon.value}%` : `${coupon.value} ج.م`} · استُخدم {coupon.used}
                  {coupon.maxUses > 0 ? ` من ${coupon.maxUses}` : ""}
                  {coupon.expiresAt ? ` · ينتهي ${formatDateTime(coupon.expiresAt)}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void toggle(coupon)}
                className={`rounded-full px-3 py-1.5 text-[10px] font-bold ${
                  coupon.active ? "bg-emerald-400/15 text-emerald-200" : "bg-white/8 text-cream/40"
                }`}
              >
                {coupon.active ? "مفعّل" : "موقوف"}
              </button>
              <button
                type="button"
                onClick={() => void remove(coupon.id)}
                className={`rounded-full px-3 py-1.5 text-[10px] font-bold ${
                  confirmId === coupon.id ? "bg-red-500/20 text-red-100" : "text-cream/35 hover:text-red-200"
                }`}
              >
                {confirmId === coupon.id ? "تأكيد الحذف" : <Trash2 className="size-3.5" aria-hidden />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
