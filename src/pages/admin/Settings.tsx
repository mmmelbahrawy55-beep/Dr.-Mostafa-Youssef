import { BellRing, CreditCard, ImageIcon, MapPin, Phone, Save, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import type { SiteSettings } from "../../../shared/types";
import { Spinner } from "../../components/ui/Spinner";
import { useToast } from "../../components/ui/Toast";
import { api } from "../../lib/api";
import { useSiteData } from "../../lib/site-data";
import { cn } from "../../lib/utils";
import { AdminField, AdminPage } from "./components";

export default function AdminSettings() {
  const toast = useToast();
  const { refresh } = useSiteData();
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await api<{ settings: SiteSettings }>("/api/admin/settings");
        if (active) setSettings(data.settings);
      } catch (cause) {
        toast.error(cause instanceof Error ? cause.message : "تعذر تحميل الإعدادات.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [toast]);

  const updateContact = (key: keyof SiteSettings["contact"], value: string) =>
    setSettings((prev) => (prev ? { ...prev, contact: { ...prev.contact, [key]: value } } : prev));
  const updatePayments = (key: keyof SiteSettings["payments"], value: string) =>
    setSettings((prev) => (prev ? { ...prev, payments: { ...prev.payments, [key]: value } } : prev));
  const updateHero = (key: keyof SiteSettings["hero"], value: string) =>
    setSettings((prev) => (prev ? { ...prev, hero: { ...prev.hero, [key]: value } } : prev));
  const updateAnnouncement = (key: keyof SiteSettings["announcement"], value: string | boolean) =>
    setSettings((prev) => (prev ? { ...prev, announcement: { ...prev.announcement, [key]: value } } : prev));

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!settings) return;
    setSaving(true);
    try {
      const data = await api<{ settings: SiteSettings }>("/api/admin/settings", { method: "PUT", body: settings });
      setSettings(data.settings);
      await refresh();
      toast.success("تم حفظ الإعدادات وتحديث الموقع.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "تعذر حفظ الإعدادات.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner className="size-8 text-lemon" />
      </div>
    );
  }

  if (!settings) {
    return <AdminPage title="الإعدادات"><p className="text-sm text-cream/45">تعذر تحميل الإعدادات.</p></AdminPage>;
  }

  return (
    <AdminPage
      kicker="الإعدادات"
      title="إعدادات الموقع والدفع"
      text="بيانات التواصل، أرقام المحافظ، تعليمات الدفع، صورة الهيرو، والإعلان الأعلى — كل حاجة بتتحدث فورًا على الموقع."
      actions={
        <button
          type="submit"
          form="settings-form"
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-full bg-lemon px-4 py-2 text-[11px] font-bold text-ink transition-transform hover:-translate-y-0.5 disabled:opacity-60"
        >
          {saving ? <Spinner className="text-ink" /> : <Save className="size-3.5" aria-hidden />}
          حفظ الإعدادات
        </button>
      }
    >
      <form id="settings-form" onSubmit={save} className="grid gap-5 xl:grid-cols-2">
        {/* Contact */}
        <section className="panel p-5">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-lemon/10 text-lemon">
              <Phone className="size-4" aria-hidden />
            </span>
            <div>
              <h2 className="text-sm font-bold">بيانات التواصل</h2>
              <p className="text-[10px] text-cream/35">بتظهر في الهيدر، الفوتر، وصفحة اتصل بنا.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <AdminField label="رقم التليفون">
              <input className="field py-2 text-xs" value={settings.contact.phone} onChange={(event) => updateContact("phone", event.target.value)} dir="ltr" />
            </AdminField>
            <AdminField label="رقم واتساب" hint="بصيغة دولية بدون +، مثال 2010…">
              <input className="field py-2 text-xs" value={settings.contact.whatsapp} onChange={(event) => updateContact("whatsapp", event.target.value)} dir="ltr" />
            </AdminField>
            <AdminField label="الإيميل" className="sm:col-span-2">
              <input className="field py-2 text-xs" value={settings.contact.email} onChange={(event) => updateContact("email", event.target.value)} dir="ltr" />
            </AdminField>
            <AdminField label="العنوان (عربي)" className="sm:col-span-2">
              <input className="field py-2 text-xs" value={settings.contact.addressAr} onChange={(event) => updateContact("addressAr", event.target.value)} />
            </AdminField>
            <AdminField label="العنوان (EN)" className="sm:col-span-2">
              <input className="field py-2 text-xs" value={settings.contact.addressEn} onChange={(event) => updateContact("addressEn", event.target.value)} dir="ltr" />
            </AdminField>
            <AdminField label="ساعات العمل (عربي)">
              <input className="field py-2 text-xs" value={settings.contact.hoursAr} onChange={(event) => updateContact("hoursAr", event.target.value)} />
            </AdminField>
            <AdminField label="ساعات العمل (EN)">
              <input className="field py-2 text-xs" value={settings.contact.hoursEn} onChange={(event) => updateContact("hoursEn", event.target.value)} dir="ltr" />
            </AdminField>
            <AdminField label="رابط خريطة Google" className="sm:col-span-2" hint="رابط embed من خرائط جوجل.">
              <input className="field py-2 text-xs" value={settings.contact.mapEmbed} onChange={(event) => updateContact("mapEmbed", event.target.value)} dir="ltr" />
            </AdminField>
          </div>
          <div className="mt-4 border-t border-white/8 pt-4">
            <p className="mb-3 flex items-center gap-1.5 text-[10px] font-bold text-cream/45">
              <Sparkles className="size-3.5 text-lemon/70" aria-hidden />
              السوشيال ميديا
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {([
                ["instagram", "إنستجرام"],
                ["facebook", "فيسبوك"],
                ["youtube", "يوتيوب"],
                ["tiktok", "تيك توك"],
              ] as const).map(([key, label]) => (
                <AdminField key={key} label={label}>
                  <input className="field py-2 text-xs" value={settings.contact[key]} onChange={(event) => updateContact(key, event.target.value)} dir="ltr" />
                </AdminField>
              ))}
            </div>
            <p className="mt-2.5 text-[10px] leading-relaxed text-cream/30">
              الروابط بتظهر في الموقع لما تكون لصفحة الحساب الفعلية (مثل ‎instagram.com/drmostafa‎). الروابط العامة اللي بتفتح على الصفحة الرئيسية بتفضل مخفية لحد ما تكتب رابط حسابك.
            </p>
          </div>
        </section>

        {/* Payments */}
        <section className="panel p-5">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-lemon/10 text-lemon">
              <Wallet className="size-4" aria-hidden />
            </span>
            <div>
              <h2 className="text-sm font-bold">إعدادات الدفع</h2>
              <p className="text-[10px] text-cream/35">أرقام المحافظ وتعليمات التحويل.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <AdminField label="رقم فودافون كاش" hint="11 رقم يبدأ بـ 010/011/012/015.">
              <input className="field py-2 text-xs" value={settings.payments.vodafone} onChange={(event) => updatePayments("vodafone", event.target.value)} dir="ltr" />
            </AdminField>
            <AdminField label="عنوان إنستاباي">
              <input className="field py-2 text-xs" value={settings.payments.instapay} onChange={(event) => updatePayments("instapay", event.target.value)} dir="ltr" />
            </AdminField>
            <AdminField label="اسم صاحب الحساب" className="sm:col-span-2">
              <input className="field py-2 text-xs" value={settings.payments.accountName} onChange={(event) => updatePayments("accountName", event.target.value)} />
            </AdminField>
            <AdminField label="تعليمات الدفع (عربي)" className="sm:col-span-2">
              <textarea className="field min-h-20 resize-y text-xs leading-relaxed" value={settings.payments.instructionsAr} onChange={(event) => updatePayments("instructionsAr", event.target.value)} />
            </AdminField>
            <AdminField label="تعليمات الدفع (EN)" className="sm:col-span-2">
              <textarea className="field min-h-16 resize-y text-xs leading-relaxed" value={settings.payments.instructionsEn} onChange={(event) => updatePayments("instructionsEn", event.target.value)} dir="ltr" />
            </AdminField>
            <AdminField label="ملاحظة بنكية (عربي)" className="sm:col-span-2">
              <input className="field py-2 text-xs" value={settings.payments.bankNoteAr} onChange={(event) => updatePayments("bankNoteAr", event.target.value)} />
            </AdminField>
            <AdminField label="ملاحظة بنكية (EN)" className="sm:col-span-2">
              <input className="field py-2 text-xs" value={settings.payments.bankNoteEn} onChange={(event) => updatePayments("bankNoteEn", event.target.value)} dir="ltr" />
            </AdminField>
          </div>

          <div className="mt-4 flex items-start justify-between gap-3 rounded-xl border border-lemon/20 bg-lemon/[0.04] p-3.5">
            <div>
              <p className="flex items-center gap-1.5 text-[11px] font-bold text-cream/80">
                <ShieldCheck className="size-3.5 text-lemon" aria-hidden />
                التحقق التلقائي من الإيصالات
              </p>
              <p className="mt-1 text-[10px] leading-relaxed text-cream/40">
                لو مفعّل، الإيصالات السليمة بتتفعّل فورًا. أي إيصال فيه ملاحظة بيروح للمراجعة اليدوية.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.payments.autoApprove}
              onClick={() => setSettings((prev) => (prev ? { ...prev, payments: { ...prev.payments, autoApprove: !prev.payments.autoApprove } } : prev))}
              className={cn(
                "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                settings.payments.autoApprove ? "bg-lemon" : "bg-white/15"
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 size-5 rounded-full bg-ink transition-all",
                  settings.payments.autoApprove ? "start-[1.375rem]" : "start-0.5"
                )}
              />
            </button>
          </div>
          <p className="mt-3 flex items-start gap-1.5 text-[10px] leading-relaxed text-cream/30">
            <CreditCard className="mt-0.5 size-3 shrink-0" aria-hidden />
            النظام بيتحقق من: رقم المستلم مقابل رقم المحافظة المعتمدة، المبلغ بالظبط مع سعر الباقة، رقم عملية التحويل، سلامة الصورة وأبعادها، ومنع تكرار الإيصال أو رقم العملية. أي ملاحظة = مراجعة يدوية.
          </p>
        </section>

        {/* Hero */}
        <section className="panel p-5">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-lemon/10 text-lemon">
              <ImageIcon className="size-4" aria-hidden />
            </span>
            <div>
              <h2 className="text-sm font-bold">صورة الهيرو</h2>
              <p className="text-[10px] text-cream/35">الصورة الرئيسية في أول الموقع.</p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            <AdminField label="رابط الصورة" hint="استخدم رابط مباشر أو ارفع صورة من مكتبة الوسائط وانسخ مسارها.">
              <input className="field py-2 text-xs" value={settings.hero.image} onChange={(event) => updateHero("image", event.target.value)} dir="ltr" />
            </AdminField>
            {settings.hero.image && (
              <div className="overflow-hidden rounded-xl border border-white/10">
                <img src={settings.hero.image} alt="معاينة الهيرو" className="h-40 w-full object-cover" />
              </div>
            )}
          </div>
        </section>

        {/* Announcement */}
        <section className="panel p-5">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-lemon/10 text-lemon">
              <BellRing className="size-4" aria-hidden />
            </span>
            <div>
              <h2 className="text-sm font-bold">الإعلان العلوي</h2>
              <p className="text-[10px] text-cream/35">شريط ليمون فوق الهيدر — مفيد للعروض والمواعيد.</p>
            </div>
          </div>
          <div className="mt-4">
            <label className="flex items-center gap-2 text-[11px] font-semibold text-cream/60">
              <input
                type="checkbox"
                checked={settings.announcement.enabled}
                onChange={(event) => updateAnnouncement("enabled", event.target.checked)}
                className="size-4 accent-[#d4ff3f]"
              />
              تفعيل الإعلان
            </label>
            <div className="mt-3 space-y-3">
              <AdminField label="نص الإعلان (عربي)">
                <input className="field py-2 text-xs" value={settings.announcement.ar} onChange={(event) => updateAnnouncement("ar", event.target.value)} />
              </AdminField>
              <AdminField label="نص الإعلان (EN)">
                <input className="field py-2 text-xs" value={settings.announcement.en} onChange={(event) => updateAnnouncement("en", event.target.value)} dir="ltr" />
              </AdminField>
            </div>
            {settings.announcement.enabled && settings.announcement.ar && (
              <div className="mt-3 rounded-lg bg-lemon px-3 py-2 text-center text-[10px] font-bold text-ink">
                {settings.announcement.ar}
              </div>
            )}
          </div>
          <div className="mt-4 flex items-start gap-1.5 text-[10px] leading-relaxed text-cream/30">
            <MapPin className="mt-0.5 size-3 shrink-0" aria-hidden />
            التعديلات بتظهر على الموقع بعد الحفظ مباشرة.
          </div>
        </section>
      </form>
    </AdminPage>
  );
}
