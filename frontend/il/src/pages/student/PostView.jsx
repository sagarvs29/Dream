import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import GlassCard from "../../components/ui/GlassCard";

function Media({ m }) {
  if (!m) return null;
  if (m.kind === 'video' || String(m.url||'').match(/\.mp4($|\?)/)) {
    return (
      <div className="mt-3 overflow-hidden rounded-xl bg-black/10">
        <video controls className="w-full max-h-[55vh] object-contain" style={{ filter: m.filter ? (m.filter === 'normal' ? 'none' : m.filter) : undefined }}>
          <source src={m.url} />
        </video>
      </div>
    );
  }
  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-black/5">
      <img src={m.thumbUrl || m.url} alt="post" className="w-full max-h-[55vh] object-contain" style={{ filter: m.filter ? (m.filter === 'normal' ? 'none' : m.filter) : undefined }} />
    </div>
  );
}

export default function PostView() {
  const { id } = useParams();
  const API = useMemo(() => axios.create({ baseURL: import.meta.env?.VITE_API_BASE_URL || "http://localhost:5000/api" }), []);
  const [post, setPost] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true); setError("");
        const token = localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
        const r = await API.get(`/posts/${id}`, { headers });
        setPost(r.data?.post || null);
      } catch (e) {
        setError(e?.response?.data?.message || 'Failed to load post');
      } finally { setLoading(false); }
    })();
  }, [API, id]);

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-gradient)" }}>
      <div className="mx-auto max-w-3xl px-4 py-6">
        {loading && <GlassCard className="p-4 text-white/80">Loading…</GlassCard>}
        {error && !loading && <GlassCard className="p-4 text-red-200">{error}</GlassCard>}
        {post && (
          <GlassCard className="p-4">
            <div className="text-white/90 font-medium">{post.author?.name || 'Student'}</div>
            <div className="text-white/60 text-xs">{typeof post.author?.school === 'object' ? (post.author?.school?.name || '') : ''}</div>
            <div className="text-white/70 text-sm">{post.caption}</div>
            {Array.isArray(post.media) && post.media[0] && <Media m={post.media[0]} />}
          </GlassCard>
        )}
      </div>
    </div>
  );
}
