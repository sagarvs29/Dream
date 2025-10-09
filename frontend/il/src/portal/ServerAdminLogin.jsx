import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const API = import.meta.env?.VITE_API_BASE_URL || "http://localhost:5000/api";

export default function ServerAdminLogin() {
  const [email, setEmail] = useState("server.admin@example.com");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  async function onSubmit(e) {
    e.preventDefault();
    setMsg("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/server/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Login failed");
      localStorage.setItem("adm_token", data.token);
      localStorage.setItem("adm_role", "SERVER");
      nav("/server");
    } catch (e) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-600 via-indigo-600 to-violet-700 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <h1 className="text-2xl font-bold text-slate-800 text-center">Welcome Back</h1>
        <p className="mt-1 text-center text-slate-500">Login to continue to your account</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <input
            type="email"
            placeholder="server.admin@example.com"
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

        <p className="mt-4 text-center text-slate-500 text-sm">
          Don’t have an account? {" "}
          <Link to="/admin/login" className="text-indigo-600 hover:underline">Create one</Link>
        </p>
      </div>
    </div>
  );
}
