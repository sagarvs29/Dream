import React from "react";
import api from "../../utils/apiClient";
import GlassCard from "../../components/ui/GlassCard";

export default function Library() {
  const API = api; // reuse shared client
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [recs, setRecs] = React.useState([]);

  React.useEffect(() => {
    (async () => {
      try {
        setLoading(true); setError("");
  const r = await API.get("/library/recommendations", { params: { limit: 8 } });
        setRecs(r.data?.recommendations || []);
      } catch (e) {
        setError(e?.response?.data?.message || "Failed to load recommendations");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-gradient)" }}>
      <div className="px-4 pt-4 mx-auto max-w-5xl">
        <div className="text-white/90 font-semibold text-lg px-1">Library</div>
        <div className="text-white/70 px-1">Recommended for you</div>

        {loading && (
          <GlassCard className="mt-3 p-4 text-white/80">Loading…</GlassCard>
        )}
        {error && !loading && (
          <GlassCard className="mt-3 p-4 text-red-200">{error}</GlassCard>
        )}
        {!loading && !error && (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {recs.map((r) => (
              <GlassCard key={r._id} className="p-3">
                <div className="rounded-xl overflow-hidden border border-white/10 bg-white/5">
                  {r.thumbnail ? (
                    <img src={r.thumbnail} alt="thumb" className="w-full h-36 object-cover" />
                  ) : (
                    <div className="w-full h-36 grid place-items-center text-white/50">No image</div>
                  )}
                </div>
                <div className="mt-2 text-white/90 font-medium leading-tight line-clamp-2">{r.title}</div>
                <div className="text-white/70 text-sm">{r.subject || "General"}</div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {(r.tags || []).slice(0,4).map((t) => (
                    <span key={t} className="px-2 py-0.5 rounded-full text-xs border border-white/25 text-white/80 bg-white/10">#{t}</span>
                  ))}
                </div>
                <a href={r.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 glass-btn px-3 py-1.5 text-sm">
                  <span>Open</span>
                  <span>↗</span>
                </a>
              </GlassCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
