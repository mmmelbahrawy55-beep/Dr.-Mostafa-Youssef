import { Inbox, Mail, MessageSquare, Phone, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { MessageDTO } from "../../../shared/types";
import { Spinner } from "../../components/ui/Spinner";
import { useToast } from "../../components/ui/Toast";
import { api, formatDateTime } from "../../lib/api";
import { whatsappLink } from "../../lib/site";
import { cn } from "../../lib/utils";
import { AdminPage, Badge, EmptyState, Modal } from "./components";

export default function AdminMessages() {
  const toast = useToast();
  const [messages, setMessages] = useState<MessageDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<MessageDTO | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api<{ messages: MessageDTO[] }>("/api/admin/messages");
      setMessages(data.messages);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "تعذر تحميل الرسائل.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return messages.filter((item) => {
      if (filter === "unread" && item.read) return false;
      if (filter === "read" && !item.read) return false;
      if (!q) return true;
      return [item.name, item.phone, item.email, item.goal, item.body].some((value) =>
        value.toLowerCase().includes(q)
      );
    });
  }, [messages, filter, query]);

  const unread = messages.filter((item) => !item.read).length;

  const toggleRead = async (message: MessageDTO, read: boolean) => {
    try {
      await api(`/api/admin/messages/${message.id}`, { method: "PATCH", body: { read } });
      setMessages((prev) => prev.map((item) => (item.id === message.id ? { ...item, read } : item)));
      setSelected((prev) => (prev && prev.id === message.id ? { ...prev, read } : prev));
      toast.success(read ? "تم تعليم الرسالة كمقروءة." : "تم تعليم الرسالة كغير مقروءة.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "تعذر تحديث الرسالة.");
    }
  };

  const openMessage = (message: MessageDTO) => {
    setSelected(message);
    setConfirmDelete(false);
    if (!message.read) void toggleRead(message, true);
  };

  const remove = async () => {
    if (!selected) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      await api(`/api/admin/messages/${selected.id}`, { method: "DELETE" });
      setMessages((prev) => prev.filter((item) => item.id !== selected.id));
      setSelected(null);
      toast.success("تم حذف الرسالة.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "تعذر حذف الرسالة.");
    }
  };

  return (
    <AdminPage
      kicker="التواصل"
      title="صندوق الرسائل"
      text="كل الطلبات اللي جاية من نموذج التواصل على الموقع. علّم عليها كمقروءة أو رد عليها مباشرة."
      actions={
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-[10px] text-cream/45">
          <Inbox className="size-3.5 text-lemon/60" aria-hidden />
          {unread} غير مقروءة
        </span>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {[
            { key: "all" as const, label: "الكل", count: messages.length },
            { key: "unread" as const, label: "غير مقروءة", count: unread },
            { key: "read" as const, label: "مقروءة", count: messages.length - unread },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-bold transition-colors",
                filter === item.key
                  ? "border-lemon bg-lemon text-ink"
                  : "border-white/10 bg-white/[0.02] text-cream/55 hover:border-lemon/40"
              )}
            >
              {item.label}
              <span className={cn("rounded-full px-1.5 text-[9px]", filter === item.key ? "bg-ink/15" : "bg-white/10")}>
                {item.count}
              </span>
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-3.5 -translate-y-1/2 text-cream/30" aria-hidden />
          <input
            className="field py-2 ps-9 text-xs"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ابحث في الرسائل…"
          />
        </div>
      </div>

      <div className="panel mt-4 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner className="size-7 text-lemon" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={MessageSquare} title="مفيش رسائل هنا" text="أول ما حد يبعت من نموذج التواصل هتلاقيها هنا." />
        ) : (
          <ul className="divide-y divide-white/8">
            {filtered.map((message) => (
              <li key={message.id}>
                <button
                  type="button"
                  onClick={() => openMessage(message)}
                  className="flex w-full items-start gap-3 px-4 py-3.5 text-start transition-colors hover:bg-white/[0.02]"
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold",
                      message.read ? "bg-white/5 text-cream/40" : "bg-lemon/15 text-lemon"
                    )}
                  >
                    {message.name.charAt(0)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className={cn("text-xs", message.read ? "font-semibold text-cream/65" : "font-bold text-cream")}>
                        {message.name}
                      </span>
                      {!message.read && <Badge tone="lemon">جديد</Badge>}
                      {message.goal && <Badge tone="neutral">{message.goal}</Badge>}
                    </span>
                    <span className="mt-1 block truncate text-[11px] text-cream/40">{message.body || "—"}</span>
                    <span className="mt-1 block text-[10px] text-cream/25" dir="ltr">{message.phone}</span>
                  </span>
                  <span className="shrink-0 text-[10px] text-cream/30">{formatDateTime(message.createdAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected ? `رسالة من ${selected.name}` : "رسالة"}
        description={selected ? formatDateTime(selected.createdAt) : undefined}
        size="lg"
        footer={
          selected ? (
            <>
              <button
                type="button"
                onClick={remove}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-[11px] font-bold transition-colors",
                  confirmDelete
                    ? "border-red-400/50 bg-red-500/15 text-red-100"
                    : "border-red-400/25 bg-red-500/5 text-red-200"
                )}
              >
                <Trash2 className="size-3.5" aria-hidden />
                {confirmDelete ? "تأكيد الحذف" : "حذف"}
              </button>
              <button
                type="button"
                onClick={() => selected && toggleRead(selected, !selected.read)}
                className="rounded-full border border-white/15 px-4 py-2 text-[11px] font-bold text-cream/60"
              >
                {selected.read ? "علّم كغير مقروءة" : "علّم كمقروءة"}
              </button>
              <a
                href={whatsappLink(`أهلاً ${selected.name}، بنرد على رسالتك بخصوص ${selected.goal || "الاستشارة"}…`)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full bg-lemon px-4 py-2 text-[11px] font-bold text-ink"
              >
                <Phone className="size-3.5" aria-hidden />
                رد واتساب
              </a>
            </>
          ) : null
        }
      >
        {selected && (
          <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2.5">
                <p className="text-[9px] text-cream/30">الموبايل</p>
                <a href={`tel:${selected.phone}`} className="mt-0.5 flex items-center gap-1.5 text-[11px] font-semibold text-cream/80" dir="ltr">
                  <Phone className="size-3 text-lemon/60" aria-hidden />
                  {selected.phone}
                </a>
              </div>
              <div className="rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2.5">
                <p className="text-[9px] text-cream/30">الإيميل</p>
                {selected.email ? (
                  <a href={`mailto:${selected.email}`} className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] font-semibold text-cream/80" dir="ltr">
                    <Mail className="size-3 text-lemon/60" aria-hidden />
                    {selected.email}
                  </a>
                ) : (
                  <p className="mt-0.5 text-[11px] text-cream/35">غير مسجل</p>
                )}
              </div>
              <div className="rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2.5">
                <p className="text-[9px] text-cream/30">الهدف</p>
                <p className="mt-0.5 text-[11px] font-semibold text-cream/80">{selected.goal || "غير محدد"}</p>
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-[10px] text-cream/35">نص الرسالة</p>
              <p className="whitespace-pre-wrap rounded-xl border border-white/8 bg-white/[0.02] p-4 text-xs leading-relaxed text-cream/70">
                {selected.body || "مفيش نص إضافي."}
              </p>
            </div>
          </div>
        )}
      </Modal>
    </AdminPage>
  );
}
