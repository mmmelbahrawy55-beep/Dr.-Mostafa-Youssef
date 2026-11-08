import { cn } from "../../lib/utils";

interface MarqueeProps {
  items: string[];
  reverse?: boolean;
  className?: string;
}

export function Marquee({ items, reverse, className }: MarqueeProps) {
  return (
    <div
      className={cn(
        "marquee-mask overflow-hidden border-y border-white/10 bg-ink-2/60 py-5",
        className
      )}
    >
      <div className={cn("marquee-track items-center", reverse && "marquee-reverse")} dir="ltr">
        {[0, 1].map((copy) => (
          <div key={copy} className="flex items-center" aria-hidden={copy === 1}>
            {items.map((item) => (
              <span
                key={`${copy}-${item}`}
                className="flex items-center gap-6 whitespace-nowrap ps-6 font-display text-sm font-semibold uppercase tracking-[0.18em] text-cream/50 md:text-base"
              >
                <span className="size-1.5 rounded-full bg-lemon" aria-hidden />
                {item}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
