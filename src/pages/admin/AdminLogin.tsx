import { motion } from "framer-motion";
import { Eye, EyeOff, Lock, Mail, ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Logo, LogoBadge } from "../../components/ui/Logo";
import { Spinner } from "../../components/ui/Spinner";
import { useToast } from "../../components/ui/Toast";
import { useAuth } from "../../lib/auth";

/**
 * Dedicated entry point for the control panel at `/admin`.
 *
 * Deliberately plain: this is a working screen for the clinic owner, not a
 * marketing page, so it carries no imagery or promotional copy.
 */
export default function AdminLogin() {
  const { login } = useAuth();
  const toast = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("اكتب الإيميل والباسورد.");
      return;
    }

    setBusy(true);
    try {
      const account = await login(email.trim(), password);
      if (account.role !== "admin") {
        setError("الحساب ده مش أدمن. افتح حسابك العادي من صفحة تسجيل الدخول.");
        return;
      }
      toast.success("أهلاً بلوحة التحكم 👋");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "حصل خطأ. جرب تاني.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink px-5 py-12">
      <div
        className="pointer-events-none absolute -top-40 left-1/2 size-[560px] -translate-x-1/2 rounded-full bg-lemon/10 blur-[150px]"
        aria-hidden
      />

      <div className="relative w-full max-w-md">
        <Link to="/" className="inline-flex">
          <Logo />
        </Link>

        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="mt-10">
            <LogoBadge />
            <h1 className="mt-5 text-3xl leading-tight md:text-4xl">لوحة تحكم الموقع.</h1>
            <p className="mt-3 text-sm leading-relaxed text-cream/55">
              دخول الإدارة لاعتماد المدفوعات، متابعة العملاء، وتحديث محتوى الموقع.
            </p>
          </div>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <div>
              <label htmlFor="admin-email" className="mb-1.5 block text-xs font-semibold text-cream/60">
                إيميل الإدارة
              </label>
              <div className="relative">
                <Mail
                  className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-cream/30"
                  aria-hidden
                />
                <input
                  id="admin-email"
                  type="email"
                  className="field ps-10"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="admin@example.com"
                  dir="ltr"
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="admin-password" className="mb-1.5 block text-xs font-semibold text-cream/60">
                الباسورد
              </label>
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-cream/30"
                  aria-hidden
                />
                <input
                  id="admin-password"
                  type={visible ? "text" : "password"}
                  className="field ps-10 pe-12"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  dir="ltr"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setVisible((prev) => !prev)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-cream/35 transition-colors hover:text-lemon"
                  aria-label={visible ? "إخفاء الباسورد" : "إظهار الباسورد"}
                >
                  {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-xs leading-relaxed text-red-200"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="shine inline-flex w-full items-center justify-center gap-2 rounded-full bg-lemon px-6 py-4 text-sm font-bold text-ink transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_45px_-14px_rgba(212,255,63,0.65)] disabled:translate-y-0 disabled:opacity-60"
            >
              {busy ? <Spinner className="text-ink" /> : <ShieldCheck className="size-4" aria-hidden />}
              {busy ? "لحظة…" : "دخول لوحة التحكم"}
            </button>
          </form>

          <div className="mt-8 flex items-center justify-center gap-2 text-[11px] text-cream/30">
            <ShieldCheck className="size-3.5 text-lemon/60" aria-hidden />
            الصفحة دي للإدارة فقط — كل عملية بتتسجل في سجل العمليات.
          </div>

          <Link
            to="/login"
            className="mt-6 flex items-center justify-center gap-1.5 text-xs text-cream/40 hover:text-lemon"
          >
            دخول كعميل
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
