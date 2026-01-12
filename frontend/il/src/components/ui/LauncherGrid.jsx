import React from "react";

function Tile({ label, icon, colorClass = "t-blue", onClick }) {
  return (
    <button type="button" onClick={onClick} className={`frost-tile ${colorClass}`} title={label} aria-label={label}>
      <div className="tile-bubble">{icon}</div>
      <div className="tile-label">{label}</div>
    </button>
  );
}

// Small consistent icons
const Icon = {
  chat: (
    <svg viewBox="0 0 24 24" className="tile-icon" fill="currentColor">
      <path d="M4 5a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H9l-5 5V5Z"/>
    </svg>
  ),
  network: (
    <svg viewBox="0 0 24 24" className="tile-icon" fill="currentColor">
      <path d="M12 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6Zm6 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM6 21a3 3 0 1 1 6 0 3 3 0 0 1-6 0Z"/>
      <path d="M12 9v3m0 0 3 3M12 12l-3 6" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    </svg>
  ),
  trophy: (
    <svg viewBox="0 0 24 24" className="tile-icon" fill="currentColor">
      <path d="M5 4h14v3a5 5 0 0 1-5 5h-4A5 5 0 0 1 5 7V4Z"/>
      <path d="M8 14h8v2a4 4 0 0 1-4 4 4 4 0 0 1-4-4v-2Z"/>
    </svg>
  ),
  project: (
    <svg viewBox="0 0 24 24" className="tile-icon" fill="currentColor">
      <path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14l-4-2-4 2-4-2-4 2V5Z"/>
    </svg>
  ),
  school: (
    <svg viewBox="0 0 24 24" className="tile-icon" fill="currentColor">
      <path d="M3 10 12 5l9 5-9 5-9-5Zm2 3 7 4 7-4v4l-7 4-7-4v-4Z"/>
    </svg>
  ),
  compose: (
    <svg viewBox="0 0 24 24" className="tile-icon" fill="currentColor">
      <path d="M4 20h16M5 15.5 15.5 5a2.1 2.1 0 0 1 3 3L8 18.5 4 20l1.5-4.5Z"/>
    </svg>
  ),
};

export default function LauncherGrid({ items = [], onPick }) {
  return (
    <div className="frost-grid">
      {items.map((it) => (
        <Tile
          key={it.label}
          label={it.label}
          colorClass={it.color || "t-blue"}
          onClick={() => (onPick ? onPick(it) : it.onClick?.())}
          icon={it.icon}
        />
      ))}
    </div>
  );
}

export { Icon };
