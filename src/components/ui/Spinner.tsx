import { Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-5 animate-spin text-lemon", className)} aria-hidden />;
}

export function PageLoader({ label = "لحظة…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-20 text-sm text-cream/50">
      <Spinner />
      {label}
    </div>
  );
}
