import { ChevronLeft, ChevronRight, Download, FileText, Lock, Maximize2, PlayCircle, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { SiteAsset } from "../../../shared/types";
import { formatDateTime } from "../../lib/api";
import { useLang } from "../../lib/i18n";
import { cn } from "../../lib/utils";

interface AssetListProps {
  assets: SiteAsset[];
  className?: string;
}

/** Full-screen photo viewer: the whole image is visible at its real proportions. */
function ImageViewer({
  images,
  index,
  onChange,
  onClose,
}: {
  images: SiteAsset[];
  index: number;
  onChange: (index: number) => void;
  onClose: () => void;
}) {
  const { lang } = useLang();
  const ar = lang === "ar";
  const asset = images[index];

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") onChange((index + 1) % images.length);
      if (event.key === "ArrowRight") onChange((index - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [index, images.length, onChange, onClose]);

  if (!asset) return null;

  return (
    <div
      className="fixed inset-0 z-[130] flex flex-col bg-ink/95 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="min-w-0">
          <p className="truncate text-xs font-bold text-cream">{asset.title || asset.filename}</p>
          <p className="mt-0.5 text-[10px] text-cream/40">
            {index + 1} / {images.length}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <a
            href={asset.url}
            download
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-[10px] font-bold text-cream/70 hover:border-lemon/40 hover:text-lemon"
          >
            <Download className="size-3" aria-hidden />
            {ar ? "تحميل" : "Download"}
          </a>
          <button
            type="button"
            onClick={onClose}
            aria-label={ar ? "إغلاق" : "Close"}
            className="rounded-full border border-white/15 p-1.5 text-cream/70 hover:border-lemon/40 hover:text-lemon"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      </div>

      <div
        className="relative flex flex-1 items-center justify-center overflow-hidden px-3 py-4 sm:px-16"
        onClick={(event) => event.stopPropagation()}
      >
        {images.length > 1 && (
          <button
            type="button"
            onClick={() => onChange((index - 1 + images.length) % images.length)}
            aria-label={ar ? "الصورة السابقة" : "Previous"}
            className="absolute start-2 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/15 bg-ink/70 p-2.5 text-cream/70 transition-colors hover:border-lemon/50 hover:text-lemon sm:start-4"
          >
            <ChevronRight className="size-5" aria-hidden />
          </button>
        )}
        <img
          src={asset.url}
          alt={asset.title || (ar ? "صورة" : "Photo")}
          className="max-h-full max-w-full rounded-xl object-contain shadow-2xl"
        />
        {images.length > 1 && (
          <button
            type="button"
            onClick={() => onChange((index + 1) % images.length)}
            aria-label={ar ? "الصورة التالية" : "Next"}
            className="absolute end-2 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/15 bg-ink/70 p-2.5 text-cream/70 transition-colors hover:border-lemon/50 hover:text-lemon sm:end-4"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </button>
        )}
      </div>

      {(asset.title || asset.note) && (
        <div
          className="border-t border-white/10 px-4 py-3"
          onClick={(event) => event.stopPropagation()}
        >
          <p className="mx-auto max-w-3xl text-center text-[11px] font-bold text-cream/80">{asset.title}</p>
          {asset.note && (
            <p className="mx-auto mt-1 max-w-3xl text-center text-[11px] leading-relaxed text-cream/50">{asset.note}</p>
          )}
        </div>
      )}
    </div>
  );
}

/** Renders the photos, videos and files the doctor attached to a plan or a client. */
export function AssetList({ assets, className }: AssetListProps) {
  const { lang } = useLang();
  const ar = lang === "ar";
  const [viewer, setViewer] = useState<number | null>(null);
  if (!assets.length) return null;

  const locked = assets.filter((asset) => asset.locked);
  const open = assets.filter((asset) => !asset.locked);
  const images = open.filter((asset) => asset.kind === "image");
  const videos = open.filter((asset) => asset.kind === "video");
  const docs = open.filter((asset) => asset.kind === "pdf" || asset.kind === "file");

  return (
    <div className={cn("space-y-6", className)}>
      {locked.length > 0 && (
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold text-cream">
            <span className="size-1.5 rounded-full bg-violet-300" aria-hidden />
            {ar ? "محتوى للمشتركين" : "Subscribers-only content"}
          </h3>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {locked.map((asset) => (
              <li
                key={asset.id}
                className="flex items-center gap-3 rounded-2xl border border-dashed border-violet-300/30 bg-violet-400/[0.06] p-3.5"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-400/15 text-violet-200">
                  <Lock className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-bold text-cream/85">
                    {asset.title || asset.filename || (ar ? "ملف" : "File")}
                  </p>
                  <p className="mt-0.5 text-[10px] text-cream/40">
                    {ar ? "متاح مع اشتراك نشط في الباقة" : "Available with an active plan"}
                  </p>
                </div>
                <Link
                  to="/programs"
                  className="shrink-0 rounded-full bg-lemon px-3 py-1.5 text-[10px] font-bold text-ink"
                >
                  {ar ? "اشترك" : "Subscribe"}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {images.length > 0 && (
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold text-cream">
            <span className="size-1.5 rounded-full bg-lemon" aria-hidden />
            {ar ? "صور من الدكتور" : "Photos from the doctor"}
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {images.map((asset, index) => (
              <figure key={asset.id} className="panel-soft overflow-hidden">
                <button
                  type="button"
                  onClick={() => setViewer(index)}
                  aria-label={ar ? "تكبير الصورة" : "Enlarge photo"}
                  className="group relative block w-full bg-ink"
                >
                  <span className="flex aspect-[4/3] w-full items-center justify-center">
                    <img
                      src={asset.url}
                      alt={asset.title || (ar ? "صورة" : "Photo")}
                      loading="lazy"
                      className="max-h-full max-w-full object-contain"
                    />
                  </span>
                  <span className="pointer-events-none absolute inset-0 flex items-end justify-center bg-gradient-to-t from-ink/85 via-transparent to-transparent pb-3 opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/85 px-3 py-1.5 text-[10px] font-bold text-cream ring-1 ring-white/15">
                      <Maximize2 className="size-3" aria-hidden />
                      {ar ? "تكبير" : "View"}
                    </span>
                  </span>
                </button>
                {(asset.title || asset.note) && (
                  <figcaption className="px-3 py-2.5">
                    {asset.title && (
                      <p className="text-[11px] font-bold leading-snug text-cream/85">{asset.title}</p>
                    )}
                    {asset.note && (
                      <p className="mt-1 text-[10px] leading-relaxed text-cream/45">{asset.note}</p>
                    )}
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
        </div>
      )}

      {videos.length > 0 && (
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold text-cream">
            <span className="size-1.5 rounded-full bg-lemon" aria-hidden />
            {ar ? "فيديوهات" : "Videos"}
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {videos.map((asset) =>
              asset.mime === "video/link" ? (
                <a
                  key={asset.id}
                  href={asset.url}
                  target="_blank"
                  rel="noreferrer"
                  className="panel-soft flex items-center gap-3 p-4 transition-colors hover:border-lemon/40"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-lemon/12 text-lemon">
                    <PlayCircle className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[11px] font-bold text-cream/85">
                      {asset.title || (ar ? "فيديو" : "Video")}
                    </span>
                    <span className="mt-0.5 block truncate text-[10px] text-cream/40">
                      {asset.note || (ar ? "اضغط للمشاهدة" : "Tap to watch")}
                    </span>
                  </span>
                </a>
              ) : (
                <figure key={asset.id} className="panel-soft overflow-hidden">
                  <video
                    src={asset.url}
                    controls
                    preload="metadata"
                    playsInline
                    className="max-h-72 w-full bg-ink-3 object-contain"
                  />
                  {(asset.title || asset.note) && (
                    <figcaption className="px-3 py-2">
                      {asset.title && <p className="truncate text-[11px] font-bold text-cream/80">{asset.title}</p>}
                      {asset.note && <p className="mt-0.5 text-[10px] leading-relaxed text-cream/40">{asset.note}</p>}
                    </figcaption>
                  )}
                </figure>
              )
            )}
          </div>
        </div>
      )}

      {docs.length > 0 && (
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold text-cream">
            <span className="size-1.5 rounded-full bg-lemon" aria-hidden />
            {ar ? "ملفات ومرفقات" : "Files & attachments"}
          </h3>
          <ul className="mt-3 space-y-2">
            {docs.map((asset) => (
              <li key={asset.id} className="panel-soft flex flex-wrap items-center gap-3 p-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-lemon/10 text-lemon">
                  <FileText className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-bold text-cream/85">
                    {asset.title || asset.filename}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] text-cream/35">
                    {asset.note || formatDateTime(asset.createdAt)}
                  </p>
                </div>
                <a
                  href={`${asset.url}?download=1`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-lemon/30 bg-lemon/10 px-3 py-1.5 text-[10px] font-bold text-lemon"
                >
                  <Download className="size-3" aria-hidden />
                  {ar ? "تحميل" : "Download"}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {viewer !== null && images[viewer] && (
        <ImageViewer
          images={images}
          index={viewer}
          onChange={setViewer}
          onClose={() => setViewer(null)}
        />
      )}
    </div>
  );
}
