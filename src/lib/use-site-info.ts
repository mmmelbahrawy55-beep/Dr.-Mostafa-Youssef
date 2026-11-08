import { useLang } from "./i18n";
import { site } from "./site";

const phoneDisplay = (raw: string) => {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+20") && digits.length === 13) {
    return `0${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
  }
  return raw.replace(/^\+/, "");
};

/** Contact + payment settings merged over the built-in defaults. */
export function useSiteInfo() {
  const { settings, lang } = useLang();
  const contact = settings?.contact;
  const payments = settings?.payments;

  return {
    phoneDisplay: contact?.phone ? phoneDisplay(contact.phone) : site.phoneDisplay,
    phone: contact?.phone || site.phone,
    whatsapp: contact?.whatsapp || site.whatsapp,
    email: contact?.email || site.email,
    address: {
      ar: contact?.addressAr || site.address.ar,
      en: contact?.addressEn || site.address.en,
    },
    hours: {
      ar: contact?.hoursAr || site.hours.ar,
      en: contact?.hoursEn || site.hours.en,
    },
    mapEmbed: contact?.mapEmbed || site.mapEmbed,
    socials: {
      instagram: contact?.instagram || site.instagram,
      facebook: contact?.facebook || site.facebook,
      youtube: contact?.youtube || site.youtube,
      tiktok: contact?.tiktok || site.tiktok,
    },
    payments: {
      vodafone: payments?.vodafone || "01004334487",
      instapay: payments?.instapay || "mostafa@instapay",
      accountName: payments?.accountName || "مصطفى يوسف",
      instructionsAr: payments?.instructionsAr || "",
      instructionsEn: payments?.instructionsEn || "",
      autoApprove: payments?.autoApprove !== false,
    },
    lang,
  };
}
