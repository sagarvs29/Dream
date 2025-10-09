import React, { useState } from "react";

const API_BASE = import.meta.env?.VITE_API_BASE_URL || "http://localhost:5000/api";

export default function MentorLogin() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/mentor/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Login failed");
      localStorage.setItem("mentor_token", data.token);
      localStorage.setItem("mentor_name", data?.mentor?.name || "");
      window.location.href = "/mentor";
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen scenic-bg flex items-center justify-center p-6">
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
