import { Laptop, LogOut, MonitorSmartphone, ShieldCheck, Smartphone } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api, formatDateTime } from "../../lib/api";
import { useToast } from "../ui/Toast";

interface Session {
  id: string;
  current: boolean;
  createdAt: string;
  lastSeen: string;
  ip: string;
  userAgent: string;
}

const deviceLabel = (userAgent: string) => {
  const ua = userAgent.toLowerCase();
  if (/android|iphone|ipad|mobile/.test(ua)) return "موبايل";
  if (/macintosh|mac os/.test(ua)) return "Mac";
  if (/windows/.test(ua)) return "Windows";
  if (/linux/.test(ua)) return "Linux";
  return "جهاز غير معروف";
};

const browserLabel = (userAgent: string) => {
  const ua = userAgent.toLowerCase();
  if (ua.includes("edg/")) return "Edge";
  if (ua.includes("chrome") && !ua.includes("chromium")) return "Chrome";
  if (ua.includes("safari") && !ua.includes("chrome")) return "Safari";
  if (ua.includes("firefox")) return "Firefox";
  return "متصفح";
};

const isMobile = (userAgent: string) => /android|iphone|ipad|mobile/i.test(userAgent);

/**
 * Lists every signed-in device and lets the owner revoke any of them. Session
 * records live in Redis, so revoking one device does not disturb the others.
 */
export function SessionsCard({ className }: { className?: string }) {
  const toast = useToast();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string>("");

  const load = useCallback(async () => {
    try {
      const data = await api<{ sessions: Session[] }>("/api/account/sessions");
      setSessions(data.sessions);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "تعذر تحميل الجلسات.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const revoke = async (session: Session) => {
    setBusy(session.id);
    try {
      const result = await api<{ current: boolean }>(`/api/account/sessions/${session.id}`, { method: "DELETE" });
      if (result.current) {
        window.location.assign("/");
        return;
      }
      await load();
      toast.success("تم إخراج الجهاز من الحساب.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "تعذر إخراج الجهاز.");
    } finally {
      setBusy("");
    }
  };

  const revokeOthers = async () => {
    setBusy("others");
    try {
      const result = await api<{ removed: number }>("/api/account/sessions/revoke-others", { method: "POST" });
      await load();
      toast.success(
        result.removed > 0 ? `تم إخراج ${result.removed} جهاز تاني.` : "مفيش أجهزة تانية مسجلة."
      );
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "تعذر إخراج الأجهزة.");
    } finally {
      setBusy("");
    }
  };

  const others = sessions.filter((session) => !session.current).length;

  return (
    <div className={className ?? "panel p-6"}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg">
            <ShieldCheck className="size-4 text-lemon" aria-hidden />
            الأجهزة والجلسات
          </h2>
          <p className="mt-1 text-[11px] leading-relaxed text-cream/40">
            أي جهاز دخل عليه حسابك بيظهر هنا. لو شوفت جهاز مش بتاعك، اخُرجه فورًا وغيّر الباسورد.
          </p>
        </div>
        <button
          type="button"
          onClick={revokeOthers}
          disabled={busy === "others" || others === 0}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-2 text-[10px] font-bold text-cream/55 transition-colors hover:border-red-400/50 hover:text-red-200 disabled:opacity-40"
        >
          <LogOut className="size-3.5" aria-hidden />
          {busy === "others" ? "بننفذ…" : "إخراج الأجهزة التانية"}
        </button>
      </div>

      {loading ? (
        <p className="mt-5 text-xs text-cream/35">بنجهّز قائمة الأجهزة…</p>
      ) : sessions.length === 0 ? (
        <p className="mt-5 rounded-xl border border-dashed border-white/12 px-4 py-6 text-center text-xs text-cream/40">
          مفيش جلسات مسجلة.
        </p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {sessions.map((session) => (
            <li
              key={session.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.02] p-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-lemon">
                  {isMobile(session.userAgent) ? (
                    <Smartphone className="size-4" aria-hidden />
                  ) : session.userAgent ? (
                    <Laptop className="size-4" aria-hidden />
                  ) : (
                    <MonitorSmartphone className="size-4" aria-hidden />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-xs font-semibold text-cream">
                    {deviceLabel(session.userAgent)} · {browserLabel(session.userAgent)}
                    {session.current && (
                      <span className="rounded-full border border-lemon/30 bg-lemon/10 px-2 py-0.5 text-[9px] font-bold text-lemon">
                        الجهاز الحالي
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-[10px] text-cream/35">
                    آخر نشاط: {formatDateTime(session.lastSeen)}
                    {session.ip ? ` · ${session.ip}` : ""}
                  </p>
                </div>
              </div>
              {!session.current && (
                <button
                  type="button"
                  onClick={() => revoke(session)}
                  disabled={busy === session.id}
                  className="rounded-full border border-white/12 px-3 py-1.5 text-[10px] font-bold text-cream/50 transition-colors hover:border-red-400/50 hover:text-red-200 disabled:opacity-40"
                >
                  {busy === session.id ? "…" : "إخراج"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
