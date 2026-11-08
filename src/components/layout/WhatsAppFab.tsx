import { MessageCircle } from "lucide-react";
import { useLang } from "../../lib/i18n";
import { useSiteInfo } from "../../lib/use-site-info";

export function WhatsAppFab() {
  const { lang } = useLang();
  const info = useSiteInfo();
  const message = lang === "ar" ? "السلام عليكم، عايز أستشير في برنامج مناسب ليّ." : "Hi, I'd like advice on the right program.";

  return (
    <a
      href={`https://wa.me/${info.whatsapp}?text=${encodeURIComponent(message)}`}
      target="_blank"
      rel="noreferrer"
      aria-label={lang === "ar" ? "كلمني على واتساب" : "Message me on WhatsApp"}
      className="group fixed bottom-5 end-5 z-40 flex size-14 items-center justify-center rounded-full bg-lemon text-ink shadow-[0_18px_45px_-12px_rgba(212,255,63,0.75)] transition-transform duration-300 hover:scale-105 md:bottom-7 md:end-7"
    >
      <span className="absolute inset-0 rounded-full border border-lemon/60 animate-[pulse-ring_2.6s_ease-out_infinite]" aria-hidden />
      <MessageCircle className="relative size-6" aria-hidden />
    </a>
  );
}
