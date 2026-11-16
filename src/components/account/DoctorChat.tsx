import { ImagePlus, Loader2, LockKeyhole, MessageSquareText, RefreshCw, Send, Stethoscope, Video, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CHAT_MAX_FILE_BYTES, type CoachMessageDTO } from "../../../shared/types";
import { api } from "../../lib/api";
import { CHAT_DIRECT_MAX_BYTES, uploadChatAttachment } from "../../lib/chat-upload";
import { useLang } from "../../lib/i18n";
import { useToast } from "../ui/Toast";
import { cn } from "../../lib/utils";
import { Spinner } from "../ui/Spinner";

interface CoachPayload {
  active: boolean;
  messages: CoachMessageDTO[];
  doctor: { name: string; role: string; replyNote: string };
}

const timeOf = (value: string, locale: string) =>
  new Date(value).toLocaleString(locale, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export function DoctorChat({ activePlan }: { activePlan: boolean }) {
  const { lang } = useLang();
  const ar = lang === "ar";
  const locale = ar ? "ar-EG" : "en-US";
  const toast = useToast();
  const [messages, setMessages] = useState<CoachMessageDTO[]>([]);
  const [doctor, setDoctor] = useState<CoachPayload["doctor"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [error, setError] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!activePlan) {
        setLoading(false);
        return;
      }
      try {
        const data = await api<CoachPayload>("/api/coach/messages");
        setMessages(data.messages);
        setDoctor(data.doctor);
        setError("");
      } catch (cause) {
        if (!silent) setError(cause instanceof Error ? cause.message : ar ? "تعذر تحميل المحادثة." : "Couldn't load the chat.");
      } finally {
        setLoading(false);
      }
    },
    [activePlan, ar]
  );

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), 10_000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    const node = scroller.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages.length]);

  const acceptFile = (candidate: File | undefined) => {
    if (!candidate) return;
    const image = candidate.type.startsWith("image/");
    const video = candidate.type.startsWith("video/");
    if (!image && !video) {
      toast.error(ar ? "الملف لازم يكون صورة أو فيديو." : "The file must be an image or video.");
      return;
    }
    if (candidate.size > CHAT_MAX_FILE_BYTES) {
      toast.error(
        ar
          ? "الحد الأقصى ٦٤ ميجا. للفيديوهات الأكبر استخدم رابط."
          : "Maximum 64 MB. Use a link for bigger videos."
      );
      return;
    }
    setFile(candidate);
  };

  const send = async () => {
    const body = text.trim();
    if ((!body && !file && !videoUrl.trim()) || sending) return;
    setSending(true);
    try {
      let data: { message: CoachMessageDTO | null };
      if (file && file.size > CHAT_DIRECT_MAX_BYTES) {
        // Big attachment: chunks first, then a small JSON message that points at them.
        setUploadPct(0);
        const mediaUploadId = await uploadChatAttachment(file, setUploadPct);
        data = await api<{ message: CoachMessageDTO | null }>("/api/coach/messages", {
          method: "POST",
          body: { body, videoUrl: videoUrl.trim(), mediaUploadId },
        });
      } else {
        const form = new FormData();
        form.append("body", body);
        form.append("videoUrl", videoUrl.trim());
        if (file) form.append("file", file);
        data = await api<{ message: CoachMessageDTO | null }>("/api/coach/messages", {
          method: "POST",
          body: form,
        });
      }
      if (data.message) setMessages((current) => [...current, data.message!]);
      setText("");
      setVideoUrl("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      setError("");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : ar ? "تعذر إرسال الرسالة." : "Couldn't send the message.");
    } finally {
      setSending(false);
      setUploadPct(null);
    }
  };

  const lastDoctorMessage = useMemo(() => [...messages].reverse().find((item) => item.sender === "doctor"), [messages]);

  if (!activePlan) {
    return (
      <div className="panel p-8 text-center">
        <span className="mx-auto flex size-16 items-center justify-center rounded-2xl border border-lemon/25 bg-lemon/10 text-lemon">
          <LockKeyhole className="size-7" aria-hidden />
        </span>
        <h2 className="mt-4 text-xl">{ar ? "المحادثة مع الدكتور جوه الباقة" : "Chat with the doctor is inside your plan"}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-cream/45">
          {ar
            ? "فعّل الباقة التجريبية المجانية أو أي باقة شهرية عشان تفتح قناة مباشرة مع د. مصطفى وتبعتله ملاحظاتك."
            : "Activate any monthly plan to open a direct line with Dr. Mostafa and send your notes."}
        </p>
        <Link to="/programs" className="mt-5 inline-flex items-center gap-2 rounded-full bg-lemon px-5 py-3 text-xs font-bold text-ink">
          {ar ? "شوف الباقات" : "See plans"}
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-ink-2">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-white/[0.025] px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="relative flex size-11 items-center justify-center rounded-2xl bg-lemon text-ink">
            <Stethoscope className="size-5" aria-hidden />
            <span className="absolute -bottom-0.5 -end-0.5 size-3 rounded-full border-2 border-ink-2 bg-lemon" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-bold text-cream">{doctor?.name ?? (ar ? "د. مصطفى يوسف" : "Dr. Mostafa Youssef")}</p>
            <p className="text-[10px] text-cream/40">
              {ar ? "قناة خاصة بينك وبين الدكتور" : "A private line between you and the doctor"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-[10px] font-bold text-cream/50 transition-colors hover:border-lemon/40 hover:text-lemon"
        >
          <RefreshCw className="size-3" aria-hidden />
          {ar ? "تحديث" : "Refresh"}
        </button>
      </div>

      <div className="border-b border-white/8 bg-lemon/[0.045] px-5 py-2.5 text-[10px] leading-relaxed text-cream/45">
        {doctor?.replyNote ?? (ar ? "الدكتور بيرد خلال ساعات العمل." : "The doctor replies during working hours.")}
      </div>

      <div ref={scroller} className="min-h-[330px] max-h-[58vh] space-y-4 overflow-y-auto px-4 py-5 sm:px-6">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Spinner className="size-7 text-lemon" />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-400/25 bg-red-500/[0.07] px-4 py-6 text-center text-xs text-red-200">{error}</div>
        ) : messages.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center px-6 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-white/[0.04] text-lemon/70">
              <MessageSquareText className="size-6" aria-hidden />
            </span>
            <p className="mt-4 text-sm font-semibold text-cream/70">{ar ? "ابدأ المحادثة مع الدكتور" : "Start the conversation"}</p>
            <p className="mt-1.5 max-w-sm text-[11px] leading-relaxed text-cream/35">
              {ar
                ? "ابعت هدفك، وزنك الحالي، وأي سؤال — وهتلاقي رد هنا وفي حسابك."
                : "Send your goal, current weight and any question — the reply appears here in your account."}
            </p>
          </div>
        ) : (
          messages.map((message) => {
            const mine = message.sender === "customer";
            return (
              <div key={message.id} className={cn("flex gap-2.5", mine ? "justify-end" : "justify-start")}>
                {!mine && (
                  <span className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-lemon/15 text-lemon">
                    <Stethoscope className="size-3.5" aria-hidden />
                  </span>
                )}
                <div className={cn("max-w-[85%] sm:max-w-[72%]", mine && "text-end")}>
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-3 text-sm leading-relaxed",
                      mine
                        ? "rounded-ee-md bg-lemon text-ink"
                        : "rounded-es-md border border-white/10 bg-white/[0.045] text-cream/80"
                    )}
                  >
                    {message.body && <p className="whitespace-pre-wrap">{message.body}</p>}
                    {message.mediaUrl && message.mediaKind === "image" && (
                      <a href={message.mediaUrl} target="_blank" rel="noreferrer" className="mt-2 block overflow-hidden rounded-xl border border-black/10">
                        <img src={message.mediaUrl} alt={ar ? "صورة من الدكتور" : "Photo from the doctor"} className="max-h-72 w-full object-cover" loading="lazy" />
                      </a>
                    )}
                    {message.mediaUrl && message.mediaKind === "video" && (
                      <video src={message.mediaUrl} controls playsInline className="mt-2 max-h-72 w-full rounded-xl bg-black" />
                    )}
                    {message.videoUrl && (
                      <a
                        href={message.videoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-2 rounded-xl border border-lemon/30 bg-lemon/10 px-3 py-2 text-[11px] font-bold text-lemon"
                      >
                        <Video className="size-4" aria-hidden />
                        {ar ? "افتح الفيديو" : "Open video"}
                      </a>
                    )}
                  </div>
                  <p className="mt-1 px-1 text-[9px] text-cream/30">{timeOf(message.createdAt, locale)}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-white/10 bg-white/[0.02] p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2 pb-2">
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
            className="inline-flex items-center gap-1.5 rounded-full border border-white/12 px-3 py-1.5 text-[10px] font-bold text-cream/55 transition-colors hover:border-lemon/40 hover:text-lemon"
          >
            <ImagePlus className="size-3.5" aria-hidden />
            {ar ? "صورة / فيديو" : "Photo / video"}
          </button>
          <div className="relative min-w-[12rem] flex-1">
            <Video className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-cream/25" aria-hidden />
            <input
              value={videoUrl}
              onChange={(event) => setVideoUrl(event.target.value)}
              placeholder={ar ? "أو رابط فيديو YouTube / Vimeo / Drive" : "Or a YouTube / Vimeo / Drive link"}
              className="field py-1.5 ps-8 text-[10px]"
              dir="ltr"
            />
          </div>
        </div>
        {file && (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-lemon/20 bg-lemon/[0.06] px-2.5 py-1.5 text-[10px] text-lemon">
            <span className="truncate">
              {uploadPct !== null
                ? ar
                  ? `جاري الرفع… ${uploadPct}%`
                  : `Uploading… ${uploadPct}%`
                : file.name}
            </span>
            <button
              type="button"
              onClick={() => {
                setFile(null);
                if (fileRef.current) fileRef.current.value = "";
              }}
              aria-label={ar ? "حذف الملف" : "Remove file"}
            >
              <X className="size-3" aria-hidden />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
            rows={1}
            maxLength={2000}
            placeholder={ar ? "اكتب رسالتك للدكتور…" : "Write your message to the doctor…"}
            className="field max-h-32 min-h-11 flex-1 resize-y py-3 text-xs"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={sending || (!text.trim() && !file && !videoUrl.trim())}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-lemon text-ink transition-transform hover:-translate-y-0.5 disabled:opacity-40"
            aria-label={ar ? "إرسال" : "Send"}
          >
            {sending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4 rtl:-scale-x-100" aria-hidden />}
          </button>
        </div>
        <p className="mt-2 flex flex-wrap items-center gap-1.5 px-1 text-[9px] text-cream/25">
          <LockKeyhole className="size-3" aria-hidden />
          {ar ? "المحادثة خاصة بينك وبين فريق الدكتور." : "This chat is private between you and the doctor's team."}
          <span className="text-cream/20">·</span>
          {ar ? "صور وفيديو بأي حجم حتى ٦٤ ميجا." : "Photos and videos of any size up to 64 MB."}
        </p>
      </div>

      {lastDoctorMessage && (
        <span className="sr-only">
          {ar ? "آخر رسالة من الدكتور" : "Latest doctor message"}: {lastDoctorMessage.body}
        </span>
      )}
    </div>
  );
}
