import { Loader2, ShieldCheck, UserPlus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { PublicUser } from "../../../shared/types";
import { Spinner } from "../../components/ui/Spinner";
import { api, formatDateTime } from "../../lib/api";
import { useToast } from "../../components/ui/Toast";

type TeamMember = PublicUser & { twoFactor: boolean; blocked?: boolean; createdAt?: string };

/** Assistants get the daily work; only the doctor manages the team and money. */
export default function Team() {
  const toast = useToast();
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });

  const load = useCallback(async () => {
    try {
      const data = await api<{ team: TeamMember[] }>("/api/admin/team");
      setTeam(data.team);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "تعذر تحميل الفريق.");
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
      await api("/api/admin/team", { method: "POST", body: form });
      setForm({ name: "", email: "", phone: "", password: "" });
      toast.success("تم إنشاء حساب المساعد.");
      await load();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "تعذر إنشاء الحساب.");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (member: TeamMember) => {
    try {
      await api(`/api/admin/team/${member.id}`, { method: "PATCH", body: { blocked: !member.blocked } });
      toast.success(member.blocked ? "تم تفعيل الحساب." : "تم إيقاف الحساب.");
      await load();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "تعذر تحديث الحساب.");
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-lemon/70">الفريق</p>
        <h1 className="mt-1 text-2xl">حسابات المساعدين</h1>
        <p className="mt-1 text-[11px] text-cream/40">
          المساعد يشوف المدفوعات والعملاء والشات والملفات، لكن التقارير والكوبونات والإعدادات للدكتور بس.
        </p>
      </div>

      <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <input
            className="field py-2 text-[11px]"
            placeholder="الاسم"
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
          />
          <input
            className="field py-2 text-[11px]"
            placeholder="الإيميل"
            dir="ltr"
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
          />
          <input
            className="field py-2 text-[11px]"
            placeholder="الموبايل"
            dir="ltr"
            value={form.phone}
            onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
          />
          <input
            className="field py-2 text-[11px]"
            type="password"
            placeholder="باسورد ٨ حروف على الأقل"
            dir="ltr"
            value={form.password}
            onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
          />
        </div>
        <button
          type="button"
          onClick={() => void create()}
          disabled={saving || !form.name.trim() || !form.email.trim() || form.password.length < 8}
          className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-lemon px-4 py-2 text-[11px] font-bold text-ink disabled:opacity-50"
        >
          {saving ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <UserPlus className="size-3.5" aria-hidden />}
          إضافة مساعد
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner className="size-7" />
        </div>
      ) : (
        <ul className="space-y-2">
          {team.map((member) => (
            <li
              key={member.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.02] p-3"
            >
              <span className="flex size-9 items-center justify-center rounded-xl bg-lemon/10 text-[11px] font-bold text-lemon">
                {member.name.charAt(0)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-bold text-cream/85">
                  {member.name}{" "}
                  <span className="text-[9px] font-normal text-cream/35">
                    {member.role === "admin" ? "· الدكتور" : "· مساعد"}
                  </span>
                </p>
                <p className="mt-0.5 truncate text-[10px] text-cream/35" dir="ltr">
                  {member.email}
                  {member.createdAt ? ` · ${formatDateTime(member.createdAt)}` : ""}
                </p>
              </div>
              {member.twoFactor && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/15 px-2 py-1 text-[9px] text-emerald-200">
                  <ShieldCheck className="size-3" aria-hidden /> 2FA
                </span>
              )}
              {member.blocked && <span className="rounded-full bg-red-400/15 px-2 py-1 text-[9px] text-red-200">موقوف</span>}
              {member.role !== "admin" && (
                <button
                  type="button"
                  onClick={() => void toggle(member)}
                  className={`rounded-full px-3 py-1.5 text-[10px] font-bold ${
                    member.blocked ? "bg-lemon text-ink" : "border border-white/12 text-cream/45 hover:text-red-200"
                  }`}
                >
                  {member.blocked ? "تفعيل" : "إيقاف"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
