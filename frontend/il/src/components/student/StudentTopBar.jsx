import React, { useEffect, useMemo, useState } from "react";
import TopBar from "./TopBar";
import ProfileModal from "../common/ProfileModal";
import { logoutAll } from "../../utils/tokens";
import { getApiBase } from "../../config/api";

// Student-specific wrapper for TopBar that adds a Logout button and shows the student's name
export default function StudentTopBar() {
  const token = useMemo(() => (typeof window !== 'undefined' ? localStorage.getItem('token') : null), []);
  const [me, setMe] = useState({ name: "", email: "" });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const base = getApiBase();
        const r = await fetch(`${base}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
        if (r.ok) {
          const d = await r.json();
          setMe({ name: d?.name || d?.realName || 'Student', email: d?.email || '' });
        }
      } catch (_) {}
    })();
  }, [token]);

  function logout() { logoutAll('/'); }

  const initials = (me.name || 'S')
    .split(' ')
    .map(p => p[0])
    .join('')
    .slice(0,2)
    .toUpperCase();

  const extraRight = (
    <div className="flex items-center gap-2">
      <div className="hidden sm:block text-right">
        <div className="text-slate-900 font-medium truncate" title={me.name}>{me.name || 'Student'}</div>
        {me.email && <div className="text-slate-600 text-xs truncate" title={me.email}>{me.email}</div>}
      </div>
      <button
        onClick={() => setOpen(true)}
        className="h-9 w-9 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-semibold border border-white/40"
        title="View profile"
        aria-label="View profile"
      >{initials}</button>
      <button
        onClick={logout}
        className="h-9 px-3 rounded-lg bg-white/80 border border-slate-200 hover:bg-white text-slate-700 text-sm"
        title="Logout"
      >Logout</button>
    </div>
  );

  return (
    <>
      <TopBar extraRight={extraRight} onProfileClick={() => setOpen(true)} />
      <ProfileModal
        open={open}
        onClose={() => setOpen(false)}
        title="Student Profile"
        avatarInitials={initials}
        sections={[{ fields: [
          { label: 'Name', value: me.name || 'Student' },
          { label: 'Email', value: me.email },
        ] }]} />
    </>
  );
}
