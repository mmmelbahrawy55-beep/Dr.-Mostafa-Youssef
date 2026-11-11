import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import type { AuthResponse, PublicUser } from "../../shared/types";
import { api } from "./api";
import { Spinner } from "../components/ui/Spinner";

export interface TwoFactorChallenge {
  twoFactorRequired: true;
  challenge: string;
}

interface AuthContextValue {
  user: PublicUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<PublicUser | TwoFactorChallenge>;
  completeTwoFactor: (challenge: string, code: string) => Promise<PublicUser>;
  register: (input: { name: string; email: string; phone: string; password: string }) => Promise<PublicUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<PublicUser | null>;
  setUser: (user: PublicUser | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const result = await api<{ user: PublicUser | null }>("/api/auth/me");
      setUser(result.user);
      return result.user;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const result = await api<{ user: PublicUser | null }>("/api/auth/me");
        if (active) setUser(result.user);
      } catch {
        if (active) setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api<AuthResponse | TwoFactorChallenge>("/api/auth/login", {
      method: "POST",
      body: { email, password },
    });
    if ("twoFactorRequired" in result) return result;
    setUser(result.user);
    return result.user;
  }, []);

  const completeTwoFactor = useCallback(async (challenge: string, code: string) => {
    const result = await api<AuthResponse>("/api/auth/2fa", {
      method: "POST",
      body: { challenge, code },
    });
    setUser(result.user);
    return result.user;
  }, []);

  const register = useCallback(
    async (input: { name: string; email: string; phone: string; password: string }) => {
      const result = await api<AuthResponse>("/api/auth/register", { method: "POST", body: input });
      setUser(result.user);
      return result.user;
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, completeTwoFactor, register, logout, refresh, setUser }),
    [user, loading, login, completeTwoFactor, register, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenLoader label="بنتأكد من حسابك…" />;
  if (!user) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }
  return <>{children}</>;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenLoader label="بنجهّز لوحة التحكم…" />;
  if (!user) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }
  if (user.role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center px-5">
        <div className="max-w-md rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-red-500/10 text-2xl">🔒</div>
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
  return <>{children}</>;
}

function FullScreenLoader({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-cream/60">
      <Spinner className="size-9" />
      <p className="text-sm">{label}</p>
    </div>
  );
}
