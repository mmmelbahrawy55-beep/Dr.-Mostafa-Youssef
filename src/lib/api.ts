export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

type ApiInit = Omit<RequestInit, "body"> & { body?: unknown };

/**
 * Small typed wrapper around fetch.
 * - Sends cookies automatically (session auth uses HttpOnly cookies).
 * - Serializes plain objects to JSON, keeps FormData untouched.
 * - Normalises Arabic error messages coming from the API.
 */
export async function api<T>(path: string, init: ApiInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  let body: BodyInit | undefined;

  if (init.body instanceof FormData) {
    body = init.body;
  } else if (init.body !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(init.body);
  }

  let response: Response;
  try {
    response = await fetch(path, {
      credentials: "same-origin",
      ...init,
      headers,
      body,
    });
  } catch {
    throw new ApiError("مش قادر أوصل للسيرفر. اتأكد من الاتصال وجرب تاني.", 0);
  }

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const message =
      (data && typeof data === "object" && "error" in data && typeof (data as { error: unknown }).error === "string"
        ? (data as { error: string }).error
        : null) || "حصل خطأ غير متوقع. جرب تاني.";
    throw new ApiError(message, response.status, data);
  }

  return data as T;
}

/** Currency suffix follows the page language; the admin panel stays Arabic by default. */
export const formatEgp = (value: number, lang: "ar" | "en" = "ar") =>
  `${new Intl.NumberFormat("en-US").format(value)} ${lang === "ar" ? "ج.م" : "EGP"}`;

export const formatDate = (value: string | Date, locale = "ar-EG") =>
  new Date(value).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });

export const formatDateTime = (value: string | Date, locale = "ar-EG") =>
  new Date(value).toLocaleString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export const daysBetween = (from: string | Date, to: string | Date) =>
  Math.max(0, Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000));
