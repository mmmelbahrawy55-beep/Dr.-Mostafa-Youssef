import { useLang } from "./i18n";
import { site } from "./site";

const phoneDisplay = (raw: string) => {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+20") && digits.length === 13) {
    return `0${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
  }
  return raw.replace(/^\+/, "");
};

/**
 * A social link only counts as configured when it points at a profile page
 * (instagram.com/drmostafa) rather than the network's own homepage. Until the
 * real accounts arrive, the footer shows nothing instead of dead links.
 */
const realSocial = (raw?: string) => {
  const value = (raw ?? "").trim();
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.pathname.replace(/\/+$/, "") ? value : "";
  } catch {
    return "";
  };
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
      instagram: realSocial(contact?.instagram || site.instagram),
      facebook: realSocial(contact?.facebook || site.facebook),
      youtube: realSocial(contact?.youtube || site.youtube),
      tiktok: realSocial(contact?.tiktok || site.tiktok),
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
