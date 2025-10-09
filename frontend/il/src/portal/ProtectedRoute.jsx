import React from "react";
import { Navigate, useLocation } from "react-router-dom";

export default function ProtectedRoute({ children, role }) {
  const token = typeof window !== "undefined" ? localStorage.getItem("adm_token") : null;
  const currentRole = typeof window !== "undefined" ? localStorage.getItem("adm_role") : null;
  const location = useLocation();

  if (!token) {
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }
  if (role && currentRole !== role) {
    return <Navigate to="/admin/login" replace />;
  }
  return children;
}
