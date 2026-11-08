import { ClipboardCopy, ImageIcon, Loader2, Trash2, UploadCloud } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MediaItem } from "../../../shared/types";
import { Spinner } from "../../components/ui/Spinner";
import { useToast } from "../../components/ui/Toast";
import { api } from "../../lib/api";
import { cn } from "../../lib/utils";
import { AdminPage, EmptyState } from "./components";

export default function AdminMedia() {
  const toast = useToast();
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const data = await api<{ media: MediaItem[] }>("/api/admin/media");
      setMedia(data.media);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "تعذر تحميل الصور.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("الملف لازم يكون صورة.");
    if (file.size > 12 * 1024 * 1024) return toast.error("حجم الصورة أكبر من 12 ميجا.");
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      await api("/api/admin/media", { method: "POST", body: form });
      toast.success("تم رفع الصورة.");
      await load();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "تعذر رفع الصورة.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("تم نسخ رابط الصورة.");
    } catch {
      toast.error("تعذر نسخ الرابط.");
    }
  };

  const remove = async (id: number) => {
    if (confirmId !== id) {
      setConfirmId(id);
      return;
    }
    try {
      await api(`/api/admin/media/${id}`, { method: "DELETE" });
      setMedia((prev) => prev.filter((item) => item.id !== id));
      setConfirmId(null);
      toast.success("تم حذف الصورة.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "تعذر حذف الصورة.");
    }
  };

  return (
    <AdminPage
      kicker="الوسائط"
      title="مكتبة الصور"
      text="ارفع صور الموقع هنا، وانسخ الرابط لاستخدامه في الباقات، الخدمات، المقالات، أو صورة الهيرو."
      actions={
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 rounded-full bg-lemon px-4 py-2 text-[11px] font-bold text-ink transition-transform hover:-translate-y-0.5 disabled:opacity-60"
        >
          {uploading ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <UploadCloud className="size-3.5" aria-hidden />}
          رفع صورة
        </button>
      }
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/heic"
        className="hidden"
        onChange={(event) => void upload(event.target.files?.[0])}
      />

      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          void upload(event.dataTransfer.files?.[0]);
        }}
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-5 py-10 text-center transition-colors hover:border-lemon/40 hover:bg-lemon/[0.03]"
      >
        {uploading ? (
          <Spinner className="size-7 text-lemon" />
        ) : (
          <span className="flex size-12 items-center justify-center rounded-2xl bg-lemon/10 text-lemon">
            <UploadCloud className="size-5" aria-hidden />
          </span>
        )}
        <p className="text-sm font-semibold text-cream/75">{uploading ? "بنرفع الصورة…" : "اسحب صورة هنا أو دوس للاختيار"}</p>
        <p className="text-[10px] text-cream/35">JPG / PNG / WebP — بحد أقصى 12 ميجا.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner className="size-7 text-lemon" />
        </div>
      ) : media.length === 0 ? (
        <div className="panel mt-4">
          <EmptyState icon={ImageIcon} title="المكتبة فاضية" text="ارفع أول صورة واستخدمها في أي مكان على الموقع." />
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {media.map((item) => (
            <div key={item.id} className="panel-soft overflow-hidden">
              <div className="relative aspect-[4/3] bg-ink">
                <img src={item.url} alt={item.filename} className="size-full object-cover" loading="lazy" />
              </div>
              <div className="p-3">
                <p className="truncate text-[10px] font-semibold text-cream/70" dir="ltr">{item.filename}</p>
                <p className="mt-0.5 text-[9px] text-cream/30">{(item.size / 1024).toFixed(0)} كيلوبايت</p>
                <div className="mt-2 flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => void copy(item.url)}
                    className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-white/10 py-1.5 text-[9px] font-bold text-cream/55 hover:border-lemon/40 hover:text-lemon"
                  >
                    <ClipboardCopy className="size-3" aria-hidden />
                    نسخ الرابط
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(item.id)}
                    className={cn(
                      "inline-flex items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-[9px] font-bold",
                      confirmId === item.id
                        ? "border-red-400/50 bg-red-500/15 text-red-100"
                        : "border-white/10 text-cream/40 hover:border-red-400/40 hover:text-red-200"
                    )}
                    aria-label="حذف الصورة"
                  >
                    <Trash2 className="size-3" aria-hidden />
                    {confirmId === item.id ? "تأكيد" : ""}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminPage>
  );
}
