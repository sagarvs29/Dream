import React, { useEffect, useState } from "react";
import apiClient from "../../utils/apiClient";

export default function StudentProgress() {
  const [data, setData] = useState({ attendance: null, submissions: [], quizScores: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await apiClient.get("/student/progress");
        if (mounted) setData(res.data || {});
      } catch (e) {
        if (mounted) setError(e?.response?.data?.message || e.message || "Failed to load progress");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const att = data.attendance || {};

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 text-white">
      <h1 className="text-2xl font-semibold mb-4">Your Progress</h1>
      {loading && <div className="mb-4">Loading…</div>}
      {error && <div className="mb-4 text-red-200">{error}</div>}

      {/* Attendance */}
      <section className="mb-8">
        <h2 className="text-xl font-medium mb-3">Attendance (current month)</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { k: "Present", color: "bg-green-600/40" },
            { k: "Absent", color: "bg-red-600/40" },
            { k: "Late", color: "bg-yellow-600/40" },
            { k: "Excused", color: "bg-blue-600/40" },
          ].map(({ k, color }) => (
            <div key={k} className={`rounded-xl p-3 border border-white/20 ${color}`}>
              <div className="text-sm opacity-80">{k}</div>
              <div className="text-2xl font-bold">{att[k] || 0}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 text-sm opacity-80">
          Total days: <span className="font-medium">{att.totalDays ?? 0}</span>
          {typeof att.attendancePct === "number" && (
            <>
              , Attendance: <span className="font-medium">{att.attendancePct}%</span>
            </>
          )}
        </div>
      </section>

      {/* Homework submissions */}
      <section className="mb-8">
        <h2 className="text-xl font-medium mb-3">Homework submissions</h2>
        <div className="rounded-xl overflow-hidden border border-white/25 bg-white/8">
          <table className="min-w-full text-sm">
            <thead className="bg-white/12">
              <tr>
                <th className="px-3 py-2 text-left">Topic</th>
                <th className="px-3 py-2 text-left">Subject</th>
                <th className="px-3 py-2 text-left">Deadline</th>
                <th className="px-3 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {(data.submissions || []).length === 0 && (
                <tr>
                  <td className="px-3 py-3" colSpan={4}>No recent homework.</td>
                </tr>
              )}
              {(data.submissions || []).map((s) => (
                <tr key={s.id} className="odd:bg-white/6">
                  <td className="px-3 py-2">{s.topic}</td>
                  <td className="px-3 py-2">{s.subject}</td>
                  <td className="px-3 py-2">{s.deadline ? new Date(s.deadline).toLocaleString() : "—"}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-1 rounded text-xs border ${s.status === "Pending" ? "border-yellow-300/60" : "border-green-300/60"}`}>
                      {s.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Quiz scores */}
      <section>
        <h2 className="text-xl font-medium mb-3">Quiz scores</h2>
        <div className="rounded-xl overflow-hidden border border-white/25 bg-white/8">
          <table className="min-w-full text-sm">
            <thead className="bg-white/12">
              <tr>
                <th className="px-3 py-2 text-left">Title</th>
                <th className="px-3 py-2 text-left">Subject</th>
                <th className="px-3 py-2 text-left">Score</th>
                <th className="px-3 py-2 text-left">Out of</th>
                <th className="px-3 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {(data.quizScores || []).length === 0 && (
                <tr>
                  <td className="px-3 py-3" colSpan={5}>No quiz submissions yet.</td>
                </tr>
              )}
              {(data.quizScores || []).map((q) => (
                <tr key={q.id} className="odd:bg-white/6">
                  <td className="px-3 py-2">{q.title}</td>
                  <td className="px-3 py-2">{q.subject}</td>
                  <td className="px-3 py-2">{typeof q.score === "number" ? q.score : "—"}</td>
                  <td className="px-3 py-2">{typeof q.totalPoints === "number" ? q.totalPoints : "—"}</td>
                  <td className="px-3 py-2">{q.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
