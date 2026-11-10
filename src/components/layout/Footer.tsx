import { Clock, Mail, MapPin, Phone, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { useLang } from "../../lib/i18n";
import { navPaths } from "../../lib/site";
import { useSiteInfo } from "../../lib/use-site-info";
import { CTA } from "../ui/CTA";
import { Logo } from "../ui/Logo";
import { PaymentBadges } from "../ui/PaymentBadges";

export function Footer() {
  const { t, lang } = useLang();
  const { user } = useAuth();
  const info = useSiteInfo();
  const year = new Date().getFullYear();

  const quickLinks = [
    { to: navPaths.home, label: t.nav.home },
    { to: navPaths.about, label: t.nav.about },
    { to: navPaths.services, label: t.nav.services },
    { to: navPaths.programs, label: t.nav.programs },
    { to: navPaths.results, label: t.nav.results },
    { to: navPaths.calculator, label: t.nav.calculator },
    { to: navPaths.blog, label: t.nav.blog },
    { to: navPaths.contact, label: t.nav.contact },
  ];

  const socials = [
    {
      href: info.socials.instagram,
      label: "Instagram",
      d: "M12 2c2.7 0 3 0 4.1.1 1 0 1.7.2 2.3.4.6.2 1.1.5 1.6 1 .5.5.8 1 1 1.6.2.6.4 1.3.4 2.3.1 1.1.1 1.4.1 4.1s0 3-.1 4.1c0 1-.2 1.7-.4 2.3-.2.6-.5 1.1-1 1.6-.5.5-1 .8-1.6 1-.6.2-1.3.4-2.3.4-1.1.1-1.4.1-4.1.1s-3 0-4.1-.1c-1 0-1.7-.2-2.3-.4-.6-.2-1.1-.5-1.6-1-.5-.5-.8-1-1-1.6-.2-.6-.4-1.3-.4-2.3C2 15 2 14.7 2 12s0-3 .1-4.1c0-1 .2-1.7.4-2.3.2-.6.5-1.1 1-1.6.5-.5 1-.8 1.6-1 .6-.2 1.3-.4 2.3-.4C9 2 9.3 2 12 2Zm0 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm6.4-.8a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0ZM12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z",
    },
    { href: info.socials.facebook, label: "Facebook", d: "M14 9h3V6h-3c-2.2 0-4 1.8-4 4v2H7v3h3v7h3v-7h3l1-3h-4v-2c0-.6.4-1 1-1Z" },
    {
      href: info.socials.youtube,
      label: "YouTube",
      d: "M21.6 7.2c-.2-.9-.9-1.6-1.8-1.8C18 5 12 5 12 5s-6 0-7.8.4c-.9.2-1.6.9-1.8 1.8C2 9 2 12 2 12s0 3 .4 4.8c.2.9.9 1.6 1.8 1.8C6 19 12 19 12 19s6 0 7.8-.4c.9-.2 1.6-.9 1.8-1.8.4-1.8.4-4.8.4-4.8s0-3-.4-4.8ZM10 15V9l5.2 3L10 15Z",
    },
    {
      href: info.socials.tiktok,
      label: "TikTok",
      d: "M16.5 3c.3 2 1.5 3.3 3.5 3.6v2.6c-1.3.1-2.5-.3-3.6-1v6.3c0 3.2-2.3 5.5-5.3 5.5A5.2 5.2 0 0 1 6 14.8c0-3 2.4-5.3 5.6-5.1v2.8c-.4-.1-.8-.2-1.2-.2-1.4 0-2.5 1.1-2.5 2.5s1.1 2.5 2.5 2.5 2.6-1.1 2.6-2.7V3h3.5Z",
    },
  ];

  return (
    <footer className="relative overflow-hidden border-t border-white/10 bg-ink-2">
      <div
        className="pointer-events-none absolute -bottom-40 start-1/2 h-80 w-[560px] -translate-x-1/2 rounded-full bg-lemon/[0.07] blur-[120px]"
        aria-hidden
      />
      <div className="container-x relative py-16 md:py-20">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1.2fr]">
          <div>
            <Link to="/" aria-label={t.hero.portraitName}>
              <Logo markClassName="size-11" />
            </Link>
            <p className="mt-6 max-w-xs text-sm leading-relaxed text-cream/55">{t.footer.tagline}</p>
            <div className="mt-6 flex items-center gap-2">
              {socials.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={social.label}
                  className="flex size-9 items-center justify-center rounded-full border border-white/10 text-cream/60 transition-colors hover:border-lemon/60 hover:text-lemon"
                >
                  <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
                    <path d={social.d} />
                  </svg>
                </a>
              ))}
            </div>
            <PaymentBadges className="mt-6" />
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-cream/40">{t.footer.quickLinks}</h3>
            <ul className="mt-5 space-y-2.5">
              {quickLinks.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="text-sm text-cream/65 transition-colors hover:text-lemon">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-cream/40">{t.ui.accountSection}</h3>
            <ul className="mt-5 space-y-2.5">
              <li>
                <Link to={user ? (user.role === "admin" ? "/admin" : "/account") : "/login"} className="text-sm text-cream/65 transition-colors hover:text-lemon">
                  {user ? (user.role === "admin" ? t.ui.dashboard : t.ui.accountAndPlan) : t.ui.signIn}
                </Link>
              </li>
              <li>
                <Link to="/register" className="text-sm text-cream/65 transition-colors hover:text-lemon">
                  {t.ui.signUp}
                </Link>
              </li>
              <li>
                <Link to={navPaths.programs} className="text-sm text-cream/65 transition-colors hover:text-lemon">
                  {t.ui.subscriptionAndPayment}
                </Link>
              </li>
              {t.services.slice(0, 4).map((service) => (
                <li key={service.title}>
                  <Link to={navPaths.services} className="text-sm text-cream/65 transition-colors hover:text-lemon">
                    {service.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-cream/40">{t.footer.contactTitle}</h3>
            <ul className="mt-5 space-y-3.5 text-sm text-cream/65">
              <li>
                <a href={`tel:${info.phone}`} className="flex items-start gap-3 transition-colors hover:text-lemon">
                  <Phone className="mt-0.5 size-4 shrink-0 text-lemon" aria-hidden />
                  <span dir="ltr">{info.phoneDisplay}</span>
                </a>
              </li>
              <li>
                <a href={`mailto:${info.email}`} className="flex items-start gap-3 transition-colors hover:text-lemon">
                  <Mail className="mt-0.5 size-4 shrink-0 text-lemon" aria-hidden />
                  <span dir="ltr" className="break-all">{info.email}</span>
                </a>
              </li>
              <li className="flex items-start gap-3">
                <MapPin className="mt-0.5 size-4 shrink-0 text-lemon" aria-hidden />
                <span>{info.address[lang]}</span>
              </li>
              <li className="flex items-start gap-3">
                <Clock className="mt-0.5 size-4 shrink-0 text-lemon" aria-hidden />
                <span>{info.hours[lang]}</span>
              </li>
            </ul>
            <CTA to={navPaths.programs} size="sm" className="mt-6" variant="outline" icon={false}>
              {t.ui.subscribePlan}
            </CTA>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-white/10 pt-6 text-xs text-cream/35 md:flex-row md:items-center md:justify-between">
          <p>
            © {year} {t.hero.portraitName}. {t.footer.rights}
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link to="/privacy" className="transition-colors hover:text-lemon">
              {t.footer.privacy}
            </Link>
            <Link to="/terms" className="transition-colors hover:text-lemon">
              {t.footer.terms}
            </Link>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 text-lemon/60" aria-hidden />
              {t.footer.disclaimer}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
