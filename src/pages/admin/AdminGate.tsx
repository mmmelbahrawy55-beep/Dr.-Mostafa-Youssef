import { Spinner } from "../../components/ui/Spinner";
import { useAuth } from "../../lib/auth";
import AdminLayout from "./AdminLayout";
import AdminLogin from "./AdminLogin";

/**
 * Guards every `/admin/*` route.
 *
 * Unlike `RequireAuth` (which bounces visitors to the customer login page),
 * this renders a dedicated admin login screen so the control panel has its own
 * branded entry point at `/admin`.
 */
export default function AdminGate() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-cream/60">
        <Spinner className="size-9" />
        <p className="text-sm">بنجهّز لوحة التحكم…</p>
      </div>
    );
  }

  if (!user) return <AdminLogin />;

  if (user.role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center px-5">
        <div className="max-w-md rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-red-500/10 text-2xl">
            🔒
          </div>
          <h1 className="mt-5 text-2xl">الصفحة دي للدكتور بس</h1>
          <p className="mt-2 text-sm leading-relaxed text-cream/55">
            حسابك مسجل كعميل، مش أدمن. لو محتاج صلاحية إضافية كلم إدارة الموقع.
          </p>
          <a
            href="/account"
            className="mt-6 inline-flex rounded-full bg-lemon px-5 py-3 text-sm font-bold text-ink"
          >
            رجوع لحسابي
          </a>
        </div>
      </div>
    );
  }

  // `AdminLayout` renders the matched child route through its own <Outlet />.
  return <AdminLayout />;
}
