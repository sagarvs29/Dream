import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import GlassCard from "../../components/ui/GlassCard";
import StudentTopBar from "../../components/student/StudentTopBar";

export default function StudentProfile() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const API = useMemo(() => axios.create({
    baseURL: import.meta.env?.VITE_API_BASE_URL || "http://localhost:5000/api",
  }), []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const headers = { Authorization: `Bearer ${token}` };
        // Try real student profile first; fallback to enhanced, then basic
        const studentRes = await API.get("/students/profile", { headers }).catch(() => null);
        if (studentRes?.data?.success) {
          if (mounted) {
            const p = studentRes.data.profile || studentRes.data.student;
            setProfile(p);
            try { sessionStorage.setItem("enhancedProfile", JSON.stringify(p)); } catch {}
          }
        } else {
          const res = await API.get("/profile/enhanced", { headers }).catch(() => null);
          if (res?.data?.success) {
          if (mounted) {
            setProfile(res.data.profile);
            try { sessionStorage.setItem("enhancedProfile", JSON.stringify(res.data.profile)); } catch {}
          }
          } else {
            const basic = await API.get("/auth/me", { headers });
            if (mounted) {
              setProfile({ ...basic.data, source: "basic" });
              try { sessionStorage.setItem("enhancedProfile", JSON.stringify({ ...basic.data, source: "basic" })); } catch {}
            }
          }
        }
      } catch (e) {
        console.error(e);
        setError(e?.response?.data?.message || "Failed to load profile");
      } finally {
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [API, navigate]);

  const display = profile || {};

  async function onPickAvatar(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("File too large. Max 5MB.");
      e.target.value = "";
      return;
    }
    try {
      setUploading(true);
      setError("");
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login", { replace: true });
        return;
      }
      const form = new FormData();
      form.append("profilePicture", file);
      const headers = { Authorization: `Bearer ${token}` };
      const resp = await API.post("/students/profile/picture", form, { headers });
      const url = resp?.data?.profilePictureUrl;
      if (url) {
        setProfile((prev) => ({ ...(prev || {}), profilePictureUrl: url }));
        try {
          const cached = { ...(display || {}), profilePictureUrl: url };
          sessionStorage.setItem("enhancedProfile", JSON.stringify(cached));
        } catch {}
      }
    } catch (e) {
      setError(e?.response?.data?.message || "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-gradient)" }}>
      <StudentTopBar />
      <div className="mx-auto max-w-4xl px-4 pt-5 pb-24">
        <div className="text-white/90 font-semibold mb-3">Your Profile</div>
        {loading && (
          <GlassCard className="p-4 text-white/80">Loading your profile…</GlassCard>
        )}
        {error && !loading && (
          <GlassCard className="p-4 text-red-200">{error}</GlassCard>
        )}
        {!loading && (
        <GlassCard className="p-5">
          <div className="flex items-start gap-4">
            <div className="relative h-16 w-16">
              <img
                src={display.profilePictureUrl || display.avatar || "/avatars/1.png"}
                alt="avatar"
                className="h-16 w-16 rounded-full ring-2 ring-white/30 object-cover"
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                title="Change photo"
                className="absolute inset-0 rounded-full bg-black/30 opacity-0 hover:opacity-100 transition flex items-center justify-center"
                aria-label="Change profile picture"
              >
                {uploading ? (
                  <span className="text-white/90 text-xs">Uploading…</span>
                ) : (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" strokeWidth="2">
                    <path d="M12 5l2 2h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3l2-2z" />
                    <circle cx="12" cy="13" r="3" />
                  </svg>
                )}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickAvatar} />
            </div>
            <div className="flex-1">
              <div className="text-white text-lg font-semibold">{display.realName || display.name || "Student Name"}</div>
              <div className="text-white/75 flex items-center gap-2">
                <button className="underline-offset-2 hover:underline" onClick={() => navigate("/app/school")}>{display.schoolDetails?.name || display.schoolName || "Your School/Hub"}</button>
                {display.grade && <span className="text-xs px-2 py-0.5 border border-white/20 rounded-full bg-white/5 text-white/75">Grade {display.grade}</span>}
              </div>
              <p className="text-white/80 mt-2 text-sm">{display.bio || "Write a short bio about your interests and goals."}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(display.badges || ["Full Stack Dev", "Eco Innovator"]).map((b) => (
                  <span key={b} className="px-2 py-0.5 rounded-full text-xs border border-white/30 text-white/80 bg-white/10">{b}</span>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/80">
                {display.uniqueStudentId && (
                  <span className="px-2 py-0.5 rounded border border-white/20 bg-white/5">ID: {display.uniqueStudentId}</span>
                )}
                {display.aadhaarVerifiedDetails?.maskedAadhaar && (
                  <span className="px-2 py-0.5 rounded border border-white/20 bg-white/5">Aadhaar: {display.aadhaarVerifiedDetails.maskedAadhaar}</span>
                )}
              </div>
            </div>
          </div>
        </GlassCard>
        )}

        {!loading && (
          <div className="mt-5 grid md:grid-cols-2 gap-4">
            <GlassCard className="p-4">
              <div className="text-white/90 font-medium mb-2 flex items-center justify-between">
                <span>Achievements</span>
                <button className="glass-btn px-2 py-1 text-xs" onClick={() => navigate("/app/achievements")}>View all</button>
              </div>
              <ul className="text-white/80 text-sm list-disc ml-5 space-y-1">
                {(display.achievements || [
                  "Top 10 in Regional Hackathon",
                  "Open-source contributor",
                ]).slice(0,3).map((it, i) => (
                  <li key={i}>{it}</li>
                ))}
              </ul>
            </GlassCard>
            <GlassCard className="p-4">
              <div className="text-white/90 font-medium mb-2 flex items-center justify-between">
                <span>Projects</span>
                <button className="glass-btn px-2 py-1 text-xs" onClick={() => navigate("/app/projects")}>View all</button>
              </div>
              <ul className="text-white/80 text-sm list-disc ml-5 space-y-1">
                {(display.projects || [
                  "Smart Irrigation System",
                  "Student Network App",
                ]).slice(0,3).map((it, i) => (
                  <li key={i}>{it}</li>
                ))}
              </ul>
            </GlassCard>
          </div>
        )}
      </div>
    </div>
  );
}
