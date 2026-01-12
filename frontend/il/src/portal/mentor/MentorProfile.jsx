import React, { useEffect, useMemo, useState } from "react";
import GlassCard from "../../components/ui/GlassCard";
import ThemeProvider from "../../components/ui/ThemeProvider";
import MentorTopBar from "../../components/mentor/MentorTopBar";
import MentorBottomNav from "../../components/nav/MentorBottomNav";

export default function MentorProfile() {
  const token = useMemo(() => (typeof window !== 'undefined' ? localStorage.getItem('mentor_token') : null), []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [me, setMe] = useState({ name: "", email: "", department: "", designation: "", role: "" });

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    (async () => {
      try {
        setLoading(true); setError("");
        const base = import.meta.env?.VITE_API_BASE_URL || 'http://localhost:5000/api';
        const r = await fetch(`${base}/mentor/me`, { headers: { Authorization: `Bearer ${token}` } });
        const d = await r.json();
        if (!r.ok) throw new Error(d?.message || 'Failed to load profile');
        const m = d?.mentor || {};
        setMe({
          name: m.name || '',
          email: m.email || '',
          department: m.department || '',
          designation: m.designation || '',
          role: m.role || ''
        });
      } catch (e) {
        setError(e.message || 'Error');
      } finally { setLoading(false); }
    })();
  }, [token]);

  if (!token) return <div className="min-h-screen flex items-center justify-center text-white">Login required.</div>;

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-gradient-to-br from-[#b085f5] via-[#8e49c2] to-[#6a1b9a]">
        <div className="min-h-screen w-full relative text-white/90">
          <div className="relative z-10">
            <MentorTopBar />
            <div className="px-4 pt-4 pb-24 mx-auto max-w-4xl">
              <h1 className="text-3xl font-bold tracking-tight mb-6">Mentor Profile</h1>
              {loading && <GlassCard className="p-4 mb-4">Loading…</GlassCard>}
              {error && !loading && <GlassCard className="p-4 mb-4 text-red-200">{error}</GlassCard>}
              {!loading && !error && (
                <GlassCard className="p-6 space-y-4">
                  <Field label="Name" value={me.name} />
                  <Field label="Email" value={me.email} />
                  <Field label="Role" value={me.role || me.designation} />
                  <Field label="Department" value={me.department} />
                  <Field label="Designation" value={me.designation} />
                </GlassCard>
              )}
            </div>
            <MentorBottomNav />
          </div>
        </div>
      </div>
    </ThemeProvider>
  );
}

function Field({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex flex-col">
      <div className="text-xs uppercase tracking-wide text-white/60">{label}</div>
      <div className="mt-0.5 font-medium text-white/90">{value}</div>
    </div>
  );
}
