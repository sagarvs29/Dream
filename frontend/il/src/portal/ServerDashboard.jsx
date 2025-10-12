import React, { useEffect, useState } from "react";

const API = import.meta.env?.VITE_API_BASE_URL || "http://localhost:5000/api";

export default function ServerDashboard() {
  const [schools, setSchools] = useState([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [msg, setMsg] = useState("");
  const [adminsBySchool, setAdminsBySchool] = useState({}); // { [schoolId]: Admin[] }
  const [openSchool, setOpenSchool] = useState(null); // which school's admins are expanded
  const [tempPwByAdmin, setTempPwByAdmin] = useState({}); // { [adminId]: tempPw }
  const token = localStorage.getItem("adm_token") || "";

  async function load() {
    const res = await fetch(`${API}/server/schools`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      setSchools(data.schools || []);
    }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!token) window.location.href = "/admin/login";
  }, [token]);

  async function createSchool(e) {
    e.preventDefault();
    setMsg("");
    const res = await fetch(`${API}/server/schools`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name, code, contactEmail: email, logoUrl })
    });
    const data = await res.json();
    if (!res.ok) return setMsg(data?.message || "Failed");
    setMsg("School created");
    setName(""); setCode(""); setEmail(""); setLogoUrl("");
    load();
  }

  async function provisionAdmin(id) {
    setMsg("");
    const res = await fetch(`${API}/server/schools/${id}/provision-admin`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ email: prompt("Admin email?"), name: prompt("Admin name?") })
    });
    const data = await res.json();
    if (!res.ok) return setMsg(data?.message || "Failed");
    const temp = data?.tempPassword;
    if (temp) {
      alert(`Temporary password (dev): ${temp}`);
      // Remember the last temp password for quick reference (UI-only, not persisted)
      if (data?.admin?.id) setTempPwByAdmin((m) => ({ ...m, [data.admin.id]: temp }));
      // Refresh admin list if it's open
      if (openSchool === id) fetchAdmins(id);
    }
    setMsg("Admin provisioned");
  }

  async function fetchAdmins(schoolId) {
    const res = await fetch(`${API}/server/school/${schoolId}/admins`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (res.ok) {
      setAdminsBySchool((prev) => ({ ...prev, [schoolId]: data.admins || [] }));
    } else {
      setMsg(data?.message || "Failed to load admins");
    }
  }

  function toggleAdmins(schoolId) {
    if (openSchool === schoolId) {
      setOpenSchool(null);
    } else {
      setOpenSchool(schoolId);
      if (!adminsBySchool[schoolId]) fetchAdmins(schoolId);
    }
  }

  async function resetPassword(adminId, schoolId) {
    setMsg("");
    const res = await fetch(`${API}/server/admins/${adminId}/reset-password`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) return setMsg(data?.message || "Reset failed");
    if (data?.tempPassword) {
      alert(`New temporary password: ${data.tempPassword}`);
      setTempPwByAdmin((m) => ({ ...m, [adminId]: data.tempPassword }));
    }
    // refresh list
    if (schoolId) fetchAdmins(schoolId);
  }

  async function deleteSchool(schoolId) {
    setMsg("");
    const proceed = confirm("Delete this school? We will first check for linked records.");
    if (!proceed) return;
    try {
      // First try a safe delete (no cascade) to detect links
      let r = await fetch(`${API}/server/schools/${schoolId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        setMsg("School deleted");
        await load();
        return;
      }
      let data = {};
      try { data = await r.json(); } catch {}
      if (r.status === 409) {
        const counts = data?.counts || {};
        const detail = `Students: ${counts.students || 0}, Teachers: ${counts.teachers || 0}, Admins: ${counts.admins || 0}`;
        const force = confirm(
          `This school has linked records.\n${detail}\n\nProceed with cascade delete? This will permanently remove these records.`
        );
        if (!force) return;
        // Force cascade delete
        r = await fetch(`${API}/server/schools/${schoolId}?force=true`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        const d2 = await r.json().catch(() => ({}));
        if (r.ok) {
          setMsg("School and linked records deleted");
          await load();
        } else {
          setMsg(d2?.message || "Delete failed");
        }
        return;
      }
      setMsg(data?.message || "Delete failed");
    } catch (e) {
      setMsg("Delete failed");
    }
  }

  return (
    <div className="min-h-screen scenic-bg text-white p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-semibold">Server Admin Dashboard</h1>
        <button onClick={()=>{localStorage.removeItem("adm_token");localStorage.removeItem("adm_role");window.location.href='/admin/login';}} className="btn-secondary px-3 py-2 rounded">Logout</button>
      </div>

      <form onSubmit={createSchool} className="glass-card p-4 rounded-xl mb-6 max-w-xl">
        <h2 className="text-xl mb-3">Create School</h2>
        <div className="grid md:grid-cols-4 gap-3">
          <input className="frost-input input-dark px-3 py-2 rounded border" placeholder="School Name" value={name} onChange={(e)=>setName(e.target.value)} />
          <input className="frost-input input-dark px-3 py-2 rounded border" placeholder="Code (unique)" value={code} onChange={(e)=>setCode(e.target.value)} />
          <input type="email" className="frost-input input-dark px-3 py-2 rounded border" placeholder="Contact Email" value={email} onChange={(e)=>setEmail(e.target.value)} />
          <input className="frost-input input-dark px-3 py-2 rounded border" placeholder="Logo URL (optional)" value={logoUrl} onChange={(e)=>setLogoUrl(e.target.value)} />
        </div>
        <button className="btn-primary mt-3 px-4 py-2 rounded">Create</button>
        {msg && <div className="text-emerald-300 text-sm mt-2">{msg}</div>}
      </form>

      <div className="grid gap-4 md:grid-cols-2">
        {schools.map((s) => (
          <div key={s._id} className="glass-card p-4 rounded-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 overflow-hidden flex items-center justify-center">
                  {s.logoUrl ? <img src={s.logoUrl} alt="logo" className="w-full h-full object-cover" /> : <span className="text-sm">🏫</span>}
                </div>
                <div>
                  <div className="text-lg font-medium flex items-center gap-2">
                    {s.name}
                    {s.isVerified && <span className="text-emerald-300 text-xs px-2 py-0.5 rounded-full border border-emerald-300">✔ Verified</span>}
                  </div>
                  <div className="text-sm opacity-80">Code: {s.code} • {s.contactEmail}</div>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => provisionAdmin(s._id)} className="btn-secondary px-3 py-2 rounded">Provision Admin</button>
                <button onClick={() => toggleAdmins(s._id)} className="px-3 py-2 rounded bg-white/20 hover:bg-white/30">{openSchool === s._id ? "Hide Admins" : "View Admins"}</button>
                <button onClick={() => deleteSchool(s._id)} className="px-3 py-2 rounded bg-rose-600 hover:bg-rose-500 text-white">Delete</button>
              </div>
            </div>

            <div className="mt-3">
              <button onClick={async()=>{
                const url = prompt('New Logo URL?');
                if (!url) return;
                const r = await fetch(`${API}/server/schools/${s._id}/logo`, { method:'PUT', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ logoUrl: url })});
                if (r.ok) load();
              }} className="text-xs underline opacity-80 hover:opacity-100">Update Logo</button>
              <label className="text-xs underline opacity-80 hover:opacity-100 ml-3 cursor-pointer">
                Upload Logo
                <input type="file" accept="image/*" className="hidden" onChange={async (e)=>{
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const fd = new FormData();
                  fd.append('file', f);
                  const r = await fetch(`${API}/server/schools/${s._id}/logo-upload`, { method:'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
                  if (r.ok) load();
                }} />
              </label>
                <button onClick={async()=>{
                  const ok = confirm('Remove logo?');
                  if (!ok) return;
                  const r = await fetch(`${API}/server/schools/${s._id}/logo`, { method:'DELETE', headers: { Authorization: `Bearer ${token}` } });
                  if (r.ok) load();
                }} className="text-xs underline opacity-80 hover:opacity-100 ml-3">Remove Logo</button>
            </div>

            {openSchool === s._id && (
              <div className="mt-4 space-y-2">
                {(adminsBySchool[s._id] || []).map((a) => (
                  <div key={a._id} className="flex items-center justify-between bg-white/10 rounded p-3">
                    <div>
                      <div className="font-medium">{a.name} <span className="opacity-80">({a.email})</span></div>
                      <div className="text-xs opacity-80">ID: {a._id} {a.isTempPassword ? "• temp password active" : ""}</div>
                      {tempPwByAdmin[a._id] && (
                        <div className="text-xs text-emerald-300">Last temp password: {tempPwByAdmin[a._id]}</div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => resetPassword(a._id, s._id)} className="btn-primary px-3 py-1 rounded">Reset Password</button>
                    </div>
                  </div>
                ))}
                {adminsBySchool[s._id] && adminsBySchool[s._id].length === 0 && (
                  <div className="opacity-80">No admins yet</div>
                )}
              </div>
            )}
          </div>
        ))}
        {!schools.length && <div className="opacity-80">No schools yet</div>}
      </div>
    </div>
  );
}
