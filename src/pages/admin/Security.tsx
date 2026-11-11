import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  KeyRound,
  Loader2,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
} from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { SessionsCard } from "../../components/account/SessionsCard";
import { useToast } from "../../components/ui/Toast";
import { api } from "../../lib/api";
import { AdminPage, Badge } from "./components";

interface TwoFactorStatus {
  enabled: boolean;
  pending: boolean;
  backupCodesLeft: number;
  account: string;
}

interface SetupData {
  secret: string;
  uri: string;
  account: string;
  issuer: string;
}

export default function AdminSecurity() {
  const toast = useToast();
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [setup, setSetup] = useState<SetupData | null>(null);
  const [setupCode, setSetupCode] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState("");
  const [backupBusy, setBackupBusy] = useState(false);
  const [error, setError] = useState("");

  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await api<TwoFactorStatus>("/api/admin/2fa");
      setStatus(data);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "تعذر تحميل إعدادات الأمان.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("تم النسخ.");
    } catch {
      toast.error("المتصفح مش سامح بالنسخ. حدد النص وانسخه يدويًا.");
    }
  };

  const startSetup = async () => {
    setBusy("setup");
    setError("");
    try {
      const data = await api<SetupData>("/api/admin/2fa/setup", { method: "POST" });
      setSetup(data);
      setCodes(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر بدء الإعداد.");
    } finally {
      setBusy("");
    }
  };

  const enable = async (event: FormEvent) => {
    event.preventDefault();
    setBusy("enable");
    setError("");
    try {
      const data = await api<{ backupCodes: string[] }>("/api/admin/2fa/enable", {
        method: "POST",
        body: { code: setupCode },
      });
      setCodes(data.backupCodes);
      setSetup(null);
      setSetupCode("");
      await load();
      toast.success("التحقق بخطوتين اتفعّل.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "الكود مش صح.");
    } finally {
      setBusy("");
    }
  };

  const regenerate = async (event: FormEvent) => {
    event.preventDefault();
    setBusy("regenerate");
    setError("");
    try {
      const data = await api<{ backupCodes: string[] }>("/api/admin/2fa/backup-codes", {
        method: "POST",
        body: { password, code },
      });
      setCodes(data.backupCodes);
      setPassword("");
      setCode("");
      await load();
      toast.success("اتولّدت أكواد احتياطية جديدة.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر توليد الأكواد.");
    } finally {
      setBusy("");
    }
  };

  const disable = async (event: FormEvent) => {
    event.preventDefault();
    setBusy("disable");
    setError("");
    try {
      await api("/api/admin/2fa/disable", { method: "POST", body: { password, code } });
      setPassword("");
      setCode("");
      setCodes(null);
      await load();
      toast.success("التحقق بخطوتين اتوقف.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر إيقاف التحقق.");
    } finally {
      setBusy("");
    }
  };

  const downloadCodes = () => {
    if (!codes) return;
    const blob = new Blob([`Dr. Mostafa Youssef — backup codes\n\n${codes.join("\n")}\n`], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "admin-backup-codes.txt";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const downloadBackup = async () => {
    setBackupBusy(true);
    try {
      const response = await fetch("/api/admin/backup", { credentials: "same-origin" });
      if (!response.ok) {
        const detail = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(detail?.error || "تعذر تجهيز النسخة الاحتياطية.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success("تم تنزيل النسخة الاحتياطية.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "تعذر تنزيل النسخة.");
    } finally {
      setBackupBusy(false);
    }
  };

  return (
    <AdminPage
      kicker="الأمان"
      title="حماية حساب الدكتور"
      text="التحقق بخطوتين، الأجهزة المسجلة، ونسخة احتياطية من بيانات الموقع. الإعدادات دي بتحمي المدفوعات وبيانات العملاء."
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="panel p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-lg">
                <KeyRound className="size-4 text-lemon" aria-hidden />
                التحقق بخطوتين
              </h2>
              <p className="mt-1 text-[11px] leading-relaxed text-cream/40">
                كود متغيّر كل 30 ثانية من تطبيق المصادقة، بالإضافة للباسورد. لو حد عرف الباسورد لوحده مش هيقدر يدخل.
              </p>
            </div>
            {status && <Badge tone={status.enabled ? "lemon" : "neutral"}>{status.enabled ? "مفعّل" : "غير مفعّل"}</Badge>}
          </div>

          {loading ? (
            <p className="mt-6 flex items-center gap-2 text-xs text-cream/40">
              <Loader2 className="size-3.5 animate-spin" aria-hidden /> بنقرأ الإعدادات…
            </p>
          ) : status?.enabled ? (
            <div className="mt-5 space-y-4">
              <div className="rounded-xl border border-lemon/20 bg-lemon/[0.06] p-3.5 text-[11px] leading-relaxed text-cream/65">
                <p className="flex items-center gap-1.5 font-bold text-lemon">
                  <ShieldCheck className="size-3.5" aria-hidden />
                  الحساب محمي
                </p>
                <p className="mt-1">
                  الأكواد الاحتياطية المتبقية: <strong className="text-cream">{status.backupCodesLeft}</strong>. كل كود
                  بيستخدم مرة واحدة ومبيظهرش تاني.
                </p>
              </div>

              {codes && (
                <div className="rounded-xl border border-amber-300/25 bg-amber-400/[0.06] p-4">
                  <p className="flex items-center gap-1.5 text-[11px] font-bold text-amber-200">
                    <AlertTriangle className="size-3.5" aria-hidden />
                    احفظ الأكواد دي دلوقتي — مش هتظهر تاني
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-[11px] text-cream/80" dir="ltr">
                    {codes.map((entry) => (
                      <span key={entry} className="rounded-lg border border-white/10 bg-ink/60 px-2 py-1.5 text-center">
                        {entry}
                      </span>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => copy(codes.join("\n"))}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-[10px] font-bold text-cream/65 hover:text-lemon"
                    >
                      <Copy className="size-3" aria-hidden /> نسخ
                    </button>
                    <button
                      type="button"
                      onClick={downloadCodes}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-[10px] font-bold text-cream/65 hover:text-lemon"
                    >
                      <Download className="size-3" aria-hidden /> تنزيل
                    </button>
                  </div>
                </div>
              )}

              <details className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5">
                <summary className="cursor-pointer text-[11px] font-bold text-cream/65">توليد أكواد احتياطية جديدة</summary>
                <form onSubmit={regenerate} className="mt-3 space-y-2.5">
                  <input
                    type="password"
                    className="field text-xs"
                    placeholder="الباسورد الحالي"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    required
                  />
                  <input
                    className="field text-center font-mono tracking-[0.3em]"
                    placeholder="كود التحقق"
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    dir="ltr"
                    required
                  />
                  <button
                    type="submit"
                    disabled={busy === "regenerate"}
                    className="inline-flex items-center gap-1.5 rounded-full bg-lemon px-4 py-2 text-[10px] font-bold text-ink disabled:opacity-50"
                  >
                    {busy === "regenerate" ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                    توليد أكواد جديدة
                  </button>
                </form>
              </details>

              <details className="rounded-xl border border-red-400/20 bg-red-500/[0.04] p-3.5">
                <summary className="cursor-pointer text-[11px] font-bold text-red-200/80">إيقاف التحقق بخطوتين</summary>
                <form onSubmit={disable} className="mt-3 space-y-2.5">
                  <input
                    type="password"
                    className="field text-xs"
                    placeholder="الباسورد الحالي"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    required
                  />
                  <input
                    className="field text-center font-mono tracking-[0.3em]"
                    placeholder="كود التحقق"
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    dir="ltr"
                    required
                  />
                  <button
                    type="submit"
                    disabled={busy === "disable"}
                    className="inline-flex items-center gap-1.5 rounded-full border border-red-400/40 px-4 py-2 text-[10px] font-bold text-red-200 disabled:opacity-50"
                  >
                    {busy === "disable" ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldOff className="size-3.5" />}
                    إيقاف التحقق
                  </button>
                </form>
              </details>
            </div>
          ) : setup ? (
            <form onSubmit={enable} className="mt-5 space-y-4">
              <ol className="space-y-2 text-[11px] leading-relaxed text-cream/55">
                <li>1. نزّل Google Authenticator أو Authy أو Microsoft Authenticator على موبايلك.</li>
                <li>2. أضف حساب جديد يدويًا واكتب المفتاح ده (أو افتح الرابط من الموبايل):</li>
              </ol>
              <div className="rounded-xl border border-white/12 bg-ink/60 p-3">
                <code className="block break-all font-mono text-xs text-lemon" dir="ltr">
                  {setup.secret}
                </code>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => copy(setup.secret)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-[10px] font-bold text-cream/65 hover:text-lemon"
                  >
                    <Copy className="size-3" aria-hidden /> نسخ المفتاح
                  </button>
                  <a
                    href={setup.uri}
                    className="inline-flex items-center gap-1.5 rounded-full border border-lemon/30 bg-lemon/10 px-3 py-1.5 text-[10px] font-bold text-lemon"
                  >
                    <LockKeyhole className="size-3" aria-hidden /> فتح في التطبيق
                  </a>
                </div>
              </div>
              <p className="text-[11px] text-cream/45">3. اكتب الكود اللي ظهر في التطبيق لتأكيد الربط:</p>
              <input
                className="field text-center font-mono text-lg tracking-[0.35em]"
                placeholder="000000"
                value={setupCode}
                onChange={(event) => setSetupCode(event.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                dir="ltr"
                required
              />
              {error && (
                <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">
                  {error}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={busy === "enable"}
                  className="inline-flex items-center gap-1.5 rounded-full bg-lemon px-4 py-2.5 text-[11px] font-bold text-ink disabled:opacity-50"
                >
                  {busy === "enable" ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
                  تفعيل التحقق
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSetup(null);
                    setSetupCode("");
                    setError("");
                  }}
                  className="rounded-full border border-white/12 px-4 py-2.5 text-[11px] font-bold text-cream/55"
                >
                  إلغاء
                </button>
              </div>
            </form>
          ) : (
            <div className="mt-5">
              <p className="rounded-xl border border-amber-300/20 bg-amber-400/[0.05] p-3.5 text-[11px] leading-relaxed text-amber-100/75">
                الحساب دلوقتي محمي بالباسورد بس. لو الباسورد اتسرّب، أي حد يقدر يدخل على المدفوعات وبيانات العملاء —
                ننصح بتفعيل الخطوة دي فورًا.
              </p>
              {error && <p className="mt-3 text-[11px] text-red-200">{error}</p>}
              <button
                type="button"
                onClick={startSetup}
                disabled={busy === "setup"}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-lemon px-5 py-3 text-xs font-bold text-ink disabled:opacity-50"
              >
                {busy === "setup" ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
                {busy === "setup" ? "بنجهّز المفتاح…" : "إعداد التحقق بخطوتين"}
              </button>
            </div>
          )}
        </div>

        <SessionsCard />
      </div>

      <div className="panel mt-5 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl">
            <h2 className="flex items-center gap-2 text-lg">
              <Download className="size-4 text-lemon" aria-hidden />
              نسخة احتياطية من البيانات
            </h2>
            <p className="mt-1 text-[11px] leading-relaxed text-cream/40">
              ملف JSON فيه العملاء، الاشتراكات، المدفوعات، المحتوى، الرسائل، والإعدادات. نزّله بعد أي تغيير كبير واحفظه
              في مكان آمن — الصور والإيصالات نفسها مش بتتحفظ في الملف.
            </p>
          </div>
          <button
            type="button"
            onClick={downloadBackup}
            disabled={backupBusy}
            className="inline-flex items-center gap-2 rounded-full border border-lemon/30 bg-lemon/10 px-5 py-3 text-xs font-bold text-lemon transition-colors hover:bg-lemon/15 disabled:opacity-50"
          >
            {backupBusy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            {backupBusy ? "بنجهّز الملف…" : "تنزيل نسخة احتياطية"}
          </button>
        </div>
      </div>
    </AdminPage>
  );
}
