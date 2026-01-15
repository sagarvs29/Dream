import React, { useEffect, useState } from "react";
import { getAdminToken, logoutAll } from "../utils/tokens";
import { useNavigate } from "react-router-dom";
import { apiUrl } from "../config/api.js";

// Centralized API base (avoids stale IP / timeout issues)

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
  const token = getAdminToken();
  const [ovEdit, setOvEdit] = useState({ open: false, id: null, data: { establishmentYear: '', vision: '', history: '', photos: [], alumni: [], recognitions: [] } });
  const [provisionModal, setProvisionModal] = useState({
    open: false,
    schoolId: null,
    form: { aadhaar: '', name: '', email: '' },
    verify: { status: 'idle', last4: null },
    submitting: false,
    result: { tempPassword: null }
  });

  async function load() {
  const res = await fetch(apiUrl('/server/schools'), {
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
  const res = await fetch(apiUrl('/server/schools'), {
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
    // Open flexible modal instead of prompt-based flow
    setProvisionModal({
      open: true,
      schoolId: id,
      form: { aadhaar: '', name: '', email: '' },
      verify: { status: 'idle', last4: null },
      submitting: false,
      result: { tempPassword: null }
    });
  }

  function handleProvisionField(field, value) {
    setProvisionModal((prev) => ({
      ...prev,
      form: { ...prev.form, [field]: value }
    }));
  }

  async function verifyAadhaar() {
    const aadhaar = provisionModal.form.aadhaar?.trim();
    if (!aadhaar || !/^\d{12}$/.test(aadhaar)) {
      setProvisionModal((prev) => ({ ...prev, verify: { status: 'error', last4: null } }));
      return;
    }
    try {
      setProvisionModal((prev) => ({ ...prev, verify: { status: 'loading', last4: null } }));
      const res = await fetch(apiUrl('/identity/verifyAadhaar'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aadhaar })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const { name, last4 } = data || {};
        setProvisionModal((prev) => ({
          ...prev,
          form: { ...prev.form, name: name || prev.form.name },
          verify: { status: 'success', last4: last4 || null }
        }));
      } else {
        setProvisionModal((prev) => ({ ...prev, verify: { status: 'error', last4: null } }));
      }
    } catch {
      setProvisionModal((prev) => ({ ...prev, verify: { status: 'error', last4: null } }));
    }
  }

  async function submitProvision() {
    const { email, name } = provisionModal.form;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name) return;
    try {
      setProvisionModal((prev) => ({ ...prev, submitting: true }));
      const res = await fetch(apiUrl(`/server/schools/${provisionModal.schoolId}/provision-admin`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email, name })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data?.message || 'Failed');
        setProvisionModal((prev) => ({ ...prev, submitting: false }));
        return;
      }
      const temp = data?.tempPassword || null;
      setProvisionModal((prev) => ({ ...prev, submitting: false, result: { tempPassword: temp } }));
      if (data?.admin?.id && temp) setTempPwByAdmin((m) => ({ ...m, [data.admin.id]: temp }));
      if (openSchool === provisionModal.schoolId) fetchAdmins(provisionModal.schoolId);
      setMsg('Admin provisioned');
    } catch (err) {
      setProvisionModal((prev) => ({ ...prev, submitting: false }));
      setMsg('Failed to provision admin');
    }
  }

  function closeProvisionModal() {
    setProvisionModal({
      open: false,
      schoolId: null,
      form: { aadhaar: '', name: '', email: '' },
      verify: { status: 'idle', last4: null },
      submitting: false,
      result: { tempPassword: null }
    });
  }

  async function fetchAdmins(schoolId) {
  const res = await fetch(apiUrl(`/server/school/${schoolId}/admins`), {
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
  const res = await fetch(apiUrl(`/server/admins/${adminId}/reset-password`), {
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
  let r = await fetch(apiUrl(`/server/schools/${schoolId}`), {
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
  r = await fetch(apiUrl(`/server/schools/${schoolId}?force=true`), {
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

  const navigate = useNavigate();

  return (
    <div className="min-h-screen scenic-bg text-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-3xl font-semibold">Server Admin Dashboard</h1>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => navigate('/institution')}
            className="px-4 py-2 rounded bg-white/15 hover:bg-white/25 backdrop-blur-sm text-sm"
            title="Institution"
          >🏫 Institution</button>
          <button
            onClick={() => navigate('/server/sponsors')}
            className="px-4 py-2 rounded bg-white/15 hover:bg-white/25 backdrop-blur-sm text-sm"
          >Manage Sponsors</button>
          <button
            onClick={() => navigate('/server/sponsors/new')}
            className="px-4 py-2 rounded bg-violet-600 hover:bg-violet-500 text-sm"
          >New Sponsor</button>
          <button
            onClick={()=>{ logoutAll('/'); }}
            className="btn-secondary px-4 py-2 rounded text-sm"
          >Logout</button>
        </div>
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
                <button onClick={() => setOvEdit({ open: true, id: s._id, data: { establishmentYear: s.establishmentYear||'', vision: s.vision||'', history: s.history||'', photos: s.photos||[], alumni: s.alumni||[], recognitions: s.recognitions||[] } })} className="px-3 py-2 rounded bg-white/20 hover:bg-white/30">Edit Overview</button>
                <button onClick={() => deleteSchool(s._id)} className="px-3 py-2 rounded bg-rose-600 hover:bg-rose-500 text-white">Delete</button>
              </div>
            </div>

            <div className="mt-3">
              <button onClick={async()=>{
                const url = prompt('New Logo URL?');
                if (!url) return;
                const r = await fetch(apiUrl(`/server/schools/${s._id}/logo`), { method:'PUT', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ logoUrl: url })});
                if (r.ok) load();
              }} className="text-xs underline opacity-80 hover:opacity-100">Update Logo</button>
              <label className="text-xs underline opacity-80 hover:opacity-100 ml-3 cursor-pointer">
                Upload Logo
                <input type="file" accept="image/*" className="hidden" onChange={async (e)=>{
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const fd = new FormData();
                  fd.append('file', f);
                  const r = await fetch(apiUrl(`/server/schools/${s._id}/logo-upload`), { method:'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
                  if (r.ok) load();
                }} />
              </label>
                <button onClick={async()=>{
                  const ok = confirm('Remove logo?');
                  if (!ok) return;
                  const r = await fetch(apiUrl(`/server/schools/${s._id}/logo`), { method:'DELETE', headers: { Authorization: `Bearer ${token}` } });
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
        {/* Sponsors quick access panel (optional small info card) */}
        <div className="glass-card p-4 rounded-xl md:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-medium">Sponsors</h2>
            <div className="flex gap-2">
              <button onClick={()=>navigate('/server/sponsors')} className="px-3 py-2 rounded bg-white/15 hover:bg-white/25 text-sm">View All</button>
              <button onClick={()=>navigate('/server/sponsors/new')} className="px-3 py-2 rounded bg-violet-600 hover:bg-violet-500 text-sm">Create</button>
            </div>
          </div>
          <p className="text-sm opacity-80">Manage organizations that provide funding or support. Provision a primary sponsor user so they can log in at /sponsor/login.</p>
        </div>
      </div>

      {ovEdit.open && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-5 w-full max-w-4xl text-slate-800">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold">Edit School Overview</h3>
              <button onClick={()=> setOvEdit({ open:false, id:null, data:{ establishmentYear:'', vision:'', history:'', photos:[], alumni:[], recognitions:[] } })} className="text-slate-500">✕</button>
            </div>
            <form onSubmit={async (e)=>{
              e.preventDefault();
              const res = await fetch(apiUrl(`/server/schools/${ovEdit.id}/overview`), {
                method: 'PUT',
                headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(ovEdit.data)
              });
              if (res.ok) {
                await load();
                setOvEdit({ open:false, id:null, data:{ establishmentYear:'', vision:'', history:'', photos:[], alumni:[], recognitions:[] } });
              } else {
                const d = await res.json().catch(()=>({}));
                alert(d?.message || 'Update failed');
              }
            }} className="grid gap-3">
              <div className="grid md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm mb-1">Establishment Year</label>
                  <input type="number" className="w-full border rounded p-2" value={ovEdit.data.establishmentYear||''} onChange={e=> setOvEdit(s=>({ ...s, data:{ ...s.data, establishmentYear: e.target.value } }))} />
                </div>
                <div className="md:col-span-1"></div>
                <div className="md:col-span-1"></div>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm mb-1">Vision</label>
                  <textarea rows={4} className="w-full border rounded p-2" value={ovEdit.data.vision||''} onChange={e=> setOvEdit(s=>({ ...s, data:{ ...s.data, vision: e.target.value } }))} />
                </div>
                <div>
                  <label className="block text-sm mb-1">History</label>
                  <textarea rows={4} className="w-full border rounded p-2" value={ovEdit.data.history||''} onChange={e=> setOvEdit(s=>({ ...s, data:{ ...s.data, history: e.target.value } }))} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2"><label className="text-sm">School Photos</label><button type="button" onClick={()=> setOvEdit(s=> ({ ...s, data:{ ...s.data, photos:[...(s.data.photos||[]), { url:'', caption:'' }] }}))} className="px-2 py-1 rounded bg-slate-200 text-slate-800 text-xs">+ Add Photo</button></div>
                <div className="space-y-2">
                  {(ovEdit.data.photos||[]).map((p,idx)=>(
                    <div key={idx} className="grid md:grid-cols-12 gap-2 items-center">
                      <input className="md:col-span-6 w-full border rounded p-2" placeholder="Image URL" value={p.url||''} onChange={e=>{ const arr=[...(ovEdit.data.photos||[])]; arr[idx] = { ...(arr[idx]||{}), url: e.target.value }; setOvEdit(s=>({ ...s, data:{ ...s.data, photos: arr } })); }} />
                      <input className="md:col-span-5 w-full border rounded p-2" placeholder="Caption" value={p.caption||''} onChange={e=>{ const arr=[...(ovEdit.data.photos||[])]; arr[idx] = { ...(arr[idx]||{}), caption: e.target.value }; setOvEdit(s=>({ ...s, data:{ ...s.data, photos: arr } })); }} />
                      <button type="button" onClick={()=>{ const arr=[...(ovEdit.data.photos||[])]; arr.splice(idx,1); setOvEdit(s=>({ ...s, data:{ ...s.data, photos: arr } })); }} className="md:col-span-1 px-2 py-2 rounded bg-rose-600 text-white">✕</button>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2"><label className="text-sm">Famous Alumni</label><button type="button" onClick={()=> setOvEdit(s=> ({ ...s, data:{ ...s.data, alumni:[...(s.data.alumni||[]), { name:'', year:'', achievement:'', photoUrl:'' }] }}))} className="px-2 py-1 rounded bg-slate-200 text-slate-800 text-xs">+ Add Alumni</button></div>
                <div className="space-y-2">
                  {(ovEdit.data.alumni||[]).map((a,idx)=>(
                    <div key={idx} className="grid md:grid-cols-12 gap-2 items-center">
                      <input className="md:col-span-3 w-full border rounded p-2" placeholder="Name" value={a.name||''} onChange={e=>{ const arr=[...(ovEdit.data.alumni||[])]; arr[idx] = { ...(arr[idx]||{}), name: e.target.value }; setOvEdit(s=>({ ...s, data:{ ...s.data, alumni: arr } })); }} />
                      <input type="number" className="md:col-span-2 w-full border rounded p-2" placeholder="Year" value={a.year||''} onChange={e=>{ const arr=[...(ovEdit.data.alumni||[])]; arr[idx] = { ...(arr[idx]||{}), year: Number(e.target.value)||'' }; setOvEdit(s=>({ ...s, data:{ ...s.data, alumni: arr } })); }} />
                      <input className="md:col-span-5 w-full border rounded p-2" placeholder="Achievement" value={a.achievement||''} onChange={e=>{ const arr=[...(ovEdit.data.alumni||[])]; arr[idx] = { ...(arr[idx]||{}), achievement: e.target.value }; setOvEdit(s=>({ ...s, data:{ ...s.data, alumni: arr } })); }} />
                      <input className="md:col-span-1 w-full border rounded p-2" placeholder="Photo URL" value={a.photoUrl||''} onChange={e=>{ const arr=[...(ovEdit.data.alumni||[])]; arr[idx] = { ...(arr[idx]||{}), photoUrl: e.target.value }; setOvEdit(s=>({ ...s, data:{ ...s.data, alumni: arr } })); }} />
                      <button type="button" onClick={()=>{ const arr=[...(ovEdit.data.alumni||[])]; arr.splice(idx,1); setOvEdit(s=>({ ...s, data:{ ...s.data, alumni: arr } })); }} className="md:col-span-1 px-2 py-2 rounded bg-rose-600 text-white">✕</button>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2"><label className="text-sm">Recognitions & Awards</label><button type="button" onClick={()=> setOvEdit(s=> ({ ...s, data:{ ...s.data, recognitions:[...(s.data.recognitions||[]), { title:'', issuer:'', level:'District', year:'', description:'' }] }}))} className="px-2 py-1 rounded bg-slate-200 text-slate-800 text-xs">+ Add Award</button></div>
                <div className="space-y-2">
                  {(ovEdit.data.recognitions||[]).map((r,idx)=>(
                    <div key={idx} className="grid md:grid-cols-12 gap-2 items-center">
                      <input className="md:col-span-3 w-full border rounded p-2" placeholder="Title" value={r.title||''} onChange={e=>{ const arr=[...(ovEdit.data.recognitions||[])]; arr[idx] = { ...(arr[idx]||{}), title: e.target.value }; setOvEdit(s=>({ ...s, data:{ ...s.data, recognitions: arr } })); }} />
                      <input className="md:col-span-3 w-full border rounded p-2" placeholder="Issuer" value={r.issuer||''} onChange={e=>{ const arr=[...(ovEdit.data.recognitions||[])]; arr[idx] = { ...(arr[idx]||{}), issuer: e.target.value }; setOvEdit(s=>({ ...s, data:{ ...s.data, recognitions: arr } })); }} />
                      <select className="md:col-span-2 w-full border rounded p-2" value={r.level||'District'} onChange={e=>{ const arr=[...(ovEdit.data.recognitions||[])]; arr[idx] = { ...(arr[idx]||{}), level: e.target.value }; setOvEdit(s=>({ ...s, data:{ ...s.data, recognitions: arr } })); }}>
                        {['District','State','National','International'].map(l=> <option key={l} value={l}>{l}</option>)}
                      </select>
                      <input type="number" className="md:col-span-2 w-full border rounded p-2" placeholder="Year" value={r.year||''} onChange={e=>{ const arr=[...(ovEdit.data.recognitions||[])]; arr[idx] = { ...(arr[idx]||{}), year: Number(e.target.value)||'' }; setOvEdit(s=>({ ...s, data:{ ...s.data, recognitions: arr } })); }} />
                      <button type="button" onClick={()=>{ const arr=[...(ovEdit.data.recognitions||[])]; arr.splice(idx,1); setOvEdit(s=>({ ...s, data:{ ...s.data, recognitions: arr } })); }} className="md:col-span-2 px-2 py-2 rounded bg-rose-600 text-white">Remove</button>
                      <textarea rows={2} className="md:col-span-12 w-full border rounded p-2" placeholder="Description (optional)" value={r.description||''} onChange={e=>{ const arr=[...(ovEdit.data.recognitions||[])]; arr[idx] = { ...(arr[idx]||{}), description: e.target.value }; setOvEdit(s=>({ ...s, data:{ ...s.data, recognitions: arr } })); }} />
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-2 flex justify-end gap-2">
                <button type="button" onClick={()=> setOvEdit({ open:false, id:null, data:{ establishmentYear:'', vision:'', history:'', photos:[], alumni:[], recognitions:[] } })} className="px-3 py-2 rounded bg-slate-200">Cancel</button>
                <button type="submit" className="px-3 py-2 rounded bg-indigo-600 text-white">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {provisionModal.open && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-5 w-full max-w-lg text-slate-800">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold">Provision School Admin</h3>
              <button onClick={closeProvisionModal} className="text-slate-500">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm mb-1">Aadhaar (optional)</label>
                <div className="flex gap-2">
                  <input type="text" maxLength={12} placeholder="12-digit Aadhaar" className="w-full border rounded p-2" value={provisionModal.form.aadhaar} onChange={(e)=> handleProvisionField('aadhaar', e.target.value.replace(/\D/g, ''))} />
                  <button type="button" onClick={verifyAadhaar} className="px-3 py-2 rounded bg-slate-200">Verify</button>
                </div>
                {provisionModal.verify.status === 'loading' && <p className="text-sm text-slate-600 mt-1">Verifying...</p>}
                {provisionModal.verify.status === 'success' && <p className="text-sm text-emerald-700 mt-1">Verified • last4: {provisionModal.verify.last4}</p>}
                {provisionModal.verify.status === 'error' && <p className="text-sm text-rose-600 mt-1">Verification failed. Check number and try again.</p>}
              </div>
              <div>
                <label className="block text-sm mb-1">Full Name</label>
                <input type="text" placeholder="Admin name" className="w-full border rounded p-2" value={provisionModal.form.name} onChange={(e)=> handleProvisionField('name', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm mb-1">Email</label>
                <input type="email" placeholder="admin@example.com" className="w-full border rounded p-2" value={provisionModal.form.email} onChange={(e)=> handleProvisionField('email', e.target.value)} />
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={closeProvisionModal} className="px-3 py-2 rounded bg-slate-200">Cancel</button>
              <button type="button" onClick={submitProvision} className="px-3 py-2 rounded bg-indigo-600 text-white disabled:opacity-50" disabled={!provisionModal.form.name || !provisionModal.form.email || !/^([^\s@]+)@([^\s@]+)\.[^\s@]+$/.test(provisionModal.form.email) || provisionModal.submitting}>
                {provisionModal.submitting ? 'Provisioning...' : 'Provision'}
              </button>
            </div>
            {provisionModal.result.tempPassword && (
              <div className="mt-4 p-3 border rounded bg-slate-50">
                <p className="text-sm">Admin provisioned successfully.</p>
                <p className="text-sm font-semibold">Temporary Password: <span className="font-mono">{provisionModal.result.tempPassword}</span></p>
                <p className="text-xs text-slate-600 mt-1">Share securely and ask the admin to change it on first login.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
