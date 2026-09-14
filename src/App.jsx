import { useEffect, useRef, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, useNavigationType } from "react-router-dom";
import Login from "./pages/auth/Login";
import ResetPassword from "./pages/auth/ResetPassword";
import AdministrativeDashboard from "./pages/administrative/AdministrativeDashboard";
import AuditorDashboard from "./pages/auditor/AuditorDashboard";
import DirectorDashboard from "./pages/director/DirectorDashboard";
import ReviewDashboardPage from "./pages/review/ReviewDashboardPage";
import { dashboardForRole } from "./api/submissions";
import { restoreAuthSession } from "./api/client";

function ProtectedRoute({ role, children }) {
  const activeRole = sessionStorage.getItem("role") || localStorage.getItem("role");
  const allowedRoles = Array.isArray(role) ? role : [role];
  const hasAccess = allowedRoles.some((allowedRole) =>
    allowedRole === activeRole || (allowedRole === "auditor" && String(activeRole || "").includes("auditor"))
  );

  if (!hasAccess) {
    return <Navigate to="/login" replace state={{ message: "Please sign in with the appropriate account to continue." }} />;
  }

  return children;
}

function AuthenticatedHistoryBoundary() {
  const location = useLocation();
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  const boundaryPushInFlight = useRef(false);
  const boundaryArmed = useRef(false);
  const activeToken = sessionStorage.getItem("token") || localStorage.getItem("token");
  const activeRole = sessionStorage.getItem("role") || localStorage.getItem("role");
  const dashboardPath = dashboardForRole(activeRole);
  const isAuthenticated = Boolean(activeToken && activeRole && dashboardPath !== "/login");
  const isDashboardBoundary = isAuthenticated && location.pathname === dashboardPath && !location.search;

  useEffect(() => {
    if (!isAuthenticated) {
      boundaryArmed.current = false;
      boundaryPushInFlight.current = false;
      return;
    }

    if (location.pathname === "/login") {
      boundaryPushInFlight.current = true;
      navigate(dashboardPath, { replace: true });
      return;
    }

    if (!isDashboardBoundary) return;

    if (boundaryPushInFlight.current) {
      boundaryPushInFlight.current = false;
      boundaryArmed.current = true;
      return;
    }

    if (!boundaryArmed.current || navigationType === "POP") {
      boundaryPushInFlight.current = true;
      navigate(`${location.pathname}${location.search}`);
    }
  }, [dashboardPath, isAuthenticated, isDashboardBoundary, location.pathname, location.search, navigate, navigationType]);

  return null;
}

export default function App() {
  const isAaaPath = typeof window !== 'undefined' && (window.location.pathname === '/AAA' || window.location.pathname.startsWith('/AAA/'));
  const basename = isAaaPath ? '/AAA' : '';
  return (
    <BrowserRouter basename={basename}>
      <AppShell />
    </BrowserRouter>
  );
}

function AppShell() {
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let isActive = true;
    restoreAuthSession().finally(() => {
      if (isActive) setAuthReady(true);
    });
    return () => {
      isActive = false;
    };
  }, []);

  if (!authReady) return null;

  return (
    <>
      <AuthenticatedHistoryBoundary />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route
          path="/director/dashboard"
          element={<ProtectedRoute role="director"><DirectorDashboard /></ProtectedRoute>}
        />
        <Route
          path="/administrative/dashboard"
          element={<ProtectedRoute role="administrative"><AdministrativeDashboard /></ProtectedRoute>}
        />
        <Route
          path="/vice-chancellor/dashboard"
          element={<ProtectedRoute role="vice-chancellor"><ReviewDashboardPage /></ProtectedRoute>}
        />
        <Route
          path="/iqac/dashboard"
          element={<ProtectedRoute role="iqac"><ReviewDashboardPage /></ProtectedRoute>}
        />
        <Route
          path="/auditor/dashboard"
          element={<ProtectedRoute role="auditor"><AuditorDashboard /></ProtectedRoute>}
        />
        <Route
          path="/review/dashboard"
          element={<ProtectedRoute role={["vice-chancellor", "iqac"]}><ReviewDashboardPage /></ProtectedRoute>}
        />
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </>
  );
}
