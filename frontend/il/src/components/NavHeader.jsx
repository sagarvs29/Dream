import React from "react";
import { useLocation, useNavigate } from "react-router-dom";

// Map raw path segments to human-friendly labels
const SEGMENT_LABELS = {
  "server": "Server",
  "school": "School",
  "sponsors": "Sponsors",
  "new": "Create Sponsor",
  "students": "Students",
  "home": "Home",
  "portal": "Portal",
  "admin": "Admin",
  "login": "Login",
  "profile": "Profile",
  "institution": "Institution",
};

function buildBreadcrumbs(pathname) {
  const parts = pathname.split("/").filter(Boolean);
  const crumbs = [];
  parts.forEach((p, idx) => {
    const label = SEGMENT_LABELS[p] || p.charAt(0).toUpperCase() + p.slice(1);
    const href = "/" + parts.slice(0, idx + 1).join("/");
    crumbs.push({ label, href });
  });
  return crumbs;
}

export default function NavHeader({ fallbackParent }) {
  const location = useLocation();
  const navigate = useNavigate();
  const crumbs = buildBreadcrumbs(location.pathname);

  // Determine parent fallback when last segment is an action like "new"
  const parentPath = fallbackParent || (crumbs.length > 1 ? crumbs[crumbs.length - 2].href : "/");
  const canGoBack = crumbs.length > 1;

  function handleBack() {
    // Try history back first; if user landed directly (no usable history) go to parentPath
    if (canGoBack) {
      navigate(-1);
      // After navigate(-1) React Router may not move if initial entry; provide safety redirect
      setTimeout(() => {
        if (location.pathname === window.location.pathname) {
          navigate(parentPath);
        }
      }, 50);
    } else {
      navigate(parentPath);
    }
  }

  return (
    <div className="flex items-center gap-4 mb-6">
      {canGoBack && (
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-md bg-white/15 hover:bg-white/25 border border-white/30 transition"
        >
          <span className="opacity-80">←</span>
          <span>Back</span>
        </button>
      )}
      <nav className="text-xs md:text-sm flex flex-wrap items-center gap-1 opacity-80">
        {crumbs.map((c, i) => (
          <React.Fragment key={c.href}>
            <a href={c.href} className="hover:text-white text-white/80">{c.label}</a>
            {i < crumbs.length - 1 && <span className="opacity-50">›</span>}
          </React.Fragment>
        ))}
      </nav>
    </div>
  );
}
