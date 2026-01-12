import React, { useEffect, useMemo, useState } from "react";
import api from "../../utils/apiClient";
import GlassCard from "../ui/GlassCard";
import PostCard from "../student/PostCard";

function ClapIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M11 3v7" /><path d="M7 5l2 5" /><path d="M15 5l-2 5" /><path d="M5 11c-1 2 0 4 2 6s4 3 6 2 3-2 4-4c1-2 0-4-2-6" />
    </svg>
  );
}

function ShareIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" /><path d="M16 6l-4-4-4 4" /><path d="M12 2v14" />
    </svg>
  );
}

function KebabIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" {...props}>
      <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
    </svg>
  );
}

function decodeJwtSub() {
  try {
    const token = localStorage.getItem("token");
    if (!token) return null;
    const [, payload] = token.split(".");
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return { userId: json?.sub || json?.id };
  } catch {
    return null;
  }
}

function Media({ m }) {
  if (!m) return null;
  const url = m.url || m.thumbUrl;
  const isVideo = m.kind === "video" || /\.mp4($|\?)/i.test(String(url || ""));
  return (
    <div className="mt-3 relative rounded-2xl overflow-hidden border border-white/20 bg-white/10">
      {isVideo ? (
        <video controls className="w-full h-auto max-h-[60vh] object-contain bg-black">
          <source src={url} />
        </video>
      ) : (
        <img src={url} alt="post media" className="w-full h-[340px] object-cover" />
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-white/10" />
    </div>
  );
}

export default function PostsFeed() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [apprs, setApprs] = useState({}); // { [postId]: { open: bool, loading: bool, list: [], draft: "", error: "" } }
  const [editState, setEditState] = useState({ open: false, id: null, caption: "", saving: false });
  const [menuState, setMenuState] = useState({ open: false, id: null });
  const [commentsModal, setCommentsModal] = useState({ open: false, id: null });
  // Hearts animation instances per post: { [postId]: Array<{id:string, x:number, r:number}> }
  const [hearts, setHearts] = useState({});
  const auth = useMemo(() => decodeJwtSub(), []);

  function timeAgo(iso) {
    try {
      const d = new Date(iso);
      const s = Math.floor((Date.now() - d.getTime()) / 1000);
      if (s < 60) return `${s}s ago`;
      const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
      const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
      const days = Math.floor(h / 24); if (days < 7) return `${days}d ago`;
      return d.toLocaleDateString();
    } catch { return ""; }
  }

  async function load(page = 1) {
    try {
      setLoading(true);
      setError("");
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
  const r = await api.get("/posts/feed", { params: { page, limit: 15 }, headers });
      setPosts(r.data?.posts || []);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load posts");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // When a post is created from a modal elsewhere, prepend it to the feed for instant feedback
  useEffect(() => {
    const handler = (e) => {
      const post = e?.detail;
      if (post && post._id) {
        setPosts((prev) => [post, ...prev]);
      } else {
        load();
      }
    };
    window.addEventListener('post-created', handler);
    return () => window.removeEventListener('post-created', handler);
  }, []);

  async function toggleLike(id) {
    try {
      const token = localStorage.getItem("token");
      if (!token) return alert("Login required");
  const r = await api.post(`/posts/${id}/like`, {});
      setPosts((prev) => prev.map((p) => (p._id === id ? { ...p, likeCount: r.data.likeCount } : p)));
    } catch (e) {
      alert(e?.response?.data?.message || "Failed to like");
    }
  }

  function spawnHeart(postId) {
    const id = Math.random().toString(36).slice(2);
    const x = (Math.random() * 36) - 18; // -18px to +18px horizontal drift
    const r = (Math.random() * 30) - 15; // -15deg to +15deg rotation
    setHearts((prev) => ({
      ...prev,
      [postId]: [ ...(prev[postId] || []), { id, x, r } ]
    }));
    // Auto cleanup after animation ends (safety timeout)
    setTimeout(() => removeHeart(postId, id), 1300);
  }

  function removeHeart(postId, heartId) {
    setHearts((prev) => ({
      ...prev,
      [postId]: (prev[postId] || []).filter(h => h.id !== heartId)
    }));
  }

  function ensureApprState(id) {
    setApprs((prev) => prev[id] ? prev : { ...prev, [id]: { open: false, loading: false, list: [], draft: "", error: "" } });
  }

  async function toggleAppreciations(id) {
    ensureApprState(id);
    setCommentsModal({ open: true, id });
    const state = apprs[id];
    if (!state || (state.list || []).length === 0) {
      await loadAppreciations(id);
    }
  }

  async function loadAppreciations(id) {
    try {
      setApprs((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), loading: true, error: "" } }));
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
  const r = await api.get(`/posts/${id}/appreciations`, { headers });
      const list = r.data?.appreciations || [];
      setApprs((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), list, loading: false } }));
    } catch (e) {
      setApprs((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), loading: false, error: e?.response?.data?.message || "Failed to load comments" } }));
    }
  }

  async function addAppreciation(id) {
    try {
      const state = apprs[id] || {};
      const text = String(state.draft || "").trim();
      if (!text) return;
      const token = localStorage.getItem("token");
      if (!token) return alert("Login required");
  const r = await api.post(`/posts/${id}/appreciations`, { text });
      const a = r.data?.appreciation;
      // Append and clear draft; keep modal open
      setApprs((prev) => ({
        ...prev,
        [id]: { ...(prev[id] || {}), list: [...(prev[id]?.list || []), a], draft: "" }
      }));
    } catch (e) {
      alert(e?.response?.data?.message || "Failed to comment");
    }
  }

  function updateDraft(id, v) {
    setApprs((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), draft: v } }));
  }

  function onPostCreated(post) {
    setPosts((prev) => [post, ...prev]);
  }

  function sharePost(p) {
    const url = `${window.location.origin}/app/post/${p._id}`;
    const title = `${p.author?.name || 'Post'} on IAb mlnds`;
    const text = p.caption || 'Check this out';
    if (navigator.share) {
      navigator.share({ title, text, url }).catch(()=>{});
    } else {
      navigator.clipboard?.writeText(url).then(()=>{
        alert('Link copied to clipboard');
      }).catch(()=>{ window.prompt('Copy link', url); });
    }
  }

  function openEdit(p) {
    setEditState({ open: true, id: p._id, caption: p.caption || "", saving: false });
  }

  async function saveEdit() {
    try {
      setEditState(s => ({ ...s, saving: true }));
      const token = localStorage.getItem('token');
      if (!token) return alert('Login required');
  const r = await api.patch(`/posts/${editState.id}`, { caption: editState.caption }, { headers: { Authorization: `Bearer ${token}` } });
      const updated = r.data?.post;
      setPosts(prev => prev.map(p => p._id === updated._id ? { ...p, caption: updated.caption } : p));
      setEditState({ open: false, id: null, caption: "", saving: false });
    } catch (e) {
      alert(e?.response?.data?.message || 'Failed to save');
      setEditState(s => ({ ...s, saving: false }));
    }
  }

  async function deletePost(id) {
    if (!confirm('Delete this post? This cannot be undone.')) return;
    try {
      const token = localStorage.getItem('token');
      if (!token) return alert('Login required');
  await api.delete(`/posts/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      setPosts(prev => prev.filter(p => p._id !== id));
    } catch (e) {
      alert(e?.response?.data?.message || 'Failed to delete');
    }
  }

  function isOwner(p) {
    return auth?.userId && (String(auth.userId) === String(p.author?._id || p.author));
  }

  return (
    <div className="mx-auto max-w-5xl px-4">
      {loading && (
        <GlassCard className="mt-4 p-4 text-white/80">Loading posts…</GlassCard>
      )}
      {error && !loading && (
        <GlassCard className="mt-4 p-4 text-red-200">{error}</GlassCard>
      )}

      {posts.map((p) => (
        <div key={p._id} className="mt-6">
          <PostCard
            post={p}
            isOwner={isOwner(p)}
            onMenu={() => setMenuState({ open: true, id: p._id })}
            onLike={() => { spawnHeart(p._id); toggleLike(p._id); }}
            onComments={() => toggleAppreciations(p._id)}
            onShare={() => sharePost(p)}
          />
          {/* floating hearts overlay retained for fun effect */}
          <div className="relative -mt-8 h-0">
            <div className="pointer-events-none absolute inset-0">
              {(hearts[p._id] || []).map((h) => (
                <svg
                  key={h.id}
                  viewBox="0 0 24 24"
                  className="floating-heart"
                  style={{ left: 8, bottom: 10, "--x": `${h.x}px`, "--r": `${h.r}deg` }}
                  onAnimationEnd={() => removeHeart(p._id, h.id)}
                >
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" fill="#ff4d7d" stroke="#ffffff" strokeOpacity="0.65" strokeWidth="0.6" />
                </svg>
              ))}
            </div>
          </div>
        </div>
      ))}

      {editState.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setEditState({ open:false, id:null, caption:"", saving:false })} />
          <div className="relative w-full max-w-md">
            <GlassCard className="p-4">
              <div className="text-white/90 font-medium mb-2">Edit Caption</div>
              <textarea className="w-full h-28 glass p-2 text-white/90" value={editState.caption} onChange={(e)=>setEditState(s=>({ ...s, caption: e.target.value }))} />
              <div className="mt-3 flex justify-end gap-2">
                <button className="glass-btn px-3 py-1.5 text-sm" onClick={()=>setEditState({ open:false, id:null, caption:"", saving:false })}>Cancel</button>
                <button className="glass-btn px-3 py-1.5 text-sm" disabled={editState.saving} onClick={saveEdit}>{editState.saving? 'Saving…':'Save'}</button>
              </div>
            </GlassCard>
          </div>
        </div>
      )}

      {menuState.open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMenuState({ open:false, id:null })} />
          <div className="relative w-full sm:max-w-sm sm:rounded-2xl sm:overflow-hidden">
            <div className="rounded-t-2xl sm:rounded-2xl bg-[#0b0f19]/90 border-t sm:border border-white/10">
              <div className="p-3 border-b border-white/10 text-center text-white/80 text-sm">Options</div>
              <div className="flex flex-col">
                <button
                  className="w-full text-left px-4 py-3 text-white/90 hover:bg-white/10"
                  onClick={() => {
                    const p = posts.find(x => x._id === menuState.id);
                    if (p) openEdit(p);
                    setMenuState({ open:false, id:null });
                  }}
                >Edit</button>
                <button
                  className="w-full text-left px-4 py-3 text-red-300 hover:bg-white/10"
                  onClick={() => {
                    const id = menuState.id; setMenuState({ open:false, id:null });
                    if (id) deletePost(id);
                  }}
                >Delete</button>
                <button
                  className="w-full text-left px-4 py-3 text-white/80 hover:bg-white/10"
                  onClick={() => setMenuState({ open:false, id:null })}
                >Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Comments bottom sheet */}
      {commentsModal.open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setCommentsModal({ open:false, id:null })} />
          <div className="relative w-full sm:max-w-md sm:rounded-2xl sm:overflow-hidden">
            <div className="rounded-t-2xl sm:rounded-2xl bg-[#0b0f19]/95 border-t sm:border border-white/10 max-h-[85vh] flex flex-col">
              <div className="py-3 border-b border-white/10">
                <div className="mx-auto h-1.5 w-12 rounded-full bg-white/20" />
                <div className="mt-2 text-center text-white/90 font-medium">Comments</div>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-3">
                {(apprs[commentsModal.id]?.loading) && (
                  <div className="text-white/70 text-sm">Loading…</div>
                )}
                {(apprs[commentsModal.id]?.error) && (
                  <div className="text-red-200 text-sm mb-2">{apprs[commentsModal.id].error}</div>
                )}
                {(apprs[commentsModal.id]?.list || []).map((a) => (
                  <div key={a._id} className="flex items-start gap-3 py-2">
                    <div className="h-8 w-8 flex items-center justify-center rounded-full bg-white/20 text-xs shrink-0">
                      <ClapIcon className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm text-white/90">{a.text}</div>
                      <div className="mt-1 text-[11px] text-white/50">{timeAgo(a.createdAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
              {/* Emoji quick row */}
              <div className="px-4 pt-2 pb-1 flex gap-2 overflow-x-auto">
                {['❤️','👏','🔥','🥲','😍','😮','😂'].map((e)=> (
                  <button key={e} className="px-2 py-1 rounded-full bg-white/10 text-lg" onClick={()=>{
                    const id = commentsModal.id; const cur = String(apprs[id]?.draft || '');
                    updateDraft(id, cur ? cur + ' ' + e : e);
                  }}>{e}</button>
                ))}
              </div>
              {/* Input bar */}
              <div className="p-3 border-t border-white/10 flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-white/20" />
                <input
                  value={apprs[commentsModal.id]?.draft || ''}
                  onChange={(e)=>updateDraft(commentsModal.id, e.target.value)}
                  placeholder="What do you think of this?"
                  className="flex-1 rounded-lg bg-white/10 px-3 py-2 text-sm text-white placeholder-white/50 outline-none ring-1 ring-white/10 focus:ring-white/20"
                />
                <button className="glass-btn px-3 py-2 text-sm" onClick={()=> addAppreciation(commentsModal.id)}>Send</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
