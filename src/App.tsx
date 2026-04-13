import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import AppLayout from "@/components/layout/AppLayout";

import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import PendingApproval from "./pages/PendingApproval";
import NotFound from "./pages/NotFound";

// Member
import MemberHome from "./pages/member/MemberHome";
import MemberPayments from "./pages/member/MemberPayments";
import Notifications from "./pages/Notifications";
import Profile from "./pages/Profile";

// Admin
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminPayments from "./pages/admin/AdminPayments";
import AdminMembers from "./pages/admin/AdminMembers";

// Super Admin
import SuperAdminDashboard from "./pages/superadmin/SuperAdminDashboard";
import SuperAdminPayments from "./pages/superadmin/SuperAdminPayments";
import SuperAdminUsers from "./pages/superadmin/SuperAdminUsers";
import SuperAdminSettings from "./pages/superadmin/SuperAdminSettings";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { firebaseUser, appUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!firebaseUser) return <Navigate to="/login" replace />;
  if (!appUser || appUser.status === "pending") return <PendingApproval />;
  if (appUser.status === "inactive") return <PendingApproval />;

  return <AppLayout>{children}</AppLayout>;
};

const RoleRoutes = () => {
  const { appUser } = useAuth();
  const role = appUser?.role;

  if (role === "super_admin") {
    return (
      <Routes>
        <Route path="/" element={<ProtectedRoute><SuperAdminDashboard /></ProtectedRoute>} />
        <Route path="/payments" element={<ProtectedRoute><SuperAdminPayments /></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute><SuperAdminUsers /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SuperAdminSettings /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    );
  }

  if (role === "admin") {
    return (
      <Routes>
        <Route path="/" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
        <Route path="/payments" element={<ProtectedRoute><AdminPayments /></ProtectedRoute>} />
        <Route path="/members" element={<ProtectedRoute><AdminMembers /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    );
  }

  // Default: member
  return (
    <Routes>
      <Route path="/" element={<ProtectedRoute><MemberHome /></ProtectedRoute>} />
      <Route path="/payments" element={<ProtectedRoute><MemberPayments /></ProtectedRoute>} />
      <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const AppRoutes = () => {
  const { firebaseUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={firebaseUser ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/register" element={firebaseUser ? <Navigate to="/" replace /> : <Register />} />
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
