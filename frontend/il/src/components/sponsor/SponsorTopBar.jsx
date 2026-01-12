import React, { useEffect, useMemo, useState } from "react";
import TopBar from "../student/TopBar";
import ProfileModal from "../common/ProfileModal";

export default function SponsorTopBar() {
  const [me, setMe] = useState({ name: "", email: "" });
  const [org, setOrg] = useState({ name: "", tier: "", website: "", description: "", contactEmail: "", contactPhone: "" });
  const token = useMemo(() => (typeof window !== 'undefined' ? localStorage.getItem('SPONSOR_TOKEN') : null), []);
  const cachedName = useMemo(() => (typeof window !== 'undefined' ? localStorage.getItem('sponsor_name') : null), []);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (cachedName && !me.name) setMe((s) => ({ ...s, name: cachedName }));
    if (!token) return;
    (async () => {
      try {
        const base = import.meta.env?.VITE_API_BASE_URL || 'http://localhost:5000/api';
        const r = await fetch(`${base}/sponsor/me`, { headers: { Authorization: `Bearer ${token}` } });
        if (r.ok) {
          const d = await r.json();
          const user = d?.user || {};
          const s = d?.sponsor || {};
          setMe({ name: user.name || cachedName || 'Sponsor', email: user.email || '' });
          setOrg({
            name: s.name || '',
            tier: s.tier || '',
            website: s.website || '',
            description: s.description || '',
            contactEmail: s.contactEmail || '',
            contactPhone: s.contactPhone || '',
          });
        }
      } catch (_) { /* ignore */ }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const initials = (me.name || org.name || 'S')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0,2)
    .toUpperCase();

  function logout() {
    try {
      localStorage.removeItem('SPONSOR_TOKEN');
      localStorage.removeItem('sponsor_name');
    } catch (_) {}
    window.location.href = '/sponsor/login';
  }

  const extraRight = (
    <div className="flex items-center gap-2">
      <div className="hidden sm:block text-right">
        <div className="text-slate-900 font-medium truncate" title={me.name}>{me.name || 'Sponsor'}</div>
        <div className="text-slate-600 text-xs truncate" title={org.name}>
          {org.name || ''}
        </div>
      </div>
      <button
        onClick={() => setOpen(true)}
        className="h-9 w-9 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-semibold border border-white/40"
        title="View profile"
        aria-label="View profile"
      >
        {initials}
      </button>
      <button
        onClick={logout}
        className="h-9 px-3 rounded-lg bg-white/80 border border-slate-200 hover:bg-white text-slate-700 text-sm"
        title="Logout"
      >Logout</button>
    </div>
  );

  return (
    <>
      {/* Pass onProfileClick so the default profile icon opens sponsor modal instead of student route */}
      <TopBar extraRight={extraRight} onProfileClick={() => setOpen(true)} />
      <ProfileModal
        open={open}
        onClose={() => setOpen(false)}
        title="Sponsor Profile"
        avatarInitials={initials}
        sections={[
          {
            title: 'User',
            fields: [
              { label: 'Name', value: me.name || 'Sponsor' },
              { label: 'Email', value: me.email },
            ],
          },
          {
            title: 'Organization',
            fields: [
              { label: 'Name', value: org.name },
              { label: 'Tier', value: org.tier },
              { label: 'Website', value: org.website, isLink: !!org.website },
              { label: 'About', value: org.description },
              { label: 'Contact Email', value: org.contactEmail },
              { label: 'Contact Phone', value: org.contactPhone },
            ],
          },
        ]}
      />
    </>
  );
}
