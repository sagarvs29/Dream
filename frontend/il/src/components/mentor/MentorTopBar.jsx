import React, { useEffect, useMemo, useState } from "react";
import { getApiBase } from "../../config/api";
import TopBar from "../student/TopBar";
import ProfileModal from "../common/ProfileModal";

export default function MentorTopBar() {
  const [me, setMe] = useState({ name: "", email: "", department: "", designation: "", role: "" });
  const token = useMemo(() => (typeof window !== 'undefined' ? localStorage.getItem('mentor_token') : null), []);
  const cachedName = useMemo(() => (typeof window !== 'undefined' ? localStorage.getItem('mentor_name') : null), []);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Use cached name quickly while fetching full profile
    if (cachedName && !me.name) setMe((s) => ({ ...s, name: cachedName }));
    if (!token) return;
    (async () => {
      try {
  const r = await fetch(`${getApiBase()}/mentor/me`, { headers: { Authorization: `Bearer ${token}` } });
        if (r.ok) {
          const d = await r.json();
          const m = d?.mentor || {};
          setMe({
            name: m.name || cachedName || 'Mentor',
            email: m.email || '',
            department: m.department || '',
            designation: m.designation || '',
            role: m.role || '',
          });
        }
      } catch (_) { /* ignore */ }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const initials = (me.name || 'M')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0,2)
    .toUpperCase();

  function logout() {
    try {
      localStorage.removeItem('mentor_token');
      localStorage.removeItem('mentor_name');
    } catch (_) {}
    window.location.href = '/mentor/login';
  }

  const extraRight = (
    <div className="flex items-center gap-2">
      <div className="hidden sm:block text-right">
        <div className="text-slate-900 font-medium truncate" title={me.name}>{me.name || 'Mentor'}</div>
        <div className="text-slate-600 text-xs truncate" title={me.role || me.designation}>
          {me.role || me.designation || ''}
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
      <a
        href="/mentor/change-password"
        className="h-9 px-3 rounded-lg bg-white/80 border border-slate-200 hover:bg-white text-slate-700 text-sm"
        title="Change Password"
      >Change Password</a>
      <button
        onClick={logout}
        className="h-9 px-3 rounded-lg bg-white/80 border border-slate-200 hover:bg-white text-slate-700 text-sm"
        title="Logout"
      >Logout</button>
    </div>
  );

  return (
    <>
  {/* Ensure profile icon in shared TopBar opens modal instead of navigating to student profile */}
  <TopBar extraRight={extraRight} onProfileClick={() => setOpen(true)} />
      <ProfileModal
        open={open}
        onClose={() => setOpen(false)}
        title="Mentor Profile"
        avatarInitials={initials}
        sections={[{
          fields: [
            { label: 'Name', value: me.name || 'Mentor' },
            { label: 'Email', value: me.email },
            { label: 'Role', value: me.role },
            { label: 'Department', value: me.department },
            { label: 'Designation', value: me.designation },
          ]
        }]}
      />
    </>
  );
}
