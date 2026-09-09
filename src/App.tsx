import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import AppLayout from "@/components/layout/AppLayout";
import { useEnsureCurrentMonth } from "@/hooks/useEnsureCurrentMonth";
import { Suspense } from "react";
import { lazyWithRetry } from "@/lib/lazy-with-retry";

// Auth / entry (kept eager: needed for the first paint)
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import PendingApproval from "./pages/PendingApproval";
import VerifyAccount from "./pages/VerifyAccount";
import NotFound from "./pages/NotFound";

// Member (lazy)
const MemberHome = lazyWithRetry(() => import("./pages/member/MemberHome"));
const MemberPayments = lazyWithRetry(() => import("./pages/member/MemberPayments"));
const Notifications = lazyWithRetry(() => import("./pages/Notifications"));
const Profile = lazyWithRetry(() => import("./pages/Profile"));

// Admin (lazy)
const AdminDashboard = lazyWithRetry(() => import("./pages/admin/AdminDashboard"));
const AdminPayments = lazyWithRetry(() => import("./pages/admin/AdminPayments"));
const AdminMembers = lazyWithRetry(() => import("./pages/admin/AdminMembers"));

// Super Admin (lazy)
const SuperAdminDashboard = lazyWithRetry(() => import("./pages/superadmin/SuperAdminDashboard"));
const SuperAdminPayments = lazyWithRetry(() => import("./pages/superadmin/SuperAdminPayments"));
const SuperAdminUsers = lazyWithRetry(() => import("./pages/superadmin/SuperAdminUsers"));
const SuperAdminUserAssignments = lazyWithRetry(() => import("./pages/superadmin/SuperAdminUserAssignments"));
const SuperAdminSettings = lazyWithRetry(() => import("./pages/superadmin/SuperAdminSettings"));
const SuperAdminDataHealth = lazyWithRetry(() => import("./pages/superadmin/SuperAdminDataHealth"));


const queryClient = new QueryClient();

const CenteredSpinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
  </div>
);

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { firebaseUser, appUser, loading } = useAuth();

  if (loading) return <CenteredSpinner />;

  if (!firebaseUser) return <Navigate to="/login" replace />;
  if (!appUser || appUser.status === "pending") return <Navigate to="/verify-account" replace />;
  if (appUser.status === "inactive") return <PendingApproval />;

  return <AppLayout>{children}</AppLayout>;
};

const RoleRoutes = () => {
  const { appUser } = useAuth();
  useEnsureCurrentMonth(appUser);
  const role = appUser?.role;

  if (role === "super_admin") {
    return (
      <Suspense fallback={<CenteredSpinner />}>
        <Routes>
          <Route path="/" element={<ProtectedRoute><SuperAdminDashboard /></ProtectedRoute>} />
          <Route path="/payments" element={<ProtectedRoute><SuperAdminPayments /></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute><SuperAdminUsers /></ProtectedRoute>} />
          <Route path="/assignments" element={<ProtectedRoute><SuperAdminUserAssignments /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SuperAdminSettings /></ProtectedRoute>} />

          <Route path="/data-health" element={<ProtectedRoute><SuperAdminDataHealth /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    );
  }

  if (role === "admin") {
    return (
      <Suspense fallback={<CenteredSpinner />}>
        <Routes>
          <Route path="/" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
          <Route path="/payments" element={<ProtectedRoute><AdminPayments /></ProtectedRoute>} />
          <Route path="/members" element={<ProtectedRoute><AdminMembers /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    );
  }

  // Default: member
  return (
    <Suspense fallback={<CenteredSpinner />}>
      <Routes>
        <Route path="/" element={<ProtectedRoute><MemberHome /></ProtectedRoute>} />
        <Route path="/payments" element={<ProtectedRoute><MemberPayments /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
};

const AuthEntryRedirect = () => {
  const { appUser, loading } = useAuth();
  if (loading) return <CenteredSpinner />;
  if (appUser?.status === "pending") return <Navigate to="/verify-account" replace />;
  return <Navigate to="/" replace />;
};

const VerifyAccountRoute = () => {
  const { firebaseUser, appUser, loading } = useAuth();
  if (loading) return <CenteredSpinner />;
  if (!firebaseUser) return <Navigate to="/login" replace />;
  if (appUser?.status === "active") return <Navigate to="/" replace />;
  return <VerifyAccount />;
};

const AppRoutes = () => {
  const { firebaseUser, loading } = useAuth();
  if (loading) return <CenteredSpinner />;

  return (
    <Routes>
      <Route path="/login" element={firebaseUser ? <AuthEntryRedirect /> : <Login />} />
      <Route path="/register" element={firebaseUser ? <AuthEntryRedirect /> : <Register />} />
      <Route path="/verify-account" element={<VerifyAccountRoute />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/*" element={<RoleRoutes />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
