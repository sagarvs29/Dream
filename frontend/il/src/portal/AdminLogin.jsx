import React, { useState } from "react";
import axios from "axios";

const API = axios.create({
  baseURL: import.meta.env?.VITE_API_BASE_URL || "http://localhost:5000/api",
  withCredentials: true,
});

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setMsg("");
    try {
      const { data } = await API.post("/portal/admins/login", { email, password });
      localStorage.setItem("adminToken", data.token);
      setMsg("Logged in. Go to Admin Dashboard.");
    } catch (e) {
      setMsg(e.response?.data?.message || "Login failed");
    }
  }

  return (
    <div className="min-h-screen scenic-bg flex items-center justify-center px-4 py-10 text-white">
      <div className="w-full max-w-md glass-card p-6">
        <h2 className="text-2xl font-bold text-center">Admin Login</h2>
        <form onSubmit={onSubmit} className="space-y-3 mt-4">
          <input className="w-full frost-input px-3 py-2 rounded border" placeholder="Email" value={email} onChange={(e)=>setEmail(e.target.value)} />
          <input type="password" className="w-full frost-input px-3 py-2 rounded border" placeholder="Password" value={password} onChange={(e)=>setPassword(e.target.value)} />
          <button className="btn-primary px-4 py-2 rounded w-full">Log In</button>
          {msg && <div className="text-center mt-2">{msg}</div>}
        </form>
      </div>
    </div>
  );
}
