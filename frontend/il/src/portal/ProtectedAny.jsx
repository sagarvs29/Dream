import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

// Accept if either a student token ('token') or an admin token ('adm_token') exists
export default function ProtectedAny({ children }) {
  const location = useLocation();
  const hasStudent = typeof window !== "undefined" && localStorage.getItem("token");
  const hasAdmin = typeof window !== "undefined" && localStorage.getItem("adm_token");
  const hasMentor = typeof window !== "undefined" && localStorage.getItem("mentor_token");
  const hasSponsor = typeof window !== "undefined" && (localStorage.getItem("SPONSOR_TOKEN") || localStorage.getItem("sponsor_token"));

  if (!hasStudent && !hasAdmin && !hasMentor && !hasSponsor) {
    // Route students to the portal login by default
    return <Navigate to="/portal/login" replace state={{ from: location }} />;
  }
  // Support both usages:
  // 1) <ProtectedAny>...children...</ProtectedAny>
  // 2) <Route element={<ProtectedAny />}> <Route .../> </Route>
  if (children) return <>{children}</>;
  return <Outlet />;
}
