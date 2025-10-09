import React, { useEffect, useState } from "react";

const API = import.meta.env?.VITE_API_BASE_URL || "http://localhost:5000/api";

export default function SchoolDashboard() {
  const [pending, setPending] = useState([]);
  const [approved, setApproved] = useState([]);
  const [rejected, setRejected] = useState([]);
  const [tab, setTab] = useState("Pending"); // Pending | Approved | Rejected | Mentors | Mentor Requests | Settings
  const [q, setQ] = useState("");
  const [settings, setSettings] = useState({ name: "", address: "", contactEmail: "", logoUrl: "", isVerified: false });
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState({ open: false, id: null, action: null, remarks: "" });
  const [detail, setDetail] = useState({ open: false, id: null, loading: false, data: null });

  // Mentors state (reuses "teachers" list var name for compatibility)
  const [teachers, setTeachers] = useState([]);
  const [tQ, setTQ] = useState("");
  const [tLoading, setTLoading] = useState(false);
  const [tEdit, setTEdit] = useState({ open: false, id: null, data: {} });
  const [tAdd, setTAdd] = useState({ open: false, data: { name:'', email:'', phone:'', employeeId:'', department:'', designation:'', role:'Mentor', status:'Active', subjects:'', classes:'', mentorshipAreas:'', auth:{ username:'' }, password:'' } });
  const [showEditPwd, setShowEditPwd] = useState(false);
  const [showAddPwd, setShowAddPwd] = useState(false);
  // Mentor requests (student -> mentor) list
  const [mentorReqs, setMentorReqs] = useState([]);
  const [mrLoading, setMrLoading] = useState(false);
  const token = localStorage.getItem("adm_token") || "";

  async function load() {
    // Load counts and lists
    const headers = { Authorization: `Bearer ${token}` };
    const [pRes, aprRes, rejRes, schRes] = await Promise.all([
      fetch(`${API}/school/students?status=Pending${q ? `&q=${encodeURIComponent(q)}` : ""}`, { headers }),
      fetch(`${API}/school/students?status=Approved${q ? `&q=${encodeURIComponent(q)}` : ""}`, { headers }),
      fetch(`${API}/school/students?status=Rejected${q ? `&q=${encodeURIComponent(q)}` : ""}`, { headers }),
      fetch(`${API}/school/me`, { headers }),
    ]);
    if (pRes.ok) setPending((await pRes.json()).students || []);
    if (aprRes.ok) setApproved((await aprRes.json()).students || []);
    if (rejRes.ok) setRejected((await rejRes.json()).students || []);
    if (schRes.ok) setSettings(((await schRes.json()).school) || settings);
  }

  useEffect(()=>{ load(); }, []);
  useEffect(()=>{
    if (tab === 'Mentors') fetchMentors();
    if (tab === 'Mentor Requests') fetchMentorRequests();
  }, [tab]);
  useEffect(() => {
    if (!token) window.location.href = "/admin/login";
  }, [token]);

  function openModal(id, action) {
    setModal({ open: true, id, action, remarks: "" });
  }
  function closeModal() { setModal({ open: false, id: null, action: null, remarks: "" }); }
  async function submitModal() {
    const { id, action, remarks } = modal;
    if (!id || !action) return;
    const res = await fetch(`${API}/school/students/${id}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ remarks })
    });
    if (res.ok) {
      closeModal();
      load();
    }
  }

  async function openDetails(id) {
    setDetail({ open: true, id, loading: true, data: null });
    const res = await fetch(`${API}/school/students/${id}`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (res.ok) setDetail({ open: true, id, loading: false, data: data.student });
    else setDetail({ open: true, id, loading: false, data: null });
  }
  function closeDetails() { setDetail({ open: false, id: null, loading: false, data: null }); }

  async function saveSettings(e) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(`${API}/school/update`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: settings.name, address: settings.address, contactEmail: settings.contactEmail, logoUrl: settings.logoUrl })
    });
    if (res.ok) {
      const data = await res.json();
      setSettings(data.school || settings);
    }
    setSaving(false);
  }

  // ===== Teachers/Mentors management =====
  async function fetchTeachers() {
    setTLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await fetch(`${API}/school/teachers?status=Active${tQ ? `&q=${encodeURIComponent(tQ)}` : ''}`, { headers });
      const data = await res.json();
      if (res.ok) setTeachers(data.teachers || []);
    } finally {
      setTLoading(false);
    }
  }

  async function fetchMentors() {
    setTLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await fetch(`${API}/school/mentors${tQ ? `?q=${encodeURIComponent(tQ)}` : ''}`, { headers });
      const data = await res.json();
      if (res.ok) setTeachers(data.mentors || []);
    } finally {
      setTLoading(false);
    }
  }

  async function fetchMentorRequests() {
    setMrLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await fetch(`${API}/school/mentor-requests`, { headers });
      const data = await res.json();
      if (res.ok) setMentorReqs(data.requests || []);
    } finally {
      setMrLoading(false);
    }
  }

  async function actMentorRequest(id, action) {
    const headers = { Authorization: `Bearer ${token}` };
    const res = await fetch(`${API}/school/mentor-requests/${id}/${action}`, { method: 'POST', headers });
    if (res.ok) fetchMentorRequests();
  }

  function openTeacherEdit(t) {
    setTEdit({ open: true, id: t._id, data: {
      name: t.name || '',
      email: t.email || '',
      phone: t.phone || '',
      employeeId: t.employeeId || '',
      department: t.department || '',
      designation: t.designation || '',
      role: t.role || 'Teacher',
      status: t.status || 'Active',
      subjects: Array.isArray(t.subjects) ? t.subjects.join(', ') : '',
      classes: Array.isArray(t.classes) ? t.classes.join(', ') : '',
      mentorshipAreas: Array.isArray(t.mentorshipAreas) ? t.mentorshipAreas.join(', ') : '',
      auth: { username: t?.auth?.username || '' },
      password: ''
    }});
    setShowEditPwd(false);
  }

  function closeTeacherEdit() { setTEdit({ open: false, id: null, data: {} }); setShowEditPwd(false); }

  async function saveTeacherEdit(e) {
    e?.preventDefault?.();
    if (!tEdit.id) return;
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
    const payload = {
      ...tEdit.data,
      // Convert comma-separated strings back to arrays
      subjects: tEdit.data.subjects?.split(',').map(s=>s.trim()).filter(Boolean) || [],
      classes: tEdit.data.classes?.split(',').map(s=>s.trim()).filter(Boolean) || [],
      mentorshipAreas: tEdit.data.mentorshipAreas?.split(',').map(s=>s.trim()).filter(Boolean) || [],
    };
    const res = await fetch(`${API}/school/teachers/${tEdit.id}`, { method: 'PUT', headers, body: JSON.stringify(payload) });
    const data = await res.json().catch(()=>({}));
    if (!res.ok) {
      alert(data?.message || 'Failed to update teacher');
      return;
    }
    closeTeacherEdit();
    if (tab === 'Mentors') await fetchMentors(); else await fetchTeachers();
  }

  return (
    <div className="min-h-screen scenic-bg text-white p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-white/20 flex items-center justify-center">
            {settings.logoUrl ? <img src={settings.logoUrl} alt="logo" className="w-full h-full object-cover" /> : <span>🏫</span>}
          </div>
          <div className="text-2xl font-semibold flex items-center gap-2">
            {settings.name || 'School Dashboard'}
            {settings.isVerified && <span className="text-emerald-300 text-xs px-2 py-0.5 rounded-full border border-emerald-300">✔ Verified</span>}
          </div>
        </div>
        <button onClick={()=>{localStorage.removeItem("adm_token");localStorage.removeItem("adm_role");window.location.href='/admin/login';}} className="btn-secondary px-3 py-2 rounded">Logout</button>
      </div>

      {/* Tabs */}
      <div className="glass-nav inline-flex rounded overflow-hidden mb-4">
        {['Pending','Approved','Rejected','Mentors','Mentor Requests','Settings'].map(t => (
          <button key={t} onClick={()=>setTab(t)} className={`px-4 py-2 ${tab===t? 'bg-white/30 text-white' : 'text-white/80'}`}>{t}
            {t==='Pending' ? ` (${pending.length})` : t==='Approved' ? ` (${approved.length})` : t==='Rejected' ? ` (${rejected.length})` : ''}
          </button>
        ))}
      </div>

      {tab !== 'Settings' && tab !== 'Mentors' && (
        <div className="mb-4 flex items-center gap-2">
          <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Search by roll/email" className="frost-input input-dark px-3 py-2 rounded border w-full max-w-sm" />
          <button onClick={load} className="btn-primary px-3 py-2 rounded">Search</button>
        </div>
      )}

      {(tab === 'Mentors') && (
        <div className="mb-4 flex items-center gap-2">
          <input value={tQ} onChange={(e)=>setTQ(e.target.value)} placeholder={'Search mentors'} className="frost-input input-dark px-3 py-2 rounded border w-full max-w-sm" />
          <button onClick={fetchMentors} className="btn-primary px-3 py-2 rounded">Search</button>
          <button onClick={()=>{ setShowAddPwd(false); setTAdd(s=>({ ...s, open: true })); }} className="btn-secondary px-3 py-2 rounded">Add Mentor</button>
        </div>
      )}

      {tab === 'Pending' && (
        <section className="mb-8">
          <div className="grid gap-4 md:grid-cols-2">
            {pending.map((s) => (
              <div key={s._id} className="glass-card p-4 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{s.name}</div>
                    <div className="text-sm opacity-80">{s.email} • {s.phone || '—'} • {s.department} • {s.admissionYear}</div>
                    <div className="text-xs opacity-80">Roll: {s.rollNumber} • Aadhaar: {s.aadhaarNumber || '—'} • {s.address || ''}</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={()=>openModal(s._id,'approve')} className="btn-primary px-3 py-2 rounded">Approve</button>
                    <button onClick={()=>openModal(s._id,'reject')} className="btn-secondary px-3 py-2 rounded">Reject</button>
                    <button onClick={()=>openDetails(s._id)} className="px-3 py-2 rounded bg-white/20 hover:bg-white/30">View Details</button>
                  </div>
                </div>
              </div>
            ))}
            {!pending.length && <div className="opacity-80">No pending requests</div>}
          </div>
        </section>
      )}

      {tab === 'Approved' && (
        <section>
          <div className="grid gap-4 md:grid-cols-2">
            {approved.map((s) => (
              <div key={s._id} className="glass-card p-4 rounded-xl">
                <div className="font-medium">{s.name}</div>
                <div className="text-sm opacity-80">{s.email} • {s.department} • {s.admissionYear} • {s.status}</div>
                <div className="text-xs opacity-80">Roll: {s.rollNumber}</div>
              </div>
            ))}
            {!approved.length && <div className="opacity-80">No approved students</div>}
          </div>
        </section>
      )}

      {tab === 'Rejected' && (
        <section>
          <div className="grid gap-4 md:grid-cols-2">
            {rejected.map((s) => (
              <div key={s._id} className="glass-card p-4 rounded-xl">
                <div className="font-medium">{s.name}</div>
                <div className="text-sm opacity-80">{s.email} • {s.department} • {s.admissionYear} • {s.status}</div>
                <div className="text-xs opacity-80">Roll: {s.rollNumber}</div>
              </div>
            ))}
            {!rejected.length && <div className="opacity-80">No rejected students</div>}
          </div>
        </section>
      )}

      {/* Teachers tab removed per requirement */}

      {tab === 'Mentors' && (
        <section>
          {tLoading && <div>Loading...</div>}
          {!tLoading && (
            <div className="grid gap-4 md:grid-cols-2">
              {teachers.map(t => (
                <div key={t._id} className="glass-card p-4 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{t.name}</div>
                      <div className="text-sm opacity-80">{t.email} • {t.department} • {t.designation} • {t.role}</div>
                      <div className="text-xs opacity-80">Areas: {(t.mentorshipAreas||[]).join(', ') || '—'}</div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={()=>openTeacherEdit(t)} className="btn-primary px-3 py-2 rounded">Edit</button>
                      <button onClick={async ()=>{
                        if (!confirm('Remove mentor from this school?')) return;
                        const r = await fetch(`${API}/school/teachers/${t._id}`, { method:'DELETE', headers: { Authorization: `Bearer ${token}` } });
                        if (r.ok) fetchMentors(); else alert('Failed to remove mentor');
                      }} className="px-3 py-2 rounded bg-red-600 text-white">Remove</button>
                    </div>
                  </div>
                </div>
              ))}
              {!teachers.length && <div className="opacity-80">No mentors found</div>}
            </div>
          )}
        </section>
      )}

      {tab === 'Mentor Requests' && (
        <section>
          {mrLoading && <div>Loading...</div>}
          {!mrLoading && (
            <div className="grid gap-4 md:grid-cols-2">
              {mentorReqs.map(r => (
                <div key={r._id} className="glass-card p-4 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{r.requester?.student?.name || 'Student'} → {r.target?.mentor?.name || 'Mentor'}</div>
                      <div className="text-sm opacity-80">{r.requester?.student?.email || ''} • {r.requester?.student?.rollNumber || ''}</div>
                      <div className="text-xs opacity-80">Status: {r.status} • {new Date(r.createdAt).toLocaleString()}</div>
                      {r.message && <div className="text-xs mt-1 opacity-90">“{r.message}”</div>}
                    </div>
                    <div className="text-xs opacity-80">Mentor decides in mentor portal</div>
                  </div>
                </div>
              ))}
              {!mentorReqs.length && <div className="opacity-80">No mentor requests</div>}
            </div>
          )}
        </section>
      )}

      {tab === 'Settings' && (
        <section className="max-w-xl">
          <div className="glass-card p-4 rounded-t-xl">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full overflow-hidden bg-white/20 flex items-center justify-center">
                {settings.logoUrl ? <img src={settings.logoUrl} alt="logo" className="w-full h-full object-cover" /> : <span>🏫</span>}
              </div>
              <div>
                <div className="text-lg font-semibold flex items-center gap-2">
                  {settings.name || '—'}
                  {settings.isVerified && <span className="text-emerald-300 text-xs px-2 py-0.5 rounded-full border border-emerald-300">✔ Verified</span>}
                </div>
                <div className="text-sm opacity-80">{settings.contactEmail || ''}</div>
              </div>
            </div>
          </div>
          <form onSubmit={saveSettings} className="glass-card p-4 rounded-b-xl space-y-3">
            <div>
              <label className="block text-sm mb-1">School Name</label>
              <input className="frost-input input-dark px-3 py-2 rounded border w-full" value={settings.name || ''} onChange={(e)=>setSettings({...settings,name:e.target.value})} />
            </div>
            <div>
              <label className="block text-sm mb-1">Address</label>
              <input className="frost-input input-dark px-3 py-2 rounded border w-full" value={settings.address || ''} onChange={(e)=>setSettings({...settings,address:e.target.value})} />
            </div>
            <div>
              <label className="block text-sm mb-1">Contact Email</label>
              <input type="email" className="frost-input input-dark px-3 py-2 rounded border w-full" value={settings.contactEmail || ''} onChange={(e)=>setSettings({...settings,contactEmail:e.target.value})} />
            </div>
            <div>
              <label className="block text-sm mb-1">Logo URL</label>
              <input className="frost-input input-dark px-3 py-2 rounded border w-full" value={settings.logoUrl || ''} onChange={(e)=>setSettings({...settings,logoUrl:e.target.value})} />
              <label className="block mt-2 text-xs underline opacity-90 cursor-pointer">
                Upload Logo File
                <input type="file" accept="image/*" className="hidden" onChange={async (e)=>{
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const fd = new FormData();
                  fd.append('file', f);
                  const r = await fetch(`${API}/school/logo-upload`, { method:'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
                  if (r.ok) {
                    const d = await r.json();
                    setSettings(s=>({ ...s, logoUrl: d.logoUrl }));
                  }
                }} />
              </label>
              <button onClick={async()=>{
                const ok = confirm('Remove logo?');
                if (!ok) return;
                const r = await fetch(`${API}/school/logo`, { method:'DELETE', headers: { Authorization: `Bearer ${token}` } });
                if (r.ok) setSettings(s=>({ ...s, logoUrl: '' }));
              }} className="block mt-2 text-xs underline opacity-90">Remove Logo</button>
            </div>
            <button disabled={saving} className="btn-primary px-4 py-2 rounded">{saving? 'Saving...' : 'Save Changes'}</button>
          </form>
        </section>
      )}

      {modal.open && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-5 w-full max-w-md text-slate-800">
            <h3 className="text-lg font-semibold mb-2">{modal.action === 'approve' ? 'Approve Student' : 'Reject Student'}</h3>
            <p className="text-sm text-slate-600 mb-3">Optional remarks</p>
            <textarea value={modal.remarks} onChange={(e)=>setModal({...modal,remarks:e.target.value})} rows={3} className="w-full border rounded p-2" placeholder="Remarks (optional)" />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={closeModal} className="px-3 py-2 rounded bg-slate-200">Cancel</button>
              <button onClick={submitModal} className="px-3 py-2 rounded bg-indigo-600 text-white">Confirm</button>
            </div>
          </div>
        </div>
      )}

      {detail.open && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-5 w-full max-w-2xl text-slate-800">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold">Student Details</h3>
              <button onClick={closeDetails} className="text-slate-500">✕</button>
            </div>
            {detail.loading && <div>Loading...</div>}
            {!detail.loading && detail.data && (
              <div className="grid md:grid-cols-2 gap-4">
                <div className="rounded border p-3">
                  <div className="font-medium mb-1">Identity</div>
                  <div className="text-sm">Name: {detail.data.name}</div>
                  <div className="text-sm">Aadhaar: {detail.data.aadhaarNumber || '—'}</div>
                </div>
                <div className="rounded border p-3">
                  <div className="font-medium mb-1">Contact</div>
                  <div className="text-sm">Email: {detail.data.email}</div>
                  <div className="text-sm">Phone: {detail.data.phone || '—'}</div>
                  <div className="text-sm">Address: {detail.data.address || '—'}</div>
                </div>
                <div className="rounded border p-3">
                  <div className="font-medium mb-1">Academic</div>
                  <div className="text-sm">Roll: {detail.data.rollNumber}</div>
                  <div className="text-sm">Class/Dept: {detail.data.department}</div>
                  <div className="text-sm">Admission Year: {detail.data.admissionYear}</div>
                  <div className="text-sm">Status: {detail.data.status}</div>
                </div>
              </div>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={()=>openModal(detail.id,'approve')} className="px-3 py-2 rounded bg-indigo-600 text-white">Approve</button>
              <button onClick={()=>openModal(detail.id,'reject')} className="px-3 py-2 rounded bg-slate-700 text-white">Reject</button>
            </div>
          </div>
        </div>
      )}

      {tEdit.open && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-5 w-full max-w-xl text-slate-800">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold">Edit {tab==='Mentors' ? 'Mentor' : 'Teacher'}</h3>
              <button onClick={closeTeacherEdit} className="text-slate-500">✕</button>
            </div>
            <form onSubmit={saveTeacherEdit} className="grid gap-3">
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm mb-1">Name</label>
                  <input className="w-full border rounded p-2" value={tEdit.data.name||''} onChange={e=>setTEdit(s=>({...s, data:{...s.data, name:e.target.value}}))} />
                </div>
                <div>
                  <label className="block text-sm mb-1">Email</label>
                  <input type="email" className="w-full border rounded p-2" value={tEdit.data.email||''} onChange={e=>setTEdit(s=>({...s, data:{...s.data, email:e.target.value}}))} />
                </div>
                <div>
                  <label className="block text-sm mb-1">Phone</label>
                  <input className="w-full border rounded p-2" value={tEdit.data.phone||''} onChange={e=>setTEdit(s=>({...s, data:{...s.data, phone:e.target.value}}))} />
                </div>
                <div>
                  <label className="block text-sm mb-1">Employee ID</label>
                  <input className="w-full border rounded p-2" value={tEdit.data.employeeId||''} onChange={e=>setTEdit(s=>({...s, data:{...s.data, employeeId:e.target.value}}))} />
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm mb-1">Department</label>
                  <input className="w-full border rounded p-2" value={tEdit.data.department||''} onChange={e=>setTEdit(s=>({...s, data:{...s.data, department:e.target.value}}))} />
                </div>
                <div>
                  <label className="block text-sm mb-1">Designation</label>
                  <input className="w-full border rounded p-2" value={tEdit.data.designation||''} onChange={e=>setTEdit(s=>({...s, data:{...s.data, designation:e.target.value}}))} />
                </div>
                <div>
                  <label className="block text-sm mb-1">Role</label>
                  <select className="w-full border rounded p-2" value={tEdit.data.role||'Teacher'} onChange={e=>setTEdit(s=>({...s, data:{...s.data, role:e.target.value}}))}>
                    {['Teacher','Mentor','Coordinator','HOD','Principal','Vice Principal'].map(r=> <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-1">Status</label>
                  <select className="w-full border rounded p-2" value={tEdit.data.status||'Active'} onChange={e=>setTEdit(s=>({...s, data:{...s.data, status:e.target.value}}))}>
                    {['Active','Inactive','On Leave','Retired'].map(s=> <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm mb-1">Subjects (comma separated)</label>
                  <input className="w-full border rounded p-2" value={tEdit.data.subjects||''} onChange={e=>setTEdit(s=>({...s, data:{...s.data, subjects:e.target.value}}))} />
                </div>
                <div>
                  <label className="block text-sm mb-1">Classes (comma separated)</label>
                  <input className="w-full border rounded p-2" value={tEdit.data.classes||''} onChange={e=>setTEdit(s=>({...s, data:{...s.data, classes:e.target.value}}))} />
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm mb-1">Mentor Username (optional)</label>
                  <input className="w-full border rounded p-2" value={tEdit.data.auth?.username||''} onChange={e=>setTEdit(s=>({...s, data:{...s.data, auth:{ ...(s.data.auth||{}), username:e.target.value }}}))} />
                  <div className="text-xs opacity-70 mt-1">Unique per school. Used for mentor login.</div>
                </div>
                <div>
                  <label className="block text-sm mb-1">Set/Reset Password (optional)</label>
                  <div className="flex gap-2">
                    <input type={showEditPwd ? 'text' : 'password'} className="w-full border rounded p-2" value={tEdit.data.password||''} onChange={e=>setTEdit(s=>({...s, data:{...s.data, password:e.target.value}}))} />
                    <button type="button" onClick={()=>setShowEditPwd(v=>!v)} className="px-2 rounded bg-slate-200 text-slate-800 whitespace-nowrap">{showEditPwd? 'Hide' : 'Show'}</button>
                  </div>
                  <div className="text-xs opacity-70 mt-1">Leave blank to keep unchanged.</div>
                </div>
              </div>
              <div>
                <label className="block text-sm mb-1">Mentorship Areas (comma separated)</label>
                <input className="w-full border rounded p-2" value={tEdit.data.mentorshipAreas||''} onChange={e=>setTEdit(s=>({...s, data:{...s.data, mentorshipAreas:e.target.value}}))} />
              </div>
              <div className="mt-2 flex justify-end gap-2">
                <button type="button" onClick={closeTeacherEdit} className="px-3 py-2 rounded bg-slate-200">Cancel</button>
                <button type="submit" className="px-3 py-2 rounded bg-indigo-600 text-white">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {tAdd.open && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-5 w-full max-w-xl text-slate-800">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold">Add Mentor</h3>
              <button onClick={()=>{ setTAdd({ open:false, data:{ name:'', email:'', phone:'', employeeId:'', department:'', designation:'', role:'Mentor', status:'Active', subjects:'', classes:'', mentorshipAreas:'', auth:{username:''}, password:'' }}); setShowAddPwd(false); }} className="text-slate-500">✕</button>
            </div>
            <form onSubmit={async (e)=>{
              e.preventDefault();
              const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
              const payload = {
                ...tAdd.data,
                subjects: tAdd.data.subjects?.split(',').map(s=>s.trim()).filter(Boolean) || [],
                classes: tAdd.data.classes?.split(',').map(s=>s.trim()).filter(Boolean) || [],
                mentorshipAreas: tAdd.data.mentorshipAreas?.split(',').map(s=>s.trim()).filter(Boolean) || [],
              };
              if (payload.role === 'Mentor') {
                const hasU = payload?.auth?.username && payload.auth.username.trim().length > 0;
                const hasP = payload?.password && payload.password.trim().length > 0;
                if (!hasU || !hasP) { alert('Mentor login requires both username and password'); return; }
              }
              const res = await fetch(`${API}/school/teachers`, { method:'POST', headers, body: JSON.stringify(payload) });
              const data = await res.json().catch(()=>({}));
              if (!res.ok) { alert(data?.message || 'Failed to add'); return; }
              setTAdd({ open:false, data:{ name:'', email:'', phone:'', employeeId:'', department:'', designation:'', role:'Mentor', status:'Active', subjects:'', classes:'', mentorshipAreas:'', auth:{username:''}, password:'' } });
              setShowAddPwd(false);
              await fetchMentors();
            }} className="grid gap-3">
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm mb-1">Name</label>
                  <input className="w-full border rounded p-2" value={tAdd.data.name} onChange={e=>setTAdd(s=>({ ...s, data:{ ...s.data, name:e.target.value }}))} />
                </div>
                <div>
                  <label className="block text-sm mb-1">Email</label>
                  <input type="email" className="w-full border rounded p-2" value={tAdd.data.email} onChange={e=>setTAdd(s=>({ ...s, data:{ ...s.data, email:e.target.value }}))} />
                </div>
                <div>
                  <label className="block text-sm mb-1">Phone</label>
                  <input className="w-full border rounded p-2" value={tAdd.data.phone} onChange={e=>setTAdd(s=>({ ...s, data:{ ...s.data, phone:e.target.value }}))} />
                </div>
                <div>
                  <label className="block text-sm mb-1">Employee ID</label>
                  <input className="w-full border rounded p-2" value={tAdd.data.employeeId} onChange={e=>setTAdd(s=>({ ...s, data:{ ...s.data, employeeId:e.target.value }}))} />
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm mb-1">Department</label>
                  <input className="w-full border rounded p-2" value={tAdd.data.department} onChange={e=>setTAdd(s=>({ ...s, data:{ ...s.data, department:e.target.value }}))} />
                </div>
                <div>
                  <label className="block text-sm mb-1">Designation</label>
                  <input className="w-full border rounded p-2" value={tAdd.data.designation} onChange={e=>setTAdd(s=>({ ...s, data:{ ...s.data, designation:e.target.value }}))} />
                </div>
                {/* Role fixed to Mentor per requirement */}
                <div>
                  <label className="block text-sm mb-1">Status</label>
                  <select className="w-full border rounded p-2" value={tAdd.data.status} onChange={e=>setTAdd(s=>({ ...s, data:{ ...s.data, status:e.target.value }}))}>
                    {['Active','Inactive','On Leave','Retired'].map(s=> <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm mb-1">Subjects (comma separated)</label>
                  <input className="w-full border rounded p-2" value={tAdd.data.subjects} onChange={e=>setTAdd(s=>({ ...s, data:{ ...s.data, subjects:e.target.value }}))} />
                </div>
                <div>
                  <label className="block text-sm mb-1">Classes (comma separated)</label>
                  <input className="w-full border rounded p-2" value={tAdd.data.classes} onChange={e=>setTAdd(s=>({ ...s, data:{ ...s.data, classes:e.target.value }}))} />
                </div>
              </div>
              <div>
                <label className="block text-sm mb-1">Mentorship Areas (comma separated)</label>
                <input className="w-full border rounded p-2" value={tAdd.data.mentorshipAreas} onChange={e=>setTAdd(s=>({ ...s, data:{ ...s.data, mentorshipAreas:e.target.value }}))} />
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm mb-1">Mentor Username {tAdd.data.role==='Mentor' && <span className="text-red-500">*</span>}</label>
                  <input required={tAdd.data.role==='Mentor'} className="w-full border rounded p-2" value={tAdd.data.auth?.username||''} onChange={e=>setTAdd(s=>({ ...s, data:{ ...s.data, auth:{ ...(s.data.auth||{}), username:e.target.value } }}))} />
                  <div className="text-xs opacity-70 mt-1">Unique within your school. Used for mentor login.</div>
                </div>
                <div>
                  <label className="block text-sm mb-1">Initial Password {tAdd.data.role==='Mentor' && <span className="text-red-500">*</span>}</label>
                  <div className="flex gap-2">
                    <input required={tAdd.data.role==='Mentor'} type={showAddPwd? 'text' : 'password'} className="w-full border rounded p-2" value={tAdd.data.password||''} onChange={e=>setTAdd(s=>({ ...s, data:{ ...s.data, password:e.target.value }}))} />
                    <button type="button" onClick={()=>setShowAddPwd(v=>!v)} className="px-2 rounded bg-slate-200 text-slate-800 whitespace-nowrap">{showAddPwd? 'Hide' : 'Show'}</button>
                  </div>
                  <div className="text-xs opacity-70 mt-1">You can reset later from Edit.</div>
                </div>
              </div>
              <div className="mt-2 flex justify-end gap-2">
                <button type="button" onClick={()=>{ setTAdd({ open:false, data:{ name:'', email:'', phone:'', employeeId:'', department:'', designation:'', role:'Mentor', status:'Active', subjects:'', classes:'', mentorshipAreas:'', auth:{username:''}, password:'' } }); setShowAddPwd(false); }} className="px-3 py-2 rounded bg-slate-200">Cancel</button>
                <button type="submit" className="px-3 py-2 rounded bg-indigo-600 text-white">Add</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
