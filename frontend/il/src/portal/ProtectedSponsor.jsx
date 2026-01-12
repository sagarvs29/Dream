import React from "react";
import { Navigate, Outlet } from "react-router-dom";

function parse(token) {
  try { return JSON.parse(atob(token.split(".")[1])); } catch { return null; }
}

export default function ProtectedSponsor() {
  const token = typeof window !== 'undefined' ? localStorage.getItem("SPONSOR_TOKEN") : null;
  const p = token ? parse(token) : null;
  const role = p?.role || p?.Role || p?.userRole;
  // Accept common variants to avoid redirecting valid sponsor tokens
  const isSponsor = role && ["SPONSOR","Sponsor","sponsor"].includes(role);
  if (!token || !p || !isSponsor) return <Navigate to="/sponsor/login" replace />;
  return <Outlet />;
}
