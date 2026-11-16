import { Check, Loader2, MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";
import type { CheckinDTO } from "../../../shared/types";
import { api, formatDateTime } from "../../lib/api";
import { useToast } from "../ui/Toast";

/** Review list: the doctor reads each weekly check-in and writes back. */
export function AdminCheckins({
  customerId,
  checkins,
  onReviewed,
}: {
  customerId: number;
  checkins: CheckinDTO[];
  onReviewed: () => void;
}) {
  const toast = useToast();
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);

  useEffect(() => {
    const next: Record<number, string> = {};
    for (const item of checkins) next[item.id] = item.doctorNote;
    setNotes(next);
  }, [checkins]);

  const save = async (id: number) => {
    setSavingId(id);
    try {
      await api(`/api/admin/checkins/${id}`, {
        method: "PATCH",
        body: { doctorNote: notes[id] ?? "", reviewed: true },
      });
      toast.success("تم حفظ الرد.");
      onReviewed();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "تعذر حفظ الرد.");
    } finally {
      setSavingId(null);
    }
  };

  if (checkins.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-white/10 py-10 text-center text-[11px] text-cream/35">
        العميل لسه مبعتش متابعات.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {checkins.map((item) => (
        <li key={item.id} className="rounded-2xl border border-white/8 bg-white/[0.02] p-3">
          <div className="flex flex-wrap items-center gap-2">
            {item.weight !== null && (
              <span className="rounded-full bg-lemon/10 px-2.5 py-1 text-[10px] font-bold text-lemon">
                {item.weight} كجم
              </span>
            )}
            <span className="text-[9px] text-cream/30">{formatDateTime(item.createdAt)}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[9px] ${
                item.reviewed ? "bg-emerald-400/15 text-emerald-200" : "bg-amber-400/15 text-amber-200"
              }`}
            >
              {item.reviewed ? "تمت المراجعة" : "مستنية رد"}
            </span>
            <span className="text-[9px] text-cream/20">#{customerId}</span>
          </div>
          {item.note && <p className="mt-1.5 text-[11px] leading-relaxed text-cream/65">{item.note}</p>}
          {item.hasPhoto && (
            <a href={`/api/checkins/${item.id}/photo`} target="_blank" rel="noreferrer" className="mt-2 block w-fit">
              <img
                src={`/api/checkins/${item.id}/photo`}
                alt="صورة المتابعة"
                className="size-24 rounded-xl object-cover"
                loading="lazy"
              />
            </a>
          )}
          <div className="mt-2 flex items-start gap-2">
            <MessageSquare className="mt-2 size-3.5 shrink-0 text-lemon/60" aria-hidden />
            <textarea
              className="field min-h-14 flex-1 resize-y py-2 text-[11px]"
              placeholder="رد الدكتور…"
              value={notes[item.id] ?? ""}
              onChange={(event) => setNotes((prev) => ({ ...prev, [item.id]: event.target.value }))}
            />
            <button
              type="button"
              onClick={() => void save(item.id)}
              disabled={savingId === item.id}
              className="mt-1 inline-flex items-center gap-1 rounded-full bg-lemon px-3 py-1.5 text-[10px] font-bold text-ink disabled:opacity-60"
            >
              {savingId === item.id ? (
                <Loader2 className="size-3 animate-spin" aria-hidden />
              ) : (
                <Check className="size-3" aria-hidden />
              )}
              حفظ
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
