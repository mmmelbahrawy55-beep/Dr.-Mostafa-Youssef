import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { useState } from "react";
import { cn } from "../../lib/utils";

interface FaqAccordionProps {
  items: { q: string; a: string }[];
  className?: string;
  defaultOpen?: number | null;
}

export function FaqAccordion({ items, className, defaultOpen = 0 }: FaqAccordionProps) {
  const [open, setOpen] = useState<number | null>(defaultOpen);

  return (
    <div className={cn("divide-y divide-white/10 overflow-hidden rounded-[1.5rem] border border-white/10", className)}>
      {items.map((item, index) => {
        const isOpen = open === index;
        return (
          <div key={item.q} className={cn("transition-colors", isOpen && "bg-white/[0.03]")}>
            <button
              type="button"
              className="flex w-full items-center gap-4 px-5 py-5 text-start md:px-7"
              onClick={() => setOpen(isOpen ? null : index)}
              aria-expanded={isOpen}
            >
              <span className="flex-1 font-display text-[0.98rem] font-semibold leading-snug text-cream md:text-lg">
                {item.q}
              </span>
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full border transition-all duration-300",
                  isOpen ? "rotate-45 border-lemon bg-lemon text-ink" : "border-white/15 text-cream/70"
                )}
              >
                <Plus className="size-4" aria-hidden />
              </span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <p className="px-5 pb-6 text-sm leading-relaxed text-cream/60 md:px-7 md:text-base">
                    {item.a}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
