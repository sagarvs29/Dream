import React, { useEffect, useMemo, useRef, useState } from "react";

const API_BASE =
  import.meta.env?.VITE_API_BASE_URL || "http://localhost:5000/api";

export default function MentorDashboard() {
  const [me, setMe] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [current, setCurrent] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [text, setText] = useState("");
  const [tab, setTab] = useState("Chat");
  const [requests, setRequests] = useState([]);
  const [mentees, setMentees] = useState([]);
  const [loadingReq, setLoadingReq] = useState(false);
  const [chatFilter, setChatFilter] = useState("");

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("mentor_token")
      : null;

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const messagesEndRef = useRef(null);

  // Helper Functions
  const nameOf = (obj) =>
    obj?.name || (obj?.model === "Student" ? "Student" : "User");
  const initialsOf = (obj) =>
    (obj?.name || "U")
      .split(" ")
      .map((s) => s[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  async function loadConversations() {
    const r = await fetch(`${API_BASE}/chat/conversations`, { headers });
    if (r.ok) {
      const list = (await r.json()).conversations || [];
      setConversations(list);
      if (!current && list.length) setCurrent(list[0]);
    }
  }

  async function loadRequests() {
    setLoadingReq(true);
    try {
      const r = await fetch(`${API_BASE}/mentor/requests`, { headers });
      if (r.ok) setRequests((await r.json()).requests || []);
    } finally {
      setLoadingReq(false);
    }
  }

  async function loadMentees() {
    const r = await fetch(`${API_BASE}/mentor/mentees`, { headers });
    if (r.ok) setMentees((await r.json()).mentees || []);
  }

  async function actRequest(id, action) {
    const r = await fetch(`${API_BASE}/mentor/requests/${id}/${action}`, {
      method: "POST",
      headers,
    });
    if (r.ok) {
      loadRequests();
      loadMentees();
    }
  }

  async function loadMe() {
    const r = await fetch(`${API_BASE}/mentor/me`, { headers });
    if (r.ok) setMe((await r.json()).mentor);
  }

  async function loadMessages(convId) {
    if (!convId) return;
    setLoadingMsgs(true);
    try {
      const r = await fetch(
        `${API_BASE}/chat/messages?conversation=${encodeURIComponent(
          convId
        )}&limit=100`,
        { headers }
      );
      if (r.ok) setMessages((await r.json()).messages || []);
    } finally {
      setLoadingMsgs(false);
    }
  }

  async function sendMessage(e) {
    e?.preventDefault?.();
    const msg = text.trim();
    if (!msg || !current?._id) return;
    const r = await fetch(`${API_BASE}/chat/messages`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ conversation: current._id, text: msg }),
    });
    const data = await r.json().catch(() => ({}));
    if (r.ok && data?.message) {
      setMessages((prev) => [...prev, data.message]);
      setText("");
    }
  }

  async function startChatWithStudent(studentId) {
    const r = await fetch(`${API_BASE}/chat/start`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ targetId: studentId, targetModel: "Student" }),
    });
    const data = await r.json().catch(() => ({}));
    if (r.ok && data?.conversation) {
      await loadConversations();
      setCurrent(data.conversation);
      setTab("Chat");
      await loadMessages(data.conversation._id);
    }
  }

  useEffect(() => {
    if (token) {
      loadMe();
      loadConversations();
      loadRequests();
      loadMentees();
    }
  }, [token]);

  useEffect(() => {
    if (current?._id) loadMessages(current._id);
  }, [current?._id]);

  useEffect(() => {
    if (!current?._id) return;
    const id = setInterval(() => loadMessages(current._id), 5000);
    return () => clearInterval(id);
  }, [current?._id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loadingMsgs]);

  const filteredConversations = useMemo(() => {
    const q = chatFilter.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) =>
      (nameOf(c.other) || "").toLowerCase().includes(q)
    );
  }, [conversations, chatFilter]);

  return (
    <div className="h-screen flex flex-col text-white overflow-hidden bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* ======= Top Navbar ======= */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-slate-900/90 border-b border-white/10 backdrop-blur-md shadow-lg">
        <div className="max-w-screen-2xl mx-auto px-4">
          <div className="h-16 flex items-center justify-between">
            {/* Left: Title */}
            <div className="text-xl sm:text-2xl font-semibold whitespace-nowrap">
              Mentor Dashboard
            </div>

            {/* Center: Tabs */}
            <nav
              className="hidden md:flex items-center justify-center bg-white/10 rounded-xl px-3 py-1 gap-4"
              role="tablist"
              aria-label="Dashboard tabs"
            >
              {["Chat", "Requests", "Mentees"].map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-2 rounded-lg text-sm sm:text-base transition-all ${
                    tab === t
                      ? "bg-white/20 text-white shadow-sm"
                      : "text-white/80 hover:bg-white/10"
                  }`}
                >
                  {t}
                </button>
              ))}
            </nav>

            {/* Mobile Tabs */}
            <nav className="md:hidden flex overflow-x-auto no-scrollbar bg-white/10 rounded-xl px-2 py-1 gap-2">
              {["Chat", "Requests", "Mentees"].map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-none whitespace-nowrap rounded-lg px-3 py-2 text-sm ${
                    tab === t
                      ? "bg-white/20 text-white shadow-sm"
                      : "text-white/80 hover:bg-white/10"
                  }`}
                >
                  {t}
                </button>
              ))}
            </nav>

            {/* Right: Logout */}
            <button
              onClick={() => {
                localStorage.removeItem("mentor_token");
                window.location.href = "/mentor/login";
              }}
              className="text-sm sm:text-base bg-white/10 hover:bg-white/20 px-4 py-2 rounded transition"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* ======= Main Content ======= */}
      <main className="flex-1 pt-16 overflow-hidden max-w-screen-2xl mx-auto px-3 sm:px-4 w-full">
        <div className="h-[calc(100vh-4rem)] grid grid-cols-1 lg:grid-cols-12 gap-4 overflow-hidden">
          {/* Sidebar */}
          <aside className="hidden lg:flex lg:col-span-4 xl:col-span-3 h-full">
            <div className="glass-card w-full rounded-xl ring-1 ring-white/10 shadow-md flex flex-col overflow-hidden">
              {tab !== "Chat" ? (
                <div className="p-4 overflow-auto">
                  <div className="font-semibold mb-2">Profile</div>
                  {!me ? (
                    <div>Loading...</div>
                  ) : (
                    <div className="text-sm opacity-90 space-y-1">
                      <div>{me.name}</div>
                      <div>{me.email}</div>
                      <div>
                        {me.department} • {me.designation}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                    <div className="font-semibold">Messages</div>
                    <button
                      onClick={() => setTab("Requests")}
                      className="text-xs sm:text-sm text-white/80 hover:text-white"
                    >
                      Requests
                    </button>
                  </div>
                  <div className="p-3 shrink-0">
                    <input
                      className="w-full rounded bg-white/80 text-slate-900 px-3 py-2 text-sm sm:text-base"
                      placeholder="Search"
                      value={chatFilter}
                      onChange={(e) => setChatFilter(e.target.value)}
                    />
                  </div>
                  <ul className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
                    {!filteredConversations.length && (
                      <li className="text-sm opacity-80 px-3 py-2">
                        No conversations
                      </li>
                    )}
                    {filteredConversations.map((c) => (
                      <li
                        key={c._id}
                        onClick={() => {
                          setCurrent(c);
                          setTab("Chat");
                        }}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer transition ${
                          current?._id === c._id
                            ? "bg-white/20"
                            : "hover:bg-white/10"
                        }`}
                      >
                        <div className="w-9 h-9 rounded-full bg-white/30 text-white flex items-center justify-center text-xs font-semibold">
                          {initialsOf(c.other)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="truncate">{nameOf(c.other)}</div>
                          <div className="text-xs opacity-70 truncate">
                            {new Date(
                              c.updatedAt || c.lastMessageAt || c.createdAt
                            ).toLocaleString()}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </aside>

          {/* ======= Main Right Section ======= */}
          <section className="lg:col-span-8 xl:col-span-9 glass-card rounded-xl ring-1 ring-white/10 shadow-md flex flex-col h-full overflow-hidden">
            <div className="px-4 py-3 border-b border-white/20 flex items-center justify-between">
              {tab === "Chat" && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white/30 text-white flex items-center justify-center text-xs font-semibold">
                    {initialsOf(current?.other)}
                  </div>
                  <div className="font-semibold truncate">
                    {current?.other?.name || "Select a conversation"}
                  </div>
                </div>
              )}
              {tab === "Requests" && (
                <div className="font-semibold text-base sm:text-lg">
                  Connection Requests
                </div>
              )}
              {tab === "Mentees" && (
                <div className="font-semibold text-base sm:text-lg">
                  Your Mentees
                </div>
              )}
            </div>

            {/* ======= Tab Content ======= */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0 animate-fade-in">
              {tab === "Chat" && (
                <>
                  {!messages.length &&
                    (loadingMsgs ? (
                      <div>Loading…</div>
                    ) : (
                      <div className="opacity-80">No messages yet</div>
                    ))}
                  {messages.map((m) => (
                    <div
                      key={m._id}
                      className={`max-w-[80%] md:max-w-[70%] px-3 py-2 rounded-2xl ${
                        m.from?.userModel === "Teacher"
                          ? "bg-blue-100 ml-auto text-slate-900"
                          : "bg-white/20 mr-auto"
                      }`}
                    >
                      <div className="text-sm sm:text-base whitespace-pre-wrap break-words">
                        {m.text}
                      </div>
                      <div className="text-[10px] sm:text-xs opacity-70 mt-0.5">
                        {new Date(m.createdAt).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </>
              )}

              {tab === "Requests" && (
                <>
                  {loadingReq && <div>Loading…</div>}
                  {!loadingReq &&
                    (!requests || requests.length === 0) && (
                      <div className="opacity-80">No pending requests</div>
                    )}
                  {(requests || []).map((r) => (
                    <div
                      key={r.id || r._id}
                      className="rounded-lg bg-white/10 p-3 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-medium">
                          {r.student?.name || r.name || "Student"}
                        </div>
                        <div className="text-xs opacity-75">
                          {r.student?.email || r.email || ""}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button className="px-3 py-1 rounded bg-green-500/80 text-white text-sm">
                          Accept
                        </button>
                        <button className="px-3 py-1 rounded bg-red-500/80 text-white text-sm">
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {tab === "Mentees" && (
                <>
                  {mentees.map((m) => (
                    <div
                      key={m.connectionId || m.id}
                      className="rounded border border-white/20 p-3 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-white/30 text-white flex items-center justify-center text-xs font-semibold">
                          {initialsOf(m.student)}
                        </div>
                        <div>
                          <div className="font-medium">
                            {m.student?.name || "Student"}
                          </div>
                          <div className="text-xs opacity-80">
                            {m.student?.email || ""} •{" "}
                            {m.student?.department || ""}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => startChatWithStudent(m.student?.id)}
                        className="btn-primary px-3 py-2 rounded text-sm sm:text-base"
                      >
                        Message
                      </button>
                    </div>
                  ))}
                  {!mentees.length && (
                    <div className="opacity-80">No mentees yet</div>
                  )}
                </>
              )}
            </div>

            {/* Chat Input */}
            {tab === "Chat" && (
              <form
                onSubmit={sendMessage}
                className="p-3 border-t border-white/20 flex gap-2 items-center shrink-0"
              >
                <input
                  className="flex-1 rounded-full px-4 py-2 bg-white/90 text-slate-900 text-sm sm:text-base"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Type a message"
                />
                <button
                  disabled={!text.trim()}
                  className="btn-primary px-4 py-2 rounded text-sm sm:text-base disabled:opacity-60"
                >
                  Send
                </button>
              </form>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
