import { RotateCcw, Save, Search, Wand2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { CopyOverrides } from "../../../shared/types";
import { content } from "../../content";
import type { Lang } from "../../content/types";
import { Spinner } from "../../components/ui/Spinner";
import { useToast } from "../../components/ui/Toast";
import { api } from "../../lib/api";
import { flattenStrings } from "../../lib/merge-content";
import { useSiteData } from "../../lib/site-data";
import { cn } from "../../lib/utils";
import { AdminPage, Badge } from "./components";

const GROUP_LABELS: Record<string, string> = {
  nav: "القائمة",
  ui: "عناصر عامة",
  hero: "الهيرو",
  marquee: "الشريط المتحرك",
  stats: "الأرقام",
  about: "من نحن",
  services: "الخدمات",
  programs: "الباقات",
  programsPage: "صفحة الباقات",
  results: "النتائج",
  resultsPage: "صفحة النتائج",
  testimonials: "آراء العملاء",
  process: "خطوات العمل",
  calculator: "حاسبة السعرات",
  blog: "المدونة",
  post: "المقال",
  contact: "التواصل",
  faq: "الأسئلة الشائعة",
  finalCta: "الدعوة النهائية",
  footer: "الفوتر",
  legal: "الشروط والخصوصية",
  notFound: "صفحة 404",
  common: "مشترك",
};

export default function AdminCopy() {
  const toast = useToast();
  const { refresh } = useSiteData();
  const [lang, setLang] = useState<Lang>("ar");
  const [overrides, setOverrides] = useState<CopyOverrides>({ ar: {}, en: {} });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");

  const base = useMemo(
    () => ({ ar: flattenStrings(content.ar), en: flattenStrings(content.en) }),
    []
  );

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await api<{ copy: CopyOverrides }>("/api/admin/copy");
        if (active) setOverrides({ ar: data.copy?.ar ?? {}, en: data.copy?.en ?? {} });
      } catch (cause) {
        toast.error(cause instanceof Error ? cause.message : "تعذر تحميل النصوص.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [toast]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const map = new Map<string, string[]>();
    for (const key of Object.keys(base[lang]).sort()) {
      const value = overrides[lang][key] ?? base[lang][key] ?? "";
      if (q && !key.toLowerCase().includes(q) && !String(value).toLowerCase().includes(q)) continue;
      const group = key.split(".")[0] || "عام";
      const list = map.get(group) ?? [];
      list.push(key);
      map.set(group, list);
    }
    return Array.from(map.entries());
  }, [base, lang, overrides, query]);

  const overrideCount = Object.keys(overrides.ar).length + Object.keys(overrides.en).length;

  const setValue = (key: string, value: string) => {
    setOverrides((prev) => ({ ...prev, [lang]: { ...prev[lang], [key]: value } }));
  };

  const reset = (key: string) => {
    setOverrides((prev) => {
      const next = { ...prev[lang] };
      delete next[key];
      return { ...prev, [lang]: next };
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const data = await api<{ copy: CopyOverrides }>("/api/admin/copy", { method: "PUT", body: overrides });
      setOverrides({ ar: data.copy?.ar ?? {}, en: data.copy?.en ?? {} });
      await refresh();
      toast.success("تم حفظ النصوص وتحديث الموقع.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "تعذر حفظ النصوص.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminPage
      kicker="النصوص"
      title="محرّر نصوص الموقع"
      text="أي جملة في الموقع تقدر تعدّلها من هنا بدون كود. التعديلات بتظهر فورًا بعد الحفظ، والباقي بيفضل زي ما هو."
      actions={
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-full bg-lemon px-4 py-2 text-[11px] font-bold text-ink transition-transform hover:-translate-y-0.5 disabled:opacity-60"
        >
          {saving ? <Spinner className="text-ink" /> : <Save className="size-3.5" aria-hidden />}
          حفظ النصوص
        </button>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5">
          {(["ar", "en"] as Lang[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setLang(item)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-[10px] font-bold transition-colors",
                lang === item ? "border-lemon bg-lemon text-ink" : "border-white/10 bg-white/[0.02] text-cream/55 hover:border-lemon/40"
              )}
            >
              {item === "ar" ? "العربي" : "English"}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={overrideCount > 0 ? "lemon" : "neutral"}>
            <Wand2 className="size-3" aria-hidden />
            {overrideCount} نص معدّل
          </Badge>
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-3.5 -translate-y-1/2 text-cream/30" aria-hidden />
            <input
              className="field py-2 ps-9 text-xs"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ابحث في النصوص…"
            />
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-start gap-1.5 rounded-xl border border-white/8 bg-white/[0.02] px-3.5 py-2.5 text-[10px] leading-relaxed text-cream/35">
        <span className="mt-0.5 rounded bg-white/5 px-1.5 py-0.5 font-latin text-[9px] text-cream/45" dir="ltr">
          hero.titleLine1
        </span>
        كل مفتاح بيمثّل جملة في الموقع. التعديل هنا بيغطي النص الأصلي، وزر الاسترجاع بيرجّع الجملة الأصلية.
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Spinner className="size-7 text-lemon" />
        </div>
      ) : groups.length === 0 ? (
        <div className="panel mt-4 px-6 py-14 text-center text-sm text-cream/40">مفيش نصوص مطابقة للبحث.</div>
      ) : (
        <div className="mt-4 space-y-5">
          {groups.map(([group, keys]) => (
            <section key={group} className="panel overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-white/8 px-4 py-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-bold text-cream/80">{GROUP_LABELS[group] ?? group}</h2>
                  <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[9px] text-cream/35">{keys.length}</span>
                </div>
                <code className="text-[9px] text-cream/25" dir="ltr">{group}</code>
              </div>
              <div className="grid gap-3 p-4 lg:grid-cols-2">
                {keys.map((key) => {
                  const value = overrides[lang][key] ?? base[lang][key] ?? "";
                  const overridden = Object.prototype.hasOwnProperty.call(overrides[lang], key);
                  const long = value.length > 90 || value.includes("\n");
                  return (
                    <div key={key} className={cn("rounded-xl border p-3", overridden ? "border-lemon/25 bg-lemon/[0.03]" : "border-white/8 bg-white/[0.015]")}>
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <code className="truncate text-[9px] text-cream/30" dir="ltr">{key}</code>
                        {overridden && (
                          <div className="flex shrink-0 items-center gap-1">
                            <Badge tone="lemon">معدّل</Badge>
                            <button
                              type="button"
                              onClick={() => reset(key)}
                              className="rounded p-1 text-cream/35 hover:bg-white/5 hover:text-cream"
                              aria-label="استرجاع النص الأصلي"
                              title="استرجاع الأصل"
                            >
                              <RotateCcw className="size-3" aria-hidden />
                            </button>
                          </div>
                        )}
                      </div>
                      {long ? (
                        <textarea
                          className="field min-h-20 resize-y text-xs leading-relaxed"
                          value={value}
                          onChange={(event) => setValue(key, event.target.value)}
                          dir={lang === "ar" ? "rtl" : "ltr"}
                        />
                      ) : (
                        <input
                          className="field py-2 text-xs"
                          value={value}
                          onChange={(event) => setValue(key, event.target.value)}
                          dir={lang === "ar" ? "rtl" : "ltr"}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </AdminPage>
  );
}
