import { lazy, Suspense, useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { Layout } from "./components/layout/Layout";
import { Spinner } from "./components/ui/Spinner";
import { ToastProvider } from "./components/ui/Toast";
import { AuthProvider, RequireAuth } from "./lib/auth";
import { LanguageProvider } from "./lib/i18n";
import { usePageMeta } from "./lib/seo";
import { SiteDataProvider } from "./lib/site-data";
import About from "./pages/About";
import Account from "./pages/Account";
import Auth from "./pages/Auth";
import Blog from "./pages/Blog";
import Calculator from "./pages/Calculator";
import Contact from "./pages/Contact";
import Home from "./pages/Home";
import Legal from "./pages/Legal";
import NotFound from "./pages/NotFound";
import Post from "./pages/Post";
import Programs from "./pages/Programs";
import Results from "./pages/Results";
import Services from "./pages/Services";
import Subscribe from "./pages/Subscribe";

// The public pages ship in the initial bundle; the whole admin dashboard is
// loaded on demand so visitors never download code they cannot use.
const AdminGate = lazy(() => import("./pages/admin/AdminGate"));
const AdminAudit = lazy(() => import("./pages/admin/Audit"));
const AdminContent = lazy(() => import("./pages/admin/Content"));
const AdminCopy = lazy(() => import("./pages/admin/Copy"));
const AdminCustomers = lazy(() => import("./pages/admin/Customers"));
const AdminMedia = lazy(() => import("./pages/admin/Media"));
const AdminMessages = lazy(() => import("./pages/admin/Messages"));
const AdminOverview = lazy(() => import("./pages/admin/Overview"));
const AdminPayments = lazy(() => import("./pages/admin/Payments"));
const AdminSecurity = lazy(() => import("./pages/admin/Security"));
const AdminSettings = lazy(() => import("./pages/admin/Settings"));
const AdminSubscriptions = lazy(() => import("./pages/admin/Subscriptions"));

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

function RouteMeta() {
  usePageMeta();
  return null;
}

function PageFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner className="size-8 text-lemon" />
    </div>
  );
}

export default function App() {
  return (
    <SiteDataProvider>
      <LanguageProvider>
        <AuthProvider>
          <ToastProvider>
            <ScrollToTop />
            <RouteMeta />
            <Suspense fallback={<PageFallback />}>
              <Routes>
                <Route path="login" element={<Auth mode="login" />} />
                <Route path="register" element={<Auth mode="register" />} />

                <Route element={<Layout />}>
                  <Route index element={<Home />} />
                  <Route path="about" element={<About />} />
                  <Route path="services" element={<Services />} />
                  <Route path="programs" element={<Programs />} />
                  <Route path="results" element={<Results />} />
                  <Route path="calculator" element={<Calculator />} />
                  <Route path="blog" element={<Blog />} />
                  <Route path="blog/:slug" element={<Post />} />
                  <Route path="contact" element={<Contact />} />
                  <Route path="subscribe/:programId" element={<Subscribe />} />
                  <Route
                    path="account"
                    element={
                      <RequireAuth>
                        <Account />
                      </RequireAuth>
                    }
                  />
                  <Route path="privacy" element={<Legal docKey="privacy" />} />
                  <Route path="terms" element={<Legal docKey="terms" />} />
                  <Route path="refund" element={<Legal docKey="refund" />} />
                  <Route path="*" element={<NotFound />} />
                </Route>

                <Route path="admin" element={<AdminGate />}>
                  <Route index element={<AdminOverview />} />
                  <Route path="payments" element={<AdminPayments />} />
                  <Route path="customers" element={<AdminCustomers />} />
                  <Route path="subscriptions" element={<AdminSubscriptions />} />
                  <Route path="messages" element={<AdminMessages />} />
                  <Route path="content" element={<AdminContent />} />
                  <Route path="copy" element={<AdminCopy />} />
                  <Route path="media" element={<AdminMedia />} />
                  <Route path="settings" element={<AdminSettings />} />
                  <Route path="audit" element={<AdminAudit />} />
                  <Route path="security" element={<AdminSecurity />} />
                </Route>
              </Routes>
            </Suspense>
          </ToastProvider>
        </AuthProvider>
      </LanguageProvider>
    </SiteDataProvider>
  );
}
