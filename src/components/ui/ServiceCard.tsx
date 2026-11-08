import {
  Activity,
  ArrowUpRight,
  Dumbbell,
  FlaskConical,
  Flame,
  Salad,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { IconKey, Service } from "../../content/types";
import { images } from "../../lib/images";
import { Photo } from "./Photo";

const icons: Record<IconKey, LucideIcon> = {
  nutrition: Salad,
  flame: Flame,
  muscle: Dumbbell,
  coach: UserRound,
  sport: Activity,
  lab: FlaskConical,
};

interface ServiceCardProps {
  service: Service;
  linkLabel: string;
  href?: string;
}

export function ServiceCard({ service, linkLabel, href = "/services" }: ServiceCardProps) {
  const Icon = icons[service.icon] ?? Salad;

  return (
    <Link
      to={href}
      className="group relative flex h-full flex-col overflow-hidden rounded-[1.6rem] border border-white/10 bg-white/[0.02] transition-all duration-500 hover:-translate-y-1 hover:border-lemon/40 hover:bg-white/[0.04]"
    >
      <div className="relative">
        <Photo
          src={service.image || images.food}
          alt={service.title}
          aspect="aspect-[16/9]"
          className="transition-transform duration-700 group-hover:scale-105"
          overlay
        />
        <div className="absolute inset-x-4 bottom-3 flex items-end justify-between gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-lemon text-ink shadow-[0_10px_30px_-12px_rgba(212,255,63,0.9)]">
            <Icon className="size-5" aria-hidden />
          </span>
          <span className="rounded-full border border-white/15 bg-ink/60 px-2.5 py-1 text-[10px] font-medium text-cream/70 backdrop-blur">
            {service.tag}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-6">
        <h3 className="relative text-xl">{service.title}</h3>
        <p className="relative mt-2.5 flex-1 text-sm leading-relaxed text-cream/55">{service.desc}</p>
        <span className="relative mt-5 inline-flex items-center gap-1.5 text-xs font-bold text-lemon">
          {linkLabel}
          <ArrowUpRight
            className="size-3.5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5"
            aria-hidden
          />
        </span>
      </div>
    </Link>
  );
}
