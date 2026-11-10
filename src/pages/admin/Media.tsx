import { ClipboardCopy, ImageIcon, Info, Loader2, Trash2, UploadCloud } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { MediaItem } from "../../../shared/types";
import { Spinner } from "../../components/ui/Spinner";
import { useToast } from "../../components/ui/Toast";
import { api, formatDate, formatDateTime } from "../../lib/api";
import { useSiteData } from "../../lib/site-data";
import { cn } from "../../lib/utils";
import { AdminPage, EmptyState, Modal } from "./components";

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/5 py-2 last:border-0">
      <span className="shrink-0 text-[11px] text-cream/45">{label}</span>
      <span className="min-w-0 break-words text-end text-[11px] text-cream/75">{children}</span>
    </div>
  );
}

function formatSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} ميجا`;
  return `${Math.max(1, Math.round(bytes / 1024))} كيلوبايت`;
}

export default function AdminMedia() {
  const toast = useToast();
  const { data: site } = useSiteData();
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [detail, setDetail] = useState<MediaItem | null>(null);
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
      setDetail((current) => (current?.id === id ? null : current));
      toast.success("تم حذف الصورة.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "تعذر حذف الصورة.");
    }
  };

  /** Where this exact file is referenced on the live site. */
  const usedIn = (url: string) => {
    const places: string[] = [];
    const title = (item: { id: string; ar: Record<string, unknown>; en: Record<string, unknown> }, key: string) =>
      String(item.ar[key] ?? item.en[key] ?? item.id);
    if (!site) return places;
    if (String(site.settings?.hero?.image ?? "") === url) places.push("صورة الغلاف (الهيرو)");
    for (const program of site.programs ?? []) {
      if (String(program.common?.image ?? "") === url) places.push(`باقة: ${title(program, "name")}`);
    }
    for (const service of site.services ?? []) {
      if (String(service.common?.image ?? "") === url) places.push(`خدمة: ${title(service, "title")}`);
    }
    for (const post of site.posts ?? []) {
      if (String(post.common?.cover ?? "") === url) places.push(`مقال: ${title(post, "title")}`);
    }
    for (const result of site.results ?? []) {
      if (String(result.common?.before ?? "") === url || String(result.common?.after ?? "") === url) {
        places.push(`نتيجة قبل/بعد: ${title(result, "name")}`);
      }
    }
    return places;
  };

  return (
    <AdminPage
      kicker="الوسائط"
      title="مكتبة الصور"
      text="ارفع صور الموقع هنا، وانسخ الرابط لاستخدامه في الباقات، الخدمات، المقالات، أو صورة الهيرو. كل صورة بتعرض مين رافعها ووقتها وحجمها وأبعادها."
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
                <p className="truncate text-[10px] font-semibold text-cream/70" dir="ltr">
                  {item.filename}
                </p>
                <p className="mt-0.5 text-[9px] text-cream/30">
                  {formatSize(item.size)} · {formatDate(item.createdAt)}
                </p>
                <p className="truncate text-[9px] text-cream/30">رفعها: {item.uploadedByName || "غير معروف"}</p>
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
                    onClick={() => setDetail(item)}
                    className="inline-flex items-center justify-center gap-1 rounded-lg border border-white/10 px-2 py-1.5 text-[9px] font-bold text-cream/55 hover:border-lemon/40 hover:text-lemon"
                    aria-label="تفاصيل الصورة"
                  >
                    <Info className="size-3" aria-hidden />
                    تفاصيل
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

      <Modal
        open={Boolean(detail)}
        title="تفاصيل الصورة"
        description={detail?.filename}
        onClose={() => setDetail(null)}
        size="lg"
        footer={
          <>
            <button
              type="button"
              onClick={() => detail && void copy(detail.url)}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-4 py-2 text-[11px] font-bold text-cream/60 hover:border-lemon/40 hover:text-lemon"
            >
              <ClipboardCopy className="size-3.5" aria-hidden />
              نسخ الرابط
            </button>
            <button
              type="button"
              onClick={() => detail && void remove(detail.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-[11px] font-bold",
                detail && confirmId === detail.id
                  ? "border-red-400/60 bg-red-500/20 text-red-100"
                  : "border-red-400/40 text-red-200 hover:bg-red-500/10"
              )}
            >
              <Trash2 className="size-3.5" aria-hidden />
              {detail && confirmId === detail.id ? "اضغط تاني لتأكيد الحذف" : "حذف الصورة"}
            </button>
          </>
        }
      >
        {detail && (
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <img src={detail.url} alt={detail.filename} className="max-h-56 w-full rounded-xl border border-white/10 bg-ink object-contain" />
              <div className="mt-3">
                <p className="text-[10px] font-bold text-cream/45">مستخدمة في</p>
                {usedIn(detail.url).length === 0 ? (
                  <p className="mt-1 text-[11px] text-cream/35">لسه مش مستخدمة في أي مكان على الموقع.</p>
                ) : (
                  <ul className="mt-1 space-y-1">
                    {usedIn(detail.url).map((place) => (
                      <li key={place} className="flex items-center gap-1.5 text-[11px] text-cream/70">
                        <span className="size-1.5 shrink-0 rounded-full bg-lemon" aria-hidden />
                        {place}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <div>
              <DetailRow label="تاريخ الرفع">{formatDateTime(detail.createdAt)}</DetailRow>
              <DetailRow label="رفعها مين">{detail.uploadedByName || "غير معروف"}</DetailRow>
              <DetailRow label="الحجم">{formatSize(detail.size)}</DetailRow>
              <DetailRow label="الأبعاد">
                {detail.width && detail.height ? `${detail.width} × ${detail.height} بكسل` : "غير متاح"}
              </DetailRow>
              <DetailRow label="نوع الملف">
                <span dir="ltr">{detail.mime}</span>
              </DetailRow>
              <DetailRow label="الرابط">
                <span className="font-latin" dir="ltr">
                  {detail.url}
                </span>
              </DetailRow>
              <DetailRow label="رقم الصورة">#{detail.id}</DetailRow>
            </div>
          </div>
        )}
      </Modal>
    </AdminPage>
  );
}
