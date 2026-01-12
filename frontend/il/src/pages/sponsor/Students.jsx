import React, { useEffect, useState } from "react";
import SponsorBottomNav from "../../components/nav/SponsorBottomNav";
import SponsorSummary from "../../components/sidebar/SponsorSummary";
import GlassCard from "../../components/ui/GlassCard";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

export default function SponsorStudents() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    async function fetchStudents() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${API_BASE}/api/student/network/recommendations?type=students`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!res.ok) throw new Error("Failed to load students");
        const data = await res.json();
        setStudents(Array.isArray(data?.students || data) ? (data.students || data) : []);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    fetchStudents();
  }, []);

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-gradient)" }}>
      <div className="px-4 pt-4">
        <div className="mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
          <div>
            <GlassCard className="p-4 text-white/90">
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold">Students</div>
              </div>
              {loading && <div className="text-white/70 text-sm">Loading…</div>}
              {error && <div className="text-red-300 text-sm">{error}</div>}
              <div className="space-y-3">
                {students.map((s) => (
                  <StudentRow key={s._id || s.id} student={s} />
                ))}
                {!loading && !error && students.length === 0 && (
                  <div className="text-white/70 text-sm">No students found.</div>
                )}
              </div>
            </GlassCard>
          </div>
          <div className="hidden lg:block">
            <SponsorSummary />
          </div>
        </div>
      </div>
      <SponsorBottomNav />
    </div>
  );
}

function StudentRow({ student }) {
  const [amount, setAmount] = useState(500);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

  const onSponsor = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/sponsor/sponsorships`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ studentId: student._id || student.id, amount, currency: "INR" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to create sponsorship");
      setMessage("Sponsorship recorded. Thank you!");
    } catch (e) {
      setMessage(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
      <img
        src={student?.avatarUrl || "/logo.png"}
        alt={student?.name || "Student"}
        className="w-12 h-12 rounded-full object-cover"
      />
      <div className="flex-1">
        <div className="font-medium text-white/90">{student?.name || student?.fullName || "Student"}</div>
        <div className="text-xs text-white/60">{student?.schoolName || student?.school?.name || "—"}</div>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={1}
          value={amount}
          onChange={(e) => setAmount(parseInt(e.target.value || 0, 10))}
          className="w-24 bg-transparent text-white/90 border border-white/15 rounded-lg px-2 py-1 text-sm focus:outline-none"
        />
        <button
          onClick={onSponsor}
          disabled={loading}
          className="px-3 py-1.5 text-sm rounded-lg bg-emerald-500/90 hover:bg-emerald-500 text-white disabled:opacity-60"
        >
          {loading ? "Sponsoring…" : "Sponsor"}
        </button>
      </div>
      {message && <div className="text-xs text-emerald-300 ml-3">{message}</div>}
    </div>
  );
}
