import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import axios from "axios";
import GlassCard from "../../components/ui/GlassCard";
import StudentTopBar from "../../components/student/StudentTopBar";

export default function StudentMessages() {
  const API = useMemo(() => axios.create({ baseURL: import.meta.env?.VITE_API_BASE_URL || "http://localhost:5000/api" }), []);
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const scrollerRef = useRef(null);

  // Fetch conversations on mount
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const headers = { Authorization: `Bearer ${token}` };
        const res = await API.get("/chat/conversations", { headers });
        if (!mounted) return;
        const list = res.data?.conversations || [];
        setConversations(list);
        const preferred = location?.state?.openConversationId;
        if (preferred && list.some(c => c._id === preferred)) {
          setActiveId(preferred);
        } else {
          setActiveId(list[0]?._id || null);
        }
      } catch (e) {
        setError(e?.response?.data?.message || "Failed to load chats");
      } finally {
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [API, location?.state?.openConversationId]);

  // Fetch messages when active conversation changes
  useEffect(() => {
    if (!activeId) { setMessages([]); return; }
    const token = localStorage.getItem("token");
    if (!token) return;
    let mounted = true;
    (async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const res = await API.get(`/chat/messages`, { params: { conversation: activeId, limit: 50 }, headers });
        if (!mounted) return;
        setMessages(res.data?.messages || []);
        // scroll to bottom
        setTimeout(() => { scrollerRef.current?.scrollTo?.(0, scrollerRef.current.scrollHeight); }, 0);
      } catch (e) {
        setError(e?.response?.data?.message || "Failed to load messages");
      }
    })();
    return () => { mounted = false; };
  }, [API, activeId]);

  async function send() {
    const content = text.trim();
    if (!content || !activeId) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await API.post("/chat/messages", { conversation: activeId, text: content }, { headers });
      const msg = res.data?.message;
      if (msg) {
        setMessages((prev) => [...prev, msg]);
        setText("");
        // Move conversation to top
        setConversations((prev) => {
          const idx = prev.findIndex((c) => c._id === activeId);
          if (idx <= 0) return prev;
          const copy = [...prev];
          const [item] = copy.splice(idx, 1);
          copy.unshift(item);
          return copy;
        });
        setTimeout(() => { scrollerRef.current?.scrollTo?.(0, scrollerRef.current.scrollHeight); }, 0);
      }
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to send");
    }
  }

  const active = conversations.find((c) => c._id === activeId);
  return (
    <div className="min-h-screen" style={{ background: "var(--bg-gradient)" }}>
      <div className="mx-auto max-w-5xl px-4 pt-5 pb-24 grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
        <div>
          <div className="text-white/90 font-semibold mb-2">Chats</div>
          <GlassCard className="p-2 divide-y divide-white/10">
            {loading && <div className="px-3 py-2 text-white/70">Loading…</div>}
            {(!loading && conversations.length === 0) && (
              <div className="px-3 py-2 text-white/70">No conversations yet.</div>
            )}
            {conversations.map((c) => (
              <button key={c._id} onClick={() => setActiveId(c._id)} className={`w-full text-left px-3 py-2 rounded hover:bg-white/10 transition ${activeId === c._id ? "bg-white/10" : ""}`}>
                <div className="text-white/90">{c.other?.name || (c.other?.model === 'Teacher' ? 'Mentor' : 'Student')}</div>
                <div className="text-white/60 text-xs">{c.other?.model === 'Teacher' ? 'Mentor' : 'Student'}</div>
              </button>
            ))}
          </GlassCard>
        </div>

        <div className="flex flex-col min-h-[60vh]">
          <div className="text-white/90 font-semibold mb-2">Conversation</div>
          <GlassCard className="flex-1 p-4 overflow-auto" ref={scrollerRef}>
            {!active && <div className="text-white/70">Select a chat to start.</div>}
            {active && messages.length === 0 && (
              <div className="text-white/70">Say hello 👋</div>
            )}
            {active && (
              <div className="space-y-2">
                {messages.map((m) => {
                  const mine = String(m.from?.userId) === (active?.participants?.find?.(p => p.userModel !== (m.from?.userModel))?.userId) ? false : (m.from?.userModel !== active?.other?.model);
                  // Fallback: if token userId is not known here, infer by from.userModel vs other model
                  return (
                    <div key={m._id || m.createdAt + m.text} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className={`glass-btn px-3 py-1.5 max-w-[75%]`}>
                        <span className="text-white/90 text-sm">{m.text}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </GlassCard>
          <div className="mt-2 flex items-center gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
              placeholder={active ? "Type a message..." : "Select a chat to start"}
              disabled={!active}
              className="flex-1 glass px-3 py-2 text-white/90 placeholder-white/60 focus-ring disabled:opacity-50"
            />
            <button className="glass-btn px-4 py-2 disabled:opacity-50" onClick={send} disabled={!active || !text.trim()}>Send</button>
          </div>
          {error && <div className="text-red-200 text-sm mt-2">{error}</div>}
        </div>
      </div>
    </div>
  );
}
