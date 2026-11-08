import { CTA } from "../components/ui/CTA";
import { useLang } from "../lib/i18n";
import { navPaths } from "../lib/site";

export default function NotFound() {
  const { t } = useLang();

  return (
    <section className="container-x flex min-h-[80vh] flex-col items-center justify-center py-32 text-center">
      <p className="font-latin text-[22vw] leading-none text-lemon/15 sm:text-[12rem]">404</p>
      <h1 className="-mt-6 text-3xl md:text-5xl">{t.notFound.title}</h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-cream/55 md:text-base">{t.notFound.text}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <CTA to={navPaths.home}>{t.notFound.cta}</CTA>
        <CTA to={navPaths.contact} variant="outline">
          {t.ui.book}
        </CTA>
      </div>
    </section>
  );
}
