import {
  CHAT_CHUNK_BYTES,
  CHAT_MAX_FILE_BYTES,
  type AssetVisibility,
  type SiteAsset,
} from "../../shared/types";
import { api } from "./api";

/** Photos, videos and PDFs share one ceiling; videos upload in 3 MB slices. */
export const ASSET_MAX_BYTES = CHAT_MAX_FILE_BYTES;

export const ASSET_ACCEPT =
  "image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,application/pdf";

const ALLOWED = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "application/pdf",
];

export type AssetOwnerType = "program" | "customer";

export const assetKindOf = (mime: string): SiteAsset["kind"] => {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime === "application/pdf") return "pdf";
  return "file";
};

export function formatAssetSize(bytes: number) {
  if (!bytes) return "رابط خارجي";
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} ميجا`;
  return `${Math.max(1, Math.round(bytes / 1024))} كيلوبايت`;
}

/**
 * Uploads one asset through a chunk session (the same machinery as chat
 * attachments), then registers it against its plan or client.
 */
export async function uploadAsset(input: {
  ownerType: AssetOwnerType;
  ownerId: string;
  file: File;
  title?: string;
  note?: string;
  visibility?: AssetVisibility;
  onProgress?: (percent: number) => void;
}): Promise<SiteAsset> {
  const { ownerType, ownerId, file, title, note, visibility, onProgress } = input;
  if (!ALLOWED.includes(file.type)) {
    throw new Error("الملف لازم يكون صورة (JPG/PNG/WebP) أو فيديو (MP4/WebM/MOV) أو PDF.");
  }
  if (file.size > ASSET_MAX_BYTES) {
    throw new Error(`حجم الملف أكبر من ${Math.round(ASSET_MAX_BYTES / 1024 / 1024)} ميجا.`);
  }

  const session = await api<{ uploadId: string; chunks: number }>("/api/admin/assets/uploads", {
    method: "POST",
    body: { mime: file.type, bytes: file.size },
  });
  const chunks = Math.max(1, session.chunks);
  for (let index = 0; index < chunks; index += 1) {
    const start = index * CHAT_CHUNK_BYTES;
    const part = file.slice(start, Math.min(start + CHAT_CHUNK_BYTES, file.size), file.type);
    const form = new FormData();
    form.append("file", part, `${index}.part`);
    await api(`/api/admin/assets/uploads/${session.uploadId}/${index}`, { method: "POST", body: form });
    onProgress?.(Math.round(((index + 1) / chunks) * 92));
  }

  const created = await api<{ asset: SiteAsset }>("/api/admin/assets", {
    method: "POST",
    body: { ownerType, ownerId, uploadId: session.uploadId, filename: file.name, title, note, visibility },
  });
  onProgress?.(100);
  return created.asset;
}

/** Adds a YouTube / Vimeo / Google Drive video instead of an uploaded file. */
export async function addAssetLink(input: {
  ownerType: AssetOwnerType;
  ownerId: string;
  link: string;
  title?: string;
  note?: string;
}): Promise<SiteAsset> {
  const created = await api<{ asset: SiteAsset }>("/api/admin/assets", {
    method: "POST",
    body: {
      ownerType: input.ownerType,
      ownerId: input.ownerId,
      link: input.link.trim(),
      title: input.title,
      note: input.note,
    },
  });
  return created.asset;
}

export const listAssets = async (ownerType: AssetOwnerType, ownerId: string): Promise<SiteAsset[]> => {
  const data = await api<{ assets: SiteAsset[] }>(
    `/api/admin/assets?ownerType=${ownerType}&ownerId=${encodeURIComponent(ownerId)}`
  );
  return data.assets;
};

export const deleteAsset = (id: number) => api(`/api/admin/assets/${id}`, { method: "DELETE" });
