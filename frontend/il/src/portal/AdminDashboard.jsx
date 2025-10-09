import React, { useEffect, useState } from "react";
import axios from "axios";

const API = axios.create({
  baseURL: import.meta.env?.VITE_API_BASE_URL || "http://localhost:5000/api",
  withCredentials: true,
});

export default function AdminDashboard() {
  const [students, setStudents] = useState([]);
  const token = localStorage.getItem("adminToken");

  useEffect(() => {
    if (!token) return;
    API.get("/portal/admins/pending", { headers: { Authorization: `Bearer ${token}` } })
      .then(({ data }) => setStudents(data.students || []));
  }, [token]);

  async function decide(studentId, status) {
    const remarks = status === "Approved" ? "Verified by admin" : "Details did not match";
    await API.post("/portal/admins/decide", { studentId, status, remarks }, { headers: { Authorization: `Bearer ${token}` } });
    setStudents((list) => list.filter(s => s._id !== studentId));
  }

  if (!token) {
    return <div className="min-h-screen scenic-bg text-white flex items-center justify-center">Login as admin first.</div>
  }

  return (
    <div className="min-h-screen scenic-bg text-white p-6">
      <h2 className="text-2xl font-bold mb-4">Pending Students</h2>
      <div className="grid gap-3 max-w-4xl">
        {students.map(s => (
          <div key={s._id} className="glass-card p-4 rounded">
            <div className="font-semibold">{s.name}</div>
            <div className="text-white/80 text-sm">{s.email}</div>
            <div className="text-white/80 text-sm">Roll: {s.rollNumber} | Dept: {s.department} | Year: {s.admissionYear}</div>
            <div className="mt-2 flex gap-2">
              <button onClick={() => decide(s._id, "Approved")} className="px-3 py-1 btn-primary rounded">Approve</button>
              <button onClick={() => decide(s._id, "Rejected")} className="px-3 py-1 bg-white/70 rounded">Reject</button>
            </div>
          </div>
        ))}
        {students.length === 0 && <div>No pending students.</div>}
      </div>
    </div>
  );
}
