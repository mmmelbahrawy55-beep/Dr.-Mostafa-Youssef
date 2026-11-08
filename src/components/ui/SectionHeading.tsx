import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import { Reveal } from "./Reveal";

interface SectionHeadingProps {
  kicker?: string;
  title: string;
  sub?: string;
  align?: "start" | "center";
  action?: ReactNode;
  className?: string;
  titleClassName?: string;
}

export function SectionHeading({
  kicker,
  title,
  sub,
  align = "start",
  action,
  className,
  titleClassName,
}: SectionHeadingProps) {
  return (
    <Reveal
      className={cn(
        "flex flex-col gap-6 md:flex-row md:items-end md:justify-between",
        align === "center" && "md:flex-col md:items-center md:text-center",
        className
      )}
    >
      <div className={cn("max-w-2xl", align === "center" && "mx-auto")}>
        {kicker && (
          <div className={cn("eyebrow", align === "center" && "justify-center")}>
            <span className="h-px w-8 bg-lemon/70" aria-hidden />
            {kicker}
          </div>
        )}
        <h2 className={cn("mt-4 text-3xl leading-[1.15] md:text-4xl lg:text-5xl", titleClassName)}>{title}</h2>
        {sub && <p className="mt-4 text-base leading-relaxed text-cream/60 md:text-lg">{sub}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </Reveal>
  );
}
