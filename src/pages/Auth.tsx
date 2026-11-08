import { motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  Mail,
  Phone,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Logo, LogoBadge } from "../components/ui/Logo";
import { Photo } from "../components/ui/Photo";
import { Spinner } from "../components/ui/Spinner";
import { useToast } from "../components/ui/Toast";
import { useAuth } from "../lib/auth";
import { images } from "../lib/images";
import { cn } from "../lib/utils";

type Mode = "login" | "register";

const safeNext = (value: string | null) => (value && value.startsWith("/") && !value.startsWith("//") ? value : "");

function PasswordInput({
  id,
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? "text" : "password"}
        className="field pe-12"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
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
  );
}

export default function Auth({ mode }: { mode: Mode }) {
  const isRegister = mode === "register";
  const { user, login, register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const strength = useMemo(() => {
    let score = 0;
    if (password.length >= 8) score += 1;
    if (/[A-Z]/.test(password) || /[a-z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    return score;
  }, [password]);

  if (user && !busy) {
    return <Navigate to={user.role === "admin" ? "/admin" : next || "/account"} replace />;
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    if (isRegister) {
      if (name.trim().length < 2) return setError("اكتب اسمك بالكامل.");
      if (!/^01[0125]\d{8}$/.test(phone.trim())) return setError("اكتب رقم موبايل مصري صحيح (01xxxxxxxxx).");
      if (password.length < 8) return setError("الباسورد لازم 8 حروف على الأقل.");
      if (password !== confirm) return setError("الباسورد وتأكيده مش متطابقين.");
    } else if (!email.trim() || !password) {
      return setError("اكتب الإيميل والباسورد.");
    }

    setBusy(true);
    try {
      const account = isRegister
        ? await register({ name: name.trim(), email: email.trim(), phone: phone.trim(), password })
        : await login(email.trim(), password);
      toast.success(isRegister ? "حسابك اتعمل بنجاح، أهلاً بيك!" : "أهلاً بيك تاني 👋");
      navigate(account.role === "admin" ? "/admin" : next || "/account", { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "حصل خطأ. جرب تاني.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-ink">
      <div className="pointer-events-none absolute -top-40 start-[-10%] size-[560px] rounded-full bg-lemon/10 blur-[150px]" aria-hidden />
      <div className="container-x relative grid min-h-screen items-center gap-10 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        <div className="mx-auto w-full max-w-md">
          <Link to="/" className="inline-flex">
            <Logo />
          </Link>

          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="mt-10">
              <LogoBadge />
              <h1 className="mt-5 text-3xl leading-tight md:text-4xl">
                {isRegister ? "اعمل حسابك وابدأ تحوّلك." : "أهلاً بيك تاني."}
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-cream/55">
                {isRegister
                  ? "حساب واحد تتابع بيه باقتك، دفعاتك، وخطتك — في مكان واحد آمن."
                  : "سجل دخولك عشان تشوف باقتك وتدفع وتتابع كل حاجة."}
              </p>
            </div>

            <form onSubmit={submit} className="mt-8 space-y-4">
              {isRegister && (
                <div>
                  <label htmlFor="auth-name" className="mb-1.5 block text-xs font-semibold text-cream/60">
                    الاسم الكامل
                  </label>
                  <div className="relative">
                    <UserRound className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-cream/30" aria-hidden />
                    <input
                      id="auth-name"
                      className="field ps-10"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="اسمك زي ما تحب نناديك"
                      autoComplete="name"
                      required
                    />
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="auth-email" className="mb-1.5 block text-xs font-semibold text-cream/60">
                  الإيميل
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-cream/30" aria-hidden />
                  <input
                    id="auth-email"
                    type="email"
                    className="field ps-10"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    dir="ltr"
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              {isRegister && (
                <div>
                  <label htmlFor="auth-phone" className="mb-1.5 block text-xs font-semibold text-cream/60">
                    رقم الموبايل
                  </label>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-cream/30" aria-hidden />
                    <input
                      id="auth-phone"
                      className="field ps-10"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="01xxxxxxxxx"
                      inputMode="tel"
                      dir="ltr"
                      autoComplete="tel"
                      required
                    />
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="auth-password" className="mb-1.5 block text-xs font-semibold text-cream/60">
                  الباسورد
                </label>
                <PasswordInput
                  id="auth-password"
                  value={password}
                  onChange={setPassword}
                  placeholder="8 حروف على الأقل"
                  autoComplete={isRegister ? "new-password" : "current-password"}
                />
                {isRegister && password.length > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex flex-1 gap-1">
                      {[1, 2, 3, 4].map((step) => (
                        <span
                          key={step}
                          className={cn(
                            "h-1 flex-1 rounded-full transition-colors",
                            strength >= step ? (strength >= 3 ? "bg-lemon" : "bg-amber-400") : "bg-white/10"
                          )}
                        />
                      ))}
                    </div>
                    <span className="text-[10px] text-cream/40">
                      {strength >= 3 ? "قوي" : strength >= 2 ? "متوسط" : "ضعيف"}
                    </span>
                  </div>
                )}
              </div>

              {isRegister && (
                <div>
                  <label htmlFor="auth-confirm" className="mb-1.5 block text-xs font-semibold text-cream/60">
                    تأكيد الباسورد
                  </label>
                  <PasswordInput id="auth-confirm" value={confirm} onChange={setConfirm} autoComplete="new-password" />
                </div>
              )}

              {error && (
                <p role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-xs leading-relaxed text-red-200">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="shine inline-flex w-full items-center justify-center gap-2 rounded-full bg-lemon px-6 py-4 text-sm font-bold text-ink transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_45px_-14px_rgba(212,255,63,0.65)] disabled:translate-y-0 disabled:opacity-60"
              >
                {busy ? <Spinner className="text-ink" /> : <Sparkles className="size-4" aria-hidden />}
                {busy ? "لحظة…" : isRegister ? "إنشاء الحساب" : "تسجيل الدخول"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-cream/50">
              {isRegister ? "عندك حساب بالفعل؟" : "معندكش حساب؟"}{" "}
              <Link to={isRegister ? `/login${next ? `?next=${encodeURIComponent(next)}` : ""}` : `/register${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-bold text-lemon hover:underline">
                {isRegister ? "سجل دخول" : "اعمل حساب جديد"}
              </Link>
            </p>

            <div className="mt-8 flex items-center justify-center gap-2 text-[11px] text-cream/30">
              <ShieldCheck className="size-3.5 text-lemon/60" aria-hidden />
              بياناتك مشفرة، والباسورد مش بيتخزن كنص.
            </div>

            <Link to="/" className="mt-6 flex items-center justify-center gap-1.5 text-xs text-cream/40 hover:text-lemon">
              <ArrowLeft className="size-3.5 rtl:rotate-180" aria-hidden />
              رجوع للموقع
            </Link>
          </motion.div>
        </div>

        <div className="relative hidden h-[min(760px,88vh)] overflow-hidden rounded-[2.5rem] border border-white/10 lg:block">
          <Photo src={isRegister ? images.heroGym : images.gymDark} alt="تدريب وتغذية" wrapperClassName="absolute inset-0" className="object-cover" overlay />
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-ink/10" aria-hidden />
          <div className="absolute inset-x-0 bottom-0 p-9">
            <div className="flex flex-wrap gap-2">
              {["متابعة أسبوعية", "خطط مخصصة", "تحاليل ومكملات"].map((item) => (
                <span key={item} className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-ink/50 px-3 py-1.5 text-[11px] font-semibold text-cream/80 backdrop-blur">
                  <Check className="size-3 text-lemon" aria-hidden />
                  {item}
                </span>
              ))}
            </div>
            <p className="mt-6 max-w-md font-display text-2xl font-bold leading-snug text-cream">
              «مش دايت… تحوّل كامل. خطة على مقاس جسمك، ومتابعة لحد ما توصل.»
            </p>
            <p className="mt-3 text-sm text-cream/50">د. مصطفى يوسف — استشاري تغذية علاجية ومدرب لياقة</p>
          </div>
        </div>
      </div>
    </div>
  );
}
