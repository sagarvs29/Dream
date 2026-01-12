import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import GlassCard from "../../components/ui/GlassCard";
import HashtagSearchInline from "../../components/search/HashtagSearchInline";

const API = axios.create({ baseURL: import.meta.env?.VITE_API_BASE_URL || "http://localhost:5000/api" });

export default function HashtagSearchPage() {
  const [params, setParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  const tagsFromParams = () => (params.get("tags") || "").split(",").map(s=>s.trim()).filter(Boolean);

  async function search(tags) {
    const tagsList = (tags && tags.length ? tags : tagsFromParams());
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const r = await API.get("/search", { params: { type: 'hashtags', tags: tagsList.join(',') }, headers });
      setData(r.data?.results?.posts || { posts: [] });
      const p = new URLSearchParams(params); p.set('type', 'hashtags'); p.set('tags', tagsList.join(',')); setParams(p, { replace: true });
    } catch (e) {
      setData({ error: e?.response?.data?.message || e?.message || "Search failed" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Auto search if tags are present in URL
    if (tagsFromParams().length) search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function PostsList({ posts }) {
    if (!posts?.length) return <GlassCard className="p-4 text-white/70">No posts</GlassCard>;
    return (
      <div className="grid grid-cols-1 gap-3">
        {posts.map((p) => (
          <GlassCard key={p._id} className="p-3">
            <div className="text-white/90 font-medium">{p.author?.name || 'Student'}</div>
            <div className="text-white/80 text-sm">{p.caption}</div>
            {Array.isArray(p.hashtags) && p.hashtags.length > 0 && (
              <div className="mt-2 flex gap-2 flex-wrap">
                {p.hashtags.map((h, i)=>(<span key={i} className="text-xs text-white/80 bg-white/10 border border-white/20 px-2 py-0.5 rounded-full">#{h}</span>))}
              </div>
            )}
          </GlassCard>
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-gradient)" }}>
      <div className="px-4 py-3 sticky top-0 z-20" style={{ background: "linear-gradient(180deg, rgba(0,0,0,.22), rgba(0,0,0,0))" }}>
        <div className="mx-auto max-w-5xl">
          <HashtagSearchInline onSubmit={search} />
        </div>
      </div>

      <div className="px-4 pb-24">
        <div className="mx-auto max-w-5xl">
          {loading && <GlassCard className="p-4 text-white/80 mt-4">Searching…</GlassCard>}
          {data?.error && <GlassCard className="p-4 text-red-200 mt-4">{data.error}</GlassCard>}
          {!loading && data && <div className="mt-4"><PostsList posts={data.posts || data} /></div>}
        </div>
      </div>
    </div>
  );
}
