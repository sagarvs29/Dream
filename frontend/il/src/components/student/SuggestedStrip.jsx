import React, { useEffect, useState } from "react";
import api from "../../utils/apiClient";

/**
 * Mobile-only horizontal suggestions strip for mentors and sponsors.
 * - Shows mentor and sponsor suggestion cards in a horizontally scrollable row
 * - Actions:
 *   - Mentor: Accept if there is an inbound request from that mentor, otherwise Request
 *   - Sponsor: Request sponsorship
 */
export default function SuggestedStrip() {
  const token = typeof window !== 'undefined' ? localStorage.getItem("token") : null;
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : undefined;

  const [mentors, setMentors] = useState([]);
  const [sponsors, setSponsors] = useState([]);
  const [inboundMentorReqs, setInboundMentorReqs] = useState({}); // mentorId -> requestId
  const [busy, setBusy] = useState({}); // id -> true
  const [requestedSponsor, setRequestedSponsor] = useState({}); // sponsorId -> 'Pending'
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true); setError("");
        // Load suggestions in parallel
        const promises = [];
        if (authHeaders) {
          promises.push(api.get("/student/network/recommendations", { params: { type: "mentor", limit: 12 } }));
          promises.push(api.get("/student/network/requests", { params: { inbound: 1 } }));
        } else {
          promises.push(Promise.resolve({ data: { mentors: [] } }));
          promises.push(Promise.resolve({ data: { requests: [] } }));
        }
        promises.push(api.get("/sponsors", { params: { limit: 12 } }));

        const [mentRes, reqRes, sponsRes] = await Promise.all(promises);
        setMentors(mentRes?.data?.mentors || []);
        const requests = reqRes?.data?.requests || [];
        // Build map for inbound requests from teachers (mentors)
        const map = {};
        for (const r of requests) {
          const counterpart = r?.requester; // inbound -> requester is the other side
          if (counterpart?.userModel === 'Teacher') {
            map[String(counterpart.userId)] = r._id;
          }
        }
        setInboundMentorReqs(map);
        setSponsors(sponsRes?.data?.sponsors || []);
      } catch (e) {
        setError(e?.response?.data?.message || "Failed to load suggestions");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  async function acceptMentor(mentorId) {
    if (!authHeaders) return alert("Login required to accept requests");
    const reqId = inboundMentorReqs[String(mentorId)];
    if (!reqId) return;
    try {
      setBusy(b => ({ ...b, ["m-"+mentorId]: true }));
  await api.post(`/student/network/requests/${reqId}/accept`);
      // Remove from inbound map to switch button to Connected
      setInboundMentorReqs(m => { const n = { ...m }; delete n[String(mentorId)]; return n; });
    } catch (e) {
      alert(e?.response?.data?.message || "Failed to accept");
    } finally {
      setBusy(b => ({ ...b, ["m-"+mentorId]: false }));
    }
  }

  async function requestMentor(mentorId) {
    if (!authHeaders) return alert("Login required to request mentors");
    try {
      setBusy(b => ({ ...b, ["m-"+mentorId]: true }));
  await api.post(`/student/network/requests`, { targetId: mentorId, targetModel: "Teacher", message: "I'd love to connect." });
      // Mark as requested by setting a temporary busy state
      // We don't fetch outbound list here; UX is to disable the button
    } catch (e) {
      const msg = e?.response?.data?.message || "Request failed";
      alert(msg);
    } finally {
      setBusy(b => ({ ...b, ["m-"+mentorId]: false }));
    }
  }

  async function requestSponsor(sponsorId) {
    if (!authHeaders) return alert("Login required to request sponsorship");
    if (requestedSponsor[sponsorId] === 'Pending') return;
    try {
      setBusy(b => ({ ...b, ["s-"+sponsorId]: true }));
  await api.post(`/student/sponsors/${sponsorId}/request`, { message: "Please consider sponsoring me." });
      setRequestedSponsor(r => ({ ...r, [sponsorId]: 'Pending' }));
    } catch (e) {
      alert(e?.response?.data?.message || "Request failed");
    } finally {
      setBusy(b => ({ ...b, ["s-"+sponsorId]: false }));
    }
  }

  if (loading) {
    return (
      <div className="block lg:hidden px-1">
        <div className="text-slate-800 font-semibold mb-2">Suggestions</div>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="w-32 shrink-0 rounded-xl bg-white/70 border border-slate-200 h-40 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return null; // fail silent on mobile strip
  }

  const cards = [
    ...mentors.map(m => ({
      kind: 'mentor',
      id: String(m._id || m.id),
      name: m.name,
      meta: m.designation || m.department || 'Mentor',
      avatar: m.profilePictureUrl || '/avatar.png',
    })),
    ...sponsors.map(s => ({
      kind: 'sponsor',
      id: String(s._id || s.id),
      name: s.name,
      meta: s.tier || 'Sponsor',
      avatar: s.logoUrl || '/vite.svg',
    })),
  ];

  if (!cards.length) return null;

  return (
    <div className="block lg:hidden">
      <div className="text-slate-900 font-semibold mb-2 px-1">Suggested for you</div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {cards.map(card => {
          const isMentor = card.kind === 'mentor';
          const inbReqId = inboundMentorReqs[card.id];
          const isBusy = !!busy[(isMentor ? 'm-' : 's-') + card.id];
          const sponsorPending = card.kind === 'sponsor' && requestedSponsor[card.id] === 'Pending';

          let actionLabel = '';
          let actionHandler = () => {};
          let disabled = isBusy;
          if (isMentor) {
            if (inbReqId) { actionLabel = 'Accept'; actionHandler = () => acceptMentor(card.id); }
            else { actionLabel = 'Request'; actionHandler = () => requestMentor(card.id); }
          } else {
            actionLabel = sponsorPending ? 'Requested' : 'Request';
            disabled = disabled || sponsorPending;
            actionHandler = () => requestSponsor(card.id);
          }

          return (
            <div key={`${card.kind}-${card.id}`} className="w-32 shrink-0">
              <div className="rounded-xl bg-white/80 border border-slate-200 shadow-sm overflow-hidden">
                <div className="aspect-square bg-slate-100 flex items-center justify-center">
                  <img src={card.avatar} alt="avatar" className="h-full w-full object-cover" />
                </div>
                <div className="p-2">
                  <div className="text-sm font-medium text-slate-900 truncate" title={card.name}>{card.name}</div>
                  <div className="text-[11px] text-slate-500 truncate" title={card.meta}>{card.meta}</div>
                  <button
                    disabled={disabled}
                    onClick={actionHandler}
                    className={`mt-2 w-full h-8 rounded-md text-xs font-semibold transition ${disabled ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-black'}`}
                  >{isBusy ? '...' : actionLabel}</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
