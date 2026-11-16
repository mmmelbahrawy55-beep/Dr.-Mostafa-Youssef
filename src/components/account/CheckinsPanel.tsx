import { ImagePlus, Loader2, MessageSquare, Send } from "lucide-react";
import { useState } from "react";
import type { CheckinDTO } from "../../../shared/types";
import { api, formatDateTime } from "../../lib/api";
import { useToast } from "../ui/Toast";
import { cn } from "../../lib/utils";

/** Weekly weight log the client submits from the account page. */
export function CheckinForm({ onSubmitted, className }: { onSubmitted: () => void; className?: string }) {
  const toast = useToast();
  const [weight, setWeight] = useState("");
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!weight && !note.trim() && !photo) {
      toast.error("اكتب وزنك أو ملاحظتك، أو ارفع صورة.");
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      if (weight) form.append("weight", weight);
      if (note.trim()) form.append("note", note.trim());
      if (photo) form.append("photo", photo);
      await api("/api/account/checkins", { method: "POST", body: form });
      setWeight("");
      setNote("");
      setPhoto(null);
      toast.success("تم إرسال المتابعة للدكتور.");
      onSubmitted();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "تعذر إرسال المتابعة.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn("rounded-2xl border border-lemon/20 bg-lemon/[0.04] p-4", className)}>
      <p className="text-[11px] font-bold text-lemon">متابعة جديدة</p>
      <p className="mt-1 text-[10px] text-cream/40">ابعت وزنك وصورة لو حابب، والدكتور يرد عليك هنا.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-[7rem_1fr]">
        <input
          className="field py-2 text-[11px]"
          type="number"
          inputMode="decimal"
          placeholder="الوزن (كجم)"
          value={weight}
          onChange={(event) => setWeight(event.target.value)}
          dir="ltr"
        />
        <input
          className="field py-2 text-[11px]"
          placeholder="ملاحظتك (نوم، التزام، جوع…)"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-white/12 px-3 py-1.5 text-[10px] font-bold text-cream/55">
          <ImagePlus className="size-3.5" aria-hidden />
          {photo ? photo.name.slice(0, 24) : "صورة (اختياري)"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) => setPhoto(event.target.files?.[0] ?? null)}
          />
        </label>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-full bg-lemon px-4 py-1.5 text-[10px] font-bold text-ink disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Send className="size-3.5" aria-hidden />}
          إرسال
        </button>
      </div>
    </div>
  );
}

function WeightChart({ checkins }: { checkins: CheckinDTO[] }) {
  const points = [...checkins]
    .filter((item) => item.weight !== null)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .slice(-12);
  if (points.length < 2) return null;
  const values = points.map((item) => item.weight as number);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(0.5, max - min);
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
      <p className="text-[11px] font-bold text-cream/70">تطور الوزن</p>
      <div className="mt-3 flex h-24 items-end gap-1.5">
        {points.map((item) => (
          <div key={item.id} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-[8px] text-cream/35">{item.weight}</span>
            <div
              className="w-full rounded-t bg-lemon/55"
              style={{ height: `${Math.max(6, ((Number(item.weight) - min) / span) * 70 + 20)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[9px] text-cream/30">
        <span>{formatDateTime(points[0].createdAt)}</span>
        <span>{formatDateTime(points[points.length - 1].createdAt)}</span>
      </div>
    </div>
  );
}

/** Client side: form + their own history with the doctor's replies. */
export function MyCheckins({ checkins, onSubmitted }: { checkins: CheckinDTO[]; onSubmitted: () => void }) {
  return (
    <div className="space-y-4">
      <CheckinForm onSubmitted={onSubmitted} />
      <WeightChart checkins={checkins} />
      {checkins.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/10 py-10 text-center text-[11px] text-cream/35">
          مفيش متابعات لسه. ابدأ بوزنك النهاردة.
        </p>
      ) : (
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
                {item.reviewed && (
                  <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[9px] text-emerald-200">تمت المراجعة</span>
                )}
              </div>
              {item.note && <p className="mt-1.5 text-[11px] leading-relaxed text-cream/65">{item.note}</p>}
              {item.hasPhoto && (
                <a href={`/api/checkins/${item.id}/photo`} target="_blank" rel="noreferrer" className="mt-2 block w-fit">
                  <img
                    src={`/api/checkins/${item.id}/photo`}
                    alt="صورة المتابعة"
                    className="size-20 rounded-xl object-cover"
                    loading="lazy"
                  />
                </a>
              )}
              {item.doctorNote && (
                <div className="mt-2 flex gap-2 rounded-xl border border-lemon/20 bg-lemon/[0.05] p-2.5">
                  <MessageSquare className="mt-0.5 size-3.5 shrink-0 text-lemon" aria-hidden />
                  <p className="text-[11px] leading-relaxed text-cream/75">{item.doctorNote}</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
