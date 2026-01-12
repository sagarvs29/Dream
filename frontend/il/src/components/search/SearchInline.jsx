import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import GlassCard from "../ui/GlassCard";

const API = axios.create({ baseURL: import.meta.env?.VITE_API_BASE_URL || "http://localhost:5000/api" });
const tabs = ["All", "People", "Posts", "Schools", "Sponsors"];

export default function SearchInline({ controlsOnly = false, onSubmit, className = "" }) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState("All");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const focusHandler = () => {
      try { inputRef.current?.focus(); } catch (_) {}
    };
    window.addEventListener("focus-inline-search", focusHandler);
    return () => window.removeEventListener("focus-inline-search", focusHandler);
  }, []);

  async function doSearch(ntab = active, nq = q) {
    const trimmed = String(nq).trim();
    if (!trimmed) { setData(null); return; }

    // If running in controlsOnly mode and onSubmit provided, delegate
    if (controlsOnly && typeof onSubmit === 'function') {
      try { onSubmit(trimmed, ntab); } catch (_) {}
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const type = (ntab || "All").toLowerCase();
      const r = await API.get("/search", { params: { q: trimmed, type }, headers });
      setData(r.data?.results || null);
    } catch (e) {
      setData({ error: e?.response?.data?.message || e?.message || "Search failed" });
    } finally {
      setLoading(false);
    }
  }

  function Section({ title, children }) {
    return (
      <div className="mt-3">
        <div className="text-white/90 font-medium mb-2">{title}</div>
        {children}
      </div>
    );
  }

  function PeopleList({ people }) {
    const { students = [], mentors = [] } = people || {};
    const items = [...students, ...mentors];
    if (!items.length) return <GlassCard className="p-3 text-white/70">No people</GlassCard>;
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.map((p, i) => (
          <GlassCard key={p._id || i} className="p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 overflow-hidden flex items-center justify-center">
              {p.profilePictureUrl ? <img src={p.profilePictureUrl} className="w-full h-full object-cover" /> : <span>👤</span>}
            </div>
            <div className="flex-1">
              <div className="text-white/90 font-medium">{p.name}</div>
              <div className="text-white/70 text-xs">{p.department || p.email || p.designation || ''}</div>
            </div>
            <button className="glass-btn px-3 py-1.5 text-sm">View</button>
          </GlassCard>
        ))}
      </div>
    );
  }

  function PostsList({ posts }) {
    if (!posts?.posts?.length) return <GlassCard className="p-3 text-white/70">No posts</GlassCard>;
    return (
      <div className="grid grid-cols-1 gap-3">
        {posts.posts.map((p) => (
          <GlassCard key={p._id} className="p-3">
            <div className="text-white/90 font-medium">{p.author?.name || 'Student'}</div>
            <div className="text-white/80 text-sm">{p.caption}</div>
          </GlassCard>
        ))}
      </div>
    );
  }

  function SchoolsList({ schools }) {
    if (!schools?.schools?.length) return <GlassCard className="p-3 text-white/70">No schools</GlassCard>;
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {schools.schools.map((s) => (
          <GlassCard key={s._id} className="p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-white/20 overflow-hidden">
              {s.logoUrl && <img src={s.logoUrl} className="w-full h-full object-cover" />}
            </div>
            <div className="flex-1">
              <div className="text-white/90 font-medium">{s.name}</div>
              <div className="text-white/70 text-xs">{s.code} {s.address ? `· ${s.address}` : ''}</div>
            </div>
            <a className="glass-btn px-3 py-1.5 text-sm" href={s.website || '#'} target="_blank" rel="noreferrer">Visit</a>
          </GlassCard>
        ))}
      </div>
    );
  }

  function SponsorsList({ sponsors }) {
    if (!sponsors?.sponsors?.length) return <GlassCard className="p-3 text-white/70">No sponsors</GlassCard>;
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {sponsors.sponsors.map((s) => (
          <GlassCard key={s._id} className="p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-white/20 overflow-hidden">
              {s.logoUrl && <img src={s.logoUrl} className="w-full h-full object-cover" />}
            </div>
            <div className="flex-1">
              <div className="text-white/90 font-medium">{s.name}</div>
              <div className="text-white/70 text-xs">{s.tier}</div>
            </div>
            <a className="glass-btn px-3 py-1.5 text-sm" href={s.website || '#'} target="_blank" rel="noreferrer">Visit</a>
          </GlassCard>
        ))}
      </div>
    );
  }

  const Controls = (
    <GlassCard className={`p-3 ${className}`}>
      <div className="flex gap-2 items-center">
        <input
          ref={inputRef}
          value={q}
          onChange={(e)=>setQ(e.target.value)}
          onKeyDown={(e)=>{ if (e.key==='Enter') doSearch(active, q); }}
          placeholder="Search students, mentors, posts, schools, sponsors…"
          className="flex-1 glass px-3 py-2 text-white/90"
        />
        <button className="glass-btn px-3" onClick={()=>doSearch(active, q)}>Search</button>
      </div>
      <div className="mt-2 flex gap-2 overflow-auto">
        {tabs.map(t => (
          <button key={t} onClick={()=>{ setActive(t); if (controlsOnly) { if (typeof onSubmit === 'function' && (t === 'Schools' || t === 'Sponsors')) { try { onSubmit(String(q).trim(), t); } catch (_) {} } return; } doSearch(t, q); }} className={`glass-btn px-3 py-1 text-sm ${active===t?'border-2 border-[var(--primary)]':''}`}>{t}</button>
        ))}
      </div>
    </GlassCard>
  );

  if (controlsOnly) return Controls;

  return (
    <div>
      {Controls}
      <div className="mt-3">
        {loading && <GlassCard className="p-3 text-white/80">Searching…</GlassCard>}
        {data?.error && <GlassCard className="p-3 text-red-200">{data.error}</GlassCard>}

        {!loading && data && (
          active === 'All' ? (
            <>
              <Section title="People"><PeopleList people={data.people} /></Section>
              <Section title="Posts"><PostsList posts={data.posts} /></Section>
              <Section title="Schools"><SchoolsList schools={data.schools} /></Section>
              <Section title="Sponsors"><SponsorsList sponsors={data.sponsors} /></Section>
            </>
          ) : active === 'People' ? (
            <Section title="People"><PeopleList people={data.people} /></Section>
          ) : active === 'Posts' ? (
            <Section title="Posts"><PostsList posts={data.posts} /></Section>
          ) : active === 'Schools' ? (
            <Section title="Schools"><SchoolsList schools={data.schools} /></Section>
          ) : (
            <Section title="Sponsors"><SponsorsList sponsors={data.sponsors} /></Section>
          )
        )}
      </div>
    </div>
  );
}
