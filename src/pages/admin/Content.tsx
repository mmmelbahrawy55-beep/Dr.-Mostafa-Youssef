import { ChevronDown, Edit3, Eye, EyeOff, FileText, Loader2, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { Collection, ContentItem } from "../../../shared/types";
import { Spinner } from "../../components/ui/Spinner";
import { useToast } from "../../components/ui/Toast";
import { api } from "../../lib/api";
import { useSiteData } from "../../lib/site-data";
import { cn } from "../../lib/utils";
import { AdminField, AdminPage, Badge, EmptyState, Modal } from "./components";

type Group = "common" | "ar" | "en";
type FieldType = "text" | "textarea" | "number" | "boolean" | "lines" | "blocks";

interface FieldDef {
  group: Group;
  key: string;
  label: string;
  type: FieldType;
  hint?: string;
}

interface CollectionDef {
  key: Collection;
  label: string;
  prefix: string;
  titleKeys: string[];
  fields: FieldDef[];
  defaults: Partial<ContentItem>;
}

const COMMON: Record<Collection, Partial<ContentItem>> = {
  programs: { common: { amount: 0, days: 30, image: "", popular: false }, ar: { name: "", tagline: "", features: [], note: "" }, en: { name: "", tagline: "", features: [], note: "" } },
  services: { common: { icon: "nutrition", image: "" }, ar: { tag: "", title: "", desc: "", bullets: [] }, en: { tag: "", title: "", desc: "", bullets: [] } },
  testimonials: { common: { rating: 5 }, ar: { name: "", role: "", quote: "", result: "" }, en: { name: "", role: "", quote: "", result: "" } },
  results: { common: { before: "", after: "" }, ar: { name: "", duration: "", stat: "", summary: "" }, en: { name: "", duration: "", stat: "", summary: "" } },
  posts: { common: { slug: "", date: new Date().toISOString().slice(0, 10), readTime: "5", cover: "" }, ar: { title: "", excerpt: "", category: "", body: [] }, en: { title: "", excerpt: "", category: "", body: [] } },
  faqs: { ar: { q: "", a: "" }, en: { q: "", a: "" } },
  credentials: { ar: { year: "", title: "", place: "" }, en: { year: "", title: "", place: "" } },
};

const COLLECTIONS: CollectionDef[] = [
  {
    key: "programs",
    label: "الباقات",
    prefix: "prog",
    titleKeys: ["name"],
    fields: [
      { group: "common", key: "amount", label: "السعر (ج.م)", type: "number" },
      { group: "common", key: "days", label: "مدة الباقة (يوم)", type: "number" },
      { group: "common", key: "image", label: "رابط الصورة", type: "text", hint: "رابط صورة أو مسار من مكتبة الوسائط." },
      { group: "common", key: "popular", label: "باقة مميزة؟", type: "boolean" },
      { group: "ar", key: "name", label: "الاسم (عربي)", type: "text" },
      { group: "ar", key: "tagline", label: "الوصف المختصر (عربي)", type: "text" },
      { group: "ar", key: "features", label: "المميزات (عربي)", type: "lines", hint: "كل ميزة في سطر." },
      { group: "ar", key: "note", label: "ملاحظة (عربي)", type: "textarea" },
      { group: "en", key: "name", label: "Name (EN)", type: "text" },
      { group: "en", key: "tagline", label: "Tagline (EN)", type: "text" },
      { group: "en", key: "features", label: "Features (EN)", type: "lines", hint: "One per line." },
      { group: "en", key: "note", label: "Note (EN)", type: "textarea" },
    ],
    defaults: COMMON.programs,
  },
  {
    key: "services",
    label: "الخدمات",
    prefix: "svc",
    titleKeys: ["title"],
    fields: [
      { group: "common", key: "icon", label: "الأيقونة", type: "text", hint: "nutrition, flame, muscle, coach, sport, lab" },
      { group: "common", key: "image", label: "رابط الصورة", type: "text" },
      { group: "ar", key: "tag", label: "التصنيف (عربي)", type: "text" },
      { group: "ar", key: "title", label: "العنوان (عربي)", type: "text" },
      { group: "ar", key: "desc", label: "الوصف (عربي)", type: "textarea" },
      { group: "ar", key: "bullets", label: "النقاط (عربي)", type: "lines" },
      { group: "en", key: "tag", label: "Tag (EN)", type: "text" },
      { group: "en", key: "title", label: "Title (EN)", type: "text" },
      { group: "en", key: "desc", label: "Description (EN)", type: "textarea" },
      { group: "en", key: "bullets", label: "Bullets (EN)", type: "lines" },
    ],
    defaults: COMMON.services,
  },
  {
    key: "testimonials",
    label: "آراء العملاء",
    prefix: "tst",
    titleKeys: ["name"],
    fields: [
      { group: "common", key: "rating", label: "التقييم (1-5)", type: "number" },
      { group: "ar", key: "name", label: "الاسم (عربي)", type: "text" },
      { group: "ar", key: "role", label: "الوصف (عربي)", type: "text" },
      { group: "ar", key: "quote", label: "الرأي (عربي)", type: "textarea" },
      { group: "ar", key: "result", label: "النتيجة (عربي)", type: "text" },
      { group: "en", key: "name", label: "Name (EN)", type: "text" },
      { group: "en", key: "role", label: "Role (EN)", type: "text" },
      { group: "en", key: "quote", label: "Quote (EN)", type: "textarea" },
      { group: "en", key: "result", label: "Result (EN)", type: "text" },
    ],
    defaults: COMMON.testimonials,
  },
  {
    key: "results",
    label: "النتائج",
    prefix: "res",
    titleKeys: ["name"],
    fields: [
      { group: "common", key: "before", label: "صورة قبل", type: "text" },
      { group: "common", key: "after", label: "صورة بعد", type: "text" },
      { group: "ar", key: "name", label: "الاسم (عربي)", type: "text" },
      { group: "ar", key: "duration", label: "المدة (عربي)", type: "text" },
      { group: "ar", key: "stat", label: "النتيجة الرقمية (عربي)", type: "text" },
      { group: "ar", key: "summary", label: "الملخص (عربي)", type: "textarea" },
      { group: "en", key: "name", label: "Name (EN)", type: "text" },
      { group: "en", key: "duration", label: "Duration (EN)", type: "text" },
      { group: "en", key: "stat", label: "Stat (EN)", type: "text" },
      { group: "en", key: "summary", label: "Summary (EN)", type: "textarea" },
    ],
    defaults: COMMON.results,
  },
  {
    key: "posts",
    label: "المقالات",
    prefix: "post",
    titleKeys: ["title"],
    fields: [
      { group: "common", key: "slug", label: "الرابط (slug)", type: "text", hint: "مثال: best-protein-sources" },
      { group: "common", key: "date", label: "التاريخ", type: "text", hint: "YYYY-MM-DD" },
      { group: "common", key: "readTime", label: "وقت القراءة (دقيقة)", type: "text" },
      { group: "common", key: "cover", label: "صورة الغلاف", type: "text" },
      { group: "ar", key: "title", label: "العنوان (عربي)", type: "text" },
      { group: "ar", key: "excerpt", label: "المقدمة (عربي)", type: "textarea" },
      { group: "ar", key: "category", label: "التصنيف (عربي)", type: "text" },
      { group: "ar", key: "body", label: "محتوى المقال (عربي)", type: "blocks" },
      { group: "en", key: "title", label: "Title (EN)", type: "text" },
      { group: "en", key: "excerpt", label: "Excerpt (EN)", type: "textarea" },
      { group: "en", key: "category", label: "Category (EN)", type: "text" },
      { group: "en", key: "body", label: "Body (EN)", type: "blocks" },
    ],
    defaults: COMMON.posts,
  },
  {
    key: "faqs",
    label: "الأسئلة الشائعة",
    prefix: "faq",
    titleKeys: ["q"],
    fields: [
      { group: "ar", key: "q", label: "السؤال (عربي)", type: "text" },
      { group: "ar", key: "a", label: "الإجابة (عربي)", type: "textarea" },
      { group: "en", key: "q", label: "Question (EN)", type: "text" },
      { group: "en", key: "a", label: "Answer (EN)", type: "textarea" },
    ],
    defaults: COMMON.faqs,
  },
  {
    key: "credentials",
    label: "الشهادات",
    prefix: "cred",
    titleKeys: ["title"],
    fields: [
      { group: "ar", key: "year", label: "السنة (عربي)", type: "text" },
      { group: "ar", key: "title", label: "الشهادة (عربي)", type: "text" },
      { group: "ar", key: "place", label: "الجهة (عربي)", type: "text" },
      { group: "en", key: "year", label: "Year (EN)", type: "text" },
      { group: "en", key: "title", label: "Credential (EN)", type: "text" },
      { group: "en", key: "place", label: "Place (EN)", type: "text" },
    ],
    defaults: COMMON.credentials,
  },
];

type BlockEntry = { h?: string; p: string };

function BlocksEditor({
  value,
  onChange,
  label,
}: {
  value: unknown;
  onChange: (blocks: BlockEntry[]) => void;
  label: string;
}) {
  const blocks: BlockEntry[] = Array.isArray(value)
    ? value.map((entry) => {
        const record = (entry ?? {}) as Record<string, unknown>;
        return { h: typeof record.h === "string" ? record.h : undefined, p: typeof record.p === "string" ? record.p : "" };
      })
    : [];

  const update = (index: number, patch: Partial<BlockEntry>) => {
    onChange(blocks.map((block, current) => (current === index ? { ...block, ...patch } : block)));
  };

  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.015] p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold text-cream/45">{label}</span>
        <button
          type="button"
          onClick={() => onChange([...blocks, { h: "", p: "" }])}
          className="inline-flex items-center gap-1 rounded-full border border-lemon/25 bg-lemon/5 px-2.5 py-1 text-[9px] font-bold text-lemon"
        >
          <Plus className="size-3" aria-hidden />
          فقرة
        </button>
      </div>
      <div className="mt-2 space-y-2">
        {blocks.length === 0 && <p className="py-2 text-center text-[10px] text-cream/25">مفيش فقرات — أضف فقرة جديدة.</p>}
        {blocks.map((block, index) => (
          <div key={index} className="rounded-lg border border-white/8 bg-ink/40 p-2">
            <div className="flex items-center gap-2">
              <input
                className="field py-1.5 text-[11px]"
                value={block.h ?? ""}
                onChange={(event) => update(index, { h: event.target.value })}
                placeholder="عنوان فرعي (اختياري)"
              />
              <button
                type="button"
                onClick={() => onChange(blocks.filter((_, current) => current !== index))}
                className="shrink-0 rounded-lg p-1.5 text-cream/30 hover:bg-red-500/10 hover:text-red-200"
                aria-label="حذف الفقرة"
              >
                <Trash2 className="size-3.5" aria-hidden />
              </button>
            </div>
            <textarea
              className="field mt-1.5 min-h-20 resize-y text-[11px] leading-relaxed"
              value={block.p}
              onChange={(event) => update(index, { p: event.target.value })}
              placeholder="نص الفقرة…"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function itemTitle(item: ContentItem, def: CollectionDef) {
  const source = item.ar as Record<string, unknown>;
  for (const key of def.titleKeys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return item.id;
}

function itemSubtitle(item: ContentItem) {
  const source = item.ar as Record<string, unknown>;
  const value = source.tagline ?? source.desc ?? source.quote ?? source.summary ?? source.a ?? source.place;
  return typeof value === "string" ? value : "";
}

export default function AdminContent() {
  const toast = useToast();
  const { refresh } = useSiteData();
  const [collection, setCollection] = useState<Collection>("programs");
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<ContentItem | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const def = useMemo(() => COLLECTIONS.find((entry) => entry.key === collection)!, [collection]);

  const load = useCallback(
    async (key: Collection) => {
      setLoading(true);
      try {
        const data = await api<{ items: ContentItem[] }>(`/api/admin/content/${key}`);
        setItems(data.items.sort((a, b) => a.sort - b.sort));
      } catch (cause) {
        toast.error(cause instanceof Error ? cause.message : "تعذر تحميل المحتوى.");
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    void load(collection);
  }, [collection, load]);

  const getValue = (item: ContentItem, group: Group, key: string) => {
    const source = item[group] as Record<string, unknown>;
    return source[key];
  };

  const setValue = (group: Group, key: string, value: unknown) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = { ...prev };
      next[group] = { ...(prev[group] as Record<string, unknown>), [key]: value };
      return next;
    });
  };

  const startNew = () => {
    const base: ContentItem = {
      id: `${def.prefix}-${Date.now().toString(36)}`,
      collection,
      sort: items.length,
      active: true,
      common: { ...(def.defaults.common ?? {}) },
      ar: { ...(def.defaults.ar ?? {}) },
      en: { ...(def.defaults.en ?? {}) },
    };
    setDraft(base);
    setIsNew(true);
    setConfirmDelete(false);
  };

  const startEdit = (item: ContentItem) => {
    setDraft(JSON.parse(JSON.stringify(item)) as ContentItem);
    setIsNew(false);
    setConfirmDelete(false);
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    setSaving(true);
    try {
      if (isNew) {
        const data = await api<{ item: ContentItem }>(`/api/admin/content/${collection}`, { method: "POST", body: draft });
        setItems((prev) => [...prev, data.item]);
        toast.success("تم إضافة العنصر.");
      } else {
        const data = await api<{ item: ContentItem }>(`/api/admin/content/${collection}/${draft.id}`, {
          method: "PATCH",
          body: { sort: draft.sort, active: draft.active, common: draft.common, ar: draft.ar, en: draft.en },
        });
        setItems((prev) => prev.map((entry) => (entry.id === data.item.id ? data.item : entry)));
        toast.success("تم حفظ التعديلات.");
      }
      setDraft(null);
      await refresh();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "تعذر الحفظ.");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (item: ContentItem) => {
    try {
      const data = await api<{ item: ContentItem }>(`/api/admin/content/${collection}/${item.id}`, {
        method: "PATCH",
        body: { active: !item.active },
      });
      setItems((prev) => prev.map((entry) => (entry.id === item.id ? data.item : entry)));
      toast.success(data.item.active ? "تم إظهار العنصر." : "تم إخفاء العنصر.");
      await refresh();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "تعذر تحديث العنصر.");
    }
  };

  const remove = async () => {
    if (!draft) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setSaving(true);
    try {
      await api(`/api/admin/content/${collection}/${draft.id}`, { method: "DELETE" });
      setItems((prev) => prev.filter((entry) => entry.id !== draft.id));
      setDraft(null);
      toast.success("تم حذف العنصر.");
      await refresh();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "تعذر الحذف.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminPage
      kicker="المحتوى"
      title="محتوى الموقع"
      text="عدّل الباقات، الخدمات، آراء العملاء، النتائج، المقالات، الأسئلة الشائعة، والشهادات — بالعربي والإنجليزي."
      actions={
        <button
          type="button"
          onClick={startNew}
          className="inline-flex items-center gap-1.5 rounded-full bg-lemon px-4 py-2 text-[11px] font-bold text-ink transition-transform hover:-translate-y-0.5"
        >
          <Plus className="size-3.5" aria-hidden />
          إضافة عنصر
        </button>
      }
    >
      <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {COLLECTIONS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => setCollection(entry.key)}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-[10px] font-bold transition-colors",
              collection === entry.key
                ? "border-lemon bg-lemon text-ink"
                : "border-white/10 bg-white/[0.02] text-cream/55 hover:border-lemon/40"
            )}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <div className="panel mt-3 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner className="size-7 text-lemon" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState icon={FileText} title="مفيش عناصر هنا" text="ابدأ بإضافة أول عنصر في القسم ده." />
        ) : (
          <ul className="divide-y divide-white/8">
            {items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/5 text-cream/40">
                  <FileText className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-xs font-bold text-cream">{itemTitle(item, def)}</p>
                    {!item.active && <Badge tone="neutral">مخفي</Badge>}
                    <span className="text-[9px] text-cream/25">ترتيب {item.sort}</span>
                  </div>
                  {itemSubtitle(item) && <p className="mt-0.5 truncate text-[10px] text-cream/35">{itemSubtitle(item)}</p>}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => void toggleActive(item)}
                    className="rounded-lg border border-white/10 p-2 text-cream/40 hover:border-lemon/30 hover:text-lemon"
                    aria-label={item.active ? "إخفاء" : "إظهار"}
                    title={item.active ? "إخفاء" : "إظهار"}
                  >
                    {item.active ? <Eye className="size-3.5" aria-hidden /> : <EyeOff className="size-3.5" aria-hidden />}
                  </button>
                  <button
                    type="button"
                    onClick={() => startEdit(item)}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-2 text-[10px] font-bold text-cream/55 hover:border-lemon/30 hover:text-lemon"
                  >
                    <Edit3 className="size-3.5" aria-hidden />
                    تعديل
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal
        open={Boolean(draft)}
        onClose={() => setDraft(null)}
        title={isNew ? `إضافة ${def.label}` : draft ? itemTitle(draft, def) : def.label}
        description={draft ? `المعرّف: ${draft.id}` : undefined}
        size="xl"
        footer={
          <>
            {!isNew && (
              <button
                type="button"
                onClick={remove}
                disabled={saving}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-[11px] font-bold",
                  confirmDelete
                    ? "border-red-400/50 bg-red-500/15 text-red-100"
                    : "border-red-400/25 bg-red-500/5 text-red-200"
                )}
              >
                <Trash2 className="size-3.5" aria-hidden />
                {confirmDelete ? "تأكيد الحذف" : "حذف"}
              </button>
            )}
            <button type="button" onClick={() => setDraft(null)} className="rounded-full border border-white/15 px-4 py-2 text-[11px] font-bold text-cream/60">
              إلغاء
            </button>
            <button
              type="submit"
              form="content-form"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-full bg-lemon px-4 py-2 text-[11px] font-bold text-ink disabled:opacity-60"
            >
              {saving ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Plus className="size-3.5" aria-hidden />}
              {isNew ? "إضافة" : "حفظ"}
            </button>
          </>
        }
      >
        {draft && (
          <form id="content-form" onSubmit={save} className="space-y-4">
            <div className="flex items-center gap-3">
              <AdminField label="الترتيب" className="w-24">
                <input
                  type="number"
                  className="field py-2 text-xs"
                  value={draft.sort}
                  onChange={(event) => setDraft({ ...draft, sort: Number(event.target.value) })}
                />
              </AdminField>
              <label className="mt-5 flex items-center gap-2 text-[11px] font-semibold text-cream/55">
                <input
                  type="checkbox"
                  checked={draft.active}
                  onChange={(event) => setDraft({ ...draft, active: event.target.checked })}
                  className="size-4 accent-[#d4ff3f]"
                />
                ظاهر على الموقع
              </label>
            </div>

            {(["common", "ar", "en"] as Group[]).map((group) => {
              const fields = def.fields.filter((field) => field.group === group);
              if (fields.length === 0) return null;
              return (
                <div key={group} className="rounded-xl border border-white/8 bg-white/[0.015] p-3.5">
                  <p className="mb-3 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-lemon/80">
                    {group === "common" ? "إعدادات مشتركة" : group === "ar" ? "المحتوى العربي" : "English content"}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {fields.map((field) => {
                      const raw = getValue(draft, group, field.key);
                      const wide = field.type === "textarea" || field.type === "blocks";
                      if (field.type === "boolean") {
                        return (
                          <label key={`${group}-${field.key}`} className="flex items-center gap-2 self-end py-2 text-[11px] font-semibold text-cream/60">
                            <input
                              type="checkbox"
                              checked={Boolean(raw)}
                              onChange={(event) => setValue(group, field.key, event.target.checked)}
                              className="size-4 accent-[#d4ff3f]"
                            />
                            {field.label}
                          </label>
                        );
                      }
                      if (field.type === "blocks") {
                        return (
                          <div key={`${group}-${field.key}`} className="sm:col-span-2">
                            <BlocksEditor
                              label={field.label}
                              value={raw}
                              onChange={(blocks) => setValue(group, field.key, blocks)}
                            />
                          </div>
                        );
                      }
                      return (
                        <AdminField key={`${group}-${field.key}`} label={field.label} hint={field.hint} className={wide ? "sm:col-span-2" : ""}>
                          {field.type === "textarea" ? (
                            <textarea
                              className="field min-h-20 resize-y text-xs"
                              value={typeof raw === "string" ? raw : ""}
                              onChange={(event) => setValue(group, field.key, event.target.value)}
                            />
                          ) : field.type === "lines" ? (
                            <textarea
                              className="field min-h-24 resize-y text-xs leading-relaxed"
                              value={Array.isArray(raw) ? raw.join("\n") : ""}
                              onChange={(event) => setValue(group, field.key, event.target.value.split("\n").filter((line) => line.trim()))}
                            />
                          ) : field.type === "number" ? (
                            <input
                              type="number"
                              className="field py-2 text-xs"
                              value={typeof raw === "number" ? raw : Number(raw ?? 0)}
                              onChange={(event) => setValue(group, field.key, Number(event.target.value))}
                            />
                          ) : (
                            <input
                              className="field py-2 text-xs"
                              value={typeof raw === "string" ? raw : ""}
                              onChange={(event) => setValue(group, field.key, event.target.value)}
                              dir={group !== "ar" && field.key === "slug" ? "ltr" : undefined}
                            />
                          )}
                        </AdminField>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            <details className="rounded-xl border border-white/8 bg-white/[0.015] p-3.5">
              <summary className="flex cursor-pointer items-center gap-1.5 text-[10px] font-bold text-cream/45">
                <ChevronDown className="size-3.5" aria-hidden />
                عرض البيانات الخام (JSON)
              </summary>
              <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-ink/60 p-3 text-[10px] leading-relaxed text-cream/55" dir="ltr">
                {JSON.stringify({ common: draft.common, ar: draft.ar, en: draft.en }, null, 2)}
              </pre>
            </details>
          </form>
        )}
      </Modal>
    </AdminPage>
  );
}
