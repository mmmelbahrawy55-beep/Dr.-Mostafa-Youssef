import { ArrowUpRight } from "lucide-react";
import type { MouseEventHandler, ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "../../lib/utils";

type Variant = "primary" | "outline" | "ghost" | "dark" | "light";
type Size = "md" | "lg" | "sm";

interface CTAProps {
  children: ReactNode;
  to?: string;
  href?: string;
  onClick?: MouseEventHandler<HTMLElement>;
  variant?: Variant;
  size?: Size;
  className?: string;
  icon?: boolean;
  target?: string;
  rel?: string;
  type?: "button" | "submit";
  disabled?: boolean;
  ariaLabel?: string;
}

const base =
  "group relative inline-flex items-center justify-center gap-2 rounded-full font-semibold tracking-tight transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60";

const variants: Record<Variant, string> = {
  primary:
    "shine bg-lemon text-ink hover:-translate-y-0.5 hover:shadow-[0_18px_45px_-14px_rgba(212,255,63,0.65)]",
  outline:
    "border border-white/20 text-cream hover:-translate-y-0.5 hover:border-lemon/70 hover:text-lemon",
  ghost: "text-cream/70 hover:text-lemon",
  dark: "bg-ink text-cream hover:-translate-y-0.5 hover:bg-ink-3 hover:text-lemon",
  light:
    "border border-ink/20 bg-transparent text-ink hover:-translate-y-0.5 hover:border-ink hover:bg-ink hover:text-cream",
};

const sizes: Record<Size, string> = {
  sm: "px-4 py-2 text-xs",
  md: "px-5 py-3 text-sm",
  lg: "px-7 py-4 text-[0.95rem]",
};

export function CTA({
  children,
  to,
  href,
  onClick,
  variant = "primary",
  size = "md",
  className,
  icon = true,
  target,
  rel,
  type = "button",
  disabled,
  ariaLabel,
}: CTAProps) {
  const classes = cn(base, variants[variant], sizes[size], className);
  const content = (
    <>
      <span>{children}</span>
      {icon && (
        <ArrowUpRight
          className="size-4 shrink-0 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5"
          aria-hidden
        />
      )}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={classes} aria-label={ariaLabel}>
        {content}
      </Link>
    );
  }

  if (href) {
    return (
      <a href={href} className={classes} target={target} rel={rel} aria-label={ariaLabel}>
        {content}
      </a>
    );
  }

  return (
    <button type={type} onClick={onClick} className={classes} disabled={disabled} aria-label={ariaLabel}>
      {content}
    </button>
  );
}
