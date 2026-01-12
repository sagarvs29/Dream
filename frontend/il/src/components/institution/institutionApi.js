// Simple fetch wrappers for Institution endpoints

const BASE = (import.meta.env?.VITE_API_BASE_URL || import.meta.env?.VITE_API_BASE) || "http://localhost:5000/api";

async function request(path, opts = {}) {
  const token = typeof window !== 'undefined' ? (localStorage.getItem('mentor_token') || localStorage.getItem('token')) : null;
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(opts.headers || {}),
  };
  const res = await fetch(BASE + path, { headers, ...opts });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const api = {
  publishReportCards: (termId, classCode) => request(`/institution/report-cards/${termId}/publish?classCode=${encodeURIComponent(classCode)}`, { method: 'POST' }),
  markAttendance: (classCode, date, records) => request(`/institution/attendance/${classCode}/${date}/mark`, { method: 'POST', body: JSON.stringify({ records }) }),
};
