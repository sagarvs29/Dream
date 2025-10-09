import React, { useState, useEffect } from "react";
import axios from "axios";

const API = axios.create({
  baseURL: import.meta.env?.VITE_API_BASE_URL || "http://localhost:5000/api",
  withCredentials: true,
});

const HomePage = () => {
  const [user, setUser] = useState(null);
  const [showUserInfo, setShowUserInfo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // No auto fetch on mount; we'll fetch when the user clicks Profile
  useEffect(() => {}, []);

  // Network panel visibility
  const [showNetwork, setShowNetwork] = useState(false);

  // Lazy-load network data when opened
  useEffect(() => {
    if (showNetwork) {
      loadRecs();
      loadOutgoingRequests();
      loadSchools();
      // also load accepted connections so UI can show "Connected"
      loadConnections?.();
    }
  }, [showNetwork]);

  // Background refresh while network panel is open
  useEffect(() => {
    if (!showNetwork) return;
    const id = setInterval(() => { loadOutgoingRequests(); loadConnections(); }, 15000);
    return () => clearInterval(id);
  }, [showNetwork]);

  const fetchUserProfile = async () => {
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("adm_token");
      if (!token) {
        setLoading(false);
        return;
      }

      // Try student profile endpoint first (for real Students collection data)
      try {
        const studentResponse = await API.get("/students/profile", {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (studentResponse.data.success) {
          setUser(studentResponse.data.student);
          return;
        }
      } catch (studentError) {
        // Try next fallback
      }

      // Try enhanced profile as fallback
      try {
        const enhancedResponse = await API.get("/profile/enhanced", {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (enhancedResponse.data.success) {
          setUser(enhancedResponse.data.profile);
          return;
        }
      } catch (enhancedError) {
        // Try basic profile
      }

      // Fallback to basic profile
      const response = await API.get("/auth/me", {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setUser(response.data);
      
    } catch (error) {
      console.error("API Error - falling back to dummy data:", error.message);
      // Set fallback user data if API fails
      setUser({
        realName: "Sample Student",
        schoolName: "Sample School",
        schoolLocation: "Sample City",
        grade: "Grade 10",
        uniqueStudentId: "SID-1234-567890",
        status: "APPROVED",
        email: "student@example.com",
        phone: "9876543210"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentBasics = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const res = await API.get("/students/me", { headers: { Authorization: `Bearer ${token}` } });
      if (res.data?.student) {
        setUser(prev => ({ ...(prev||{}), profileVisibility: res.data.student.profileVisibility || "Private" }));
      }
    } catch (_) {}
  };

  const handleProfilePictureUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size should be less than 5MB');
      return;
    }

    setUploading(true);
    
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        alert('Please log in again');
        return;
      }

      const formData = new FormData();
      formData.append('profilePicture', file);

      const response = await API.post("/students/profile/picture", formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        // Update user state with new profile picture
        setUser(prev => ({
          ...prev,
          profilePictureUrl: response.data.profilePictureUrl
        }));
        alert('Profile picture updated successfully!');
      }
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Failed to upload profile picture. Please try again.');
    } finally {
      setUploading(false);
      // Reset file input
      event.target.value = '';
    }
  };

  const setVisibility = async (next) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return alert("Login required");
      const prevVis = user?.profileVisibility || 'Private';
      // Optimistic UI update
      setUser(prev => ({ ...(prev||{}), profileVisibility: next }));
      const r = await API.patch("/students/me/visibility", { profileVisibility: next }, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.data?.ok) {
        // Rollback if backend didn't confirm
        setUser(prev => ({ ...(prev||{}), profileVisibility: prevVis }));
        alert(r?.data?.message || "Failed to update visibility");
      } else {
        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 2000);
      }
    } catch (e) {
      // Rollback on error
      setUser(prev => ({ ...(prev||{}), profileVisibility: user?.profileVisibility || 'Private' }));
      alert(e?.response?.data?.message || e?.message || "Failed to update visibility");
    }
  };

  const getFirstName = (fullName) => {
    if (!fullName) return "User";
    const firstName = fullName.split(" ")[0];
    return firstName || "User";
  };

  const toggleUserInfo = () => {
    setShowUserInfo(!showUserInfo);
  };

  const closeUserInfo = () => {
    setShowUserInfo(false);
  };

  const openProfile = async () => {
    setShowUserInfo(true);
    // Trigger fetch when opening the profile modal
    await fetchUserProfile();
    await fetchStudentBasics();
  };

  const [recs, setRecs] = useState({ mentors: [], students: [] });
  const [requestedStudents, setRequestedStudents] = useState([]);
  const [requestedTeachers, setRequestedTeachers] = useState([]);
  const [outgoingMap, setOutgoingMap] = useState({}); // targetId -> requestId
  const [myId, setMyId] = useState(null);
  const [connectedStudents, setConnectedStudents] = useState([]);
  const [connectedTeachers, setConnectedTeachers] = useState([]);
  const loadRecs = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const [m, s] = await Promise.all([
        API.get("/student/network/recommendations?type=mentor&limit=8", { headers: { Authorization: `Bearer ${token}` } }),
        API.get("/student/network/recommendations?type=student&limit=8", { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      setRecs({ mentors: m.data?.mentors||[], students: s.data?.students||[] });
    } catch (_) {}
  };

  // Load my outgoing pending connection requests to disable buttons accordingly
  const loadOutgoingRequests = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const r = await API.get("/student/network/requests?inbound=0", { headers: { Authorization: `Bearer ${token}` } });
      const reqs = r.data?.requests || [];
      const sIds = [];
      const tIds = [];
      const idByTarget = new Map();
      for (const cr of reqs) {
        const key = String(cr.target.userId);
        idByTarget.set(key, String(cr._id));
        if (cr?.target?.userModel === 'Student') sIds.push(key);
        if (cr?.target?.userModel === 'Teacher') tIds.push(key);
      }
      // De-duplicate
      setRequestedStudents([...new Set(sIds)]);
      setRequestedTeachers([...new Set(tIds)]);
      // save mapping to state
      const obj = {};
      for (const [k,v] of idByTarget.entries()) obj[k] = v;
      setOutgoingMap(obj);
    } catch (_) {}
  };

  const connect = async (targetId, targetModel) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return alert("Login required");
      const r = await API.post("/student/network/requests", { targetId, targetModel }, { headers: { Authorization: `Bearer ${token}` } });
      if (r.status === 201) {
        // Optimistically mark as requested
        if (targetModel === 'Student') setRequestedStudents(prev => [...new Set([...prev, String(targetId)])]);
        if (targetModel === 'Teacher') setRequestedTeachers(prev => [...new Set([...prev, String(targetId)])]);
        const newId = r?.data?.request?._id;
        if (newId) setOutgoingMap(prev => ({ ...prev, [String(targetId)]: String(newId) }));
        alert("Request sent");
        // Background refresh connections in a bit to reflect acceptance
        setTimeout(()=>{ loadConnections(); }, 5000);
      }
    } catch (e) {
      // If already pending (409), also mark as requested
      if (e?.response?.status === 409) {
        if (targetModel === 'Student') setRequestedStudents(prev => [...new Set([...prev, String(targetId)])]);
        if (targetModel === 'Teacher') setRequestedTeachers(prev => [...new Set([...prev, String(targetId)])]);
        // Refresh mapping to capture existing request id
        await loadOutgoingRequests();
        // Also refresh connections in background
        setTimeout(()=>{ loadConnections(); }, 5000);
        return; // No alert needed
      }
      alert(e?.response?.data?.message || "Failed to send request");
    }
  };

  const cancelRequest = async (targetId) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const crId = outgoingMap[String(targetId)];
      if (!crId) {
        // fallback: reload outgoing list
        await loadOutgoingRequests();
        return;
      }
      await API.delete(`/student/network/requests/${crId}`, { headers: { Authorization: `Bearer ${token}` } });
      setRequestedStudents(prev => prev.filter(id => id !== String(targetId)));
      setRequestedTeachers(prev => prev.filter(id => id !== String(targetId)));
      setOutgoingMap(prev => {
        const copy = { ...prev };
        delete copy[String(targetId)];
        return copy;
      });
    } catch (_) {}
  };

  const [tab, setTab] = useState('Students');
  const [search, setSearch] = useState('');
  const filteredStudents = recs.students.filter(s => (s.name||'').toLowerCase().includes(search.toLowerCase()));

  // Schools with mentors
  const [schools, setSchools] = useState([]);
  const [justSaved, setJustSaved] = useState(false);
  // Chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatConv, setChatConv] = useState(null);
  const [chatTarget, setChatTarget] = useState(null); // { id, model, name }
  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatText, setChatText] = useState("");
  const loadSchools = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const r = await API.get('/student/network/schools', { headers: { Authorization: `Bearer ${token}` } });
      setSchools(r.data?.schools || []);
    } catch (_) {}
  };

  // Ensure my student id (used for mapping connections)
  const ensureMyId = async () => {
    if (myId) return myId;
    try {
      const token = localStorage.getItem("token");
      if (!token) return null;
      const res = await API.get("/students/me", { headers: { Authorization: `Bearer ${token}` } });
      const id = res?.data?.student?._id || null;
      if (id) setMyId(String(id));
      return id;
    } catch (_) { return null; }
  };

  // Load accepted connections to display "Connected" state
  const loadConnections = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const id = (await ensureMyId()) || myId;
      if (!id) return;
      const r = await API.get('/student/network/connections', { headers: { Authorization: `Bearer ${token}` } });
      const list = r.data?.connections || [];
      const sSet = new Set();
      const tSet = new Set();
      for (const c of list) {
        const a = c.userA; const b = c.userB;
        const aId = String(a?.userId || '');
        const bId = String(b?.userId || '');
        if (aId === String(id)) {
          if (b?.userModel === 'Student') sSet.add(String(bId));
          if (b?.userModel === 'Teacher') tSet.add(String(bId));
        } else if (bId === String(id)) {
          if (a?.userModel === 'Student') sSet.add(String(aId));
          if (a?.userModel === 'Teacher') tSet.add(String(aId));
        }
      }
      setConnectedStudents(Array.from(sSet));
      setConnectedTeachers(Array.from(tSet));
    } catch (_) {}
  };

  const filteredSchools = schools.filter(s => {
    const q = search.toLowerCase();
    if ((s.name||'').toLowerCase().includes(q)) return true;
    if ((s.address||'').toLowerCase().includes(q)) return true;
    if (Array.isArray(s.mentors) && s.mentors.some(m => (m.name||'').toLowerCase().includes(q))) return true;
    return false;
  });

  // Safe profile display values
  const displayName = user?.realName || user?.name || user?.fullName || '—';
  const schoolName = user?.schoolName || user?.school?.name || (typeof user?.school === 'string' ? user.school : '') || '—';
  const schoolLocation = user?.schoolLocation || user?.school?.address || user?.city || '';
  const schoolCode = user?.schoolCode || user?.school?.code || '';
  const grade = user?.grade || user?.currentGrade || user?.class || user?.standard || '—';
  const rollNo = user?.rollNo || user?.rollNumber || '';
  const admitted = user?.admitted || user?.admissionYear || '';
  const email = user?.email || user?.mail || '';
  const phone = user?.phone || user?.mobile || '';

  // Chat helpers
  async function openChat(targetId, targetModel, targetName) {
    try {
      const token = localStorage.getItem("token");
      if (!token) return alert("Login required");
      const r = await API.post("/chat/start", { targetId, targetModel }, { headers: { Authorization: `Bearer ${token}` } });
      const conv = r.data?.conversation;
      if (!conv) return;
      setChatConv(conv);
      setChatTarget({ id: targetId, model: targetModel, name: targetName||'' });
      setChatOpen(true);
      await loadMessages(conv._id);
    } catch (e) {
      alert(e?.response?.data?.message || "Failed to start chat");
    }
  }

  async function loadMessages(conversationId) {
    try {
      const token = localStorage.getItem("token");
      if (!token || !conversationId) return;
      setChatLoading(true);
      const r = await API.get(`/chat/messages`, { params: { conversation: conversationId, limit: 50 }, headers: { Authorization: `Bearer ${token}` } });
      setChatMessages(r.data?.messages || []);
    } finally {
      setChatLoading(false);
    }
  }

  async function sendMessage(e) {
    e?.preventDefault?.();
    const text = chatText.trim();
    if (!text || !chatConv?._id) return;
    try {
      const token = localStorage.getItem("token");
      const r = await API.post(`/chat/messages`, { conversation: chatConv._id, text }, { headers: { Authorization: `Bearer ${token}` } });
      const msg = r.data?.message;
      if (msg) setChatMessages(prev => [...prev, msg]);
      setChatText("");
    } catch (_) {}
  }

  useEffect(() => {
    if (!chatOpen || !chatConv?._id) return;
    const id = setInterval(() => { loadMessages(chatConv._id); }, 5000);
    return () => clearInterval(id);
  }, [chatOpen, chatConv?._id]);
  
  return (
      <div className="pt-24 px-6 pb-16">
        <div className="max-w-6xl mx-auto">
          {/* Top actions */}
          <div className="flex justify-end">
            <button onClick={openProfile} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">
              <span>Profile</span>
            </button>
          </div>

          {/* Network entry/panel below */}
          {!showNetwork ? (
            <div className="rounded-2xl border shadow-sm p-8 bg-white/70 text-center">
              <h2 className="text-2xl font-bold">Student Network</h2>
              <p className="text-gray-600 mt-1">Discover students and schools, and connect</p>
              <button
                className="mt-6 inline-flex items-center px-6 py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => setShowNetwork(true)}
              >
                Open Network
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border shadow-sm p-6 bg-white/70 backdrop-blur">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Student Network</h2>
                  <p className="text-gray-600 mt-1">Connect with students and explore schools (mentors are under each school)</p>
                </div>
                <button className="text-gray-600 hover:text-gray-800" onClick={()=>setShowNetwork(false)}>Close ✖</button>
              </div>

              {/* Tabs */}
              <div className="flex justify-center gap-2 mt-6">
                {['Students','Schools'].map(t => (
                  <button key={t} onClick={()=>setTab(t)} className={`px-4 py-2 rounded ${tab===t? 'bg-blue-600 text-white':'bg-gray-100 text-gray-700'}`}>{t}</button>
                ))}
              </div>

              {/* Search */}
              <div className="mt-4">
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={`Search ${tab.toLowerCase()}`} className="w-full px-4 py-2 border rounded" />
              </div>

              {/* Grid */}
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                {tab === 'Students' && (
                  filteredStudents.length === 0 ? (
                    <div className="text-gray-500 col-span-full">No students yet</div>
                  ) : (
                    filteredStudents.map(s => {
                      const isRequested = requestedStudents.includes(String(s._id));
                      const isConnected = connectedStudents.includes(String(s._id));
                      return (
                        <div key={s._id} className="rounded-xl border p-4 bg-white">
                          <div className="w-12 h-12 rounded-full bg-gray-200 mb-2"></div>
                          <div className="font-semibold">{s.name}</div>
                          <div className="text-sm text-gray-500">{s.school?.name || ''}</div>
                          {isConnected ? (
                            <div className="mt-3 w-full px-3 py-2 rounded bg-emerald-100 text-emerald-700 text-center text-sm">Connected</div>
                          ) : isRequested ? (
                            <button
                              className="mt-3 w-full px-3 py-2 rounded bg-gray-200 text-gray-700"
                              onClick={() => cancelRequest(s._id)}
                            >
                              Cancel request
                            </button>
                          ) : (
                            <button
                              className="mt-3 w-full px-3 py-2 rounded bg-blue-600 text-white"
                              onClick={() => connect(s._id, 'Student')}
                            >
                              Connect
                            </button>
                          )}
                        </div>
                      );
                    })
                  )
                )}

                {tab === 'Schools' && (
                  filteredSchools.length === 0 ? (
                    <div className="text-gray-500 col-span-full">No schools found</div>
                  ) : (
                    filteredSchools.map(s => (
                      <div key={s._id} className="rounded-xl border p-4 bg-white">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded bg-gray-200"></div>
                          <div>
                            <div className="font-semibold">{s.name}</div>
                            <div className="text-sm text-gray-500">{s.address || ''}</div>
                          </div>
                        </div>
                        {s.principalName && (
                          <div className="mt-3 text-sm text-gray-700">Principal: {s.principalName}</div>
                        )}
                        {Array.isArray(s.heads) && s.heads.length > 0 && (
                          <div className="mt-2">
                            <div className="text-xs text-gray-500">Heads of Departments</div>
                            <ul className="mt-1 space-y-1">
                              {s.heads.slice(0,3).map((h,idx)=>(
                                <li key={idx} className="text-sm text-gray-700">{h.department ? `${h.department}: `: ''}{h.name}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {/* Mentors under this school */}
                        <div className="mt-4">
                          <div className="text-xs text-gray-500 mb-2">Mentors</div>
                          {(!s.mentors || s.mentors.length===0) ? (
                            <div className="text-gray-400 text-sm">No mentors listed</div>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {s.mentors.map(m => {
                                const isRequested = requestedTeachers.includes(String(m._id));
                                const isConnected = connectedTeachers.includes(String(m._id));
                                return (
                                  <div key={m._id} className="border rounded-lg px-3 py-2 bg-gray-50">
                                    <div className="text-sm font-medium">{m.name}</div>
                                    <div className="text-xs text-gray-500">{m.department || ''}</div>
                                    {isConnected ? (
                                      <span className="mt-2 inline-block text-xs px-2 py-1 rounded bg-emerald-100 text-emerald-700">Connected</span>
                                    ) : isRequested ? (
                                      <button className="mt-2 text-xs px-2 py-1 rounded bg-gray-200 text-gray-700" onClick={()=>cancelRequest(m._id)}>Cancel</button>
                                    ) : (
                                      <button className="mt-2 text-xs px-2 py-1 rounded bg-blue-600 text-white" onClick={()=>connect(m._id,'Teacher')}>Connect</button>
                                    )}
                                    <button className="mt-2 ml-2 text-xs px-2 py-1 rounded bg-emerald-600 text-white" onClick={()=>openChat(m._id,'Teacher', m.name)}>Message</button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )
                )}
              </div>
            </div>
          )}
        </div>
        {/* Profile modal overlay */}
        {showUserInfo && (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-14 bg-black/30">
            <div className="w-full max-w-xl mx-auto px-4 max-h-[calc(100vh-3.5rem)] flex flex-col">
              {/* Card header */}
              <div className="rounded-t-2xl overflow-hidden bg-gradient-to-r from-indigo-500 to-purple-500 text-white p-5 flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-white/30 flex items-center justify-center">
                  <span className="text-lg">👤</span>
                </div>
                <div className="flex-1">
                  <div className="text-lg font-semibold">Student Profile</div>
                  <div className="text-sm text-white/90">Logged in user details</div>
                </div>
                <button className="text-white/90 hover:text-white" onClick={closeUserInfo}>✖</button>
              </div>

              {/* Profile details */}
              <div className="rounded-b-2xl bg-white p-4 space-y-3 shadow-xl overflow-y-auto flex-1">
                {loading ? (
                  <div className="p-10 text-center text-gray-600">Loading…</div>
                ) : (
                  <>
                    <div className="rounded-xl border p-4 bg-green-50 border-green-200">
                      <div className="text-xs font-semibold text-green-800 flex items-center gap-2">
                        <span>✅</span> Aadhaar Verified Name
                      </div>
                      <div className="mt-1 text-lg font-semibold text-gray-900">{displayName}</div>
                    </div>

                    <div className="rounded-xl border p-4 bg-blue-50 border-blue-200">
                      <div className="text-xs font-semibold text-blue-800 flex items-center gap-2">
                        <span>🏫</span> Approved by School
                      </div>
                      <div className="mt-1 font-semibold text-gray-900">{schoolName}</div>
                      {(schoolLocation || schoolCode || email) && (
                        <div className="mt-1 space-y-0.5 text-sm text-gray-700">
                          {schoolLocation && <div>📍 {schoolLocation}</div>}
                          {schoolCode && <div>School Code: {schoolCode}</div>}
                          {email && <div>✉️ {email}</div>}
                        </div>
                      )}
                    </div>

                    <div className="rounded-xl border p-4 bg-purple-50 border-purple-200">
                      <div className="text-xs font-semibold text-purple-800 flex items-center gap-2">
                        <span>🎓</span> Academic Details
                      </div>
                      <div className="mt-1 text-gray-900">
                        <div className="font-semibold">Class {grade !== '—' ? grade : '—'}</div>
                        <div className="text-sm text-gray-700 space-y-0.5 mt-1">
                          {rollNo && <div>Roll No: {rollNo}</div>}
                          {admitted && <div>Admitted: {admitted}</div>}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border p-4 bg-gray-50 border-gray-200">
                      <div className="text-xs font-semibold text-gray-700 flex items-center gap-2">
                        <span>📞</span> Contact Information
                      </div>
                      <div className="mt-1 text-sm text-gray-900">
                        {email ? <div>✉️ {email}</div> : <div className="text-gray-500">—</div>}
                        {phone && <div className="text-gray-700">📱 {phone}</div>}
                      </div>
                    </div>

                    {/* Current Grade */}
                    <div className="rounded-xl border p-4 bg-indigo-50 border-indigo-200">
                      <div className="text-xs font-semibold text-indigo-800">Current Grade</div>
                      <div className="mt-1 text-lg font-semibold text-gray-900">Class {grade}</div>
                    </div>

                    {/* Student ID */}
                    { (user?.uniqueStudentId || rollNo) && (
                      <div className="rounded-xl border p-4 bg-orange-50 border-orange-200">
                        <div className="text-xs font-semibold text-orange-800">Student ID</div>
                        <div className="mt-1 text-base font-semibold text-gray-900">{user?.uniqueStudentId || rollNo}</div>
                      </div>
                    )}

                    {/* Account Status */}
                    { user?.status && (
                      <div className={`rounded-xl border p-4 ${String(user.status).toUpperCase()==='APPROVED' ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                        <div className={`text-xs font-semibold ${String(user.status).toUpperCase()==='APPROVED' ? 'text-green-800' : 'text-yellow-800'}`}>Account Status</div>
                        <div className={`mt-1 text-base font-semibold ${String(user.status).toUpperCase()==='APPROVED' ? 'text-green-700' : 'text-yellow-700'}`}>{String(user.status).charAt(0).toUpperCase()+String(user.status).slice(1).toLowerCase()}</div>
                      </div>
                    )}

                    {/* Update Profile Picture */}
                    <div className="rounded-xl border p-4 bg-blue-50/40 border-blue-200">
                      <label htmlFor="profilePicInput" className="text-blue-700 font-medium cursor-pointer hover:underline flex items-center gap-2">
                        <span>🖼️</span>
                        <span>Update Profile Picture</span>
                      </label>
                      <input
                        id="profilePicInput"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleProfilePictureUpload}
                        disabled={uploading}
                      />
                      {uploading && <div className="text-xs text-blue-600 mt-1">Uploading…</div>}
                    </div>

                    {/* Profile Visibility Toggle */}
                    <div className="rounded-xl border p-4 bg-white">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs text-gray-700">Profile Visibility</div>
                        {justSaved && <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Saved</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-700 w-16">Private</span>
                        <button
                          className={`px-4 py-2 rounded-lg text-sm font-medium ${ (user?.profileVisibility||'Private')==='Private' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800' }`}
                          onClick={() => setVisibility('Private')}
                        >
                          Private
                        </button>
                        <button
                          className={`px-4 py-2 rounded-lg text-sm font-medium ${ (user?.profileVisibility||'Private')==='Public' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800' }`}
                          onClick={() => setVisibility('Public')}
                        >
                          Public
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
              <div className="py-3 text-center">
                <button className="text-gray-700 hover:text-gray-900" onClick={closeUserInfo}>Close</button>
              </div>
            </div>
          </div>
        )}
        {/* Chat drawer */}
        {chatOpen && (
          <div className="fixed right-4 bottom-4 w-full max-w-md rounded-xl overflow-hidden shadow-xl border bg-white/90 backdrop-blur">
            <div className="bg-indigo-600 text-white px-4 py-2 flex items-center justify-between">
              <div className="font-semibold">Chat {chatTarget?.name ? `with ${chatTarget.name}` : ''}</div>
              <button onClick={()=>setChatOpen(false)} className="text-white/90 hover:text-white">✖</button>
            </div>
            <div className="h-64 overflow-y-auto p-3">
              {chatLoading && <div className="text-sm text-gray-600">Loading…</div>}
              {!chatLoading && chatMessages.length === 0 && <div className="text-sm text-gray-600">No messages yet</div>}
              <div className="space-y-2">
                {chatMessages.map(m => (
                  <div key={m._id} className={`max-w-[80%] px-3 py-2 rounded-lg ${m.from?.userModel==='Student' ? 'bg-blue-100 ml-auto' : 'bg-gray-100 mr-auto'}`}>
                    <div className="text-sm text-gray-900">{m.text}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">{new Date(m.createdAt).toLocaleTimeString()}</div>
                  </div>
                ))}
              </div>
            </div>
            <form onSubmit={sendMessage} className="flex items-center gap-2 p-2 border-t bg-white">
              <input className="flex-1 px-3 py-2 border rounded" value={chatText} onChange={e=>setChatText(e.target.value)} placeholder="Type a message" />
              <button className="px-3 py-2 rounded bg-indigo-600 text-white">Send</button>
            </form>
          </div>
        )}
        </div>
    );
  };

  export default HomePage;
