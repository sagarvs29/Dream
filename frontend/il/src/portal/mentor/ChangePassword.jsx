import React, { useMemo, useState } from "react";
import ThemeProvider from "../../components/ui/ThemeProvider";
import MentorTopBar from "../../components/mentor/MentorTopBar";
import MentorBottomNav from "../../components/nav/MentorBottomNav";

export default function MentorChangePassword() {
  const token = useMemo(() => (typeof window !== 'undefined' ? localStorage.getItem('mentor_token') : null), []);
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!form.currentPassword || !form.newPassword) {
      setError('Please fill all fields');
      return;
    }
    if (form.newPassword !== form.confirm) {
      setError('New password and confirm do not match');
      return;
    }
    try {
      setLoading(true);
      const base = import.meta.env?.VITE_API_BASE_URL || 'http://localhost:5000/api';
      const res = await fetch(`${base}/mentor/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword })
      });
      const d = await res.json().catch(()=>({}));
      if (!res.ok) throw new Error(d?.message || 'Failed to change password');
      setSuccess('Password updated successfully');
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (e) {
      setError(e.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  }

  if (!token) return <div className="min-h-screen flex items-center justify-center text-white">Login required.</div>;

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-gradient-to-br from-[#b085f5] via-[#8e49c2] to-[#6a1b9a]">
        <div className="min-h-screen w-full relative text-white/90">
          <div className="relative z-10">
            <MentorTopBar />
            <div className="px-4 pt-4 pb-24 mx-auto max-w-md">
              <h1 className="text-3xl font-bold tracking-tight mb-6">Change Password</h1>
              {error && <div className="mb-4 rounded-lg border border-red-300/40 bg-red-900/30 p-3 text-red-100 text-sm">{error}</div>}
              {success && <div className="mb-4 rounded-lg border border-emerald-300/40 bg-emerald-900/30 p-3 text-emerald-100 text-sm">{success}</div>}
              <form onSubmit={submit} className="rounded-xl border border-white/20 bg-white/10 p-4 space-y-3">
                <div>
                  <label className="block text-xs mb-1">Current Password</label>
                  <input type="password" className="w-full bg-white/10 border border-white/20 rounded px-2 py-2" value={form.currentPassword} onChange={e=>setForm(s=>({ ...s, currentPassword: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs mb-1">New Password</label>
                  <input type="password" className="w-full bg-white/10 border border-white/20 rounded px-2 py-2" value={form.newPassword} onChange={e=>setForm(s=>({ ...s, newPassword: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs mb-1">Confirm New Password</label>
                  <input type="password" className="w-full bg-white/10 border border-white/20 rounded px-2 py-2" value={form.confirm} onChange={e=>setForm(s=>({ ...s, confirm: e.target.value }))} />
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button type="submit" disabled={loading} className="px-4 py-2 rounded-lg bg-white/80 border border-slate-200 hover:bg-white text-slate-800 text-sm">{loading ? 'Updating…' : 'Update Password'}</button>
                </div>
              </form>
            </div>
            <MentorBottomNav />
          </div>
        </div>
      </div>
    </ThemeProvider>
  );
}
