import { CHAT_CHUNK_BYTES, CHAT_MAX_FILE_BYTES } from "../../shared/types";
import { api } from "./api";

/** Small attachments still travel in one multipart request (the 4 MB wire cap). */
export const CHAT_DIRECT_MAX_BYTES = 4 * 1024 * 1024;

export { CHAT_MAX_FILE_BYTES };

/**
 * Uploads a chat attachment in ≤ 3 MB slices: each request stays under the
 * serverless body cap, and the server reassembles the file on attach. Used only
 * for files larger than CHAT_DIRECT_MAX_BYTES — smaller ones keep the single
 * multipart request.
 */
export async function uploadChatAttachment(
  file: File,
  onProgress?: (percent: number) => void
): Promise<string> {
  const created = await api<{ uploadId: string; chunks: number }>("/api/coach/uploads", {
    method: "POST",
    body: { mime: file.type, bytes: file.size },
  });
  const chunks = Math.max(1, created.chunks);
  for (let index = 0; index < chunks; index += 1) {
    const start = index * CHAT_CHUNK_BYTES;
    // slice() keeps the original mime type, so multer still sees image/* or video/*.
    const part = file.slice(start, Math.min(start + CHAT_CHUNK_BYTES, file.size), file.type);
    const form = new FormData();
    form.append("file", part, `${index}.part`);
    await api(`/api/coach/uploads/${created.uploadId}/${index}`, { method: "POST", body: form });
    onProgress?.(Math.round(((index + 1) / chunks) * 100));
  }
  return created.uploadId;
}
