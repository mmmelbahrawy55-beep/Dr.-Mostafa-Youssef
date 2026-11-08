import { ArrowUpRight, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { CtaBand } from "../components/ui/CtaBand";
import { PageHero } from "../components/ui/PageHero";
import { Reveal, Stagger, StaggerItem } from "../components/ui/Reveal";
import { useLang } from "../lib/i18n";

export default function Blog() {
  const { t, lang } = useLang();

  return (
    <>
      <PageHero kicker={t.blogPage.kicker} title={t.blogPage.title} lead={t.blogPage.lead} />

      <section className="container-x pb-16 md:pb-24">
        <Stagger className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {t.posts.map((post) => (
            <StaggerItem key={post.slug} className="h-full">
              <Link
                to={`/blog/${post.slug}`}
                className="group flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.02] transition-all duration-500 hover:-translate-y-1 hover:border-lemon/40"
              >
                <div className="relative overflow-hidden">
                  <img
                    src={post.cover}
                    alt={post.title}
                    className="aspect-[16/10] w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink/70 to-transparent" aria-hidden />
                  <span className="absolute start-4 top-4 rounded-full bg-ink/80 px-3 py-1 text-[10px] font-semibold text-lemon backdrop-blur">
                    {post.category}
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-center gap-3 text-[11px] text-cream/35">
                    <span>
                      {new Date(post.date).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-GB", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="size-3" aria-hidden />
                      {post.readTime} {t.blogPage.minRead}
                    </span>
                  </div>
                  <h2 className="mt-3 text-xl leading-snug transition-colors group-hover:text-lemon">{post.title}</h2>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-cream/50">{post.excerpt}</p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-lemon">
                    {t.blogPage.readArticle}
                    <ArrowUpRight className="size-3.5" aria-hidden />
                  </span>
                </div>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>

        {t.posts.length === 0 && <p className="text-sm text-cream/50">{t.blogPage.empty}</p>}

        <Reveal className="mt-12">
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 md:p-8">
            <p className="text-sm leading-relaxed text-cream/55">{t.servicesPage.note}</p>
          </div>
        </Reveal>
      </section>

      <CtaBand
        kicker={t.finalCta.kicker}
        title={t.finalCta.title}
        text={t.finalCta.text}
        primary={t.finalCta.primary}
        secondary={t.finalCta.secondary}
      />
    </>
  );
}
