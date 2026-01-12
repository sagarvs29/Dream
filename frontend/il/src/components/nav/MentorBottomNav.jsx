import React, { useEffect } from "react";
import { NavLink } from "react-router-dom";

// Removed Profile tab; profile now accessed solely via top-right avatar modal
const items = [
  { to: "/mentor", label: "Home", icon: "🏠" },
  { to: "/app/library", label: "Library", icon: "📚" },
  { to: "/app/messages", label: "Messages", icon: "💬" },
  // Institution hub for mentors (shows Teacher Dashboard & schedules)
  { to: "/app/institution", label: "Institution", icon: "🏫" },
];

export default function MentorBottomNav() {
  const spacerHeight = 72; // reduced height for better visibility
  useEffect(() => {
    // Dispatch height so pages can reserve space dynamically
    try { window.dispatchEvent(new CustomEvent('mentor-nav-height', { detail: spacerHeight + 16 })); } catch(_) {}
  }, [spacerHeight]);
  return (
    <>
      {/* Reserved space so content never hides behind nav */}
      <div aria-hidden className="w-full" style={{ height: spacerHeight }} />
      <div
        className="fixed left-0 right-0 px-4 z-40"
        style={{ bottom: `calc(env(safe-area-inset-bottom, 0px) + 8px)` }}
      >
        <div className="mx-auto max-w-3xl">
          {/* Changed background color of bottom navigation bar. Adjust gradient or replace with a solid color as needed. */}
          <div className="rounded-2xl border border-purple-300/40 bg-gradient-to-br from-[#b085f5]/70 via-[#8e49c2]/70 to-[#6a1b9a]/70 backdrop-blur-xl shadow-[0_12px_40px_rgba(0,0,0,0.38)] px-2 py-2 flex items-stretch justify-between ring-1 ring-purple-300/40 pointer-events-auto">
            {items.map((it) => (
              <NavLink
                key={it.label}
                to={it.to}
                className={({ isActive }) =>
                  `flex-1 min-w-0 mx-1 rounded-xl px-3 py-2 text-center text-[11px] tracking-wide font-medium transition border ${
                    isActive
                      ? "bg-purple-600/60 border-purple-200/70 text-white shadow-[0_4px_16px_rgba(176,133,245,0.65)]"
                      : "bg-purple-900/20 border-purple-300/30 text-white/85 hover:bg-purple-800/30"
                  }`
                }
              >
                <div className="text-sm leading-none mb-1">{it.icon}</div>
                <div className="truncate">{it.label}</div>
              </NavLink>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
