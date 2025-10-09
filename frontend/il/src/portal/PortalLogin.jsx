import React, { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";

const API = axios.create({
  baseURL: import.meta.env?.VITE_API_BASE_URL || "http://localhost:5000/api",
  withCredentials: true,
});

export default function PortalLogin() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ phone: "", password: "" });
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setMsg("");
    try {
      setLoading(true);
      const { data } = await API.post("/auth/student/login", form);
      if (data.status === "Approved" && data.token) {
        localStorage.setItem("token", data.token);
        navigate("/home");
      } else if (data.status === "Pending") {
        setMsg("Your signup request is under review.");
      } else if (data.status === "Rejected") {
        setMsg("Your request was rejected.");
      } else {
        setMsg(data.message || "Login response received.");
      }
    } catch (e) {
      setMsg(e.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen scenic-bg flex items-center justify-center px-4 py-10 text-white">
      <div className="w-full max-w-md glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-9 h-9 rounded-full bg-white/90 flex items-center justify-center text-indigo-700 font-bold">IAb</div>
          <span className="text-white/90">mlnds</span>
        </div>
        <h2 className="text-2xl font-bold text-center">Student Login</h2>
        <p className="text-white/80 text-center mb-4">Approved students can sign in here</p>
        {msg && <div className="mb-3 text-center">{msg}</div>}
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="block text-sm mb-1">Phone Number</label>
            <input
              className="w-full px-3 py-2 rounded input-dark"
              name="phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="Enter phone number"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Password</label>
            <input
              type="password"
              className="w-full px-3 py-2 rounded input-dark"
              name="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="••••••••"
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary px-4 py-2 rounded w-full">
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
        <div className="text-center mt-4 text-white/80 text-sm">
          New here? <Link className="underline" to="/portal/signup">Create your student account</Link>
        </div>
        <div className="text-center mt-2 text-white/80 text-sm">
          Mentor? <Link className="underline" to="/mentor/login">Go to Mentor Login</Link>
        </div>
      </div>
    </div>
  );
}
