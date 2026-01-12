import React, { useRef, useState } from "react";
import GlassCard from "../ui/GlassCard";

const PRESETS = [
  { key: "talent", label: "Talent Video", emoji: "🎬" },
  { key: "innovation", label: "Innovation", emoji: "💡" },
  { key: "achievement", label: "Achievement", emoji: "👏" },
  { key: "project", label: "Project", emoji: "👥" },
];

// variant: 'full' | 'search-only' | 'presets-only'
export default function HashtagSearchInline({ onSubmit, className = "", variant = 'full' }) {
  const [q, setQ] = useState("");
  const inputRef = useRef(null);

  function submit(tagsFromPreset) {
    const raw = q.trim();
    const fromText = (raw.match(/#([\p{L}0-9_]+)/giu) || []).map(h => h.replace(/^#/, ""));
    if (!fromText.length && raw) {
      raw.split(/[\s,]+/).forEach(w => { const t = w.trim(); if (t) fromText.push(t.replace(/^#/, "")); });
    }
    const tags = Array.from(new Set([...(tagsFromPreset || []), ...fromText])).filter(Boolean);
    if (typeof onSubmit === 'function') onSubmit(tags);
  }

  const showSearch = variant === 'full' || variant === 'search-only';
  const showPresets = variant === 'full' || variant === 'presets-only';

  return (
    <div className={`min-w-0 ${className}`}>
      {showSearch && (
        <div className="min-w-0 rounded-[18px] border border-white/25 bg-white/14 backdrop-blur-xl px-4 py-2 flex items-center gap-3 shadow-[0_8px_40px_rgba(0,0,0,0.12)]">
          <SearchIcon className="h-5 w-5 text-white/85" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e)=>setQ(e.target.value)}
            onKeyDown={(e)=>{ if (e.key==='Enter') submit(); }}
            placeholder="Search by hashtags.. e.g. #Innovation, #project"
            className="bg-transparent placeholder-white/75 text-white/95 w-full min-w-0 focus:outline-none"
          />
          <button
            className="ml-2 px-4 py-1.5 rounded-[12px] bg-white/18 hover:bg-white/28 transition border border-white/30 text-white/95 text-sm"
            onClick={()=>submit()}
          >
            Search
          </button>
        </div>
      )}
      {showPresets && (
        <div className="mt-4 flex flex-wrap gap-3">
          {PRESETS.map(p => (
            <button
              key={p.key}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-sm text-white/95 border border-white/25 backdrop-blur-xl bg-gradient-to-b from-[#7ea4ff]/20 via-[#826bff]/18 to-[#6a5cff]/22 hover:from-white/24 hover:to-white/28 shadow-[0_10px_35px_rgba(0,0,0,0.18)]"
              onClick={()=>submit([p.key])}
            >
              <span className="opacity-95">{p.emoji}</span>
              <span>{p.label}</span>
              <span className="ml-2 h-2 w-2 rounded-full bg-white/70" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const SearchIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={props.className}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </svg>
);
