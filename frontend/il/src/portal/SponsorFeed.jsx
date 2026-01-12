import React, { useEffect, useMemo, useState } from "react";
import api from "../utils/apiClient";
import GlassCard from "../components/ui/GlassCard";
import PostCard from "../components/student/PostCard";

// Sponsor feed: mirror MentorFeed behaviour but currently reuses public/student feed
// If a dedicated backend route is added (e.g. /posts/sponsor-feed) change FEED_ENDPOINT accordingly.
const FEED_ENDPOINT = "/posts/feed"; // fallback to generic feed

export default function SponsorFeed() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [apprs, setApprs] = useState({});
  const sponsorToken = useMemo(() => (typeof window !== 'undefined' ? localStorage.getItem('SPONSOR_TOKEN') : null), []);
  const authHeader = sponsorToken ? { Authorization: `Bearer ${sponsorToken}` } : undefined;

  async function load(page = 1) {
    try {
      setLoading(true); setError("");
      const r = await api.get(FEED_ENDPOINT, { params: { page, limit: 15 }, headers: authHeader });
      setPosts(r.data?.posts || []);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load posts");
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function toggleLike(id) {
    try {
      if (!sponsorToken) return alert("Login required");
      const r = await api.post(`/posts/${id}/like`, {}, { headers: authHeader });
      setPosts((prev) => prev.map((p) => p._id === id ? { ...p, likeCount: r.data.likeCount } : p));
    } catch (e) {
      alert(e?.response?.data?.message || "Failed to like");
    }
  }

  function ensureApprState(id) {
    setApprs((prev) => prev[id] ? prev : { ...prev, [id]: { open: false, loading: false, list: [], draft: "", error: "" } });
  }

  async function openComments(id) {
    ensureApprState(id);
    setApprs(prev => ({ ...prev, [id]: { ...(prev[id]||{}), open: true } }));
    await loadComments(id);
  }

  async function loadComments(id) {
    try {
      setApprs(prev => ({ ...prev, [id]: { ...(prev[id]||{}), loading: true, error: "" } }));
      const r = await api.get(`/posts/${id}/appreciations`, { headers: authHeader });
      const list = r.data?.appreciations || [];
      setApprs(prev => ({ ...prev, [id]: { ...(prev[id]||{}), list, loading: false } }));
    } catch (e) {
      setApprs(prev => ({ ...prev, [id]: { ...(prev[id]||{}), loading: false, error: e?.response?.data?.message || "Failed to load comments" } }));
    }
  }

  async function addComment(id) {
    try {
      const state = apprs[id] || {}; const text = String(state.draft||"").trim();
      if (!text) return; if (!sponsorToken) return alert("Login required");
      const r = await api.post(`/posts/${id}/appreciations`, { text }, { headers: authHeader });
      const a = r.data?.appreciation;
      setApprs(prev => ({ ...prev, [id]: { ...(prev[id]||{}), list: [...(prev[id]?.list||[]), a], draft: "" } }));
    } catch (e) {
      alert(e?.response?.data?.message || "Failed to comment");
    }
  }

  function updateDraft(id, v) {
    setApprs(prev => ({ ...prev, [id]: { ...(prev[id]||{}), draft: v } }));
  }

  function sharePost(p) {
    const url = `${window.location.origin}/app/post/${p._id}`;
    const title = `${p.author?.name || 'Post'} on Platform`;
    const text = p.caption || 'Check this out';
    if (navigator.share) navigator.share({ title, text, url }).catch(()=>{});
    else navigator.clipboard?.writeText(url).then(()=>alert('Link copied')).catch(()=>{ window.prompt('Copy link', url); });
  }

  return (
    <div className="mx-auto max-w-5xl px-4">
      {loading && <GlassCard className="mt-4 p-4 text-white/80">Loading posts…</GlassCard>}
      {error && !loading && <GlassCard className="mt-4 p-4 text-red-200">{error}</GlassCard>}

      {posts.map(p => (
        <div key={p._id} className="mt-6">
          <PostCard
            post={p}
            isOwner={false}
            onMenu={() => {}}
            onLike={() => toggleLike(p._id)}
            onComments={() => openComments(p._id)}
            onShare={() => sharePost(p)}
          />
        </div>
      ))}

      {Object.entries(apprs).map(([id, state]) => state.open ? (
        <div key={id} className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setApprs(prev => ({ ...prev, [id]: { ...(prev[id]||{}), open:false } }))} />
          <div className="relative w-full max-w-md">
            <div className="rounded-2xl bg-[#0b0f19]/95 border border-white/10 p-3 max-h-[75vh] overflow-auto">
              <div className="text-white/90 font-medium mb-2">Comments</div>
              {state.loading && <div className="text-white/70 text-sm">Loading…</div>}
              {state.error && <div className="text-red-200 text-sm mb-2">{state.error}</div>}
              <div className="space-y-2">
                {(state.list || []).map(a => (
                  <div key={a._id} className="text-sm text-white/90">
                    <span className="opacity-80">{a.author?.userModel || 'User'}:</span> {a.text}
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <input
                  value={state.draft || ''}
                  onChange={e=>updateDraft(id, e.target.value)}
                  placeholder="Add a comment…"
                  className="flex-1 rounded bg-white/10 px-3 py-2 text-white placeholder-white/60 border border-white/15"
                />
                <button className="glass-btn px-3 py-2 text-sm" onClick={() => addComment(id)}>Send</button>
              </div>
            </div>
          </div>
        </div>
      ) : null)}
    </div>
  );
}
