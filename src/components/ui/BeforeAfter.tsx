import { MoveHorizontal } from "lucide-react";
import { useCallback, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { fallbackImage } from "../../lib/images";
import { cn } from "../../lib/utils";

interface BeforeAfterProps {
  before: string;
  after: string;
  beforeLabel: string;
  afterLabel: string;
  name?: string;
  stat?: string;
  hint?: string;
  className?: string;
}

export function BeforeAfter({
  before,
  after,
  beforeLabel,
  afterLabel,
  name,
  stat,
  hint,
  className,
}: BeforeAfterProps) {
  const [position, setPosition] = useState(56);
  const [dragging, setDragging] = useState(false);
  const [touched, setTouched] = useState(false);
  const [beforeFailed, setBeforeFailed] = useState(false);
  const [afterFailed, setAfterFailed] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);

  const update = useCallback((clientX: number) => {
    const frame = frameRef.current;
    if (!frame) return;
    const rect = frame.getBoundingClientRect();
    const next = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.min(100, Math.max(0, next)));
  }, []);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    setTouched(true);
    update(event.clientX);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    update(event.clientX);
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setTouched(true);
      setPosition((prev) => Math.max(0, prev - 4));
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      setTouched(true);
      setPosition((prev) => Math.min(100, prev + 4));
    }
  };

  return (
    <div className={cn("group relative", className)}>
      <div
        ref={frameRef}
        className={cn(
          "relative aspect-[4/5] w-full touch-none select-none overflow-hidden rounded-[1.9rem] border border-white/12 bg-ink-2 shadow-[0_40px_100px_-60px_rgba(0,0,0,0.95)]",
          dragging ? "cursor-ew-resize" : "cursor-ew-resize"
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        onDoubleClick={() => {
          setPosition(56);
          setTouched(true);
        }}
        role="slider"
        tabIndex={0}
        aria-label={`${beforeLabel} / ${afterLabel}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(position)}
        aria-valuetext={`${Math.round(position)}% ${beforeLabel}`}
      >
        <img
          src={afterFailed || !after ? fallbackImage : after}
          alt={name ? `${afterLabel} — ${name}` : afterLabel}
          className="absolute inset-0 size-full object-cover transition-transform duration-700 group-hover:scale-[1.015]"
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setAfterFailed(true)}
        />
        <img
          src={beforeFailed || !before ? fallbackImage : before}
          alt={name ? `${beforeLabel} — ${name}` : beforeLabel}
          className="absolute inset-0 size-full object-cover saturate-[0.82] brightness-[0.9]"
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setBeforeFailed(true)}
        />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-ink/95 via-ink/35 to-transparent" />
        <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/10" aria-hidden />
        <div className="grain pointer-events-none absolute inset-0" aria-hidden />

        {/* corner ticks */}
        <span className="pointer-events-none absolute start-4 top-4 size-5 border-s border-t border-lemon/70" aria-hidden />
        <span className="pointer-events-none absolute end-4 top-4 size-5 border-e border-t border-lemon/70" aria-hidden />
        <span className="pointer-events-none absolute bottom-4 start-4 size-5 border-b border-s border-lemon/70" aria-hidden />
        <span className="pointer-events-none absolute bottom-4 end-4 size-5 border-b border-e border-lemon/70" aria-hidden />

        <span className="pointer-events-none absolute start-5 top-5 rounded-full border border-white/15 bg-ink/65 px-3 py-1 text-[10px] font-bold text-cream/85 backdrop-blur-md">
          {beforeLabel}
        </span>
        <span className="pointer-events-none absolute end-5 top-5 rounded-full bg-lemon px-3 py-1 text-[10px] font-bold text-ink shadow-[0_8px_24px_-8px_rgba(212,255,63,0.8)]">
          {afterLabel}
        </span>

        <div
          className="pointer-events-none absolute inset-y-0 z-10 w-px bg-lemon shadow-[0_0_24px_rgba(212,255,63,0.9)]"
          style={{ left: `${position}%` }}
        >
          <div
            className={cn(
              "absolute top-1/2 left-1/2 flex size-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-lemon/70 bg-ink text-lemon shadow-[0_0_0_6px_rgba(8,9,10,0.35),0_12px_30px_-10px_rgba(0,0,0,0.9)] transition-transform duration-300",
              dragging ? "scale-95" : "group-hover:scale-105"
            )}
          >
            <MoveHorizontal className="size-5" aria-hidden />
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-3 p-5">
          <div className="min-w-0">
            {name && <p className="truncate font-display text-sm font-bold text-cream md:text-base">{name}</p>}
            {hint && (
              <p
                className={cn(
                  "mt-0.5 text-[9px] uppercase tracking-[0.18em] text-cream/45 transition-opacity duration-500",
                  touched && "opacity-0"
                )}
              >
                {hint}
              </p>
            )}
          </div>
          {stat && (
            <span className="shrink-0 rounded-full border border-lemon/30 bg-lemon/10 px-3 py-1.5 font-latin text-base text-lemon backdrop-blur">
              {stat}
            </span>
          )}
        </div>

        <div className="pointer-events-none absolute inset-x-6 bottom-2 h-px bg-white/15" aria-hidden>
          <span className="absolute inset-y-0 start-0 bg-lemon" style={{ width: `${position}%` }} />
        </div>
      </div>
    </div>
  );
}
