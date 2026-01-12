import React, { useEffect, useState } from "react";
import NavHeader from "../../components/NavHeader";
import axios from "axios";
import ProtectedRoute from "../ProtectedRoute";
import { getAdminToken } from "../../utils/tokens";

export default function SponsorDashboard() {
  const API = axios.create({ baseURL: import.meta.env?.VITE_API_BASE_URL || "http://localhost:5000/api" });
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [logoUploading, setLogoUploading] = useState(null);
  const [credSponsorId, setCredSponsorId] = useState(null); // which sponsor credentials open
  const [creds, setCreds] = useState([]);
  const [credError, setCredError] = useState("");

  async function load() {
    try {
      setLoading(true); setError("");
  const token = getAdminToken();
      const r = await API.get("/admin/sponsors", { headers: { Authorization: `Bearer ${token}` } });
      setList(r.data?.sponsors || []);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  async function viewCredentials(id) {
    setCredSponsorId(id); setCredError(""); setCreds([]);
    try {
      const token = getAdminToken();
      const r = await API.get(`/admin/sponsors/${id}/credentials`, { headers: { Authorization: `Bearer ${token}` } });
      setCreds(r.data?.users || []);
    } catch (e) {
      setCredError(e?.response?.data?.message || "Failed to load credentials");
    }
  }

  async function deleteSponsor(id) {
    const ok = window.confirm("Delete sponsor and all its users? This cannot be undone.");
    if (!ok) return;
    try {
      const token = getAdminToken();
      await API.delete(`/admin/sponsors/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      setList(list.filter(s => s.id !== id));
      if (credSponsorId === id) { setCredSponsorId(null); setCreds([]); }
    } catch (e) {
      alert(e?.response?.data?.message || "Delete failed");
    }
  }

  useEffect(()=>{ load(); }, []);

  async function uploadLogo(id, file) {
    if (!file) return;
    setLogoUploading(id);
    try {
      const base64 = await toBase64(file);
  const token = getAdminToken();
      await API.post(`/admin/sponsors/${id}/logo`, { file: base64 }, { headers: { Authorization: `Bearer ${token}` } });
      await load();
    } catch (e) {
      alert(e?.response?.data?.message || "Upload failed");
    } finally {
      setLogoUploading(null);
    }
  }

  function toBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  return (
    <ProtectedRoute role={undefined}>
      <div className="min-h-screen bg-gradient-to-br from-purple-700 to-purple-900 text-white">
        <div className="mx-auto max-w-5xl px-4 py-8">
          <NavHeader />
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold">Sponsors</h1>
            <a href="/server/sponsors/new" className="rounded-md bg-white/20 hover:bg-white/30 px-4 py-2 text-sm">New Sponsor</a>
          </div>
          {loading && <div className="mt-4">Loading...</div>}
          {error && <div className="mt-4 bg-red-600/70 rounded-md px-3 py-2">{error}</div>}
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {list.map(s => (
              <div key={s.id} className="rounded-xl bg-white/10 backdrop-blur border border-white/20 p-4 flex flex-col">
                <div className="flex items-center gap-3">
                  {s.logoUrl ? (
                    <img src={s.logoUrl} alt={s.name} className="h-12 w-12 object-contain rounded" />
                  ) : (
                    <div className="h-12 w-12 rounded bg-white/20 grid place-items-center text-xs text-white/70">No Logo</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{s.name}</div>
                    <div className="text-xs text-white/70">Tier: {s.tier}</div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-white/70">
                  <span>{s.userCount} user(s)</span>
                  <span>{new Date(s.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="mt-4">
                  <label className="text-xs block mb-1">Upload / Replace Logo</label>
                  <input type="file" accept="image/*" onChange={e=>uploadLogo(s.id, e.target.files[0])} className="block w-full text-xs" />
                  {logoUploading === s.id && <div className="text-xs mt-1">Uploading...</div>}
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <button onClick={()=>viewCredentials(s.id)} className="px-3 py-1 rounded bg-white/20 hover:bg-white/30">View Credentials</button>
                  <button onClick={()=>deleteSponsor(s.id)} className="px-3 py-1 rounded bg-rose-600 hover:bg-rose-500">Delete</button>
                </div>
                {credSponsorId === s.id && (
                  <div className="mt-3 rounded bg-white/10 p-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Credentials</span>
                      <button onClick={()=>setCredSponsorId(null)} className="text-white/60 hover:text-white">✕</button>
                    </div>
                    {credError && <div className="text-rose-300 mt-1">{credError}</div>}
                    {!credError && creds.length === 0 && <div className="opacity-70 mt-1">{"Loading..."}</div>}
                    {creds.map(u => (
                      <div key={u.id} className="mt-2 border border-white/20 rounded p-2">
                        <div><span className="font-medium">{u.name}</span> <span className="opacity-70">({u.email})</span></div>
                        {u.tempPassword ? (
                          <div className="mt-1">Temp Password: <code className="bg-black/30 px-1 py-0.5 rounded">{u.tempPassword}</code></div>
                        ) : (
                          <div className="mt-1 opacity-60">No active temp password</div>
                        )}
                        <div className="mt-2 flex gap-2">
                          <button
                            onClick={async () => {
                              try {
                                const token = getAdminToken();
                                const r = await API.post(`/admin/sponsors/users/${u.id}/reset-password`, {}, { headers: { Authorization: `Bearer ${token}` } });
                                const newTemp = r.data?.tempPassword;
                                setCreds(prev => prev.map(p => p.id === u.id ? { ...p, tempPassword: newTemp } : p));
                              } catch (e) {
                                alert(e?.response?.data?.message || 'Reset failed');
                              }
                            }}
                            className="px-2 py-1 rounded bg-white/20 hover:bg-white/30"
                          >Reset Password</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          {!loading && list.length === 0 && !error && (
            <div className="mt-6 text-white/70">No sponsors yet. Create one.</div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
