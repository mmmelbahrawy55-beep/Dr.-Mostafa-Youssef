import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "framer-motion";
import {
  ArrowUpRight,
  Globe,
  LayoutDashboard,
  LogIn,
  Menu,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { useLang } from "../../lib/i18n";
import { navPaths, whatsappLink } from "../../lib/site";
import { useSiteInfo } from "../../lib/use-site-info";
import { cn } from "../../lib/utils";
import { CTA } from "../ui/CTA";
import { Logo } from "../ui/Logo";
import { Spinner } from "../ui/Spinner";

export function Header() {
  const { t, lang, toggle, settings } = useLang();
  const { user, loading } = useAuth();
  const info = useSiteInfo();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [bannerClosed, setBannerClosed] = useState(false);
  const lastY = useRef(0);
  const { scrollY } = useScroll();
  const location = useLocation();

  useMotionValueEvent(scrollY, "change", (y) => {
    setScrolled(y > 20);
    setHidden((prev) => {
      if (y > 320 && y > lastY.current) return true;
      if (y < lastY.current || y < 320) return false;
      return prev;
    });
    lastY.current = y;
  });

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const links = [
    { to: navPaths.home, label: t.nav.home },
    { to: navPaths.about, label: t.nav.about },
    { to: navPaths.services, label: t.nav.services },
    { to: navPaths.programs, label: t.nav.programs },
    { to: navPaths.results, label: t.nav.results },
    { to: navPaths.calculator, label: t.nav.calculator },
    { to: navPaths.blog, label: t.nav.blog },
    { to: navPaths.contact, label: t.nav.contact },
  ];

  const announcement = settings?.announcement;
  const announcementText = announcement?.enabled ? (lang === "ar" ? announcement.ar : announcement.en) : "";
  const showAnnouncement = Boolean(announcementText) && !bannerClosed;
  const accountHref = user?.role === "admin" ? "/admin" : "/account";

  return (
    <>
      <motion.header
        animate={{ y: hidden && !open ? "-130%" : "0%" }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className={cn("fixed inset-x-0 top-0 z-50 transition-colors duration-300", scrolled || open ? "glass" : "bg-transparent")}
      >
        {showAnnouncement && (
          <div className="relative border-b border-lemon/15 bg-lemon text-ink">
            <div className="container-x flex items-center justify-center gap-2 py-2 text-center text-[11px] font-bold sm:text-xs">
              <span className="inline-flex size-1.5 rounded-full bg-ink" aria-hidden />
              <span className="line-clamp-1">{announcementText}</span>
              <button
                type="button"
                onClick={() => setBannerClosed(true)}
                className="absolute end-3 text-ink/60 transition-colors hover:text-ink"
                aria-label="إغلاق الإعلان"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </div>
          </div>
        )}

        <div className="container-x flex h-[72px] items-center justify-between gap-4">
          <Link to="/" className="group flex shrink-0 items-center" aria-label={t.hero.portraitName}>
            <Logo />
          </Link>

          <nav className="hidden items-center gap-5 xl:flex" aria-label={t.ui.menu}>
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === navPaths.home}
                className={({ isActive }) =>
                  cn(
                    "link-underline whitespace-nowrap text-[13px] font-semibold transition-colors",
                    isActive ? "text-lemon" : "text-cream/65 hover:text-cream"
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggle}
              className="hidden items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-[11px] font-semibold text-cream/75 transition-colors hover:border-lemon/60 hover:text-lemon sm:flex"
            >
              <Globe className="size-3.5" aria-hidden />
              {t.ui.languageLabel}
            </button>

            {loading ? (
              <span className="flex size-9 items-center justify-center rounded-full border border-white/10">
                <Spinner className="size-4" />
              </span>
            ) : user ? (
              <Link
                to={accountHref}
                className="group flex items-center gap-2 rounded-full border border-white/15 py-1.5 pe-3 ps-1.5 text-[11px] font-bold text-cream/80 transition-colors hover:border-lemon/50 hover:text-lemon"
                title={user.role === "admin" ? t.ui.dashboard : t.ui.myAccount}
              >
                <span className="flex size-7 items-center justify-center rounded-full bg-lemon text-ink">
                  {user.role === "admin" ? <LayoutDashboard className="size-3.5" aria-hidden /> : <UserRound className="size-3.5" aria-hidden />}
                </span>
                <span className="hidden max-w-24 truncate sm:block">{user.name.split(" ")[0]}</span>
              </Link>
            ) : (
              <Link
                to="/login"
                className="flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-2 text-[11px] font-bold text-cream/80 transition-colors hover:border-lemon/50 hover:text-lemon"
              >
                <LogIn className="size-3.5" aria-hidden />
                <span className="hidden sm:inline">{t.ui.signInShort}</span>
              </Link>
            )}

            <CTA to={navPaths.programs} size="sm" className="hidden xl:inline-flex" icon={false}>
              {t.ui.subscribeNow}
            </CTA>

            <button
              type="button"
              onClick={() => setOpen((prev) => !prev)}
              className="flex size-10 items-center justify-center rounded-full border border-white/15 text-cream transition-colors hover:border-lemon/60 hover:text-lemon xl:hidden"
              aria-label={open ? t.ui.close : t.ui.menu}
              aria-expanded={open}
            >
              {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
            </button>
          </div>
        </div>
      </motion.header>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-40 overflow-y-auto bg-ink/[0.985] backdrop-blur-xl xl:hidden"
          >
            <div className="container-x flex min-h-full flex-col pb-10 pt-24">
              {user ? (
                <Link
                  to={accountHref}
                  className="flex items-center gap-3 rounded-2xl border border-lemon/25 bg-lemon/[0.07] p-4"
                >
                  <span className="flex size-11 items-center justify-center rounded-xl bg-lemon text-ink">
                    {user.role === "admin" ? <LayoutDashboard className="size-5" /> : <UserRound className="size-5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-sm font-bold text-cream">{user.name}</span>
                    <span className="mt-0.5 block text-[11px] text-lemon">
                      {user.role === "admin" ? t.ui.dashboard : t.ui.accountAndPlan}
                    </span>
                  </span>
                  <ArrowUpRight className="size-4 text-lemon" aria-hidden />
                </Link>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Link to="/login" className="flex items-center justify-center gap-2 rounded-2xl bg-lemon px-4 py-3 text-sm font-bold text-ink">
                    <LogIn className="size-4" aria-hidden />
                    {t.ui.signIn}
                  </Link>
                  <Link to="/register" className="flex items-center justify-center gap-2 rounded-2xl border border-white/15 px-4 py-3 text-sm font-bold text-cream">
                    {t.ui.signUp}
                  </Link>
                </div>
              )}

              <nav className="mt-6 flex flex-col divide-y divide-white/10" aria-label={t.ui.menu}>
                {links.map((link, index) => (
                  <motion.div
                    key={link.to}
                    initial={{ opacity: 0, x: 18 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.04 * index + 0.05, duration: 0.4 }}
                  >
                    <NavLink
                      to={link.to}
                      end={link.to === navPaths.home}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center justify-between py-4 font-display text-xl font-semibold",
                          isActive ? "text-lemon" : "text-cream"
                        )
                      }
                    >
                      {link.label}
                      <ArrowUpRight className="size-5 text-cream/35" aria-hidden />
                    </NavLink>
                  </motion.div>
                ))}
              </nav>

              <div className="mt-8 flex flex-col gap-3">
                <CTA to={navPaths.programs} size="lg">
                  {t.ui.subscribePlan}
                </CTA>
                <CTA
                  href={whatsappLink(t.ui.whatsapp)}
                  target="_blank"
                  rel="noreferrer"
                  variant="outline"
                  size="lg"
                  icon={false}
                >
                  {t.ui.whatsapp}
                </CTA>
                <button
                  type="button"
                  onClick={toggle}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-cream/75"
                >
                  <Globe className="size-4" aria-hidden />
                  {t.ui.languageLabel}
                </button>
              </div>

              <div className="mt-auto space-y-2 pt-10 text-sm text-cream/50">
                <a href={`tel:${info.phone}`} className="block font-latin text-lg text-cream" dir="ltr">
                  {info.phoneDisplay}
                </a>
                <p>{t.contact.info.hours}: {info.hours[lang]}</p>
                <p className="flex items-center gap-1.5 text-[11px] text-cream/35">
                  <ShieldCheck className="size-3.5 text-lemon/60" aria-hidden />
                  {t.ui.securePayment}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
