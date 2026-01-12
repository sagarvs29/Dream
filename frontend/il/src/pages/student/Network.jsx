import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import GlassCard from "../../components/ui/GlassCard";
import StudentBottomNav from "../../components/nav/StudentBottomNav";

function PersonCard({ item, type, onConnect, pending, isConnected, isStudentConnected, onMessage, onUnconnect, onAccept, onReject }) {
  const isMentor = type === "mentor";
  return (
    <GlassCard className="p-4">
      <div className="flex items-start gap-3">
        <img src={item.profilePictureUrl || "/avatars/1.png"} alt="pfp" className="h-14 w-14 rounded-full ring-2 ring-white/20 object-cover" />
        <div className="flex-1 min-w-0">
          <div className="text-white/95 font-semibold truncate flex items-center gap-2">
            {item.name || item.realName || "—"}
            {isMentor && <span title="Mentor" className="text-white/85">✔️</span>}
          </div>
          {isMentor ? (
            <div className="text-white/70 text-sm truncate">{item.designation || item.department || "Mentor"}</div>
          ) : (
            <div className="text-white/70 text-sm truncate">Student</div>
          )}
          <div className="mt-3">
            {isMentor && isConnected ? (
              <div className="flex gap-2">
                <button onClick={() => onMessage?.(item)} className="glass-btn px-3 py-1.5 text-sm">Message</button>
                <button onClick={() => onUnconnect?.(item)} className="glass-btn px-3 py-1.5 text-sm">Unconnect</button>
              </div>
            ) : (!isMentor && isStudentConnected) ? (
              <div className="flex gap-2">
                <button onClick={() => onMessage?.(item)} className="glass-btn px-3 py-1.5 text-sm">Message</button>
              </div>
            ) : onAccept && onReject ? (
              <div className="flex gap-2">
                <button onClick={onAccept} className="glass-btn px-3 py-1.5 text-sm">Accept</button>
                <button onClick={onReject} className="glass-btn px-3 py-1.5 text-sm">Reject</button>
              </div>
            ) : (
              <button
                disabled={pending}
                onClick={() => onConnect(item)}
                className={`glass-btn px-3 py-1.5 text-sm ${pending ? "opacity-60" : ""}`}
              >
                {pending ? "Requested" : "Connect"}
              </button>
            )}
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

export default function NetworkPage() {
  const API = useMemo(() => axios.create({ baseURL: import.meta.env?.VITE_API_BASE_URL || "http://localhost:5000/api" }), []);
  const navigate = useNavigate();
  const [tab, setTab] = useState("mentor"); // mentor | student | requests | connections
  const [list, setList] = useState([]); // recommendations list for mentor/student
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(new Set());
  const [outboundSet, setOutboundSet] = useState(new Set());
  const [connected, setConnected] = useState(new Set()); // mentors
  const [connectedStudents, setConnectedStudents] = useState(new Set());
  // Requests state
  const [reqTab, setReqTab] = useState("inbound"); // inbound | outbound
  const [inbound, setInbound] = useState([]);
  const [outbound, setOutbound] = useState([]);
  // Map of inbound requesterId -> requestId for quick actions on student cards
  const [inboundFromMap, setInboundFromMap] = useState({});
  // Connections state (mentors list)
  const [mentors, setMentors] = useState([]);
  const [peers, setPeers] = useState([]);
  // Toasts
  const [toasts, setToasts] = useState([]); // { id, msg, type }
  const notify = (msg, type = "info") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2500);
  };

  async function loadRecommendations(which = tab) {
    try {
      setLoading(true); setError("");
      const token = localStorage.getItem("token");
      if (!token) { setError("Login required"); setLoading(false); return; }
      const headers = { Authorization: `Bearer ${token}` };
      const res = await API.get(`/student/network/recommendations`, { params: { type: which, limit: 24 }, headers });
      setList((which === "mentor" ? res.data.mentors : res.data.students) || []);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { loadRecommendations("mentor"); }, []);
  useEffect(() => {
    if (tab === "mentor" || tab === "student") {
      loadRecommendations(tab);
      // refresh connection/pending status silently
      loadConnections(true);
      loadRequests(false, true); // outbound (so we can show Requested)
      loadRequests(true, true);  // inbound (so we can show Accept/Reject on Students cards)
    } else if (tab === "requests") {
      loadRequests(true);
      loadRequests(false);
    } else if (tab === "connections") {
      loadConnections();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function onConnect(item) {
  const rawId = item._id || item.id;
  const id = String(rawId);
    try {
      const token = localStorage.getItem("token");
      if (!token) return alert("Login required");
      // mark as pending optimistically
      setPending(prev => {
        const copy = new Set(prev);
        copy.add(id);
        return copy;
      });
      const headers = { Authorization: `Bearer ${token}` };
      const targetModel = tab === "mentor" ? "Teacher" : "Student";
  const res = await API.post(`/student/network/requests`, { targetId: rawId, targetModel }, { headers });
      if (res.status === 201) {
        // also reflect in outbound set so button stays as "Requested"
        setOutboundSet(prev => {
          const copy = new Set(prev);
          copy.add(id);
          return copy;
        });
        notify("Request sent");
      }
    } catch (e) {
      // If already pending, keep it marked requested
      if (e?.response?.status === 409) {
        setOutboundSet(prev => {
          const copy = new Set(prev);
          copy.add(id);
          return copy;
        });
        notify("Request already pending", "info");
        return;
      }
      // Log detailed error for debugging and show best-available message
      console.error("Connect error", e?.response?.status, e?.response?.data || e?.message);
      const msg = e?.response?.data?.message || e?.message || "Failed to request";
      notify(msg, "error");
    }
  }

  // Requests load/actions
  async function loadRequests(isInbound, silent = false) {
    try {
      if (!silent) { setLoading(true); setError(""); }
      const token = localStorage.getItem("token");
      if (!token) { setError("Login required"); if (!silent) setLoading(false); return; }
      const headers = { Authorization: `Bearer ${token}` };
      const res = await API.get(`/student/network/requests`, { params: { inbound: isInbound ? 1 : 0 }, headers });
      const list = res.data?.requests || [];
      if (isInbound) {
        setInbound(list);
        const map = {};
        list.forEach(r => {
          const requesterId = String(r?.requester?.userId || "");
          if (requesterId) map[requesterId] = String(r._id);
        });
        setInboundFromMap(map);
      } else {
        setOutbound(list);
        // maintain a quick lookup of requested target ids
        const s = new Set(list.map(r => String(r.target?.userId)));
        setOutboundSet(s);
      }
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load requests");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function acceptRequest(id) {
    const token = localStorage.getItem("token");
    if (!token) return alert("Login required");
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await API.post(`/student/network/requests/${id}/accept`, {}, { headers });
      // refresh inbound and connections
      await Promise.all([loadRequests(true), loadConnections()]);
      notify("Request accepted", "success");
    } catch (e) {
      notify(e?.response?.data?.message || "Failed to accept", "error");
    }
  }

  async function rejectRequest(id) {
    const token = localStorage.getItem("token");
    if (!token) return alert("Login required");
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await API.post(`/student/network/requests/${id}/reject`, {}, { headers });
      await loadRequests(true);
    } catch (e) {
      notify(e?.response?.data?.message || "Failed to reject", "error");
    }
  }

  async function cancelRequest(id) {
    const token = localStorage.getItem("token");
    if (!token) return alert("Login required");
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await API.delete(`/student/network/requests/${id}`, { headers });
      await loadRequests(false);
    } catch (e) {
      notify(e?.response?.data?.message || "Failed to cancel", "error");
    }
  }

  // Connections load and message
  async function loadConnections(silent = false) {
    try {
      if (!silent) { setLoading(true); setError(""); }
      const token = localStorage.getItem("token");
      if (!token) { setError("Login required"); if (!silent) setLoading(false); return; }
      const headers = { Authorization: `Bearer ${token}` };
      const [mRes, sRes] = await Promise.all([
        API.get(`/student/network/mentors`, { headers }),
        API.get(`/student/network/students`, { headers }),
      ]);
      setMentors(mRes.data?.mentors || []);
      setPeers(sRes.data?.students || []);
      const ids = new Set((mRes.data?.mentors || []).map(m => String(m._id)));
      const sids = new Set((sRes.data?.students || []).map(s => String(s._id)));
      setConnected(ids);
      setConnectedStudents(sids);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load connections");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function messageMentor(mentor) {
    try {
      const token = localStorage.getItem("token");
      if (!token) return alert("Login required");
      const headers = { Authorization: `Bearer ${token}` };
      const res = await API.post(`/chat/start`, { targetId: mentor._id, targetModel: "Teacher" }, { headers });
      const convId = res.data?.conversation?._id;
      navigate("/app/messages", { state: { openConversationId: convId } });
    } catch (e) {
      notify(e?.response?.data?.message || "Failed to start chat", "error");
    }
  }

  async function messageStudent(student) {
    try {
      const token = localStorage.getItem("token");
      if (!token) return alert("Login required");
      const headers = { Authorization: `Bearer ${token}` };
      const res = await API.post(`/chat/start`, { targetId: student._id, targetModel: "Student" }, { headers });
      const convId = res.data?.conversation?._id;
      navigate("/app/messages", { state: { openConversationId: convId } });
    } catch (e) {
      alert(e?.response?.data?.message || "Failed to start chat");
    }
  }

  async function unconnectMentor(mentor) {
    try {
      const token = localStorage.getItem("token");
      if (!token) return alert("Login required");
      const headers = { Authorization: `Bearer ${token}` };
      await API.delete(`/student/network/connections/${mentor._id}`, { headers });
      // Refresh state
      await loadConnections(true);
      // also update mentors list if on recommendations tab
      setConnected(prev => {
        const copy = new Set(prev);
        copy.delete(String(mentor._id));
        return copy;
      });
      notify("Disconnected", "success");
    } catch (e) {
      notify(e?.response?.data?.message || "Failed to disconnect", "error");
    }
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-gradient)" }}>
      <div className="mx-auto max-w-6xl px-4 pt-5 pb-24">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <button onClick={() => setTab("mentor")} className={`glass-btn px-3 py-1.5 ${tab === "mentor" ? "border-2 border-[var(--primary)]" : ""}`}>Mentors</button>
          <button onClick={() => setTab("student")} className={`glass-btn px-3 py-1.5 relative ${tab === "student" ? "border-2 border-[var(--primary)]" : ""}`}>
            Students
            {inbound?.length > 0 && (
              <span className="absolute -top-2 -right-2 text-[10px] px-1.5 py-[2px] rounded-full bg-emerald-500/90 text-white shadow">
                {inbound.length}
              </span>
            )}
          </button>
          <button onClick={() => setTab("requests")} className={`glass-btn px-3 py-1.5 relative ${tab === "requests" ? "border-2 border-[var(--primary)]" : ""}`}>
            Requests
            {(inbound?.length || outbound?.length) ? (
              <span className="absolute -top-2 -right-2 text-[10px] px-1.5 py-[2px] rounded-full bg-indigo-500/90 text-white shadow">
                {inbound.length}
              </span>
            ) : null}
          </button>
          <button onClick={() => setTab("connections")} className={`glass-btn px-3 py-1.5 ${tab === "connections" ? "border-2 border-[var(--primary)]" : ""}`}>Connections</button>
        </div>

        {error && <GlassCard className="p-4 text-red-200 mb-3">{error}</GlassCard>}

        {(tab === "mentor" || tab === "student") && (
          <>
            {loading && <GlassCard className="p-4 text-white/80">Loading recommendations…</GlassCard>}
            {!loading && (
              <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {list.map((it) => {
                  const id = String(it._id);
                  const isPending = pending.has(id) || outboundSet.has(id);
                  const isConn = tab === 'mentor' && connected.has(id);
                  const inboundId = tab === 'student' ? inboundFromMap[id] : undefined;
                  const isStudentConn = tab === 'student' && connectedStudents.has(id);
                  return (
                    <PersonCard
                      key={it._id}
                      item={it}
                      type={tab}
                      onConnect={onConnect}
                      pending={isPending || isStudentConn}
                      isConnected={isConn}
                      isStudentConnected={isStudentConn}
                      onAccept={inboundId ? () => acceptRequest(inboundId) : undefined}
                      onReject={inboundId ? () => rejectRequest(inboundId) : undefined}
                      onMessage={tab === 'mentor' ? messageMentor : messageStudent}
                    />
                  );
                })}
                {list.length === 0 && (
                  <GlassCard className="p-4 text-white/80">No recommendations yet.</GlassCard>
                )}
              </div>
            )}
          </>
        )}

        {tab === "requests" && (
          <>
            <div className="flex items-center gap-2 mb-3">
              <button onClick={() => setReqTab("inbound")} className={`glass-btn px-3 py-1.5 ${reqTab === "inbound" ? "border-2 border-[var(--primary)]" : ""}`}>Inbound</button>
              <button onClick={() => setReqTab("outbound")} className={`glass-btn px-3 py-1.5 ${reqTab === "outbound" ? "border-2 border-[var(--primary)]" : ""}`}>Outbound</button>
            </div>
            {loading && <GlassCard className="p-4 text-white/80">Loading requests…</GlassCard>}
            {!loading && reqTab === "inbound" && (
              <div className="space-y-2">
                {inbound.length === 0 && <GlassCard className="p-4 text-white/80">No inbound requests.</GlassCard>}
                {inbound.map((r) => (
                  <GlassCard key={r._id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <img src={r.counterpart?.profilePictureUrl || "/avatars/1.png"} alt="pfp" className="h-8 w-8 rounded-full object-cover" />
                      <div className="text-white/90 truncate">
                        Incoming request from {r.counterpart?.name || (r.requester?.userModel === 'Teacher' ? 'Mentor' : 'Student')}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="glass-btn px-3 py-1.5" onClick={() => acceptRequest(r._id)}>Accept</button>
                      <button className="glass-btn px-3 py-1.5" onClick={() => rejectRequest(r._id)}>Reject</button>
                    </div>
                  </GlassCard>
                ))}
              </div>
            )}
            {!loading && reqTab === "outbound" && (
              <div className="space-y-2">
                {outbound.length === 0 && <GlassCard className="p-4 text-white/80">No outbound requests.</GlassCard>}
                {outbound.map((r) => (
                  <GlassCard key={r._id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <img src={r.counterpart?.profilePictureUrl || "/avatars/2.png"} alt="pfp" className="h-8 w-8 rounded-full object-cover" />
                      <div className="text-white/90 truncate">
                        Pending request to {r.counterpart?.name || (r.target?.userModel === 'Teacher' ? 'Mentor' : 'Student')}
                      </div>
                    </div>
                    <div>
                      <button className="glass-btn px-3 py-1.5" onClick={() => cancelRequest(r._id)}>Cancel</button>
                    </div>
                  </GlassCard>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "connections" && (
          <>
            {loading && <GlassCard className="p-4 text-white/80">Loading connections…</GlassCard>}
            {!loading && (
              <div className="space-y-6">
                <div>
                  <div className="text-white/90 font-semibold mb-2">Student connections</div>
                  <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {peers.length === 0 && <GlassCard className="p-4 text-white/80">No student connections yet.</GlassCard>}
                    {peers.map((s) => (
                      <GlassCard key={s._id} className="p-4">
                        <div className="flex items-start gap-3">
                          <img src={s.profilePictureUrl || "/avatars/1.png"} alt="pfp" className="h-14 w-14 rounded-full ring-2 ring-white/20 object-cover" />
                          <div className="flex-1 min-w-0">
                            <div className="text-white/95 font-semibold truncate">{s.name || "Student"}</div>
                            <div className="mt-3 flex gap-2">
                              <button className="glass-btn px-3 py-1.5" onClick={() => messageStudent(s)}>Message</button>
                            </div>
                          </div>
                        </div>
                      </GlassCard>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-white/90 font-semibold mb-2">Mentor connections</div>
                  <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {mentors.length === 0 && <GlassCard className="p-4 text-white/80">No mentors connected yet.</GlassCard>}
                    {mentors.map((m) => (
                      <GlassCard key={m._id} className="p-4">
                        <div className="flex items-start gap-3">
                          <img src={m.profilePictureUrl || "/avatars/2.png"} alt="pfp" className="h-14 w-14 rounded-full ring-2 ring-white/20 object-cover" />
                          <div className="flex-1 min-w-0">
                            <div className="text-white/95 font-semibold truncate flex items-center gap-2">{m.name || "Mentor"}</div>
                            <div className="text-white/70 text-sm truncate">{m.designation || m.department || "Mentor"}</div>
                            <div className="mt-3 flex gap-2">
                              <button className="glass-btn px-3 py-1.5" onClick={() => messageMentor(m)}>Message</button>
                              <button className="glass-btn px-3 py-1.5" onClick={() => unconnectMentor(m)}>Unconnect</button>
                            </div>
                          </div>
                        </div>
                      </GlassCard>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      {/* Toasts */}
      <div className="fixed right-3 bottom-[92px] z-40 space-y-2">
        {toasts.map(t => (
          <div key={t.id} className={`px-3 py-2 rounded-lg shadow text-sm text-white ${t.type === 'error' ? 'bg-red-500/90' : t.type === 'success' ? 'bg-emerald-600/90' : 'bg-slate-700/90'}`}>
            {t.msg}
          </div>
        ))}
      </div>
      <StudentBottomNav />
    </div>
  );
}
