import { Bell, CheckCheck, Loader2, Send } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { AppNotificationDTO } from "../../../shared/types";
import { Spinner } from "../../components/ui/Spinner";
import { api, formatDateTime } from "../../lib/api";
import { useToast } from "../../components/ui/Toast";

/** Everything the doctor should know about: payments, files, messages, renewals. */
export default function Notifications() {
  const toast = useToast();
  const [items, setItems] = useState<AppNotificationDTO[]>([]);
  const [unread, setUnread] = useState(0);
  const [emailConfigured, setEmailConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api<{ notifications: AppNotificationDTO[]; unread: number; emailConfigured: boolean }>(
        "/api/admin/notifications"
      );
      setItems(data.notifications);
      setUnread(data.unread);
      setEmailConfigured(data.emailConfigured);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "تعذر تحميل التنبيهات.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const markRead = async () => {
    try {
      await api("/api/admin/notifications/read", { method: "POST" });
      setItems((prev) => prev.map((item) => ({ ...item, read: true })));
      setUnread(0);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "تعذر تحديث التنبيهات.");
    }
  };

  const sendExpiring = async () => {
    setSending(true);
    try {
      const data = await api<{ sent: number }>("/api/admin/notify/expiring", { method: "POST" });
      toast.success(data.sent > 0 ? `تم تنبيه ${data.sent} عميل باقتهم قربت تخلص.` : "مفيش اشتراكات قربت تخلص.");
      await load();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "تعذر إرسال التنبيهات.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-lemon/70">التنبيهات</p>
          <h1 className="mt-1 text-2xl">آخر الأحداث</h1>
          <p className="mt-1 text-[11px] text-cream/40">
            {emailConfigured
              ? "الإيميل مفعّل: تنبيهات العملاء بتوصل على بريدهم كمان."
              : "الإيميل مش مفعّل — ضيف RESEND_API_KEY و EMAIL_FROM في متغيرات البيئة عشان الإيميلات تتبعت."}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void markRead()}
            disabled={unread === 0}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/12 px-3.5 py-2 text-[11px] font-bold text-cream/55 disabled:opacity-40"
          >
            <CheckCheck className="size-3.5" aria-hidden /> تحديد الكل كمقروء
          </button>
          <button
            type="button"
            onClick={() => void sendExpiring()}
            disabled={sending}
            className="inline-flex items-center gap-1.5 rounded-full bg-lemon px-3.5 py-2 text-[11px] font-bold text-ink disabled:opacity-50"
          >
            {sending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Send className="size-3.5" aria-hidden />}
            تنبيه الاشتراكات القريبة
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner className="size-7" />
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/10 py-12 text-center text-[11px] text-cream/35">
          مفيش تنبيهات جديدة.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className={`flex gap-3 rounded-2xl border p-3 ${
                item.read ? "border-white/8 bg-white/[0.015]" : "border-lemon/25 bg-lemon/[0.05]"
              }`}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-lemon/10 text-lemon">
                <Bell className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-bold text-cream/85">{item.title}</p>
                <p className="mt-0.5 break-words text-[11px] leading-relaxed text-cream/45">{item.body}</p>
                <p className="mt-1 text-[9px] text-cream/25">
                  {item.userName ? `${item.userName} · ` : ""}
                  {formatDateTime(item.createdAt)} · {item.kind}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
