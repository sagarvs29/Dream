import React from "react";
import { Navigate, useLocation } from "react-router-dom";

export default function ProtectedMentor({ children }) {
  const location = useLocation();
  const token = typeof window !== "undefined" ? localStorage.getItem("mentor_token") : null;
  if (!token) return <Navigate to="/mentor/login" replace state={{ from: location }} />;
  return children;
}
