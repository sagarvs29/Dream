import React from "react";
import { Link, useNavigate } from "react-router-dom";
import HashtagSearchInline from "../search/HashtagSearchInline";

// TopBar now accepts optional onProfileClick to override default student profile navigation.
// If provided, the profile icon becomes a button triggering that handler (used in sponsor/mentor portals).
export default function TopBar({ extraRight = null, onProfileClick = null }) {
  const navigate = useNavigate();
  const onSubmit = (tags) => {
    const qs = new URLSearchParams({ type: "hashtags", tags: (tags||[]).join(",") });
    navigate(`/app/search?${qs.toString()}`);
  };

  return (
    <header className="sticky top-0 z-30 backdrop-blur-md bg-gradient-to-b from-[rgba(255,255,255,0.55)] to-[rgba(255,255,255,0.15)] border-b border-white/20">
      <div className="mx-auto max-w-6xl px-4 py-3">
        <div className="grid grid-cols-12 items-center gap-3">
          {/* Left: Brand */}
          <div className="col-span-12 sm:col-span-3 flex items-center gap-2">
            <img src="/logo.png" alt="IAb minds" className="h-7 w-7 rounded" />
            <span className="font-semibold text-slate-900">IAb minds</span>
          </div>

          {/* Center: Search + quick chips */}
          <div className="col-span-12 sm:col-span-6 min-w-0">
            {/* Use search-only to avoid duplicate preset chips (we render our own below) */}
            <HashtagSearchInline className="min-w-0" variant="search-only" onSubmit={onSubmit} />
            <div className="mt-2 flex flex-wrap gap-2">
              {["Talent Video","Innovation","Achievement","Project"].map((f)=> (
                <button key={f} className="px-3 py-1.5 rounded-full text-sm bg-white/80 border border-slate-200 hover:bg-white text-slate-700"
                  onClick={()=> onSubmit([f.toLowerCase().replace(/\s+/g,'')])}
                >{f}</button>
              ))}
            </div>
          </div>

          {/* Right: actions */}
          <div className="col-span-12 sm:col-span-3 flex sm:justify-end gap-2 flex-wrap min-w-0">
            <Link to="/app/messages" title="Messages" className="h-10 px-3 rounded-xl bg-white/80 border border-slate-200 hover:bg-white inline-flex items-center gap-2 text-slate-700">💬</Link>
            {/* Replaced top-right Library button with Institution symbol as requested */}
            <button
              type="button"
              title="Institution"
              aria-label="Institution"
              onClick={() => { try { window.dispatchEvent(new CustomEvent('institution-button-click')); } catch(_) {} }}
              className="h-10 px-3 rounded-xl bg-white/80 border border-slate-200 hover:bg-white inline-flex items-center gap-2 text-slate-700"
            >🏫</button>
            {onProfileClick ? (
              <button type="button" onClick={onProfileClick} title="Profile" className="h-10 px-3 rounded-xl bg-white/80 border border-slate-200 hover:bg-white inline-flex items-center gap-2 text-slate-700">👤</button>
            ) : (
              <Link to="/app/profile" title="Profile" className="h-10 px-3 rounded-xl bg-white/80 border border-slate-200 hover:bg-white inline-flex items-center gap-2 text-slate-700">👤</Link>
            )}
            {extraRight}
          </div>
        </div>
      </div>
    </header>
  );
}
