import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Clock, Mail, MapPin, MessageCircle, Phone, Send } from "lucide-react";
import { useState, type FormEvent } from "react";
import { CTA } from "../components/ui/CTA";
import { PageHero } from "../components/ui/PageHero";
import { Reveal } from "../components/ui/Reveal";
import { Spinner } from "../components/ui/Spinner";
import { useToast } from "../components/ui/Toast";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useLang } from "../lib/i18n";
import { localize } from "../lib/localize";
import { useSiteInfo } from "../lib/use-site-info";
import { cn } from "../lib/utils";

export default function Contact() {
  const { t, lang } = useLang();
  const info = useSiteInfo();
  const { user } = useAuth();
  const toast = useToast();

  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [goalIndex, setGoalIndex] = useState(0);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const goal = t.contact.form.goals[goalIndex];
  const whatsappText =
    lang === "ar"
      ? [
          "طلب استشارة من الموقع",
          `الاسم: ${name.trim()}`,
          `الموبايل: ${phone.trim()}`,
          `الهدف: ${goal}`,
          message.trim() ? `ملاحظات: ${message.trim()}` : "",
        ]
          .filter(Boolean)
          .join("\n")
      : [
          "Consultation request from the website",
          `Name: ${name.trim()}`,
          `Phone: ${phone.trim()}`,
          `Goal: ${goal}`,
          message.trim() ? `Notes: ${message.trim()}` : "",
        ]
          .filter(Boolean)
          .join("\n");

  const whatsappHref = `https://wa.me/${info.whatsapp}${whatsappText ? `?text=${encodeURIComponent(whatsappText)}` : ""}`;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next: { name?: string; phone?: string } = {};

    if (name.trim().length < 2) next.name = t.contact.form.errors.name;
    if (!/^[0-9+\-\s()]{8,20}$/.test(phone.trim())) next.phone = t.contact.form.errors.phone;

    setErrors(next);
    if (Object.keys(next).length > 0) {
      setSent(false);
      return;
    }

    setBusy(true);
    try {
      await api("/api/messages", {
        method: "POST",
        body: {
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          goal,
          message: message.trim(),
        },
      });
      setSent(true);
      toast.success(
        lang === "ar" ? "وصلتنا رسالتك، وهنرد عليك في أقرب وقت." : "We got your message — we'll get back to you soon."
      );
      setMessage("");
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? localize(cause.message, lang)
          : lang === "ar"
            ? "تعذر إرسال الرسالة. جرب تاني."
            : "Couldn't send the message. Try again."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHero kicker={t.contact.intro.kicker} title={t.contact.intro.title} lead={t.contact.intro.lead} />

      <section className="container-x pb-16 md:pb-24">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <Reveal>
            <form onSubmit={handleSubmit} className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-6 md:p-8">
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="contact-name" className="mb-1.5 block text-xs font-semibold text-cream/55">
                    {t.contact.form.name}
                  </label>
                  <input
                    id="contact-name"
                    className={cn("field", errors.name && "border-red-400/60")}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder={lang === "ar" ? "اسمك الكامل" : "Your full name"}
                    autoComplete="name"
                    aria-invalid={Boolean(errors.name)}
                  />
                  {errors.name && <p className="mt-1.5 text-[11px] text-red-300">{errors.name}</p>}
                </div>

                <div>
                  <label htmlFor="contact-phone" className="mb-1.5 block text-xs font-semibold text-cream/55">
                    {t.contact.form.phone}
                  </label>
                  <input
                    id="contact-phone"
                    className={cn("field", errors.phone && "border-red-400/60")}
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="01xxxxxxxxx"
                    inputMode="tel"
                    dir="ltr"
                    autoComplete="tel"
                    aria-invalid={Boolean(errors.phone)}
                  />
                  {errors.phone && <p className="mt-1.5 text-[11px] text-red-300">{errors.phone}</p>}
                </div>

                <div>
                  <label htmlFor="contact-email" className="mb-1.5 block text-xs font-semibold text-cream/55">
                    الإيميل (اختياري)
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    className="field"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    dir="ltr"
                    autoComplete="email"
                  />
                </div>

                <div>
                  <label htmlFor="contact-goal" className="mb-1.5 block text-xs font-semibold text-cream/55">
                    {t.contact.form.goal}
                  </label>
                  <select
                    id="contact-goal"
                    className="field"
                    value={goalIndex}
                    onChange={(event) => setGoalIndex(Number(event.target.value))}
                  >
                    {t.contact.form.goals.map((item, index) => (
                      <option key={item} value={index}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="contact-message" className="mb-1.5 block text-xs font-semibold text-cream/55">
                    {t.contact.form.message}
                  </label>
                  <textarea
                    id="contact-message"
                    className="field min-h-28 resize-y"
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    rows={4}
                    placeholder="احكيلنا عن هدفك وأي تفاصيل تحب تعرفها…"
                  />
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-full bg-lemon px-6 py-3.5 text-sm font-bold text-ink transition-transform hover:-translate-y-0.5 disabled:opacity-60"
                >
                  {busy ? <Spinner className="text-ink" /> : <Send className="size-4" aria-hidden />}
                  {busy ? "بنبعت…" : t.contact.form.submit}
                </button>
                <a
                  href={`tel:${info.phone}`}
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3.5 text-sm font-semibold text-cream/70 transition-colors hover:text-lemon"
                >
                  <Phone className="size-4" aria-hidden />
                  {t.contact.info.call}
                </a>
              </div>

              <AnimatePresence>
                {sent && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-4 rounded-2xl border border-lemon/30 bg-lemon/10 p-4"
                  >
                    <p className="flex items-center gap-2 text-xs font-bold text-lemon">
                      <CheckCircle2 className="size-4" aria-hidden />
                      {t.contact.form.success}
                    </p>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-cream/50">
                      لو مستعجل، تقدر تبعتلنا نفس التفاصيل على واتساب وهنرد عليك أسرع.
                    </p>
                    <a
                      href={whatsappHref}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2.5 inline-flex items-center gap-1.5 text-[11px] font-bold text-lemon hover:underline"
                    >
                      <MessageCircle className="size-3.5" aria-hidden />
                      ابعت على واتساب
                    </a>
                  </motion.div>
                )}
              </AnimatePresence>
              <p className="mt-4 text-[11px] leading-relaxed text-cream/35">{t.contact.form.note}</p>
            </form>
          </Reveal>

          <div className="space-y-4">
            <Reveal delay={0.06}>
              <div className="rounded-[2rem] border border-white/10 bg-ink-2 p-6 md:p-7">
                <h2 className="text-lg">{t.contact.info.title}</h2>
                <ul className="mt-5 space-y-4 text-sm">
                  <li>
                    <a href={`tel:${info.phone}`} className="flex items-start gap-3 text-cream/70 transition-colors hover:text-lemon">
                      <Phone className="mt-0.5 size-4 shrink-0 text-lemon" aria-hidden />
                      <span dir="ltr">{info.phoneDisplay}</span>
                    </a>
                  </li>
                  <li>
                    <a
                      href={`mailto:${info.email}`}
                      className="flex items-start gap-3 text-cream/70 transition-colors hover:text-lemon"
                    >
                      <Mail className="mt-0.5 size-4 shrink-0 text-lemon" aria-hidden />
                      <span dir="ltr">{info.email}</span>
                    </a>
                  </li>
                  <li className="flex items-start gap-3 text-cream/70">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-lemon" aria-hidden />
                    <span>{info.address[lang]}</span>
                  </li>
                  <li className="flex items-start gap-3 text-cream/70">
                    <Clock className="mt-0.5 size-4 shrink-0 text-lemon" aria-hidden />
                    <span>{info.hours[lang]}</span>
                  </li>
                </ul>
                <p className="mt-5 border-t border-white/10 pt-4 text-[11px] text-cream/35">
                  {t.contact.info.responseNote}
                </p>
                <CTA
                  href={whatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-5 w-full"
                  icon={false}
                >
                  {t.contact.info.whatsapp}
                </CTA>
              </div>
            </Reveal>

            <Reveal delay={0.12}>
              <div className="overflow-hidden rounded-[2rem] border border-white/10">
                <iframe
                  title="Google Maps"
                  src={info.mapEmbed}
                  className="h-64 w-full grayscale-[0.4] contrast-[1.1]"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            </Reveal>
          </div>
        </div>
      </section>
    </>
  );
}
