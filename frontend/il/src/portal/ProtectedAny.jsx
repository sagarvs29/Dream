import React from "react";
import { Navigate, useLocation } from "react-router-dom";

// Accept if either a student token ('token') or an admin token ('adm_token') exists
export default function ProtectedAny({ children }) {
  const location = useLocation();
  const hasStudent = typeof window !== "undefined" && localStorage.getItem("token");
  const hasAdmin = typeof window !== "undefined" && localStorage.getItem("adm_token");

  if (!hasStudent && !hasAdmin) {
    // Route students to the portal login by default
    return <Navigate to="/portal/login" replace state={{ from: location }} />;
  }
  return children;
}
