import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { Layout } from "./components/layout/Layout";
import { ToastProvider } from "./components/ui/Toast";
import { AuthProvider, RequireAuth } from "./lib/auth";
import { LanguageProvider } from "./lib/i18n";
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
import AdminGate from "./pages/admin/AdminGate";
import AdminAudit from "./pages/admin/Audit";
import AdminContent from "./pages/admin/Content";
import AdminCopy from "./pages/admin/Copy";
import AdminCustomers from "./pages/admin/Customers";
import AdminMedia from "./pages/admin/Media";
import AdminMessages from "./pages/admin/Messages";
import AdminOverview from "./pages/admin/Overview";
import AdminPayments from "./pages/admin/Payments";
import AdminSettings from "./pages/admin/Settings";
import AdminSubscriptions from "./pages/admin/Subscriptions";

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

export default function App() {
  return (
    <SiteDataProvider>
      <LanguageProvider>
        <AuthProvider>
          <ToastProvider>
            <ScrollToTop />
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
              </Route>
            </Routes>
          </ToastProvider>
        </AuthProvider>
      </LanguageProvider>
    </SiteDataProvider>
  );
}
