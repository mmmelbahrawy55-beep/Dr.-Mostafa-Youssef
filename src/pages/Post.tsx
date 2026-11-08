import { ArrowLeft, ArrowUpRight, Clock } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { CTA } from "../components/ui/CTA";
import { CtaBand } from "../components/ui/CtaBand";
import { Reveal } from "../components/ui/Reveal";
import { useLang } from "../lib/i18n";
import { navPaths } from "../lib/site";
import NotFound from "./NotFound";

export default function Post() {
  const { slug } = useParams();
  const { t, lang } = useLang();
  const post = t.posts.find((item) => item.slug === slug);

  if (!post) return <NotFound />;

  const related = t.posts.filter((item) => item.slug !== post.slug).slice(0, 2);

  return (
    <>
      <article className="container-x pb-16 pt-32 md:pt-40">
        <Reveal>
          <Link
            to={navPaths.blog}
            className="inline-flex items-center gap-2 text-xs font-semibold text-cream/45 transition-colors hover:text-lemon"
          >
            <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
            {t.blogPage.back}
          </Link>
        </Reveal>

        <Reveal delay={0.05}>
          <div className="mt-6 flex flex-wrap items-center gap-3 text-[11px] text-cream/40">
            <span className="rounded-full bg-lemon/10 px-3 py-1 font-semibold text-lemon">{post.category}</span>
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
          <h1 className="display-xl mt-5 max-w-4xl text-3xl leading-[1.1] sm:text-5xl lg:text-6xl">{post.title}</h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-cream/55 md:text-lg">{post.excerpt}</p>
        </Reveal>

        <Reveal delay={0.1} className="mt-10">
          <div className="overflow-hidden rounded-[2rem] border border-white/10">
            <img src={post.cover} alt={post.title} className="aspect-[16/8] w-full object-cover" />
          </div>
        </Reveal>

        <div className="mx-auto mt-12 max-w-3xl">
          {post.body.map((block, index) => (
            <Reveal key={index} delay={0.02 * index}>
              <div className="mb-6">
                {block.h && <h2 className="mb-3 text-xl leading-snug text-cream md:text-2xl">{block.h}</h2>}
                <p className="text-base leading-loose text-cream/65">{block.p}</p>
              </div>
            </Reveal>
          ))}

          <Reveal className="mt-12 rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-6 md:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-display text-base font-semibold text-cream">{t.hero.portraitName}</p>
                <p className="mt-1 text-xs text-cream/45">{t.hero.portraitRole}</p>
              </div>
              <CTA to={navPaths.calculator} size="sm">
                {t.hero.ctaSecondary}
              </CTA>
            </div>
          </Reveal>
        </div>

        {related.length > 0 && (
          <div className="mt-16">
            <h2 className="text-2xl">{t.blogPage.related}</h2>
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              {related.map((item) => (
                <Link
                  key={item.slug}
                  to={`/blog/${item.slug}`}
                  className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4 transition-colors hover:border-lemon/40"
                >
                  <img
                    src={item.cover}
                    alt={item.title}
                    className="size-20 shrink-0 rounded-xl object-cover"
                    loading="lazy"
                  />
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-lemon">{item.category}</p>
                    <p className="mt-1 font-display text-sm font-semibold leading-snug text-cream transition-colors group-hover:text-lemon">
                      {item.title}
                    </p>
                    <span className="mt-2 inline-flex items-center gap-1 text-[11px] text-cream/40">
                      {t.blogPage.readArticle}
                      <ArrowUpRight className="size-3" aria-hidden />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </article>

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
