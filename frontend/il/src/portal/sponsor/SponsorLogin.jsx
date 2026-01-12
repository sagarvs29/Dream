import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function SponsorLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const base = import.meta.env?.VITE_API_BASE_URL || "http://localhost:5000/api";
      const res = await fetch(`${base}/sponsor/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      // Read body once safely
      const raw = await res.text();
      let data = null;
      try { data = raw ? JSON.parse(raw) : null; } catch { /* non-JSON */ }
      if (!res.ok || !data?.token) {
        const msg = data?.message || (res.status === 404 ? "Endpoint not found (check backend URL / proxy)" : `Login failed (HTTP ${res.status})`);
        throw new Error(msg);
      }
      localStorage.setItem("SPONSOR_TOKEN", data.token);
      navigate("/sponsor/home", { replace: true });
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-md bg-slate-800/70 border border-slate-700 rounded-2xl p-6 shadow-xl">
        <h1 className="text-xl font-semibold mb-4">Sponsor Login</h1>
        {err && <div className="mb-3 text-sm text-red-200 bg-red-500/15 border border-red-500/40 rounded px-3 py-2">{err}</div>}
        <input className="w-full mb-3 rounded-md bg-slate-900/60 border border-slate-700 px-3 py-2 outline-none focus:ring-2 focus:ring-violet-500" placeholder="Email" value={email} onChange={(e)=>setEmail(e.target.value)} />
        <input type="password" className="w-full mb-4 rounded-md bg-slate-900/60 border border-slate-700 px-3 py-2 outline-none focus:ring-2 focus:ring-violet-500" placeholder="Password" value={password} onChange={(e)=>setPassword(e.target.value)} />
        <button disabled={loading} className="w-full rounded-md bg-violet-600 hover:bg-violet-500 py-2 disabled:opacity-60">{loading ? "Signing in..." : "Login"}</button>
      </form>
    </div>
  );
}
