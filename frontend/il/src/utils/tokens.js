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

// Clear all known auth tokens/metadata across roles and redirect to welcome
// Usage: logoutAll('/') or logoutAll('/signup') depending on desired landing page
export function logoutAll(redirectPath = "/") {
  try {
    [
      "token",
      "student_token",
      "adm_token",
      "ADMIN_TOKEN",
      "adminToken",
      "mentor_token",
      "SPONSOR_TOKEN",
      "sponsor_token",
    ].forEach((k) => localStorage.removeItem(k));
    ["adm_role", "sponsor_name"].forEach((k) => localStorage.removeItem(k));
  } catch (_) {}
  try {
    // Replace history entry so back button doesn't return to the protected page
    if (typeof window !== 'undefined' && window.location && typeof window.location.replace === 'function') {
      window.location.replace(redirectPath || "/");
    } else {
      window.location.href = redirectPath || "/";
    }
  } catch (_) {}
}
