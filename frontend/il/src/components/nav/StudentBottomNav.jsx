import React from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

const items = [
  { to: "/app/home", label: "Home", icon: "🏠" },
  { to: "/app/library", label: "Library", icon: "📚" },
  { to: "/app/progress", label: "Progress", icon: "📈" },
  { to: "/app/network", label: "Network", icon: "👥" },
  { to: "/app/achievements", label: "Achievements", icon: "🏆" },
  { to: null, label: "Post", icon: "✏️", action: "post" },
];

export default function StudentBottomNav() {
  // Height of the bar + outer gap to reserve space in the page flow
  const spacerHeight = 88; // px
  const navigate = useNavigate();
  const location = useLocation();

  function handleAction(action) {
    if (action === "post") {
      if (location.pathname !== "/app/home") {
        navigate("/app/home", { state: { openComposerModal: true } });
      } else {
        // Ask Home to open the composer modal
        try { window.dispatchEvent(new CustomEvent("open-post-composer")); } catch (_) {}
      }
    }
  }
  return (
    <>
      {/* spacer to prevent content from hiding behind fixed nav and to keep gradient behind it at page end */}
      <div aria-hidden className="w-full" style={{ height: spacerHeight }} />
      <div
        className="fixed left-0 right-0 px-4 z-40"
        style={{ bottom: `calc(env(safe-area-inset-bottom, 0px) + 12px)` }}
      >
        <div className="mx-auto max-w-3xl">
          <div className="rounded-2xl border border-white/25 bg-white/14 backdrop-blur-xl shadow-[0_18px_50px_rgba(0,0,0,0.22)] px-2 py-2 flex items-stretch justify-between">
            {items.map((it) => (
              it.to ? (
                <NavLink
                  key={it.label}
                  to={it.to}
                  className={({ isActive }) =>
                    `flex-1 min-w-0 mx-1 rounded-xl px-3 py-2 text-center text-xs transition border ${
                      isActive
                        ? "bg-purple-600/40 border-purple-400/50 text-white shadow-[0_8px_24px_rgba(176,133,245,0.55)]"
                        : "bg-white/8 border-white/20 text-white/90 hover:bg-white/16"
                    }`
                  }
                >
                  <div className="text-base leading-none">{it.icon}</div>
                  <div className="mt-1 truncate">{it.label}</div>
                </NavLink>
              ) : (
                <button
                  key={it.label}
                  type="button"
                  onClick={() => handleAction(it.action)}
                  className="flex-1 min-w-0 mx-1 rounded-xl px-3 py-2 text-center text-xs bg-white/12 hover:bg-white/20 border border-white/25 text-white"
                  title="New Post"
                  aria-label="New Post"
                >
                  <div className="text-base leading-none">{it.icon}</div>
                  <div className="mt-1 truncate">{it.label}</div>
                </button>
              )
            ))}
            
          </div>
        </div>
      </div>
    </>
  );
}
