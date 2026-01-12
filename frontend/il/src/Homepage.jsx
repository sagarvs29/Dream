import React, { useState, useEffect } from "react";
import api from "./utils/apiClient";
import NewPostFlow from "./components/newpost/NewPostFlow.jsx";

const API = api;

const HomePage = () => {
  const [user, setUser] = useState(null);
  const [showUserInfo, setShowUserInfo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showNewPost, setShowNewPost] = useState(false);
  const [expandedCaptions, setExpandedCaptions] = useState({}); // postId -> bool
  const [menuOpenId, setMenuOpenId] = useState(null); // owner three-dot menu

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

  const initialsOfName = (name) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((s) => s[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  async function sendCollabRequest(targetStudentId) {
    try {
      const token = localStorage.getItem("token");
      if (!token) return alert("Login required");
      const r = await API.post(
        "/student/network/requests",
        { targetId: targetStudentId, targetModel: "Student" },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (r.data?.success) {
        alert("Collaboration request sent");
      } else {
        alert(r.data?.message || "Failed to send request");
      }
    } catch (e) {
      alert(e?.response?.data?.message || e?.message || "Failed to send request");
    }
  }

  async function shareGeneric(post) {
    try {
      const text = `${post.caption || ''}${post.caption ? '\n' : ''}${post.media?.[0]?.url || ''}`.trim();
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        alert("Post link copied to clipboard");
      } else {
        window.prompt("Copy this", text);
      }
    } catch (_) {
      alert("Could not copy");
    }
  }

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

  // ==================== Posts (Create + Feed) ====================
  const [feed, setFeed] = useState([]);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [myStudentId, setMyStudentId] = useState(null);
  // Edit modal state
  const [editingPost, setEditingPost] = useState(null);
  const [editCaption, setEditCaption] = useState("");
  const [editFile, setEditFile] = useState(null);
  const [editPreview, setEditPreview] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  // Share modal state
  const [sharePostObj, setSharePostObj] = useState(null);
  const [mentors, setMentors] = useState([]);
  const [loadingMentors, setLoadingMentors] = useState(false);
  const [sendingShareTo, setSendingShareTo] = useState(null);
  const [appreciationsByPost, setAppreciationsByPost] = useState({}); // postId -> list
  const [newAppText, setNewAppText] = useState({}); // postId -> text
  const [connectedStudentIds, setConnectedStudentIds] = useState([]);

  async function loadFeed(scope = "school") {
    try {
      setLoadingFeed(true);
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const r = await API.get(`/posts/feed`, { params: { scope }, headers });
      setFeed(r.data?.posts || []);
    } catch (_) {
      setFeed([]);
    } finally {
      setLoadingFeed(false);
    }
  }

  useEffect(() => {
    // try to load a school-scoped feed if logged in; falls back to public feed on server side
    loadFeed("school");
    // also learn my id to control self actions
    (async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;
        const r = await API.get('/students/me', { headers: { Authorization: `Bearer ${token}` } });
        setMyStudentId(r.data?.student?._id || null);
      } catch (_) {}
    })();
    // load connections for connected badge
    (async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const r = await API.get('/student/network/connections', { headers: { Authorization: `Bearer ${token}` } });
        const myId = await ensureMyId?.();
        const list = r.data?.connections || [];
        const setIds = new Set();
        for (const c of list) {
          const a = c.userA, b = c.userB;
          if (String(a.userModel) === 'Student' && String(b.userId) === String(myId)) setIds.add(String(a.userId));
          if (String(b.userModel) === 'Student' && String(a.userId) === String(myId)) setIds.add(String(b.userId));
        }
        setConnectedStudentIds(Array.from(setIds));
      } catch (_) {}
    })();
  }, []);

  // createPost handled inside PostComposer, use onPostCreated to prepend to feed

  async function toggleLike(postId) {
    try {
      const token = localStorage.getItem("token");
      if (!token) return alert("Login required");
      const r = await API.post(`/posts/${postId}/like`, {}, { headers: { Authorization: `Bearer ${token}` } });
      const { liked, likeCount } = r.data || {};
      setFeed(prev => prev.map(p => p._id === postId ? { ...p, likeCount } : p));
    } catch (_) {}
  }

  function openEditPost(p) {
    setEditingPost(p);
    setEditCaption(p.caption || "");
    setEditFile(null);
    setEditPreview(p.media?.[0]?.url || "");
  }

  function onEditFileChange(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/') && !f.type.startsWith('video/')) {
      alert('Please select an image or video');
      return;
    }
    setEditFile(f);
    const reader = new FileReader();
    reader.onload = () => setEditPreview(String(reader.result || ""));
    reader.readAsDataURL(f);
  }

  async function saveEditPost() {
    if (!editingPost) return;
    try {
      setSavingEdit(true);
      const token = localStorage.getItem("token");
      if (!token) return alert("Login required");
      let media = editingPost.media;
      if (editFile) {
        const fd = new FormData();
        fd.append('file', editFile);
        const up = await API.post('/posts/upload', fd, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } });
        media = [up.data.media];
      }
      const r = await API.patch(`/posts/${editingPost._id}`, { caption: editCaption, media }, { headers: { Authorization: `Bearer ${token}` } });
      const updated = r.data?.post;
      if (updated) {
        setFeed(prev => prev.map(p => p._id === updated._id ? updated : p));
        setEditingPost(null);
      }
    } catch (e) {
      alert(e?.response?.data?.message || e?.message || 'Failed to update post');
    } finally {
      setSavingEdit(false);
    }
  }

  async function deletePost(id) {
    if (!confirm('Delete this post?')) return;
    try {
      const token = localStorage.getItem("token");
      if (!token) return alert("Login required");
      await API.delete(`/posts/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      setFeed(prev => prev.filter(p => p._id !== id));
    } catch (e) {
      alert(e?.response?.data?.message || 'Failed to delete');
    }
  }

  async function sharePost(p) {
    setSharePostObj(p);
    setLoadingMentors(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const r = await API.get('/student/network/mentors', { headers: { Authorization: `Bearer ${token}` } });
      setMentors(r.data?.mentors || []);
    } catch (_) {
      setMentors([]);
    } finally {
      setLoadingMentors(false);
    }
  }

  async function sendShareToMentor(mid) {
    if (!sharePostObj) return;
    try {
      setSendingShareTo(String(mid));
      const token = localStorage.getItem('token');
      if (!token) return alert('Login required');
      // Start chat and send a message with the post
      const start = await API.post('/chat/start', { targetId: mid, targetModel: 'Teacher' }, { headers: { Authorization: `Bearer ${token}` } });
      const conv = start.data?.conversation;
      if (conv?._id) {
        const msg = `Please check my post: ${sharePostObj.media?.[0]?.url}\n\n${sharePostObj.caption || ''}`;
        await API.post('/chat/messages', { conversation: conv._id, text: msg }, { headers: { Authorization: `Bearer ${token}` } });
      }
      setSharePostObj(null);
      alert('Shared to mentor');
    } catch (e) {
      alert(e?.response?.data?.message || 'Failed to share');
    } finally {
      setSendingShareTo(null);
    }
  }

  async function loadAppreciations(postId) {
    try {
      const r = await API.get(`/posts/${postId}/appreciations`);
      setAppreciationsByPost(prev => ({ ...prev, [postId]: r.data?.appreciations || [] }));
    } catch (_) {
      setAppreciationsByPost(prev => ({ ...prev, [postId]: [] }));
    }
  }

  async function addAppreciation(postId) {
    const text = (newAppText[postId] || '').trim();
    if (!text) return;
    try {
      const token = localStorage.getItem('token');
      if (!token) return alert('Login required');
      const r = await API.post(`/posts/${postId}/appreciations`, { text }, { headers: { Authorization: `Bearer ${token}` } });
      const a = r.data?.appreciation;
      if (a) {
        setAppreciationsByPost(prev => ({ ...prev, [postId]: [ ...(prev[postId]||[]), a ] }));
        setNewAppText(prev => ({ ...prev, [postId]: '' }));
      }
    } catch (e) {
      alert(e?.response?.data?.message || 'Failed to add comment');
    }
  }
  
  return (
      <div className="min-h-screen w-full relative overflow-hidden bg-gradient-to-br from-[#7a75ff] via-[#a479ff] to-[#79ccff]">
        {/* Decorative background blobs */}
        <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-white/35 blur-3xl" />
        <div className="absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-white/30 blur-3xl" />
        <div className="absolute top-1/3 -right-10 h-72 w-72 rounded-full bg-pink-300/30 blur-3xl" />
        <div className="absolute top-1/4 left-10 h-64 w-64 rounded-full bg-blue-200/40 blur-3xl" />

        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Top actions */}
          <div className="flex justify-end">
            <button onClick={openProfile} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">
              <span>Profile</span>
            </button>
          </div>

          {/* Create Post - glass button */}
          <div className="mb-8">
            <button onClick={()=>setShowNewPost(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur">
              New Post
            </button>
          </div>
          <NewPostFlow open={showNewPost} onClose={()=>setShowNewPost(false)} onPosted={(p)=>setFeed(prev=>[p,...prev])} />

          {/* Feed container */}
          <div className="rounded-3xl border border-white/25 bg-white/12 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.18)] p-6 mb-8 text-white">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white/90">Feed</h2>
              <div className="flex items-center gap-2">
                <button onClick={()=>loadFeed("school")} className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white/90 border border-white/25">School</button>
                <button onClick={()=>loadFeed("public")} className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white/90 border border-white/25">Public</button>
              </div>
            </div>
            {loadingFeed ? (
              <div className="text-white/80">Loading…</div>
            ) : feed.length === 0 ? (
              <div className="text-white/70">No posts yet</div>
            ) : (
              <div className="space-y-5">
                {feed.map((p) => {
                  const isOwner = String(p.author?._id || p.author) === String(myStudentId);
                  const authorName = p.author?.name || "Student";
                  const media = Array.isArray(p.media) ? p.media[0] : p.media;
                  const hasMedia = !!(media && media.url);
                  const expanded = !!expandedCaptions[p._id];
                  const caption = String(p.caption || "");
                  const shortCaption = caption.length > 220 && !expanded ? caption.slice(0, 220) + " …" : caption;
                  const authorId = p.author?._id || p.author;
                  return (
                    <article key={p._id} className="rounded-3xl border border-white/25 bg-white/12 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.18)] p-4">
                      {/* Header */}
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white/30 backdrop-blur-sm text-white/90 flex items-center justify-center text-sm font-semibold">
                          {initialsOfName(authorName)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-white/90 truncate">{authorName}</div>
                          <div className="text-xs text-white/70">{new Date(p.createdAt).toLocaleString()}</div>
                        </div>
                        <div className="ml-auto flex items-center gap-2">
                          {p.visibility === "school" && (
                            <span className="text-[10px] bg-white/20 text-white/90 border border-white/25 rounded-full px-2 py-0.5">School-only</span>
                          )}
                          {connectedStudentIds.includes(String(authorId)) && (
                            <span className="text-[10px] bg-emerald-400/20 text-emerald-100 border border-emerald-200/30 rounded-full px-2 py-0.5">Connected</span>
                          )}
                          {isOwner && (
                            <div className="relative">
                              <button
                                className="h-9 w-9 grid place-items-center rounded-xl bg-white/15 border border-white/25 text-white/80"
                                onClick={() => setMenuOpenId((v) => (v === p._id ? null : p._id))}
                                title="Options"
                              >
                                ⋮
                              </button>
                              {menuOpenId === p._id && (
                                <div className="absolute right-0 mt-2 w-40 rounded-xl bg-[#0b0f19]/90 border border-white/15 shadow-xl z-10 overflow-hidden">
                                  <button onClick={() => { setMenuOpenId(null); openEditPost(p); }} className="w-full text-left px-3 py-2 text-white/90 hover:bg-white/10">✏️ Edit</button>
                                  <button onClick={() => { setMenuOpenId(null); deletePost(p._id); }} className="w-full text-left px-3 py-2 text-red-300 hover:bg-white/10">🗑️ Delete</button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Media (only if present) */}
                      {hasMedia && (
                        <div className="mt-3 relative rounded-2xl overflow-hidden border border-white/20 bg-white/10">
                          {media.kind === "video" ? (
                            <video controls className="w-full h-auto max-h-[60vh] object-contain bg-black">
                              <source src={media.url} />
                            </video>
                          ) : (
                            <img src={media.url} alt="post media" className="w-full h-[340px] object-cover" />
                          )}
                          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-white/10" />
                        </div>
                      )}

                      {/* Action bar (icons only) */}
                      <div className="mt-4 flex items-center gap-3">
                          <button
                            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/12 hover:bg-white/20 transition border border-white/25 text-white/90 ${isOwner ? 'opacity-50 cursor-not-allowed' : ''}`}
                            onClick={() => !isOwner && toggleLike(p._id)}
                            title="Motivate"
                          >
                            <span className="text-base" role="img" aria-label="motivate">🔥</span>
                            <span className="text-sm">{p.likeCount || 0}</span>
                          </button>
                          <button
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/12 hover:bg-white/20 transition border border-white/25 text-white/90"
                            onClick={() => sendCollabRequest(authorId)}
                            title="Collab"
                          >
                            <span className="text-base" role="img" aria-label="collab">🤝</span>
                          </button>
                          <button
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/12 hover:bg-white/20 transition border border-white/25 text-white/90"
                            onClick={() => shareGeneric(p)}
                            title="Share"
                          >
                            <span className="text-base" role="img" aria-label="share">🔗</span>
                          </button>
                        <div className="ml-auto text-white/70 text-xs uppercase tracking-wide">{new Date(p.createdAt).toLocaleString()}</div>
                      </div>

                      {/* Stats */}
                      <div className="mt-2 text-sm text-white/80">🔥 {p.likeCount || 0} Motivates</div>

                      {/* Caption */}
                      {caption && (
                        <div className="mt-1 text-white/90 whitespace-pre-wrap">
                          {shortCaption}
                          {caption.length > 220 && (
                            <button
                              className="ml-1 text-sm text-white/70 hover:text-white/90"
                              onClick={() => setExpandedCaptions((prev) => ({ ...prev, [p._id]: !prev[p._id] }))}
                            >
                              {expanded ? "less" : "more"}
                            </button>
                          )}
                        </div>
                      )}

                      {/* Collab area placeholder */}
                      <div className="mt-2">
                        <button className="text-sm text-white/80 hover:text-white/95 underline-offset-2 hover:underline" title="View collaborators (coming soon)">View Collaborators</button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          {/* Network entry/panel below */}
          {!showNetwork ? (
            <div className="rounded-3xl border border-white/25 bg-white/12 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.18)] p-8 text-center text-white">
              <h2 className="text-2xl font-bold text-white/90">Student Network</h2>
              <p className="text-white/80 mt-1">Discover students and schools, and connect</p>
              <button
                className="mt-6 inline-flex items-center px-6 py-3 rounded-xl bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur"
                onClick={() => setShowNetwork(true)}
              >
                Open Network
              </button>
            </div>
          ) : (
            <div className="rounded-3xl border border-white/25 bg-white/12 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.18)] p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white/90">Student Network</h2>
                  <p className="text-white/80 mt-1">Connect with students and explore schools (mentors are under each school)</p>
                </div>
                <button className="text-white/80 hover:text-white/95" onClick={()=>setShowNetwork(false)}>Close ✖</button>
              </div>

              {/* Tabs */}
              <div className="flex justify-center gap-2 mt-6">
                {['Students','Schools'].map(t => (
                  <button key={t} onClick={()=>setTab(t)} className={`px-4 py-2 rounded-xl border ${tab===t? 'bg-white/25 border-white/30 text-white':'bg-white/10 border-white/20 text-white/85 hover:bg-white/20'}`}>{t}</button>
                ))}
              </div>

              {/* Search */}
              <div className="mt-4">
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={`Search ${tab.toLowerCase()}`} className="w-full px-4 py-2 rounded-2xl bg-white/10 border border-white/25 text-white placeholder-white/70 outline-none" />
              </div>

              {/* Grid */}
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                {tab === 'Students' && (
                  filteredStudents.length === 0 ? (
                    <div className="text-white/70 col-span-full">No students yet</div>
                  ) : (
                    filteredStudents.map(s => {
                      const isRequested = requestedStudents.includes(String(s._id));
                      const isConnected = connectedStudents.includes(String(s._id));
                      return (
                        <div key={s._id} className="rounded-xl border border-white/25 bg-white/10 backdrop-blur p-4 text-white">
                          <div className="w-12 h-12 rounded-full bg-white/30 mb-2"></div>
                          <div className="font-semibold text-white/90">{s.name}</div>
                          <div className="text-sm text-white/70">{s.school?.name || ''}</div>
                          {isConnected ? (
                            <div className="mt-3 w-full px-3 py-2 rounded bg-emerald-400/20 text-emerald-100 border border-emerald-200/30 text-center text-sm">Connected</div>
                          ) : isRequested ? (
                            <button
                              className="mt-3 w-full px-3 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white border border-white/30"
                              onClick={() => cancelRequest(s._id)}
                            >
                              Cancel request
                            </button>
                          ) : (
                            <button
                              className="mt-3 w-full px-3 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white border border-white/30"
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
                    <div className="text-white/70 col-span-full">No schools found</div>
                  ) : (
                    filteredSchools.map(s => (
                      <div key={s._id} className="rounded-xl border border-white/25 bg-white/10 backdrop-blur p-4 text-white">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded bg-white/30"></div>
                          <div>
                            <div className="font-semibold text-white/90">{s.name}</div>
                            <div className="text-sm text-white/70">{s.address || ''}</div>
                          </div>
                        </div>
                        {s.principalName && (
                          <div className="mt-3 text-sm text-white/85">Principal: {s.principalName}</div>
                        )}
                        {Array.isArray(s.heads) && s.heads.length > 0 && (
                          <div className="mt-2">
                            <div className="text-xs text-white/70">Heads of Departments</div>
                            <ul className="mt-1 space-y-1">
                              {s.heads.slice(0,3).map((h,idx)=>(
                                <li key={idx} className="text-sm text-white/85">{h.department ? `${h.department}: `: ''}{h.name}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {/* Mentors under this school */}
                        <div className="mt-4">
                          <div className="text-xs text-white/70 mb-2">Mentors</div>
                          {(!s.mentors || s.mentors.length===0) ? (
                            <div className="text-white/60 text-sm">No mentors listed</div>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {s.mentors.map(m => {
                                const isRequested = requestedTeachers.includes(String(m._id));
                                const isConnected = connectedTeachers.includes(String(m._id));
                                return (
                                  <div key={m._id} className="border border-white/25 rounded-lg px-3 py-2 bg-white/10 backdrop-blur text-white">
                                    <div className="text-sm font-medium text-white/90">{m.name}</div>
                                    <div className="text-xs text-white/70">{m.department || ''}</div>
                                    {isConnected ? (
                                      <span className="mt-2 inline-block text-xs px-2 py-1 rounded bg-emerald-400/20 text-emerald-100 border border-emerald-200/30">Connected</span>
                                    ) : isRequested ? (
                                      <button className="mt-2 text-xs px-2 py-1 rounded-xl bg-white/20 hover:bg-white/30 text-white border border-white/30" onClick={()=>cancelRequest(m._id)}>Cancel</button>
                                    ) : (
                                      <button className="mt-2 text-xs px-2 py-1 rounded-xl bg-white/20 hover:bg-white/30 text-white border border-white/30" onClick={()=>connect(m._id,'Teacher')}>Connect</button>
                                    )}
                                    <button className="mt-2 ml-2 text-xs px-2 py-1 rounded-xl bg-white/20 hover:bg-white/30 text-white border border-white/30" onClick={()=>openChat(m._id,'Teacher', m.name)}>Message</button>
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
        {/* Edit Post Modal */}
        {editingPost && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="font-semibold">Edit Post</div>
                <button onClick={()=>setEditingPost(null)} className="text-gray-600 hover:text-gray-900">✖</button>
              </div>
              <div className="space-y-3">
                <textarea value={editCaption} onChange={e=>setEditCaption(e.target.value)} rows={3} className="w-full border rounded px-3 py-2" placeholder="Update caption" />
                {editPreview && (
                  <div className="rounded-lg overflow-hidden border bg-black/5">
                    {editingPost.media?.[0]?.kind === 'video' || (editFile && editFile.type.startsWith('video/')) ? (
                      <video controls className="w-full max-h-[40vh] object-contain"><source src={editPreview} /></video>
                    ) : (
                      <img src={editPreview} className="w-full max-h-[40vh] object-contain" />
                    )}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <label className="px-3 py-2 rounded bg-gray-100 text-gray-800 cursor-pointer">
                    Replace media
                    <input type="file" accept="image/*,video/*" className="hidden" onChange={onEditFileChange} />
                  </label>
                  <button disabled={savingEdit} onClick={saveEditPost} className="ml-auto px-4 py-2 rounded bg-indigo-600 text-white">{savingEdit? 'Saving…':'Save'}</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Share to Mentor Modal */}
        {sharePostObj && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white shadow-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="font-semibold">Share to Mentor</div>
                <button onClick={()=>setSharePostObj(null)} className="text-gray-600 hover:text-gray-900">✖</button>
              </div>
              {loadingMentors ? (
                <div className="text-gray-600">Loading mentors…</div>
              ) : mentors.length === 0 ? (
                <div className="text-gray-600">No connected mentors found.</div>
              ) : (
                <ul className="space-y-2 max-h-80 overflow-auto">
                  {mentors.map(m => (
                    <li key={m._id} className="flex items-center justify-between rounded border px-3 py-2">
                      <div>
                        <div className="font-medium">{m.name}</div>
                        <div className="text-xs text-gray-600">{m.email || m.department || ''}</div>
                      </div>
                      <button disabled={String(sendingShareTo)===String(m._id)} onClick={()=>sendShareToMentor(m._id)} className="px-3 py-1.5 rounded bg-indigo-600 text-white text-sm">
                        {String(sendingShareTo)===String(m._id) ? 'Sending…' : 'Share'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
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
