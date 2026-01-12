import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import GlassCard from "../ui/GlassCard";

export default function SponsorSummary() {
  const API = useMemo(() => axios.create({ baseURL: import.meta.env?.VITE_API_BASE_URL || "http://localhost:5000/api" }), []);
  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [currency, setCurrency] = useState("INR");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { setLoading(false); return; }
    (async () => {
      try {
        setLoading(true); setError("");
        const headers = { Authorization: `Bearer ${token}` };
        const res = await API.get("/sponsor/sponsorships", { headers });
        setList(res.data?.sponsorships || []);
        setTotal(res.data?.total || 0);
        setCurrency(res.data?.currency || "INR");
      } catch (e) {
        setError(e?.response?.data?.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [API]);

  if (loading) return <GlassCard className="p-4 text-white/80">Loading…</GlassCard>;
  if (error) return <GlassCard className="p-4 text-red-200">{error}</GlassCard>;

  return (
    <div className="space-y-3">
      <div className="text-white/90 font-semibold flex items-center gap-2 px-1 mt-1">
        <span>📈</span>
        <span>Funding summary</span>
      </div>
      <GlassCard className="p-4">
        <div className="text-white/80 text-sm mb-3">Total contributed: <span className="text-white font-semibold">{currency} {total.toLocaleString()}</span></div>
        <div className="space-y-3 max-h-[50vh] overflow-auto pr-2">
          {list.map((s) => (
            <div key={s._id} className="flex items-center gap-3">
              <img src={s.student?.profilePictureUrl || "/avatars/1.png"} alt="pfp" className="h-8 w-8 rounded-full object-cover" />
              <div className="flex-1 min-w-0">
                <div className="text-white/90 font-medium truncate">{s.student?.name || "Student"}</div>
                <div className="text-white/70 text-xs truncate">{new Date(s.createdAt).toLocaleDateString()}</div>
              </div>
              <div className="text-white/90 text-sm">{currency} {Number(s.amount || 0).toLocaleString()}</div>
            </div>
          ))}
          {list.length === 0 && <div className="text-white/70">No sponsorships yet.</div>}
        </div>
      </GlassCard>
    </div>
  );
}
