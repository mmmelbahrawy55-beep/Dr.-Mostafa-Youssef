import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  Check,
  CheckCircle2,
  ClipboardCopy,
  Clock3,
  CreditCard,
  ImagePlus,
  Info,
  Lock,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trash2,
  UploadCloud,
  UserRound,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import type { PaymentDTO } from "../../shared/types";
import { PaymentBadges } from "../components/ui/PaymentBadges";
import { Photo } from "../components/ui/Photo";
import { Spinner } from "../components/ui/Spinner";
import { useToast } from "../components/ui/Toast";
import { api, formatEgp } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useLang } from "../lib/i18n";
import { compressImage } from "../lib/image";
import { localize } from "../lib/localize";
import { useSiteData } from "../lib/site-data";
import { useSiteInfo } from "../lib/use-site-info";
import { cn } from "../lib/utils";

type Method = "vodafone" | "instapay";

interface SubmitResult {
  payment: { id: number; status: PaymentDTO["status"]; risk: string[]; amount: number };
  subscriptionId: number | null;
  auto: boolean;
}

export default function Subscribe() {
  const { programId = "" } = useParams();
  const { t, lang } = useLang();
  const ar = lang === "ar";
  const { loading: siteLoading } = useSiteData();
  const { user, loading: authLoading } = useAuth();
  const info = useSiteInfo();
  const toast = useToast();

  const program = useMemo(
    () => t.programs.find((item) => (item.contentId ?? item.id) === programId || item.id === programId),
    [t.programs, programId]
  );
  const amount = program?.amount ?? Number((program?.price ?? "0").replace(/[^\d]/g, "")) ?? 0;
  const days = program?.days ?? 30;

  const [method, setMethod] = useState<Method>("vodafone");
  const [sender, setSender] = useState(user?.phone ?? "");
  const [reference, setReference] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SubmitResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user?.phone && !sender) setSender(user.phone);
  }, [user?.phone, sender]);

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : ""), [file]);
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const target = method === "vodafone" ? info.payments.vodafone : info.payments.instapay;
  const methodLabel =
    method === "vodafone" ? (ar ? "فودافون كاش" : "Vodafone Cash") : ar ? "إنستاباي" : "InstaPay";

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(ar ? `تم نسخ ${label}.` : `${label} copied.`);
    } catch {
      toast.error(ar ? "مش قادر أنسخ تلقائيًا — انسخه يدوي." : "Auto-copy failed — copy it manually.");
    }
  };

  const acceptFile = (candidate: File | undefined) => {
    if (!candidate) return;
    if (!candidate.type.startsWith("image/"))
      return toast.error(ar ? "الملف لازم يكون صورة (JPG / PNG / WebP)." : "The file must be an image (JPG / PNG / WebP).");
    if (candidate.size > 12 * 1024 * 1024)
      return toast.error(
        ar ? "حجم الصورة أكبر من 12 ميجا. صوّر سكرين شوت أوضح بحجم أصغر." : "The image exceeds 12 MB. Take a smaller screenshot."
      );
    setFile(candidate);
    setError("");
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    acceptFile(event.dataTransfer.files?.[0]);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    if (!program) return setError(ar ? "الباقة غير متاحة." : "That plan isn't available.");
    if (!sender.trim())
      return setError(ar ? "اكتب رقم المحفظة أو الحساب اللي حوّلت منه." : "Enter the wallet or account you transferred from.");
    if (method === "vodafone" && !/^01[0125]\d{8}$/.test(sender.trim()))
      return setError(
        ar
          ? "رقم فودافون كاش لازم يكون 11 رقم ويبدأ بـ 010 أو 011 أو 012 أو 015."
          : "A Vodafone Cash number must be 11 digits starting 010, 011, 012 or 015."
      );
    if (method === "instapay" && sender.trim().length < 5)
      return setError(ar ? "اكتب بيانات حساب إنستاباي المُحوّل منه." : "Enter the InstaPay account you transferred from.");
    if (reference.trim().length < 4)
      return setError(
        ar ? "اكتب رقم عملية التحويل كما يظهر في الإيصال." : "Enter the transaction reference exactly as shown on the receipt."
      );
    if (!file) return setError(ar ? "ارفع صورة إيصال التحويل." : "Upload the transfer receipt screenshot.");

    setBusy(true);
    try {
      // Phone screenshots are often 8–12 MB; shrink before upload so every
      // request stays below Vercel's 4.5 MB serverless body limit.
      const upload = await compressImage(file);
      if (upload.size > 4 * 1024 * 1024) {
        setError(
          ar
            ? "الصورة لسه أكبر من 4 ميجا بعد الضغط. ارفع سكرين شوت أوضح بحجم أصغر."
            : "The image is still over 4 MB after compression. Upload a smaller screenshot."
        );
        return;
      }

      const form = new FormData();
      form.append("programId", program.contentId ?? program.id);
      form.append("method", method);
      form.append("sender", sender.trim());
      form.append("reference", reference.trim());
      form.append("amount", String(amount));
      form.append("screenshot", upload);

      const payload = await api<SubmitResult>("/api/payments", { method: "POST", body: form });
      setResult(payload);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? localize(cause.message, lang)
          : ar
            ? "تعذر إرسال الدفعة. جرب تاني."
            : "Couldn't submit the payment. Try again."
      );
    } finally {
      setBusy(false);
    }
  };

  if (!program) {
    // The dictionary is empty until /api/site resolves — wait instead of
    // flashing the "missing plan" panel for a plan that does exist.
    if (siteLoading) {
      return (
        <div className="flex min-h-[70vh] items-center justify-center">
          <Spinner className="size-8 text-lemon" />
        </div>
      );
    }
    return (
      <div className="container-x pb-20 pt-32">
        <div className="panel mx-auto max-w-lg p-8 text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-200">
            <Info className="size-6" aria-hidden />
          </span>
          <h1 className="mt-4 text-xl">{ar ? "الباقة مش موجودة" : "Plan not found"}</h1>
          <p className="mt-2 text-sm text-cream/45">
            {ar
              ? "يمكن الرابط قديم أو الباقة اتشالت. اختار باقة تانية من صفحة الباقات."
              : "The link may be outdated or the plan was removed. Pick another plan from the plans page."}
          </p>
          <Link to="/programs" className="mt-5 inline-flex items-center gap-2 rounded-full bg-lemon px-5 py-3 text-xs font-bold text-ink">
            {ar ? "كل الباقات" : "All plans"}
            <ArrowUpRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
    );
  }

  if (result) {
    const approved = result.auto || result.payment.status === "auto_approved" || result.payment.status === "approved";
    return (
      <div className="container-x pb-20 pt-28">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-2xl">
          <div className="panel overflow-hidden">
            <div
              className={cn(
                "relative px-6 py-10 text-center md:px-10",
                approved ? "bg-gradient-to-b from-lemon/15 to-transparent" : "bg-gradient-to-b from-amber-400/10 to-transparent"
              )}
            >
              <span
                className={cn(
                  "mx-auto flex size-20 items-center justify-center rounded-full border",
                  approved ? "border-lemon/40 bg-lemon/15 text-lemon" : "border-amber-400/40 bg-amber-400/10 text-amber-200"
                )}
              >
                {approved ? <CheckCircle2 className="size-10" aria-hidden /> : <Clock3 className="size-10" aria-hidden />}
              </span>
              <h1 className="mt-5 text-2xl md:text-3xl">
                {approved
                  ? ar
                    ? "تم تفعيل باقتك بنجاح 🎉"
                    : "Your plan is active 🎉"
                  : ar
                    ? "إيصالك وصل وبيراجَع"
                    : "Receipt received — under review"}
              </h1>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-cream/55">
                {approved
                  ? ar
                    ? `باقة «${program.name}» شغالة دلوقتي لمدة ${days} يوم. تقدر تبدأ من حسابك فورًا.`
                    : `“${program.name}” is active for ${days} days. You can start from your account now.`
                  : ar
                    ? "التحقق التلقائي محتاج مراجعة بسيطة من فريق الدكتور. عادةً بنراجع الإيصالات خلال ساعات العمل، وهتلاقي التحديث في حسابك."
                    : "Automatic verification needs a quick review from the team. Receipts are usually checked within working hours, and the update will appear in your account."}
              </p>
              <div className="mx-auto mt-5 inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.03] px-4 py-2 text-[11px] text-cream/60">
                <span>{ar ? "رقم الدفعة" : "Payment"} #{result.payment.id}</span>
                <span className="text-cream/20">·</span>
                <span>{formatEgp(result.payment.amount, lang)}</span>
                <span className="text-cream/20">·</span>
                <span>{methodLabel}</span>
              </div>
            </div>

            <div className="border-t border-white/10 p-6 md:p-8">
              {!approved && result.payment.risk.length > 0 && (
                <div className="mb-5 rounded-xl border border-amber-400/25 bg-amber-400/[0.06] p-4">
                  <p className="flex items-center gap-1.5 text-[11px] font-bold text-amber-200">
                    <Info className="size-3.5" aria-hidden />
                    {ar ? "ملاحظات على الإيصال (مش بالضرورة مشكلة):" : "Notes on the receipt (not necessarily problems):"}
                  </p>
                  <ul className="mt-2 space-y-1">
                    {result.payment.risk.map((reason) => (
                      <li key={reason} className="flex items-start gap-1.5 text-[11px] leading-relaxed text-cream/55">
                        <span className="mt-1.5 size-1 shrink-0 rounded-full bg-amber-300" aria-hidden />
                        {localize(reason, lang)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Link
                  to="/account"
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-lemon px-5 py-3 text-xs font-bold text-ink"
                >
                  <UserRound className="size-4" aria-hidden />
                  {ar ? "روح لحسابك" : "Go to your account"}
                </Link>
                <Link
                  to="/programs"
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-white/15 px-5 py-3 text-xs font-bold text-cream/70 transition-colors hover:border-lemon/50 hover:text-lemon"
                >
                  {ar ? "باقي الباقات" : "Other plans"}
                </Link>
              </div>

              <p className="mt-5 flex items-start gap-2 text-[11px] leading-relaxed text-cream/35">
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-lemon/60" aria-hidden />
                {ar
                  ? "احتفظ بصورة التحويل عندك لحد ما الباقة تتفعّل. لو عندك استفسار تواصل معانا من صفحة اتصل بنا مع رقم الدفعة."
                  : "Keep the transfer screenshot until your plan activates. Any questions — reach us from the contact page with your payment number."}
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="pb-20 pt-24 md:pt-28">
      <div className="container-x">
        <Link
          to="/programs"
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-cream/45 transition-colors hover:text-lemon"
        >
          <ArrowLeft className="size-3.5 rtl:rotate-180" aria-hidden />
          {ar ? "رجوع للباقات" : "Back to plans"}
        </Link>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-lemon">
              {ar ? "إتمام الاشتراك" : "Complete your subscription"}
            </p>
            <h1 className="mt-2 text-2xl md:text-3xl">
              {ar ? "خطوتين وتحوّلك يبدأ" : "Two steps and your transformation begins"}
            </h1>
            <p className="mt-2 max-w-xl text-xs leading-relaxed text-cream/45">
              {ar
                ? "حوّل قيمة الباقة على فودافون كاش أو إنستاباي، وبعدين ارفع صورة التحويل. التحقق بيتم تلقائيًا في أغلب الحالات."
                : "Transfer the plan amount via Vodafone Cash or InstaPay, then upload the screenshot. Verification is automatic in most cases."}
            </p>
          </div>
          <PaymentBadges />
        </div>

        <div className="mt-7 grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          {/* Summary */}
          <aside className="space-y-4 lg:sticky lg:top-24">
            <div className="panel overflow-hidden">
              <div className="relative h-40">
                <Photo
                  src={program.image}
                  alt={program.name}
                  wrapperClassName="absolute inset-0"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0b0d08] via-[#0b0d08]/30 to-transparent" aria-hidden />
                <span className="absolute start-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-lemon/30 bg-ink/60 px-3 py-1 text-[10px] font-bold text-lemon backdrop-blur">
                  <Sparkles className="size-3" aria-hidden />
                  {ar ? "باقتك المختارة" : "Your selected plan"}
                </span>
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-xl font-bold text-cream">{program.name}</h2>
                    <p className="mt-1 text-[11px] text-cream/40">{program.tagline}</p>
                  </div>
                  <div className="text-end">
                    <p className="font-display text-2xl font-black text-lemon">{formatEgp(amount, lang)}</p>
                    <p className="text-[10px] text-cream/35">{ar ? `لمدة ${days} يوم` : `For ${days} days`}</p>
                  </div>
                </div>

                <ul className="mt-4 space-y-2">
                  {program.features.slice(0, 5).map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-[11px] leading-relaxed text-cream/60">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-lemon" aria-hidden />
                      {feature}
                    </li>
                  ))}
                </ul>

                <div className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[10px] text-cream/45">
                  <span className="flex items-center gap-1.5">
                    <Lock className="size-3.5 text-lemon/70" aria-hidden />
                    {ar ? "دفع آمن ومتحقق منه" : "Secure, verified payment"}
                  </span>
                  <span>{ar ? "تفعيل فوري" : "Instant activation"}</span>
                </div>
              </div>
            </div>

            <div className="panel-soft p-4">
              <p className="flex items-center gap-1.5 text-[11px] font-bold text-cream/65">
                <ShieldCheck className="size-3.5 text-lemon" aria-hidden />
                {ar ? "إيه اللي بيحصل بعد الدفع؟" : "What happens after payment?"}
              </p>
              <ol className="mt-3 space-y-2.5">
                {(ar
                  ? [
                      "بنراجع صورة التحويل ونتأكد من المبلغ ورقم العملية.",
                      "لو كل حاجة سليمة، الباقة بتتفعّل تلقائيًا.",
                      "لو محتاج مراجعة يدوية، فريق الدكتور بيراجعها بسرعة.",
                      "تقدر تتابع حالة الدفعة في أي وقت من حسابك.",
                    ]
                  : [
                      "We check the screenshot, the amount and the transaction reference.",
                      "If everything matches, the plan activates automatically.",
                      "If a manual review is needed, the team checks it quickly.",
                      "You can track the payment status any time from your account.",
                    ]
                ).map((step, index) => (
                  <li key={step} className="flex items-start gap-2.5 text-[11px] leading-relaxed text-cream/45">
                    <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-lemon/15 text-[9px] font-bold text-lemon">
                      {index + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          </aside>

          {/* Checkout */}
          <div className="panel overflow-hidden">
            {authLoading ? (
              <div className="flex items-center justify-center py-24">
                <Spinner className="size-7 text-lemon" />
              </div>
            ) : !user ? (
              <div className="px-6 py-14 text-center md:px-10">
                <span className="mx-auto flex size-16 items-center justify-center rounded-2xl border border-lemon/30 bg-lemon/10 text-lemon">
                  <UserRound className="size-7" aria-hidden />
                </span>
                <h2 className="mt-5 text-xl">{ar ? "سجل دخول الأول عشان تدفع" : "Sign in first to pay"}</h2>
                <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-cream/45">
                  {ar
                    ? "بنربط الدفعة بحسابك عشان تتابع الباقة والإيصالات في أي وقت، وتضمن إن تفعيل الباقة يوصلك على طول."
                    : "We link the payment to your account so you can track the plan and receipts any time, and your activation arrives right away."}
                </p>
                <div className="mx-auto mt-6 flex max-w-sm flex-col gap-2 sm:flex-row">
                  <Link
                    to={`/login?next=${encodeURIComponent(`/subscribe/${programId}`)}`}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-lemon px-5 py-3 text-xs font-bold text-ink"
                  >
                    {ar ? "تسجيل الدخول" : "Sign in"}
                  </Link>
                  <Link
                    to={`/register?next=${encodeURIComponent(`/subscribe/${programId}`)}`}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-white/15 px-5 py-3 text-xs font-bold text-cream/70 transition-colors hover:border-lemon/50 hover:text-lemon"
                  >
                    {ar ? "حساب جديد" : "Create account"}
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={submit} className="p-5 md:p-7">
                <ol className="flex flex-wrap items-center gap-2 text-[10px] font-semibold text-cream/35">
                  {(ar ? ["اختار الطريقة", "حوّل المبلغ", "ارفع الإيصال"] : ["Choose method", "Transfer", "Upload receipt"]).map(
                    (step, index) => (
                      <li key={step} className="flex items-center gap-2">
                        <span className="flex size-5 items-center justify-center rounded-full bg-lemon/15 text-[9px] font-bold text-lemon">
                          {index + 1}
                        </span>
                        {step}
                        {index < 2 && <span className="ms-1 h-px w-6 bg-white/15" aria-hidden />}
                      </li>
                    )
                  )}
                </ol>

                {/* Method */}
                <div className="mt-6">
                  <p className="mb-2 text-[11px] font-bold text-cream/60">{ar ? "طريقة الدفع" : "Payment method"}</p>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setMethod("vodafone")}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border p-3 text-start transition-colors",
                        method === "vodafone"
                          ? "border-lemon/60 bg-lemon/[0.08]"
                          : "border-white/10 bg-white/[0.02] hover:border-white/20"
                      )}
                    >
                      <span className="flex size-9 items-center justify-center rounded-xl bg-red-500 text-white">
                        <Smartphone className="size-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-bold text-cream">{ar ? "فودافون كاش" : "Vodafone Cash"}</span>
                        <span className="mt-0.5 block text-[10px] text-cream/40">
                          {ar ? "تحويل من محفظتك" : "From your wallet"}
                        </span>
                      </span>
                      {method === "vodafone" && <Check className="size-4 text-lemon" aria-hidden />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setMethod("instapay")}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border p-3 text-start transition-colors",
                        method === "instapay"
                          ? "border-lemon/60 bg-lemon/[0.08]"
                          : "border-white/10 bg-white/[0.02] hover:border-white/20"
                      )}
                    >
                      <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 text-white">
                        <CreditCard className="size-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-bold text-cream">{ar ? "إنستاباي" : "InstaPay"}</span>
                        <span className="mt-0.5 block text-[10px] text-cream/40">
                          {ar ? "من حسابك البنكي" : "From your bank account"}
                        </span>
                      </span>
                      {method === "instapay" && <Check className="size-4 text-lemon" aria-hidden />}
                    </button>
                  </div>
                </div>

                {/* Transfer target */}
                <div className="mt-4 rounded-2xl border border-lemon/20 bg-lemon/[0.04] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] text-cream/40">
                        {method === "vodafone"
                          ? ar
                            ? "حوّل على محفظة"
                            : "Transfer to wallet"
                          : ar
                            ? "حوّل على حساب إنستاباي"
                            : "Transfer to InstaPay account"}
                      </p>
                      <p className="mt-1 truncate font-latin text-xl font-bold tracking-wide text-lemon" dir="ltr">
                        {target}
                      </p>
                      <p className="mt-0.5 text-[10px] text-cream/40">
                        {ar ? `باسم ${info.payments.accountName}` : `To ${info.payments.accountName}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        copy(
                          target,
                          method === "vodafone"
                            ? ar
                              ? "رقم المحفظة"
                              : "Wallet number"
                            : ar
                              ? "عنوان إنستاباي"
                              : "InstaPay address"
                        )
                      }
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-lemon/30 bg-ink/30 px-3 py-2 text-[10px] font-bold text-lemon transition-colors hover:bg-lemon/10"
                    >
                      <ClipboardCopy className="size-3.5" aria-hidden />
                      {ar ? "نسخ" : "Copy"}
                    </button>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-lemon/15 pt-3">
                    <span className="text-[10px] text-cream/40">
                      {ar ? "المبلغ المطلوب بالظبط" : "The exact amount due"}
                    </span>
                    <button
                      type="button"
                      onClick={() => copy(String(amount), ar ? "المبلغ" : "Amount")}
                      className="inline-flex items-center gap-1.5 rounded-full bg-ink/30 px-3 py-1.5 text-[11px] font-bold text-cream transition-colors hover:text-lemon"
                    >
                      {formatEgp(amount, lang)}
                      <ClipboardCopy className="size-3 text-cream/40" aria-hidden />
                    </button>
                  </div>
                  {(ar ? info.payments.instructionsAr : info.payments.instructionsEn) && (
                    <p className="mt-3 border-t border-lemon/15 pt-3 text-[10px] leading-relaxed text-cream/45">
                      {ar ? info.payments.instructionsAr : info.payments.instructionsEn}
                    </p>
                  )}
                </div>

                <p className="mt-2 flex items-start gap-1.5 text-[10px] leading-relaxed text-cream/30">
                  <Info className="mt-0.5 size-3 shrink-0" aria-hidden />
                  {ar
                    ? "حوّل نفس المبلغ بالظبط — أي فرق في المبلغ بيحوّل الدفعة للمراجعة اليدوية."
                    : "Transfer the exact amount — any difference sends the payment to manual review."}
                </p>

                {/* Details */}
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="pay-sender" className="mb-1.5 block text-[11px] font-semibold text-cream/55">
                      {method === "vodafone"
                        ? ar
                          ? "رقم المحفظة المُحوّل منها"
                          : "Wallet number you sent from"
                        : ar
                          ? "حساب إنستاباي المُحوّل منه"
                          : "InstaPay account you sent from"}
                    </label>
                    <input
                      id="pay-sender"
                      className="field"
                      value={sender}
                      onChange={(event) => setSender(event.target.value)}
                      dir="ltr"
                      inputMode="tel"
                      placeholder={method === "vodafone" ? "01xxxxxxxxx" : "name@instapay"}
                    />
                  </div>
                  <div>
                    <label htmlFor="pay-reference" className="mb-1.5 block text-[11px] font-semibold text-cream/55">
                      {ar ? "رقم عملية التحويل" : "Transaction reference"}
                    </label>
                    <input
                      id="pay-reference"
                      className="field"
                      value={reference}
                      onChange={(event) => setReference(event.target.value)}
                      dir="ltr"
                      placeholder={ar ? "زي ما هو في الإيصال" : "As shown on the receipt"}
                    />
                  </div>
                </div>

                {/* Upload */}
                <div className="mt-5">
                  <p className="mb-1.5 text-[11px] font-semibold text-cream/55">
                    {ar ? "صورة إيصال التحويل" : "Transfer receipt screenshot"}
                  </p>
                  <input
                    ref={inputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(event) => acceptFile(event.target.files?.[0])}
                  />
                  {file ? (
                    <div className="flex items-center gap-3 rounded-xl border border-lemon/25 bg-lemon/[0.04] p-3">
                      <img
                        src={preview}
                        alt={ar ? "معاينة الإيصال" : "Receipt preview"}
                        className="h-16 w-14 rounded-lg border border-white/10 object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-cream">{file.name}</p>
                        <p className="mt-0.5 text-[10px] text-cream/40">
                          {ar
                            ? `${(file.size / 1024).toFixed(0)} كيلوبايت · جاهزة للإرسال`
                            : `${(file.size / 1024).toFixed(0)} KB · ready to upload`}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setFile(null);
                          if (inputRef.current) inputRef.current.value = "";
                        }}
                        className="rounded-full border border-white/15 p-2 text-cream/50 hover:border-red-400/40 hover:text-red-200"
                        aria-label={ar ? "حذف الصورة" : "Remove image"}
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </button>
                    </div>
                  ) : (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => inputRef.current?.click()}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        setDragging(true);
                      }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={onDrop}
                      className={cn(
                        "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-8 text-center transition-colors",
                        dragging ? "border-lemon/70 bg-lemon/[0.06]" : "border-white/15 bg-white/[0.02] hover:border-lemon/40"
                      )}
                    >
                      <span className="flex size-11 items-center justify-center rounded-xl bg-lemon/10 text-lemon">
                        <UploadCloud className="size-5" aria-hidden />
                      </span>
                      <p className="text-xs font-semibold text-cream/70">
                        {ar ? "اسحب الصورة هنا أو دوس للاختيار" : "Drag the image here or click to choose"}
                      </p>
                      <p className="text-[10px] text-cream/35">
                        {ar ? "JPG أو PNG أو WebP — بنضغطها تلقائيًا قبل الرفع" : "JPG, PNG or WebP — compressed automatically before upload"}
                      </p>
                    </div>
                  )}
                </div>

                {error && (
                  <p role="alert" className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-[11px] leading-relaxed text-red-200">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="shine mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-lemon px-6 py-3.5 text-sm font-bold text-ink transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_45px_-14px_rgba(212,255,63,0.65)] disabled:opacity-60"
                >
                  {busy ? <Spinner className="text-ink" /> : <Wallet className="size-4" aria-hidden />}
                  {busy
                    ? ar
                      ? "بنرفع الإيصال ونتحقق…"
                      : "Uploading and verifying…"
                    : ar
                      ? `أرسل الدفعة (${formatEgp(amount, lang)})`
                      : `Submit payment (${formatEgp(amount, lang)})`}
                </button>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[10px] text-cream/30">
                  <span className="flex items-center gap-1.5">
                    <Lock className="size-3" aria-hidden />
                    {ar ? "الاتصال مشفر والبيانات محفوظة بأمان" : "Encrypted connection — data stored securely"}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <BadgeCheck className="size-3 text-lemon/60" aria-hidden />
                    {ar ? "تحقق تلقائي من الإيصال" : "Automatic receipt verification"}
                  </span>
                </div>
              </form>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {(ar
            ? [
                { icon: ShieldCheck, title: "إيصالك في أمان", text: "صور التحويل متاحة ليك وللفريق الطبي بس." },
                { icon: Clock3, title: "مراجعة سريعة", text: "أغلب الإيصالات بتتفعّل تلقائيًا في ثواني." },
                { icon: ImagePlus, title: "سكرين شوت واضح", text: "تأكد إن المبلغ ورقم العملية ظاهرين في الصورة." },
              ]
            : [
                { icon: ShieldCheck, title: "Your receipt is safe", text: "Transfer images are visible only to you and the medical team." },
                { icon: Clock3, title: "Quick review", text: "Most receipts are verified automatically in seconds." },
                { icon: ImagePlus, title: "Clear screenshot", text: "Make sure the amount and reference are visible in the image." },
              ]
          ).map((item) => (
            <div key={item.title} className="panel-soft flex items-start gap-3 p-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-lemon/10 text-lemon">
                <item.icon className="size-4" aria-hidden />
              </span>
              <div>
                <p className="text-xs font-bold text-cream/75">{item.title}</p>
                <p className="mt-1 text-[10px] leading-relaxed text-cream/40">{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {busy && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[105] flex items-center justify-center bg-ink/60 backdrop-blur-sm"
          >
            <div className="panel flex flex-col items-center gap-3 px-8 py-7 text-center">
              <Spinner className="size-8 text-lemon" />
              <p className="text-sm font-semibold text-cream">{ar ? "بنتحقق من الإيصال…" : "Verifying your receipt…"}</p>
              <p className="text-[11px] text-cream/40">{ar ? "ثواني ونجهّز باقتك." : "Seconds and your plan is ready."}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
