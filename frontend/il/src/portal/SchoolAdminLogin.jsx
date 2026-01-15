import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiUrl } from "../config/api";

export default function SchoolAdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();
  const goBack = () => {
    if (window.history.length > 1) nav(-1);
    else nav("/signup");
  };

  async function onSubmit(e) {
    e.preventDefault();
    setMsg("");
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/auth/school/login"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Login failed");
      localStorage.setItem("adm_token", data.token);
      localStorage.setItem("adm_role", "SCHOOL");
      localStorage.setItem("adm_school", data.schoolId || "");
      if (data.isTempPassword) return nav("/change-password");
      nav("/school");
    } catch (e) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-600 via-indigo-600 to-violet-700 flex items-center justify-center p-6">
      {/* Back button */}
      <button
        onClick={goBack}
        aria-label="Go back"
        className="fixed left-4 top-4 z-50 h-10 w-10 rounded-full bg-white/90 text-slate-700 shadow hover:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 flex items-center justify-center"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
          <path d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <h1 className="text-2xl font-bold text-slate-800 text-center">Welcome Back</h1>
        <p className="mt-1 text-center text-slate-500">Login to continue to your account</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <input
            type="email"
            placeholder="school.admin@your-school.org"
            className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={email}
            onChange={(e)=>setEmail(e.target.value)}
            autoFocus
          />
          <input
            type="password"
            placeholder="••••••••"
            className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={password}
            onChange={(e)=>setPassword(e.target.value)}
          />
          {msg && <div className="text-rose-600 text-sm">{msg}</div>}
          <button type="submit" disabled={loading} className="w-full py-2.5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-60">
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        {/* Removed self-signup footer: school admins are created by management */}
      </div>
    </div>
  );
}
