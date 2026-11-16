import {
  ArrowDown,
  ArrowUp,
  Check,
  FileText,
  ImageIcon,
  Link2,
  Loader2,
  Lock,
  Pencil,
  PlayCircle,
  Plus,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AssetVisibility, SiteAsset } from "../../../shared/types";
import { useToast } from "../../components/ui/Toast";
import { api, formatDateTime } from "../../lib/api";
import {
  ASSET_ACCEPT,
  addAssetLink,
  deleteAsset,
  formatAssetSize,
  listAssets,
  uploadAsset,
  type AssetOwnerType,
} from "../../lib/assets";
import { cn } from "../../lib/utils";

interface AssetManagerProps {
  ownerType: AssetOwnerType;
  ownerId: string;
  hint?: string;
  className?: string;
}

const ICONS = {
  image: ImageIcon,
  video: PlayCircle,
  pdf: FileText,
  file: FileText,
} as const;

/**
 * Files the doctor attaches to one plan or one client: photos, videos (uploaded
 * or a YouTube/Vimeo/Drive link) and PDFs, with visibility and ordering.
 */
export function AssetManager({ ownerType, ownerId, hint, className }: AssetManagerProps) {
  const toast = useToast();
  const [assets, setAssets] = useState<SiteAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [link, setLink] = useState("");
  const [visibility, setVisibility] = useState<AssetVisibility>("public");
  const [addingLink, setAddingLink] = useState(false);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editNote, setEditNote] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!ownerId) return;
    try {
      setAssets(await listAssets(ownerType, ownerId));
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "تعذر تحميل الملفات.");
    } finally {
      setLoading(false);
    }
  }, [ownerId, ownerType, toast]);

  useEffect(() => {
    setLoading(true);
    setAssets([]);
    void load();
  }, [load]);

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !ownerId) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        setProgress(1);
        await uploadAsset({
          ownerType,
          ownerId,
          file,
          title: title.trim() || file.name,
          note: note.trim(),
          visibility,
          onProgress: setProgress,
        });
      }
      setTitle("");
      setNote("");
      toast.success("تم رفع المحتوى.");
      await load();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "تعذر رفع الملف.");
    } finally {
      setBusy(false);
      setProgress(0);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const addLinkHandler = async () => {
    if (!link.trim() || !ownerId) return;
    setAddingLink(true);
    try {
      await addAssetLink({ ownerType, ownerId, link, title: title.trim(), note: note.trim() });
      setLink("");
      setTitle("");
      setNote("");
      toast.success("تم إضافة رابط الفيديو.");
      await load();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "تعذر إضافة الرابط.");
    } finally {
      setAddingLink(false);
    }
  };

  const patch = async (asset: SiteAsset, body: Record<string, unknown>) => {
    try {
      const data = await api<{ asset: SiteAsset }>(`/api/admin/assets/${asset.id}`, { method: "PATCH", body });
      setAssets((prev) => prev.map((entry) => (entry.id === asset.id ? data.asset : entry)));
      return true;
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "تعذر تحديث الملف.");
      return false;
    }
  };

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= assets.length) return;
    const next = [...assets];
    [next[index], next[target]] = [next[target], next[index]];
    setAssets(next);
    try {
      await Promise.all(
        next.map((asset, position) =>
          api(`/api/admin/assets/${asset.id}`, { method: "PATCH", body: { sort: position } })
        )
      );
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "تعذر ترتيب الملفات.");
    }
  };

  const remove = async (id: number) => {
    if (confirmId !== id) {
      setConfirmId(id);
      return;
    }
    try {
      await deleteAsset(id);
      setAssets((prev) => prev.filter((asset) => asset.id !== id));
      setConfirmId(null);
      toast.success("تم حذف الملف.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "تعذر حذف الملف.");
    }
  };

  const startEdit = (asset: SiteAsset) => {
    setEditingId(asset.id);
    setEditTitle(asset.title);
    setEditNote(asset.note);
  };

  const saveEdit = async (asset: SiteAsset) => {
    const ok = await patch(asset, { title: editTitle.trim(), note: editNote.trim() });
    if (ok) {
      setEditingId(null);
      toast.success("تم حفظ بيانات الملف.");
    }
  };

  return (
    <div className={cn("rounded-xl border border-white/8 bg-white/[0.015] p-3.5", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-lemon/80">صور وفيديوهات وملفات</p>
          {hint && <p className="mt-1 text-[10px] text-cream/35">{hint}</p>}
        </div>
        <span className="text-[10px] text-cream/30">{assets.length} ملف</span>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <input
          className="field py-2 text-[11px]"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="عنوان الملف (اختياري)"
        />
        <input
          className="field py-2 text-[11px]"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="وصف قصير (اختياري)"
        />
      </div>

      {ownerType === "program" && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-cream/35">مين يشوفه؟</span>
          {[
            { key: "public" as AssetVisibility, label: "الكل" },
            { key: "subscribers" as AssetVisibility, label: "المشتركين فقط" },
          ].map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setVisibility(option.key)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[10px] font-bold",
                visibility === option.key
                  ? "border-lemon bg-lemon text-ink"
                  : "border-white/12 bg-white/[0.03] text-cream/50"
              )}
            >
              {option.key === "subscribers" && <Lock className="size-2.5" aria-hidden />}
              {option.label}
            </button>
          ))}
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-full bg-lemon px-3.5 py-2 text-[10px] font-bold text-ink disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <UploadCloud className="size-3.5" aria-hidden />}
          {busy ? `بنرفع ${progress}%` : "رفع صورة / فيديو / PDF"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ASSET_ACCEPT}
          multiple
          className="hidden"
          onChange={(event) => void upload(event.target.files)}
        />
        <div className="flex flex-1 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.02] px-3 py-1.5">
          <Link2 className="size-3.5 shrink-0 text-cream/30" aria-hidden />
          <input
            className="min-w-0 flex-1 bg-transparent text-[10px] text-cream/70 outline-none placeholder:text-cream/25"
            value={link}
            onChange={(event) => setLink(event.target.value)}
            placeholder="أو رابط فيديو YouTube / Vimeo / Drive"
            dir="ltr"
          />
          <button
            type="button"
            onClick={() => void addLinkHandler()}
            disabled={addingLink || !link.trim()}
            className="shrink-0 rounded-full bg-white/8 p-1.5 text-cream/60 disabled:opacity-40"
            aria-label="إضافة الرابط"
          >
            {addingLink ? <Loader2 className="size-3 animate-spin" aria-hidden /> : <Plus className="size-3" aria-hidden />}
          </button>
        </div>
      </div>
      <p className="mt-2 text-[9px] text-cream/25">
        الحد الأقصى ٦٤ ميجا للملف — الفيديوهات الكبيرة بتترفع على أجزاء تلقائيًا.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="size-4 animate-spin text-lemon" aria-hidden />
        </div>
      ) : assets.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-white/10 px-3 py-5 text-center text-[10px] text-cream/30">
          مفيش محتوى مرفوع هنا لحد دلوقتي.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {assets.map((asset, index) => {
            const Icon = ICONS[asset.kind] ?? FileText;
            return (
              <li key={asset.id} className="rounded-lg border border-white/8 bg-ink/30 p-2.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  {asset.kind === "image" ? (
                    <img src={asset.url} alt="" className="size-10 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-lemon/10 text-lemon">
                      <Icon className="size-4" aria-hidden />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-bold text-cream/85">{asset.title || asset.filename}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[9px] text-cream/30">
                      <span>{asset.mime === "video/link" ? "رابط فيديو" : formatAssetSize(asset.size)}</span>
                      <span>·</span>
                      <span>{formatDateTime(asset.createdAt)}</span>
                      {asset.visibility === "subscribers" && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-violet-400/15 px-1.5 py-0.5 text-violet-200">
                          <Lock className="size-2.5" aria-hidden /> للمشتركين
                        </span>
                      )}
                    </p>
                    {asset.note && <p className="mt-0.5 line-clamp-1 text-[9px] text-cream/35">{asset.note}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => void move(index, -1)}
                      disabled={index === 0}
                      className="rounded-lg border border-white/10 p-1.5 text-cream/40 disabled:opacity-25 hover:border-lemon/40 hover:text-lemon"
                      aria-label="تحريك لفوق"
                    >
                      <ArrowUp className="size-3" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => void move(index, 1)}
                      disabled={index === assets.length - 1}
                      className="rounded-lg border border-white/10 p-1.5 text-cream/40 disabled:opacity-25 hover:border-lemon/40 hover:text-lemon"
                      aria-label="تحريك لتحت"
                    >
                      <ArrowDown className="size-3" aria-hidden />
                    </button>
                    {ownerType === "program" && (
                      <button
                        type="button"
                        onClick={() =>
                          void patch(asset, {
                            visibility: asset.visibility === "subscribers" ? "public" : "subscribers",
                          })
                        }
                        className={cn(
                          "rounded-lg border p-1.5",
                          asset.visibility === "subscribers"
                            ? "border-violet-300/40 bg-violet-400/15 text-violet-200"
                            : "border-white/10 text-cream/40 hover:border-lemon/40 hover:text-lemon"
                        )}
                        aria-label="تغيير صلاحية العرض"
                        title={asset.visibility === "subscribers" ? "للمشتركين فقط" : "ظاهر للكل"}
                      >
                        <Lock className="size-3" aria-hidden />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => startEdit(asset)}
                      className="rounded-lg border border-white/10 p-1.5 text-cream/40 hover:border-lemon/40 hover:text-lemon"
                      aria-label="تعديل العنوان"
                    >
                      <Pencil className="size-3" aria-hidden />
                    </button>
                    <a
                      href={asset.url || "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-white/10 px-2 py-1.5 text-[9px] font-bold text-cream/50 hover:border-lemon/40 hover:text-lemon"
                    >
                      عرض
                    </a>
                    <button
                      type="button"
                      onClick={() => void remove(asset.id)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[9px] font-bold",
                        confirmId === asset.id
                          ? "border-red-400/50 bg-red-500/15 text-red-100"
                          : "border-white/10 text-cream/40 hover:border-red-400/40 hover:text-red-200"
                      )}
                    >
                      <Trash2 className="size-3" aria-hidden />
                      {confirmId === asset.id ? "تأكيد" : ""}
                    </button>
                  </div>
                </div>

                {editingId === asset.id && (
                  <div className="mt-2 rounded-lg border border-lemon/25 bg-lemon/[0.04] p-2">
                    <input
                      className="field py-1.5 text-[11px]"
                      value={editTitle}
                      onChange={(event) => setEditTitle(event.target.value)}
                      placeholder="العنوان"
                    />
                    <textarea
                      className="field mt-1.5 min-h-14 resize-y text-[11px]"
                      value={editNote}
                      onChange={(event) => setEditNote(event.target.value)}
                      placeholder="الوصف"
                    />
                    <div className="mt-1.5 flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => void saveEdit(asset)}
                        className="inline-flex items-center gap-1 rounded-full bg-lemon px-3 py-1.5 text-[10px] font-bold text-ink"
                      >
                        <Check className="size-3" aria-hidden /> حفظ
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="inline-flex items-center gap-1 rounded-full border border-white/15 px-3 py-1.5 text-[10px] font-bold text-cream/55"
                      >
                        <X className="size-3" aria-hidden /> إلغاء
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
