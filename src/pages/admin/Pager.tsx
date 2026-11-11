import { ChevronLeft, ChevronRight } from "lucide-react";

/** Compact pagination footer shared by the admin tables. */
export function Pager({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/8 px-4 py-3 text-[10px] text-cream/40">
      <span>
        {start}–{end} من {total}
      </span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="inline-flex items-center gap-1 rounded-full border border-white/12 px-2.5 py-1.5 font-bold text-cream/55 transition-colors hover:border-lemon/40 hover:text-lemon disabled:opacity-30"
        >
          <ChevronRight className="size-3" aria-hidden />
          السابق
        </button>
        <span className="px-1 font-bold text-cream/55">
          {page} / {pages}
        </span>
        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={page >= pages}
          className="inline-flex items-center gap-1 rounded-full border border-white/12 px-2.5 py-1.5 font-bold text-cream/55 transition-colors hover:border-lemon/40 hover:text-lemon disabled:opacity-30"
        >
          التالي
          <ChevronLeft className="size-3" aria-hidden />
        </button>
      </div>
    </div>
  );
}
