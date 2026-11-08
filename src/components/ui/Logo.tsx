import { cn } from "../../lib/utils";

const ARM_PATH =
  "M3 18.34S4 7.09 7 3l5 1l-1 3.09H9v7.16h1c2-3.07 6.14-4.19 8.64-3.07c3.3 1.53 3 6.14 0 8.18C16.24 21 9 22.43 3 18.34";

export function LogoMark({ className, glow = true }: { className?: string; glow?: boolean }) {
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-lemon via-lemon to-lemon-deep text-ink",
        glow && "shadow-[0_14px_38px_-16px_rgba(212,255,63,0.85)]",
        className
      )}
      aria-hidden
    >
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_28%_18%,rgba(255,255,255,0.55),transparent_42%)]" />
      <svg viewBox="0 0 24 24" className="relative size-[62%] translate-y-[2%]" fill="currentColor">
        <path d={ARM_PATH} />
      </svg>
      <span className="absolute -end-1 -bottom-1 size-3 rounded-full border-2 border-ink bg-ink/80" />
    </span>
  );
}

interface LogoProps {
  className?: string;
  markClassName?: string;
  showText?: boolean;
  compact?: boolean;
}

export function Logo({ className, markClassName, showText = true, compact = false }: LogoProps) {
  return (
    <span className={cn("group flex items-center gap-3", className)}>
      <LogoMark className={cn("size-10", markClassName)} />
      {showText && (
        <span className="leading-tight">
          <span
            className={cn(
              "block font-display font-bold tracking-tight text-cream transition-colors group-hover:text-lemon",
              compact ? "text-sm" : "text-[0.95rem]"
            )}
          >
            د. مصطفى يوسف
          </span>
          <span className="mt-0.5 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-cream/40">
            <span className="inline-block size-1 rounded-full bg-lemon" />
            MOSTAFA YOUSSEF
          </span>
        </span>
      )}
    </span>
  );
}

export function LogoBadge({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 rounded-full border border-lemon/25 bg-lemon/[0.07] px-3 py-1.5", className)}>
      <LogoMark className="size-5 rounded-md" glow={false} />
      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-lemon">MOSTAFA YOUSSEF</span>
    </span>
  );
}
