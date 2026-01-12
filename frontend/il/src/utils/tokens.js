// Centralized token helpers for various roles.
// Admin tokens historically stored under multiple keys; we normalize retrieval.
export function getAdminToken() {
  return (
    localStorage.getItem("adm_token") ||
    localStorage.getItem("ADMIN_TOKEN") ||
    localStorage.getItem("adminToken") ||
    localStorage.getItem("token") ||
    ""
  );
}

export function clearAdminTokens() {
  ["adm_token","ADMIN_TOKEN","adminToken","token"].forEach(k=>localStorage.removeItem(k));
  localStorage.removeItem("adm_role");
}

export function getSponsorToken() {
  return localStorage.getItem("sponsor_token") || localStorage.getItem("token") || "";
}

export function clearSponsorToken() {
  ["sponsor_token","token"].forEach(k=>localStorage.removeItem(k));
}

export function getStudentToken() {
  return localStorage.getItem("student_token") || localStorage.getItem("token") || "";
}

export function getGenericToken() {
  return localStorage.getItem("token") || "";
}
