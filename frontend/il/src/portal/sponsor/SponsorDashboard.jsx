import React, { useEffect, useState } from 'react';
import { getApiBase } from '../../config/api';
import { logoutAll } from '../../utils/tokens';

export default function SponsorDashboard() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('SPONSOR_TOKEN') : null;
  const [requests, setRequests] = useState([]);
  const [active, setActive] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        setLoading(true); setError('');
        const h = { Authorization: `Bearer ${token}`, 'Content-Type':'application/json' };
        const API = getApiBase();
        const r1 = await fetch(`${API}/sponsor/requests`, { headers: h });
        const d1 = await r1.json();
        if (r1.ok) setRequests(d1.requests || []); else setError(d1.message || 'Failed to load requests');
        const r2 = await fetch(`${API}/sponsor/sponsorships`, { headers: h });
        const d2 = await r2.json();
        if (r2.ok) setActive(d2.sponsorships || []); else setError(prev=> prev || d2.message || 'Failed to load active');
      } catch (e) {
        setError('Failed to load');
      } finally { setLoading(false); }
    })();
  }, [token]);

  async function updateStatus(id, status) {
    try {
      const h = { Authorization: `Bearer ${token}`, 'Content-Type':'application/json' };
      const API = getApiBase();
      const r = await fetch(`${API}/sponsor/sponsorships/${id}/status`, { method:'PATCH', headers: h, body: JSON.stringify({ status, amount: status==='Active' ? 0 : undefined }) });
      const d = await r.json();
      if (!r.ok) return alert(d.message || 'Update failed');
      setRequests(req => req.filter(x => x._id !== id));
      if (status === 'Active') setActive(a => [d.sponsorship, ...a]);
    } catch { alert('Update failed'); }
  }

  if (!token) return <div className='min-h-screen flex items-center justify-center text-white'>Login required.</div>;
  if (loading) return <div className='min-h-screen flex items-center justify-center text-white'>Loading…</div>;

  return (
    <div className='min-h-screen bg-gradient-to-br from-[#2d2b4f] via-[#3d2d6d] to-[#512f8d] text-white'>
      <div className='max-w-5xl mx-auto px-4 py-8'>
        <div className='flex items-center justify-between mb-6'>
          <h1 className='text-3xl font-bold tracking-tight'>Sponsor Dashboard</h1>
          <button onClick={()=> logoutAll('/') } className='px-4 py-2 rounded-lg bg-white/15 hover:bg-white/25'>Logout</button>
        </div>
        {error && <div className='mb-4 bg-rose-500/20 border border-rose-400/40 text-rose-100 px-4 py-3 rounded-xl'>{error}</div>}

        <section className='mb-10'>
          <h2 className='text-xl font-semibold mb-2 flex items-center gap-2'>
            <span>📨</span><span>Pending Requests</span>
          </h2>
          {requests.length === 0 ? <div className='text-white/70 text-sm'>No pending requests.</div> : (
            <div className='grid md:grid-cols-2 gap-4'>
              {requests.map(r => (
                <div key={r._id} className='rounded-xl backdrop-blur-md bg-white/10 border border-white/20 p-4'>
                  <div className='flex items-center gap-3'>
                    <img src={r.student?.profilePictureUrl || 'https://i.pravatar.cc/60'} alt='' className='h-12 w-12 rounded-full object-cover ring-2 ring-white/30' />
                    <div className='flex-1 min-w-0'>
                      <div className='font-medium truncate'>{r.student?.name}</div>
                      <div className='text-xs text-white/70 truncate'>{r.student?.school?.name || r.student?.school || 'School'}</div>
                    </div>
                  </div>
                  {r.message && <p className='text-sm text-white/80 mt-2'>{r.message}</p>}
                  <div className='mt-3 flex gap-2'>
                    <button onClick={()=>updateStatus(r._id,'Active')} className='px-3 py-1.5 rounded bg-emerald-500/90 hover:bg-emerald-400 text-sm font-medium'>Approve</button>
                    <button onClick={()=>updateStatus(r._id,'Cancelled')} className='px-3 py-1.5 rounded bg-rose-500/80 hover:bg-rose-500 text-sm font-medium'>Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className='text-xl font-semibold mb-2 flex items-center gap-2'><span>🌱</span><span>Active Sponsorships</span></h2>
          {active.length === 0 ? <div className='text-white/70 text-sm'>No active sponsorships yet.</div> : (
            <div className='space-y-3'>
              {active.map(s => (
                <div key={s._id} className='rounded-xl backdrop-blur-md bg-white/10 border border-white/20 p-4 flex items-center gap-4'>
                  <img src={s.student?.profilePictureUrl || 'https://i.pravatar.cc/60'} alt='' className='h-12 w-12 rounded-full object-cover ring-2 ring-white/30' />
                  <div className='flex-1 min-w-0'>
                    <div className='font-medium truncate'>{s.student?.name}</div>
                    <div className='text-xs text-white/70 truncate'>{s.student?.school?.name || s.student?.school || 'School'}</div>
                  </div>
                  <div className='text-sm font-medium'>{s.currency || 'INR'} {Number(s.amount||0).toLocaleString()}</div>
                  <span className='text-xs px-2 py-0.5 rounded-full bg-white/20 border border-white/25'>{s.status}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
