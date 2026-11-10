import { CreditCard, Smartphone } from "lucide-react";
import { useLang } from "../../lib/i18n";
import { cn } from "../../lib/utils";

export function PaymentBadges({ className }: { className?: string }) {
  const { lang } = useLang();
  const ar = lang === "ar";

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className="inline-flex items-center gap-2 rounded-xl border border-red-500/25 bg-red-500/[0.08] px-3 py-2 text-[11px] font-bold text-red-200">
        <span className="flex size-6 items-center justify-center rounded-full bg-red-500 text-white">
          <Smartphone className="size-3.5" aria-hidden />
        </span>
        {ar ? "فودافون كاش" : "Vodafone Cash"}
      </span>
      <span className="inline-flex items-center gap-2 rounded-xl border border-violet-400/25 bg-violet-500/[0.08] px-3 py-2 text-[11px] font-bold text-violet-200">
        <span className="flex size-6 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 text-white">
          <CreditCard className="size-3.5" aria-hidden />
        </span>
        {ar ? "إنستاباي" : "InstaPay"}
      </span>
      <span className="inline-flex items-center gap-1.5 rounded-xl border border-lemon/20 bg-lemon/[0.05] px-3 py-2 text-[11px] font-bold text-lemon">
        {ar ? "تحقق تلقائي من التحويل" : "Automatic verification"}
      </span>
    </div>
  );
}
