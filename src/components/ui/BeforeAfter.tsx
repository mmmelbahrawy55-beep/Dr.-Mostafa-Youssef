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
  className?: string;
}

export function BeforeAfter({
  before,
  after,
  beforeLabel,
  afterLabel,
  name,
  className,
}: BeforeAfterProps) {
  const [position, setPosition] = useState(55);
  const [dragging, setDragging] = useState(false);
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
      setPosition((prev) => Math.max(0, prev - 4));
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      setPosition((prev) => Math.min(100, prev + 4));
    }
  };

  return (
    <div
      ref={frameRef}
      className={cn(
        "group relative aspect-[4/5] w-full touch-none select-none overflow-hidden rounded-[1.75rem] border border-white/10 bg-ink-2",
        dragging ? "cursor-ew-resize" : "cursor-ew-resize",
        className
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
      role="slider"
      tabIndex={0}
      aria-label={`${beforeLabel} / ${afterLabel}`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(position)}
    >
      <img
        src={afterFailed || !after ? fallbackImage : after}
        alt={name ? `${afterLabel} — ${name}` : afterLabel}
        className="absolute inset-0 size-full object-cover"
        loading="lazy"
        draggable={false}
        onError={() => setAfterFailed(true)}
      />
      <img
        src={beforeFailed || !before ? fallbackImage : before}
        alt={name ? `${beforeLabel} — ${name}` : beforeLabel}
        className="absolute inset-0 size-full object-cover grayscale-[0.35]"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
        loading="lazy"
        draggable={false}
        onError={() => setBeforeFailed(true)}
      />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ink/85 to-transparent" />

      <span className="pointer-events-none absolute start-4 top-4 rounded-full bg-ink/70 px-3 py-1 text-[11px] font-semibold text-cream backdrop-blur">
        {beforeLabel}
      </span>
      <span className="pointer-events-none absolute end-4 top-4 rounded-full bg-lemon px-3 py-1 text-[11px] font-bold text-ink">
        {afterLabel}
      </span>

      <div
        className="pointer-events-none absolute inset-y-0 w-px bg-lemon shadow-[0_0_18px_rgba(212,255,63,0.8)]"
        style={{ left: `${position}%` }}
      >
        <div className="absolute top-1/2 left-1/2 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-lemon/60 bg-ink text-lemon shadow-lg transition-transform duration-300 group-hover:scale-110">
          <MoveHorizontal className="size-5" aria-hidden />
        </div>
      </div>
    </div>
  );
}
