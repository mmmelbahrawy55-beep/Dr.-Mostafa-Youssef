import {
  ArrowUpRight,
  BookOpenText,
  ClipboardList,
  CreditCard,
  Files,
  Home,
  ImageIcon,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import type { Overview } from "../../../shared/types";
import { Logo } from "../../components/ui/Logo";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useToast } from "../../components/ui/Toast";
import { cn } from "../../lib/utils";

interface AdminNavItem {
  to: string;
  label: string;
  icon: typeof Home;
  end?: boolean;
  badge?: "pending" | "unread";
}

const SECTIONS: { title: string; items: AdminNavItem[] }[] = [
  {
    title: "الرئيسية",
    items: [{ to: "/admin", label: "نظرة عامة", icon: LayoutDashboard, end: true }],
  },
  {
    title: "الإدارة",
    items: [
      { to: "/admin/payments", label: "المدفوعات", icon: CreditCard, badge: "pending" },
      { to: "/admin/customers", label: "العملاء", icon: Users },
      { to: "/admin/subscriptions", label: "الاشتراكات", icon: ClipboardList },
    ],
  },
  {
    title: "المحتوى",
    items: [
      { to: "/admin/content", label: "محتوى الموقع", icon: Files },
      { to: "/admin/copy", label: "نصوص الموقع", icon: BookOpenText },
      { to: "/admin/media", label: "الصور والوسائط", icon: ImageIcon },
    ],
  },
  {
    title: "التواصل",
    items: [{ to: "/admin/messages", label: "الرسائل", icon: MessageSquare, badge: "unread" }],
  },
  {
    title: "النظام",
    items: [
      { to: "/admin/settings", label: "الإعدادات", icon: Settings },
      { to: "/admin/security", label: "الأمان", icon: KeyRound },
      { to: "/admin/audit", label: "سجل العمليات", icon: ShieldCheck },
    ],
  },
];

export function AdminLayout() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState<{ pending: number; unread: number }>({ pending: 0, unread: 0 });

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await api<Overview>("/api/admin/overview");
        if (active) setCounts({ pending: data.pendingCount, unread: data.unreadMessages });
      } catch {
        /* counts are non-critical */
      }
    })();
    return () => {
      active = false;
    };
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const handleLogout = async () => {
    await logout();
    toast.success("تم تسجيل الخروج.");
    navigate("/");
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-white/8 px-4">
        <Link to="/admin" className="min-w-0">
          <Logo compact markClassName="size-9" />
        </Link>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full p-2 text-cream/40 hover:bg-white/5 hover:text-cream lg:hidden"
          aria-label="إغلاق القائمة"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {SECTIONS.map((section) => (
          <div key={section.title} className="mb-5">
            <p className="mb-1.5 px-3 text-[9px] font-bold uppercase tracking-[0.18em] text-cream/25">{section.title}</p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const badgeCount =
                  item.badge === "pending" ? counts.pending : item.badge === "unread" ? counts.unread : 0;
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={Boolean(item.end)}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors",
                          isActive
                            ? "bg-lemon/10 text-lemon"
                            : "text-cream/55 hover:bg-white/[0.04] hover:text-cream"
                        )
                      }
                    >
                      <item.icon className="size-4 shrink-0" aria-hidden />
                      <span className="flex-1">{item.label}</span>
                      {badgeCount > 0 && (
                        <span className="rounded-full bg-lemon px-1.5 py-0.5 text-[9px] font-bold text-ink">{badgeCount}</span>
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-white/8 p-3">
        <div className="flex items-center gap-2.5 rounded-xl bg-white/[0.03] px-3 py-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-lemon text-xs font-bold text-ink">
            {(user?.name ?? "م").charAt(0)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-bold text-cream">{user?.name}</p>
            <p className="text-[9px] text-lemon/70">مدير الموقع</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg p-1.5 text-cream/35 hover:bg-white/5 hover:text-red-200"
            aria-label="تسجيل الخروج"
            title="تسجيل الخروج"
          >
            <LogOut className="size-4" aria-hidden />
          </button>
        </div>
        <Link
          to="/"
          className="mt-2 flex items-center justify-center gap-1.5 rounded-xl border border-white/8 py-2 text-[10px] font-semibold text-cream/40 transition-colors hover:border-lemon/30 hover:text-lemon"
        >
          <Home className="size-3.5" aria-hidden />
          عرض الموقع
          <ArrowUpRight className="size-3" aria-hidden />
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-ink">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_80%_0%,rgba(212,255,63,0.05),transparent_45%)]" aria-hidden />

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 start-0 z-40 hidden w-60 border-e border-white/8 bg-[#0a0c07]/95 backdrop-blur-xl lg:block">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/70 backdrop-blur-sm" onClick={() => setOpen(false)} aria-hidden />
          <aside className="absolute inset-y-0 start-0 w-[17rem] border-e border-white/10 bg-[#0a0c07] shadow-2xl">{sidebar}</aside>
        </div>
      )}

      <div className="relative lg:ps-60">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-white/8 bg-ink/80 px-4 backdrop-blur-xl lg:px-7">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="rounded-lg border border-white/10 p-2 text-cream/60 hover:text-lemon lg:hidden"
              aria-label="فتح القائمة"
            >
              <Menu className="size-4" aria-hidden />
            </button>
            <span className="hidden items-center gap-1.5 text-[10px] text-cream/30 sm:flex">
              <Wallet className="size-3.5 text-lemon/60" aria-hidden />
              لوحة تحكم د. مصطفى يوسف
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/admin/payments"
              className="relative inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-[10px] font-semibold text-cream/55 transition-colors hover:border-lemon/40 hover:text-lemon"
            >
              <CreditCard className="size-3.5" aria-hidden />
              مدفوعات معلقة
              {counts.pending > 0 && (
                <span className="rounded-full bg-lemon px-1.5 text-[9px] font-bold text-ink">{counts.pending}</span>
              )}
            </Link>
            <Link to="/" className="hidden rounded-full border border-white/10 p-2 text-cream/45 hover:text-lemon sm:flex" aria-label="عرض الموقع">
              <ArrowUpRight className="size-3.5" aria-hidden />
            </Link>
          </div>
        </header>

        <main className="px-4 py-6 md:px-7 md:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;
