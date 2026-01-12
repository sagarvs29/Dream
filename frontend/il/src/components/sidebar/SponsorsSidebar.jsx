import React, { useEffect, useState } from "react";
import api from "../../utils/apiClient";
import GlassCard from "../ui/GlassCard";

export default function SponsorsSidebar() {
  const [list, setList] = useState([]); // sponsorships OR sponsors fallback
  const [total, setTotal] = useState(0);
  const [currency, setCurrency] = useState("INR");
  const [allSponsors, setAllSponsors] = useState([]); // public sponsors for requesting
  const [requests, setRequests] = useState({}); // { sponsorId: status }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    (async () => {
      try {
        setLoading(true); setError("");
        if (token) {
          // Load existing sponsorships for the student
          const res = await api.get("/student/sponsorships");
          setList(res.data?.sponsorships || []);
          setTotal(res.data?.total || 0);
          setCurrency(res.data?.currency || "INR");
        }
        // Always load public sponsors list for request actions
  const pub = await api.get("/sponsors");
        setAllSponsors(pub.data?.sponsors || []);
      } catch (e) {
        setError(e?.response?.data?.message || "Failed to load sponsors");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function requestSponsor(id) {
    const token = localStorage.getItem("token");
    if (!token) return alert("Login required");
    if (requests[id] === "Pending" || requests[id] === "Active") return;
    try {
      setRequests(r => ({ ...r, [id]: "Pending" }));
  const res = await api.post(`/student/sponsors/${id}/request`, { message: "Please consider sponsoring me." });
      if (res.status === 201) {
        setRequests(r => ({ ...r, [id]: "Pending" }));
      }
    } catch (e) {
      const msg = e?.response?.data?.message || "Request failed";
      alert(msg);
      setRequests(r => ({ ...r, [id]: undefined }));
    }
  }

  if (loading) return <GlassCard className="p-4 text-white/80">Loading sponsors…</GlassCard>;
  if (error) return <GlassCard className="p-4 text-red-200">{error}</GlassCard>;

  return (
    <div className="space-y-3">
      <div className="text-white/90 font-semibold flex items-center gap-2 px-1 mt-1">
        <span>🤝</span>
        <span>Your sponsors</span>
      </div>
      <div className="px-1 -mt-1">
        <a href="/app/sponsors" className="text-xs underline text-white/80 hover:text-white">Explore all sponsors →</a>
      </div>
      {list.length > 0 && (
        <GlassCard className="p-4">
          <div className="text-white/80 text-sm mb-3">Total sponsored: <span className="text-white font-semibold">{currency} {total.toLocaleString()}</span></div>
          <div className="space-y-3">
            {list.map((s) => (
              <div key={s._id} className="flex items-center gap-3">
                <img src={s.sponsor?.logoUrl || "/vite.svg"} alt="logo" className="h-8 w-8 rounded bg-white/20 object-cover" />
                <div className="flex-1 min-w-0">
                  <div className="text-white/90 font-medium truncate">{s.sponsor?.name || "Sponsor"}</div>
                  <div className="text-white/70 text-xs truncate">{s.sponsor?.tier || "Supporter"}</div>
                </div>
                <div className="text-white/90 text-sm">{currency} {Number(s.amount || 0).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}
      <div className="text-white/90 font-semibold flex items-center gap-2 px-1 mt-4">
        <span>🏢</span>
        <span>Available Sponsors</span>
      </div>
      <GlassCard className="p-4 space-y-3">
        {allSponsors.map(sp => {
          const status = requests[sp._id];
          return (
            <div key={sp._id} className="flex items-center gap-3">
              <img src={sp.logoUrl || "/vite.svg"} alt="logo" className="h-8 w-8 rounded bg-white/20 object-cover" />
              <div className="flex-1 min-w-0">
                <div className="text-white/90 font-medium truncate">{sp.name}</div>
                <div className="text-white/70 text-xs truncate">{sp.tier}</div>
              </div>
              <button
                disabled={status === "Pending"}
                onClick={() => requestSponsor(sp._id)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition ${status === "Pending" ? "bg-white/20 text-white/60 cursor-not-allowed" : "bg-white text-purple-700 hover:bg-purple-100"}`}
              >{status === "Pending" ? "Requested" : "Request"}</button>
            </div>
          );
        })}
        {allSponsors.length === 0 && <div className="text-white/70 text-sm">No sponsors available yet.</div>}
      </GlassCard>
    </div>
  );
}
