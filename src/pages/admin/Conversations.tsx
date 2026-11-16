import {
  CheckCheck,
  ImagePlus,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Search,
  Send,
  Stethoscope,
  UserRound,
  Video,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CHAT_MAX_FILE_BYTES, type CoachConversation, type CoachMessageDTO } from "../../../shared/types";
import { Spinner } from "../../components/ui/Spinner";
import { useToast } from "../../components/ui/Toast";
import { api, formatDate, formatDateTime } from "../../lib/api";
import { CHAT_DIRECT_MAX_BYTES, uploadChatAttachment } from "../../lib/chat-upload";
import { cn } from "../../lib/utils";
import { AdminPage, Badge, EmptyState } from "./components";

const previewOf = (conversation: CoachConversation) =>
  conversation.lastMessage || (conversation.activeSubscriptions > 0 ? "لسه مفيش رسائل — ابدأ المحادثة" : "مفيش رسائل");

const timeOf = (value: string) =>
  new Date(value).toLocaleString("ar-EG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function AdminConversations() {
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const wantedUser = Number(searchParams.get("user") ?? 0);
  const [conversations, setConversations] = useState<CoachConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<CoachConversation | null>(null);
  const [messages, setMessages] = useState<CoachMessageDTO[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [text, setText] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadConversations = useCallback(async (silent = false) => {
    try {
      const data = await api<{ conversations: CoachConversation[] }>("/api/admin/conversations");
      setConversations(data.conversations);
    } catch (cause) {
      if (!silent) toast.error(cause instanceof Error ? cause.message : "تعذر تحميل المحادثات.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadConversations();
    const timer = window.setInterval(() => void loadConversations(true), 20_000);
    return () => window.clearInterval(timer);
  }, [loadConversations]);

  useEffect(() => {
    if (!wantedUser) return;
    const found = conversations.find((item) => item.userId === wantedUser);
    if (found && selected?.userId !== wantedUser) setSelected(found);
  }, [conversations, selected?.userId, wantedUser]);

  const loadMessages = useCallback(async (userId: number, silent = false) => {
    if (!silent) setMessagesLoading(true);
    try {
      const data = await api<{ messages: CoachMessageDTO[] }>(`/api/admin/conversations/${userId}/messages`);
      setMessages(data.messages);
      setConversations((current) =>
        current.map((item) => (item.userId === userId ? { ...item, unread: 0 } : item))
      );
    } catch (cause) {
      if (!silent) toast.error(cause instanceof Error ? cause.message : "تعذر تحميل الرسائل.");
    } finally {
      if (!silent) setMessagesLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!selected) return;
    setMessages([]);
    void loadMessages(selected.userId);
    const timer = window.setInterval(() => void loadMessages(selected.userId, true), 8_000);
    return () => window.clearInterval(timer);
  }, [selected, loadMessages]);

  useEffect(() => {
    const node = scroller.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages.length]);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return conversations;
    return conversations.filter((item) =>
      [item.name, item.email, item.phone].filter(Boolean).some((entry) => entry.toLowerCase().includes(value))
    );
  }, [conversations, query]);

  const select = (conversation: CoachConversation) => {
    setSelected(conversation);
    setText("");
    setVideoUrl("");
    setFile(null);
  };

  const acceptFile = (candidate: File | undefined) => {
    if (!candidate) return;
    const image = candidate.type.startsWith("image/");
    const video = candidate.type.startsWith("video/");
    if (!image && !video) return toast.error("الملف لازم يكون صورة أو فيديو.");
    if (candidate.size > CHAT_MAX_FILE_BYTES) return toast.error("الحد الأقصى 64 ميجا. للفيديو الأكبر استخدم رابط.");
    setFile(candidate);
  };

  const send = async () => {
    if (!selected || sending) return;
    if (!text.trim() && !file && !videoUrl.trim()) return;
    setSending(true);
    try {
      const endpoint = `/api/admin/conversations/${selected.userId}/messages`;
      let data: { message: CoachMessageDTO | null };
      if (file && file.size > CHAT_DIRECT_MAX_BYTES) {
        setUploadPct(0);
        const mediaUploadId = await uploadChatAttachment(file, setUploadPct);
        data = await api<{ message: CoachMessageDTO | null }>(endpoint, {
          method: "POST",
          body: { body: text.trim(), videoUrl: videoUrl.trim(), mediaUploadId },
        });
      } else {
        const form = new FormData();
        form.append("body", text.trim());
        form.append("videoUrl", videoUrl.trim());
        if (file) form.append("file", file);
        data = await api<{ message: CoachMessageDTO | null }>(endpoint, { method: "POST", body: form });
      }
      if (data.message) setMessages((current) => [...current, data.message!]);
      setText("");
      setVideoUrl("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      await loadConversations(true);
      toast.success("تم إرسال الرسالة.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "تعذر إرسال الرسالة.");
    } finally {
      setSending(false);
      setUploadPct(null);
    }
  };

  return (
    <AdminPage
      kicker="التواصل"
      title="دردشة مع العملاء"
      text="قناة مباشرة بين الدكتور وكل عميل داخل باقته. شوف رسائل العملاء أولًا بأول، وابعت نص أو صورة أو فيديو أو رابط فيديو — والتحديث تلقائي."
      actions={
        <button
          type="button"
          onClick={() => void loadConversations()}
          className="inline-flex items-center gap-1.5 rounded-full border border-lemon/30 bg-lemon/10 px-4 py-2 text-[11px] font-bold text-lemon hover:bg-lemon/15"
        >
          <RefreshCw className="size-3.5" aria-hidden />
          تحديث
        </button>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        <div className="panel overflow-hidden">
          <div className="border-b border-white/8 p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-3.5 -translate-y-1/2 text-cream/30" aria-hidden />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="ابحث بالاسم أو الإيميل أو الموبايل…"
                className="field py-2 ps-9 text-xs"
              />
            </div>
          </div>
          {loading ? (
            <div className="flex h-72 items-center justify-center">
              <Spinner className="size-7 text-lemon" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-4">
              <EmptyState icon={MessageSquareText} title="مفيش محادثات" text="المشتركون النشطون هيظهروا هنا تلقائيًا، وتقدر تبدأ المحادثة معاهم." />
            </div>
          ) : (
            <ul className="max-h-[64vh] divide-y divide-white/6 overflow-y-auto">
              {filtered.map((conversation) => {
                const active = selected?.userId === conversation.userId;
                return (
                  <li key={conversation.userId}>
                    <button
                      type="button"
                      onClick={() => select(conversation)}
                      className={cn(
                        "flex w-full items-start gap-3 px-3.5 py-3 text-start transition-colors",
                        active ? "bg-lemon/[0.09]" : "hover:bg-white/[0.035]"
                      )}
                    >
                      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl text-[11px] font-bold", active ? "bg-lemon text-ink" : "bg-lemon/10 text-lemon")}>
                        {conversation.name.charAt(0)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-[12px] font-bold text-cream/85">{conversation.name}</span>
                          {conversation.unread > 0 && (
                            <span className="rounded-full bg-lemon px-1.5 py-0.5 text-[9px] font-bold text-ink">{conversation.unread}</span>
                          )}
                        </span>
                        <span className="mt-0.5 block truncate text-[10px] text-cream/35">{previewOf(conversation)}</span>
                        <span className="mt-1 flex items-center gap-1.5">
                          {conversation.activeSubscriptions > 0 ? (
                            <Badge tone="lemon">نشط</Badge>
                          ) : (
                            <Badge tone="neutral">منتهي</Badge>
                          )}
                          {conversation.lastMessageAt && (
                            <span className="text-[9px] text-cream/25">{formatDate(conversation.lastMessageAt)}</span>
                          )}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="panel flex min-h-[32rem] flex-col overflow-hidden">
          {!selected ? (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <span className="flex size-16 items-center justify-center rounded-2xl bg-lemon/10 text-lemon">
                <Stethoscope className="size-7" aria-hidden />
              </span>
              <h2 className="mt-4 text-lg">اختار محادثة من القائمة</h2>
              <p className="mt-2 max-w-sm text-xs leading-relaxed text-cream/40">
                هتلاقي هنا كل المشتركين النشطين. افتح محادثة عشان تشوف رسائل العميل وترد عليه أو تبعتله خطة/صورة/فيديو.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-white/[0.025] px-4 py-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-lemon/12 text-lemon">
                    <UserRound className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-cream">{selected.name}</p>
                    <p className="truncate text-[10px] text-cream/35" dir="ltr">{selected.email}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">

                  {selected.endsAt && <Badge tone="neutral">تنتهي {formatDate(selected.endsAt)}</Badge>}
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className="rounded-full border border-white/10 p-1.5 text-cream/40 hover:text-cream lg:hidden"
                    aria-label="إغلاق المحادثة"
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                </div>
              </div>

              <div ref={scroller} className="min-h-[22rem] flex-1 space-y-4 overflow-y-auto px-4 py-5">
                {messagesLoading ? (
                  <div className="flex h-64 items-center justify-center">
                    <Spinner className="size-7 text-lemon" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex h-64 flex-col items-center justify-center text-center">
                    <MessageSquareText className="size-8 text-cream/20" aria-hidden />
                    <p className="mt-3 text-sm font-semibold text-cream/55">ابدأ المحادثة</p>
                    <p className="mt-1 text-[11px] text-cream/30">ابعت ترحيب أو خطة أولى للعميل.</p>
                  </div>
                ) : (
                  messages.map((message) => {
                    const doctor = message.sender === "doctor";
                    return (
                      <div key={message.id} className={cn("flex gap-2", doctor ? "justify-start" : "justify-end")}>
                        {doctor && (
                          <span className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-lemon/15 text-lemon">
                            <Stethoscope className="size-3" aria-hidden />
                          </span>
                        )}
                        <div className={cn("max-w-[84%]", !doctor && "text-end")}>
                          <div
                            className={cn(
                              "rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed",
                              doctor
                                ? "rounded-es-md bg-lemon text-ink"
                                : "rounded-ee-md border border-white/10 bg-white/[0.05] text-cream/80"
                            )}
                          >
                            {message.body && <p className="whitespace-pre-wrap">{message.body}</p>}
                            {message.mediaUrl && message.mediaKind === "image" && (
                              <a href={message.mediaUrl} target="_blank" rel="noreferrer" className="mt-2 block overflow-hidden rounded-lg">
                                <img src={message.mediaUrl} alt="صورة" className="max-h-56 w-full object-cover" loading="lazy" />
                              </a>
                            )}
                            {message.mediaUrl && message.mediaKind === "video" && (
                              <video src={message.mediaUrl} controls playsInline className="mt-2 max-h-56 w-full rounded-lg bg-black" />
                            )}
                            {message.videoUrl && (
                              <a
                                href={message.videoUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-current/20 bg-black/10 px-2.5 py-1.5 text-[10px] font-bold"
                              >
                                <Video className="size-3.5" aria-hidden />
                                فتح رابط الفيديو
                              </a>
                            )}
                          </div>
                          <p className="mt-1 flex items-center justify-end gap-1 px-1 text-[9px] text-cream/30">
                            {doctor && <CheckCheck className="size-3" aria-hidden />}
                            {timeOf(message.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="border-t border-white/10 bg-white/[0.02] p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
                    className="hidden"
                    onChange={(event) => acceptFile(event.target.files?.[0])}
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/12 px-3 py-1.5 text-[10px] font-bold text-cream/55 hover:border-lemon/40 hover:text-lemon"
                  >
                    <ImagePlus className="size-3.5" aria-hidden />
                    صورة / فيديو
                  </button>
                  <div className="relative min-w-[13rem] flex-1">
                    <Video className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-cream/25" aria-hidden />
                    <input
                      value={videoUrl}
                      onChange={(event) => setVideoUrl(event.target.value)}
                      placeholder="أو رابط فيديو YouTube / Vimeo / Drive"
                      className="field py-1.5 ps-8 text-[10px]"
                      dir="ltr"
                    />
                  </div>
                </div>
                {file && (
                  <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-lemon/20 bg-lemon/[0.06] px-2.5 py-1.5 text-[10px] text-lemon">
                    <span className="truncate">
                      {uploadPct !== null ? `جاري الرفع… ${uploadPct}%` : file.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setFile(null);
                        if (fileRef.current) fileRef.current.value = "";
                      }}
                      aria-label="حذف الملف"
                    >
                      <X className="size-3" aria-hidden />
                    </button>
                  </div>
                )}
                <div className="mt-2 flex items-end gap-2">
                  <textarea
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void send();
                      }
                    }}
                    rows={2}
                    maxLength={2000}
                    placeholder="اكتب ردك للعميل…"
                    className="field min-h-11 flex-1 resize-y py-2 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => void send()}
                    disabled={sending || (!text.trim() && !file && !videoUrl.trim())}
                    className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-lemon text-ink disabled:opacity-40"
                    aria-label="إرسال"
                  >
                    {sending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4 rtl:-scale-x-100" aria-hidden />}
                  </button>
                </div>
                <p className="mt-1.5 text-[9px] text-cream/25">صور وفيديو حتى ٦٤ ميجا — الكبير بيترفع على مراحل تلقائيًا.</p>
              </div>
            </>
          )}
        </div>
      </div>

      {selected?.lastMessageAt && (
        <p className="mt-3 text-[10px] text-cream/25">
          آخر رسالة في المحادثة: {formatDateTime(selected.lastMessageAt)}
        </p>
      )}
    </AdminPage>
  );
}
