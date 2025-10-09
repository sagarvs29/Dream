import React, { useState } from "react";

const API = import.meta.env?.VITE_API_BASE_URL || "http://localhost:5000/api";

export default function ChangePassword() {
  const [oldPassword, setOld] = useState("");
  const [newPassword, setNew] = useState("");
  const [msg, setMsg] = useState("");
  const token = localStorage.getItem("adm_token") || "";

  async function submit(e) {
    e.preventDefault();
    setMsg("");
    const res = await fetch(`${API}/auth/change-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ oldPassword, newPassword })
    });
    const data = await res.json();
    if (!res.ok) return setMsg(data?.message || "Failed");
    setMsg("Password changed. You can continue.");
  }

  return (
    <div className="min-h-screen scenic-bg text-white flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-md glass-card p-6 rounded-2xl">
        <h1 className="text-2xl font-semibold mb-4">Change Password</h1>
        <input type="password" className="w-full frost-input px-3 py-2 rounded border mb-3" placeholder="Old password" value={oldPassword} onChange={(e)=>setOld(e.target.value)} />
        <input type="password" className="w-full frost-input px-3 py-2 rounded border mb-3" placeholder="New password" value={newPassword} onChange={(e)=>setNew(e.target.value)} />
        {msg && <div className="text-emerald-300 text-sm mb-2">{msg}</div>}
        <button className="btn-primary w-full py-2 rounded">Update</button>
      </form>
    </div>
  );
}
