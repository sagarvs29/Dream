import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import GlassCard from "../../components/ui/GlassCard";

export default function StudentSchool() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [school, setSchool] = useState(null);
  const API = useMemo(() => axios.create({ baseURL: import.meta.env?.VITE_API_BASE_URL || "http://localhost:5000/api" }), []);

  useEffect(() => {
    const cached = (() => { try { return JSON.parse(sessionStorage.getItem("enhancedProfile") || "null"); } catch { return null; } })();
    if (cached?.schoolDetails) {
      setSchool(cached.schoolDetails);
      setLoading(false);
      return;
    }
    const token = localStorage.getItem("token");
    if (!token) { navigate("/login", { replace: true }); return; }
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const headers = { Authorization: `Bearer ${token}` };
        // Prefer student profile which populates school
        const s = await API.get("/students/profile", { headers }).catch(() => null);
        if (s?.data?.success) {
          const prof = s.data.profile || s.data.student;
          if (mounted) {
            setSchool(prof?.schoolDetails || { name: prof?.schoolName, address: prof?.schoolLocation });
            try { sessionStorage.setItem("enhancedProfile", JSON.stringify(prof)); } catch {}
          }
        } else {
          const e = await API.get("/profile/enhanced", { headers }).catch(() => null);
          const prof = e?.data?.profile;
          if (prof && mounted) {
            setSchool(prof.schoolDetails || { name: prof.schoolName, address: prof.schoolLocation });
            try { sessionStorage.setItem("enhancedProfile", JSON.stringify(prof)); } catch {}
          }
        }
      } catch (err) {
        setError(err?.response?.data?.message || "Failed to load school");
      } finally {
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [API, navigate]);

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-gradient)" }}>
      <div className="mx-auto max-w-4xl px-4 pt-5 pb-24">
        <div className="text-white/90 font-semibold mb-3">Your School</div>
        {loading && <GlassCard className="p-4 text-white/80">Loading school…</GlassCard>}
        {error && !loading && <GlassCard className="p-4 text-red-200">{error}</GlassCard>}
        {!loading && (
          <GlassCard className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-white text-lg font-semibold">{school?.name || "School"}</div>
                {school?.code && <div className="text-white/70 text-sm">Code: {school.code}</div>}
                <div className="text-white/75 mt-1">{school?.address || "Address not available"}</div>
                {school?.contactEmail && (
                  <div className="text-white/75 mt-1">
                    Contact: <a href={`mailto:${school.contactEmail}`} className="underline">{school.contactEmail}</a>
                  </div>
                )}
                {school?.isVerified && (
                  <span className="mt-2 inline-block text-xs px-2 py-0.5 rounded-full border border-white/25 bg-white/10 text-white/85">Verified</span>
                )}
              </div>
              {school?.logoUrl && (
                <img src={school.logoUrl} alt="school logo" className="h-12 w-12 object-contain rounded" />
              )}
            </div>
            <p className="text-white/80 mt-4 text-sm">Announcements from your approved school will appear here.</p>
            <div className="mt-4 grid sm:grid-cols-2 gap-3">
              <GlassCard className="p-3"><div className="text-white/85">📢 Science Fair registrations open till 30 Nov.</div></GlassCard>
              <GlassCard className="p-3"><div className="text-white/85">🧪 Chemistry Lab timing moved to Friday.</div></GlassCard>
            </div>
          </GlassCard>
        )}
      </div>
    </div>
  );
}
