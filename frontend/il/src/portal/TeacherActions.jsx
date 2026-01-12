import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

const API = import.meta.env?.VITE_API_BASE_URL || "http://localhost:5000/api";

export default function TeacherActions() {
  const { id } = useParams();
  const navigate = useNavigate();
  const token = useMemo(() => (typeof window !== 'undefined' ? localStorage.getItem('adm_token') : ''), []);
  const [t, setT] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // page sections
  const [activeTab, setActiveTab] = useState('credentials'); // 'credentials' | 'payment' | 'attendance' | 'verification' | 'timetable'
  // Credentials state
  const [cred, setCred] = useState({ username:'', changedAt:null, showReset:false, showCurrent:false, newPassword:'', saving:false, msg:'' });
  // Payment state
  const [pay, setPay] = useState({ amount: 0, method: 'Cash', receiptNo: '', notes: '', month: new Date().getMonth()+1, year: new Date().getFullYear(), date: new Date().toISOString().slice(0,10), saving:false, msg:'' });
  // Attendance state
  const [att, setAtt] = useState({ summary:null, loading:false, month: new Date().getMonth()+1, year: new Date().getFullYear(), msg:'' });
  // Verification state
  const [ver, setVer] = useState({ verified:false, notes:'', saving:false, msg:'' });
  // Timetable state
  const [tt, setTt] = useState({ classCode:'', entries:[], loading:false, msg:'', editing:null, add:{ dayOfWeek:1, period:'P1', subject:'', room:'' }, selected:[] });

  useEffect(() => { load(); }, [id]);

  async function load() {
    try {
      setLoading(true); setError('');
      const r = await fetch(`${API}/school/teachers/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.message || 'Failed to load teacher');
      setT(d.teacher);
      setCred(s => ({ ...s, username: d.teacher?.auth?.username || '', changedAt: d.teacher?.passwordChangedAt || null }));
      setVer(s => ({ ...s, verified: !!d.teacher?.backgroundVerified }));
      await loadAttSummary(d.teacher?._id || id, att.year, att.month);
    } catch (e) {
      setError(e.message || 'Error');
    } finally { setLoading(false); }
  }

  async function saveCred(e){
    e.preventDefault();
    setCred(s=>({ ...s, msg:'', saving:true }));
    try {
      if (!cred.newPassword || cred.newPassword.length < 6) throw new Error('Enter a new password (min 6 chars)');
      const r = await fetch(`${API}/school/teachers/${id}/`, { method:'PUT', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body: JSON.stringify({ password: cred.newPassword }) });
      const d = await r.json().catch(()=>({}));
      if (!r.ok) throw new Error(d?.message || 'Failed to reset password');
      setCred(s=>({ ...s, newPassword:'', saving:false, msg:'Password updated' }));
      await load();
    } catch (e) {
      setCred(s=>({ ...s, saving:false, msg: e.message || 'Failed' }));
    }
  }

  async function savePayment(e){
    e.preventDefault();
    setPay(s=>({ ...s, msg:'', saving:true }));
    try {
      const payload = { ...pay, amount: Number(pay.amount||0) };
      const r = await fetch(`${API}/school/teachers/${id}/payments`, { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body: JSON.stringify(payload) });
      const d = await r.json().catch(()=>({}));
      if (!r.ok) throw new Error(d?.message || 'Failed to record payment');
      setPay(s=>({ ...s, saving:false, msg:'Payment recorded' }));
      await load();
    } catch (e) {
      setPay(s=>({ ...s, saving:false, msg: e.message || 'Failed' }));
    }
  }

  async function loadAttSummary(tid, year, month){
    try{
      setAtt(s=>({ ...s, loading:true, msg:'' }));
      const r = await fetch(`${API}/school/teachers/${tid}/attendance-summary?year=${year}&month=${month}`, { headers:{ Authorization:`Bearer ${token}` } });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.message || 'Failed to load attendance');
      setAtt(s=>({ ...s, summary: d.summary, year: d.year, month: d.month, loading:false }));
    } catch(e){
      setAtt(s=>({ ...s, loading:false, msg: e.message || 'Failed' }));
    }
  }

  async function recordAttendance(status){
    try{
      const r = await fetch(`${API}/school/teachers/${id}/attendance`, { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body: JSON.stringify({ date: new Date().toISOString().slice(0,10), status }) });
      if (r.ok) await loadAttSummary(id, att.year, att.month);
    } catch(_){}
  }

  async function saveVerification(e){
    e.preventDefault();
    setVer(s=>({ ...s, msg:'', saving:true }));
    try{
      const r = await fetch(`${API}/school/teachers/${id}/background-verify`, { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body: JSON.stringify({ verified: ver.verified, notes: ver.notes }) });
      const d = await r.json().catch(()=>({}));
      if (!r.ok) throw new Error(d?.message || 'Failed to update verification');
      setVer(s=>({ ...s, saving:false, msg:'Updated' }));
      await load();
    } catch(e){
      setVer(s=>({ ...s, saving:false, msg: e.message || 'Failed' }));
    }
  }

  function goTimetable(){
    // Navigate back to institution hub and signal opening timetable step
    navigate(`/institution?openTimetableFor=${encodeURIComponent(id)}`);
  }

  // ------- Timetable helpers (School Admin scoped) -------
  const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const PERIODS = ['P1','P2','P3','P4','P5','P6','P7','P8'];

  useEffect(()=>{
    // Set default class code from teacher data on load
    if (t && !tt.classCode) {
      const firstClass = Array.isArray(t.classes) && t.classes.length ? t.classes[0] : '';
      setTt(s=>({ ...s, classCode: firstClass || '' }));
      if (firstClass) loadTimetable(firstClass);
    }
  },[t]);

  async function loadTimetable(classCode){
    if (!classCode) return;
    try{
      setTt(s=>({ ...s, loading:true, msg:'' }));
      const r = await fetch(`${API}/school/timetable/${encodeURIComponent(classCode)}`, { headers:{ Authorization:`Bearer ${token}` } });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.message || 'Failed to load timetable');
      const entries = Array.isArray(d.entries) ? d.entries : [];
      setTt(s=>({ ...s, entries, loading:false }));
    }catch(e){
      setTt(s=>({ ...s, loading:false, msg: e.message || 'Failed' }));
    }
  }

  function hasOverlap(dayOfWeek, period){
    return tt.entries.some(e=> Number(e.dayOfWeek)===Number(dayOfWeek) && String(e.period)===String(period));
  }

  async function addTimetableEntry(){
    try{
      const { dayOfWeek, period, subject, room } = tt.add;
      if (!tt.classCode) throw new Error('Select class');
      if (!subject || !period) throw new Error('Subject and period required');
      if (hasOverlap(dayOfWeek, period)) throw new Error('Overlap: period already exists for this day');
      const payload = { dayOfWeek, period, subject, room, teacher: id };
      const r = await fetch(`${API}/school/timetable/${encodeURIComponent(tt.classCode)}/entry`, { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body: JSON.stringify(payload) });
      const d = await r.json().catch(()=>({}));
      if (!r.ok) throw new Error(d?.message || 'Failed to add slot');
      setTt(s=>({ ...s, msg:'Added', add:{ ...s.add, subject:'', room:'' } }));
      await loadTimetable(tt.classCode);
    }catch(e){
      setTt(s=>({ ...s, msg: e.message || 'Failed' }));
    }
  }

  async function saveEdit(entry){
    try{
      if (!tt.classCode) return;
      // Validate overlap if day/period changed
      const changedDay = entry.dayOfWeek;
      const changedPeriod = entry.period;
      const other = tt.entries.filter(e=> String(e._id)!==String(entry._id));
      if (other.some(e=> Number(e.dayOfWeek)===Number(changedDay) && String(e.period)===String(changedPeriod))) {
        throw new Error('Overlap with existing slot');
      }
      const r = await fetch(`${API}/school/timetable/${encodeURIComponent(tt.classCode)}/entry/${entry._id}`, { method:'PATCH', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body: JSON.stringify({ dayOfWeek: entry.dayOfWeek, period: entry.period, subject: entry.subject, room: entry.room, teacher: id, notes: entry.notes||'' }) });
      const d = await r.json().catch(()=>({}));
      if (!r.ok) throw new Error(d?.message || 'Failed to save');
      setTt(s=>({ ...s, editing:null, msg:'Saved' }));
      await loadTimetable(tt.classCode);
    }catch(e){
      setTt(s=>({ ...s, msg: e.message || 'Failed' }));
    }
  }

  async function deleteSelected(){
    try{
      for(const entryId of tt.selected){
        await fetch(`${API}/school/timetable/${encodeURIComponent(tt.classCode)}/entry/${entryId}`, { method:'DELETE', headers:{ Authorization:`Bearer ${token}` } });
      }
      setTt(s=>({ ...s, selected:[], msg:'Deleted' }));
      await loadTimetable(tt.classCode);
    }catch(e){
      setTt(s=>({ ...s, msg: e.message || 'Failed' }));
    }
  }

  return (
    <div className="min-h-screen scenic-bg text-white p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold">Teacher Actions</h1>
          <button onClick={()=>navigate('/institution')} className="px-3 py-2 rounded bg-white/10">Back to Institution</button>
        </div>
        {loading && <div className="glass-card p-4 rounded-lg">Loading…</div>}
        {error && !loading && <div className="glass-card p-4 rounded-lg text-red-200">{error}</div>}
        {t && (
          <div className="space-y-6">
            <div className="grid md:grid-cols-3 gap-3">
              <div className="glass-card p-4 rounded-lg">
                <div className="text-sm text-white/70">Name</div>
                <div className="font-medium">{t.name}</div>
                <div className="text-sm text-white/70 mt-2">Department</div>
                <div className="font-medium">{t.department}</div>
              </div>
              <div className="glass-card p-4 rounded-lg">
                <div className="text-sm text-white/70">Login Username</div>
                <div className="font-medium">{cred.username || '-'}</div>
                <div className="text-sm text-white/70 mt-2">Password Changed</div>
                <div className="font-medium">{cred.changedAt ? String(cred.changedAt).slice(0,10) : '-'}</div>
              </div>
              <div className="glass-card p-4 rounded-lg">
                <div className="text-sm text-white/70">Salary Status</div>
                <div className="font-medium">{t.salary?.status || 'Pending'}</div>
                <div className="text-sm text-white/70 mt-2">Monthly</div>
                <div className="font-medium">₹{Number(t.salary?.monthlySalary||0)}</div>
              </div>
            </div>
            {/* Tabs */}
            <div className="flex items-center gap-2">
              {[
                {key:'credentials', label:'Credentials'},
                {key:'payment', label:'Make Payment'},
                {key:'attendance', label:'Attendance'},
                {key:'verification', label:'Verification'},
                {key:'timetable', label:'Timetable'}
              ].map(tab => (
                <button key={tab.key} onClick={()=>setActiveTab(tab.key)} className={`px-3 py-2 rounded border ${activeTab===tab.key? 'bg-white/20' : 'bg-white/10'}`}>{tab.label}</button>
              ))}
            </div>

            {activeTab==='credentials' && (
              <div className="rounded-xl border border-white/15 bg-white/10 p-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-medium">Credentials</h2>
                  <div className="text-xs text-white/70">Current password: <button type="button" className="underline" onClick={()=>setCred(s=>({ ...s, showCurrent: !s.showCurrent }))}>{cred.showCurrent ? 'Hide' : 'Show'}</button></div>
                </div>
                <div className="mt-2 text-sm">
                  {cred.showCurrent ? <span>Not retrievable (hashed; cannot display)</span> : <span>••••••••</span>}
                </div>
                <form onSubmit={saveCred} className="mt-3">
                  <label className="block text-xs mb-1">Reset Password</label>
                  <div className="relative">
                    <input type={cred.showReset ? 'text' : 'password'} className="w-full bg-white/10 border border-white/20 rounded px-2 py-2 pr-10" value={cred.newPassword} onChange={e=>setCred(s=>({ ...s, newPassword: e.target.value }))} />
                    <button type="button" onClick={()=>setCred(s=>({ ...s, showReset: !s.showReset }))} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-white/80">{cred.showReset ? 'Hide' : 'Show'}</button>
                  </div>
                  {cred.msg && <div className="text-xs mt-2 text-emerald-300">{cred.msg}</div>}
                  <div className="flex items-center justify-end mt-3">
                    <button type="submit" disabled={cred.saving} className="px-3 py-2 rounded bg-indigo-600">{cred.saving ? 'Saving…' : 'Save'}</button>
                  </div>
                </form>
              </div>
            )}

            {activeTab==='payment' && (
              <div className="rounded-xl border border-white/15 bg-white/10 p-4">
                <h2 className="font-medium mb-2">Make Payment</h2>
                <form onSubmit={savePayment} className="grid md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs mb-1">Amount (₹)</label>
                    <input type="number" className="w-full bg-white/10 border border-white/20 rounded px-2 py-2" value={pay.amount} onChange={e=>setPay(s=>({ ...s, amount: Number(e.target.value)||0 }))} />
                  </div>
                  <div>
                    <label className="block text-xs mb-1">Method</label>
                    <select className="w-full bg-white/10 border border-white/20 rounded px-2 py-2" value={pay.method} onChange={e=>setPay(s=>({ ...s, method: e.target.value }))}>
                      {['Cash','UPI','Bank','Cheque','Other'].map(m=> <option className="text-black" key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs mb-1">Receipt No</label>
                    <input className="w-full bg-white/10 border border-white/20 rounded px-2 py-2" value={pay.receiptNo} onChange={e=>setPay(s=>({ ...s, receiptNo: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs mb-1">Date</label>
                    <input type="date" className="w-full bg-white/10 border border-white/20 rounded px-2 py-2" value={pay.date||''} onChange={e=>setPay(s=>({ ...s, date: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs mb-1">Month</label>
                    <input type="number" min={1} max={12} className="w-full bg-white/10 border border-white/20 rounded px-2 py-2" value={pay.month} onChange={e=>setPay(s=>({ ...s, month: Number(e.target.value)||1 }))} />
                  </div>
                  <div>
                    <label className="block text-xs mb-1">Year</label>
                    <input type="number" className="w-full bg-white/10 border border-white/20 rounded px-2 py-2" value={pay.year} onChange={e=>setPay(s=>({ ...s, year: Number(e.target.value)||new Date().getFullYear() }))} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs mb-1">Notes</label>
                    <textarea rows={3} className="w-full bg-white/10 border border-white/20 rounded px-2 py-2" value={pay.notes} onChange={e=>setPay(s=>({ ...s, notes: e.target.value }))} />
                  </div>
                  {pay.msg && <div className="md:col-span-2 text-xs text-emerald-300">{pay.msg}</div>}
                  <div className="md:col-span-2 flex items-center justify-end">
                    <button type="submit" disabled={pay.saving} className="px-3 py-2 rounded bg-indigo-600">{pay.saving ? 'Saving…' : 'Save Payment'}</button>
                  </div>
                </form>
              </div>
            )}

            {activeTab==='attendance' && (
              <div className="rounded-xl border border-white/15 bg-white/10 p-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-medium">Attendance</h2>
                  {att.loading && <span className="text-xs text-white/80">Loading…</span>}
                </div>
                <div className="flex items-center gap-2 mt-2 text-sm">
                  <label>Month</label>
                  <input type="number" min={1} max={12} className="bg-white/10 border border-white/20 rounded px-2 py-1" value={att.month} onChange={e=>loadAttSummary(id, att.year, Number(e.target.value)||att.month)} />
                  <label>Year</label>
                  <input type="number" className="bg-white/10 border border-white/20 rounded px-2 py-1" value={att.year} onChange={e=>loadAttSummary(id, Number(e.target.value)||att.year, att.month)} />
                  <div className="ml-auto space-x-2">
                    <button onClick={()=>recordAttendance('Present')} className="px-2 py-1 rounded bg-white/20">Mark Present</button>
                    <button onClick={()=>recordAttendance('Absent')} className="px-2 py-1 rounded bg-white/20">Mark Absent</button>
                  </div>
                </div>
                {att.summary ? (
                  <div className="grid grid-cols-4 gap-3 mt-3">
                    {['Present','Absent','Late','Excused'].map(k=> (
                      <div key={k} className="rounded-xl border border-white/15 bg-white/10 p-4 text-center">
                        <div className="text-2xl font-semibold">{att.summary[k]||0}</div>
                        <div className="text-xs text-white/80 mt-1">{k}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-white/80 mt-3">No attendance yet.</div>
                )}
              </div>
            )}

            {activeTab==='verification' && (
              <div className="rounded-xl border border-white/15 bg-white/10 p-4">
                <h2 className="font-medium">Verification</h2>
                <form onSubmit={saveVerification} className="space-y-2 mt-2">
                  <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={ver.verified} onChange={e=>setVer(s=>({ ...s, verified: e.target.checked }))} /> Verified</label>
                  <div>
                    <label className="block text-xs mb-1">Notes</label>
                    <textarea rows={3} className="w-full bg-white/10 border border-white/20 rounded px-2 py-2" value={ver.notes} onChange={e=>setVer(s=>({ ...s, notes: e.target.value }))} />
                  </div>
                  {ver.msg && <div className="text-xs text-emerald-300">{ver.msg}</div>}
                  <div className="flex items-center justify-end">
                    <button type="submit" disabled={ver.saving} className="px-3 py-2 rounded bg-indigo-600">{ver.saving ? 'Saving…' : 'Save'}</button>
                  </div>
                </form>
              </div>
            )}

            {activeTab==='timetable' && (
              <div className="rounded-xl border border-white/15 bg-white/10 p-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-medium">Timetable</h2>
                  <button onClick={goTimetable} className="px-3 py-2 rounded bg-white/10">Open in Institution</button>
                </div>
                <div className="text-sm text-white/70 mt-2">Manage periods and slots for this teacher here. Select a class and add/edit slots. Delete selected at bottom.</div>

                {/* Class selector */}
                <div className="flex items-center gap-2 mt-3">
                  <label className="text-xs">Class</label>
                  <select className="bg-white/10 border border-white/20 rounded px-2 py-2"
                          value={tt.classCode}
                          onChange={e=>{ const v=e.target.value; setTt(s=>({ ...s, classCode: v })); loadTimetable(v); }}>
                    <option className="text-black" value="">Select class</option>
                    {(Array.isArray(t.classes)? t.classes: []).map(cc => (
                      <option className="text-black" key={cc} value={cc}>{cc}</option>
                    ))}
                  </select>
                  {!tt.classCode && <span className="text-xs text-red-200">Pick a class to edit</span>}
                </div>

                {/* Add slot */}
                <div className="rounded-lg bg-white/5 border border-white/10 mt-4 p-3">
                  <div className="text-sm font-medium mb-2">Add Slot</div>
                  <div className="grid md:grid-cols-5 gap-2">
                    <div>
                      <label className="block text-xs mb-1">Day</label>
                      <select className="w-full bg-white/10 border border-white/20 rounded px-2 py-2" value={tt.add.dayOfWeek} onChange={e=>setTt(s=>({ ...s, add:{ ...s.add, dayOfWeek: Number(e.target.value) } }))}>
                        {DAY_LABELS.map((d,i)=>(<option className="text-black" key={i} value={i}>{d}</option>))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs mb-1">Period</label>
                      <select className="w-full bg-white/10 border border-white/20 rounded px-2 py-2" value={tt.add.period} onChange={e=>setTt(s=>({ ...s, add:{ ...s.add, period: e.target.value } }))}>
                        {PERIODS.map(p=>(<option className="text-black" key={p} value={p}>{p}</option>))}
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs mb-1">Subject</label>
                      <input className="w-full bg-white/10 border border-white/20 rounded px-2 py-2" value={tt.add.subject} onChange={e=>setTt(s=>({ ...s, add:{ ...s.add, subject: e.target.value } }))} />
                    </div>
                    <div>
                      <label className="block text-xs mb-1">Room</label>
                      <input className="w-full bg-white/10 border border-white/20 rounded px-2 py-2" value={tt.add.room} onChange={e=>setTt(s=>({ ...s, add:{ ...s.add, room: e.target.value } }))} />
                    </div>
                    <div className="md:col-span-5 flex items-center justify-end">
                      <button onClick={addTimetableEntry} disabled={!tt.classCode} className="px-3 py-2 rounded bg-indigo-600">Add</button>
                    </div>
                  </div>
                  {tt.msg && <div className="text-xs mt-2 text-emerald-300">{tt.msg}</div>}
                </div>

                {/* Existing entries list for this teacher */}
                <div className="mt-4">
                  {tt.loading ? (
                    <div className="text-sm">Loading timetable…</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left">
                            <th className="py-2">Select</th>
                            <th className="py-2">Day</th>
                            <th className="py-2">Period</th>
                            <th className="py-2">Subject</th>
                            <th className="py-2">Room</th>
                            <th className="py-2">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tt.entries
                            .filter(e=> String(e.teacher||id)===String(id))
                            .sort((a,b)=> (a.dayOfWeek-b.dayOfWeek) || String(a.period).localeCompare(String(b.period)))
                            .map(e => (
                              <tr key={e._id} className="border-t border-white/10">
                                <td className="py-2">
                                  <input type="checkbox" checked={tt.selected.includes(e._id)} onChange={ev=>{
                                    const checked = ev.target.checked; const idd = e._id;
                                    setTt(s=>({ ...s, selected: checked ? [...s.selected, idd] : s.selected.filter(x=>String(x)!==String(idd)) }));
                                  }} />
                                </td>
                                <td className="py-2">
                                  {tt.editing===e._id ? (
                                    <select className="bg-white/10 border border-white/20 rounded px-2 py-1" value={e.dayOfWeek} onChange={ev=>{ const v=Number(ev.target.value); setTt(s=>({ ...s, entries: s.entries.map(x=>x._id===e._id? { ...x, dayOfWeek:v }: x) })) }}>
                                      {DAY_LABELS.map((d,i)=>(<option className="text-black" key={i} value={i}>{d}</option>))}
                                    </select>
                                  ) : (
                                    <span>{DAY_LABELS[e.dayOfWeek||0]}</span>
                                  )}
                                </td>
                                <td className="py-2">
                                  {tt.editing===e._id ? (
                                    <select className="bg-white/10 border border-white/20 rounded px-2 py-1" value={e.period} onChange={ev=>{ const v=ev.target.value; setTt(s=>({ ...s, entries: s.entries.map(x=>x._id===e._id? { ...x, period:v }: x) })) }}>
                                      {PERIODS.map(p=>(<option className="text-black" key={p} value={p}>{p}</option>))}
                                    </select>
                                  ) : (
                                    <span>{e.period}</span>
                                  )}
                                </td>
                                <td className="py-2">
                                  {tt.editing===e._id ? (
                                    <input className="bg-white/10 border border-white/20 rounded px-2 py-1" value={e.subject||''} onChange={ev=>{ const v=ev.target.value; setTt(s=>({ ...s, entries: s.entries.map(x=>x._id===e._id? { ...x, subject:v }: x) })) }} />
                                  ) : (
                                    <span>{e.subject}</span>
                                  )}
                                </td>
                                <td className="py-2">
                                  {tt.editing===e._id ? (
                                    <input className="bg-white/10 border border-white/20 rounded px-2 py-1" value={e.room||''} onChange={ev=>{ const v=ev.target.value; setTt(s=>({ ...s, entries: s.entries.map(x=>x._id===e._id? { ...x, room:v }: x) })) }} />
                                  ) : (
                                    <span>{e.room||'-'}</span>
                                  )}
                                </td>
                                <td className="py-2">
                                  {tt.editing===e._id ? (
                                    <div className="space-x-2">
                                      <button onClick={()=>saveEdit(e)} className="px-2 py-1 rounded bg-emerald-600">Done</button>
                                      <button onClick={()=>setTt(s=>({ ...s, editing:null }))} className="px-2 py-1 rounded bg-white/20">Cancel</button>
                                    </div>
                                  ) : (
                                    <button onClick={()=>setTt(s=>({ ...s, editing:e._id }))} className="px-2 py-1 rounded bg-white/20">Edit</button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          {tt.entries.filter(e=> String(e.teacher||id)===String(id)).length===0 && (
                            <tr><td colSpan={6} className="py-3 text-center text-white/70">No slots for this teacher</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Bottom actions */}
                <div className="flex items-center justify-between mt-3">
                  <div className="text-xs text-white/70">Select rows to delete. Overlap prevention is enforced on add/edit.</div>
                  <button onClick={deleteSelected} disabled={!tt.selected.length} className="px-3 py-2 rounded bg-rose-600">Delete Selected</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
