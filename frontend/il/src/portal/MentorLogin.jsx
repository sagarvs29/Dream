import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getApiBase } from "../config/api";

export default function MentorLogin() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  // Back behavior: if not authenticated (no mentor_token) always go to welcome '/signup'.
  // If authenticated (edge case of returning to this page while token still present), preserve existing back navigation.
  const goBack = () => {
    const hasToken = typeof window !== 'undefined' && localStorage.getItem('mentor_token');
    if (!hasToken) {
      navigate('/signup');
      return;
    }
    // Authenticated: use history when available, fallback to mentor root.
    if (window.history.length > 1) navigate(-1); else navigate('/mentor');
  };

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const base = getApiBase();
      // Debug aid: log and surface the base being used
      try { console.debug('Mentor login using API base:', base); } catch (_) {}
      const res = await fetch(`${base}/mentor/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Login failed");
      // Clear any other role tokens to avoid mixed UI/state
      try {
        ["token","SPONSOR_TOKEN","sponsor_token","adm_token"].forEach(k=>localStorage.removeItem(k));
      } catch(_) {}
      localStorage.setItem("mentor_token", data.token);
      localStorage.setItem("mentor_name", data?.mentor?.name || "");
      window.location.href = "/mentor";
    } catch (e) {
      setError(`${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen scenic-bg flex items-center justify-center p-6">
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
      <form onSubmit={submit} className="glass-card p-6 rounded-xl w-full max-w-md text-white">
  <h1 className="text-2xl font-semibold mb-4">Mentor Login</h1>
  <label className="block mb-2 text-sm">Mentor ID</label>
  <input className="w-full mb-3 p-2 rounded input-dark" value={identifier} onChange={e=>setIdentifier(e.target.value)} placeholder="Enter Mentor ID" />
        <label className="block mb-2 text-sm">Password</label>
        <input type="password" className="w-full mb-3 p-2 rounded input-dark" value={password} onChange={e=>setPassword(e.target.value)} placeholder="password" />
        {error && <div className="mb-3 text-red-200 text-sm">{error}</div>}
        <button disabled={loading} className="btn-primary px-4 py-2 rounded w-full">{loading? 'Signing in...' : 'Sign In'}</button>
      </form>
    </div>
  );
}
