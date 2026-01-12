import React, { useEffect, useState } from "react";
import api from "../../utils/apiClient";

const TIERS = ["Platinum","Gold","Silver","Bronze","Partner","Supporter"];

export default function SponsorsExplore() {
  const [q, setQ] = useState("");
  const [tier, setTier] = useState("All");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [requests, setRequests] = useState({}); // { id: "Pending" }

  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        setLoading(true); setError("");
        const { data } = await api.get('/sponsors', { params: q ? { q } : undefined });
        let list = data?.sponsors || [];
        if (tier !== "All") list = list.filter(s => s.tier === tier);
        setItems(list);
      } catch (e) {
        setError(e?.response?.data?.message || "Failed to load sponsors");
      } finally { setLoading(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [q, tier]);

  async function requestSponsor(id) {
    const token = localStorage.getItem("token");
    if (!token) return alert("Please login as a student to request");
    try {
      setRequests(r => ({ ...r, [id]: "Pending" }));
      await api.post(`/student/sponsors/${id}/request`, { message: "I'd love your support for my projects!" });
    } catch (e) {
      alert(e?.response?.data?.message || 'Request failed');
      setRequests(r => ({ ...r, [id]: undefined }));
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#6b9cff] via-[#a474ff] to-[#ff9bd3]">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <header className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6 justify-between mb-6">
          <div>
            <h1 className="text-white text-3xl font-bold tracking-tight">Sponsor Explorer</h1>
            <p className="text-white/80">Find organizations that align with your goals and send a request.</p>
          </div>
          <div className="flex gap-2">
            <input
              value={q}
              onChange={e=>setQ(e.target.value)}
              placeholder="Search sponsors by name or description"
              className="w-72 max-w-[70vw] rounded-xl px-4 py-2 bg-white/90 placeholder-slate-500 text-slate-900 focus:outline-none focus:ring-4 focus:ring-sky-300"
            />
            <select value={tier} onChange={e=>setTier(e.target.value)} className="rounded-xl px-3 py-2 bg-white/90 text-slate-900">
              <option>All</option>
              {TIERS.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
        </header>

        {loading ? (
          <div className="text-white/90">Loading…</div>
        ) : error ? (
          <div className="text-rose-100">{error}</div>
        ) : items.length === 0 ? (
          <div className="text-white/90">No sponsors match your filters.</div>
        ) : (
          <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {items.map(sp => (
              <article key={sp._id} className="relative rounded-2xl overflow-hidden backdrop-blur-md bg-white/15 border border-white/25 shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
                <div className="h-28 bg-gradient-to-r from-white/20 to-white/5" />
                <div className="px-4 -mt-10">
                  <img src={sp.logoUrl || '/vite.svg'} alt="logo" className="h-16 w-16 rounded-xl ring-2 ring-white/50 object-cover bg-white" />
                </div>
                <div className="p-4 pt-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-white font-semibold truncate pr-2">{sp.name}</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/20 text-white/90 border border-white/25">{sp.tier}</span>
                  </div>
                  {sp.description && <p className="text-white/80 text-sm mt-1 line-clamp-2">{sp.description}</p>}
                  {sp.website && <a href={sp.website} target="_blank" rel="noreferrer" className="text-xs text-white/80 underline mt-1 inline-block">Visit website</a>}
                  <div className="mt-3 flex items-center justify-end">
                    <button
                      disabled={requests[sp._id] === 'Pending'}
                      onClick={() => requestSponsor(sp._id)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${requests[sp._id] === 'Pending' ? 'bg-white/25 text-white/70 cursor-not-allowed' : 'bg-white text-purple-700 hover:shadow-purple-400/40 hover:-translate-y-0.5'}`}
                    >{requests[sp._id] === 'Pending' ? 'Requested' : 'Request'}</button>
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
