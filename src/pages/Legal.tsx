import { PageHero } from "../components/ui/PageHero";
import { Reveal } from "../components/ui/Reveal";
import { useLang } from "../lib/i18n";

export default function Legal({ docKey }: { docKey: "privacy" | "terms" }) {
  const { t } = useLang();
  const doc = t.legal[docKey];

  return (
    <>
      <PageHero kicker={t.footer.quickLinks} title={doc.title} lead={doc.updated} />

      <section className="container-x pb-20 md:pb-28">
        <div className="max-w-3xl space-y-8">
          {doc.sections.map((section) => (
            <Reveal key={section.h}>
              <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 md:p-7">
                <h2 className="text-lg md:text-xl">{section.h}</h2>
                <p className="mt-3 text-sm leading-loose text-cream/60">{section.p}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>
    </>
  );
}
