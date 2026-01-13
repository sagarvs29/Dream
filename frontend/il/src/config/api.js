// Central API base resolution to avoid hardcoding IPs that may time out.
// Prefers explicit VITE_API_BASE_URL. Falls back to same host mapping (replace :5173 with :5000).
// If running from a LAN/mobile IP, ensure backend listens on 0.0.0.0 (default) and CORS allows the origin.

export function getApiBase() {
  // Prefer runtime-injected value from env.js (works with static hosting/Docker)
  if (typeof window !== 'undefined' && window.__ENV__?.API_BASE_URL) {
    return String(window.__ENV__.API_BASE_URL).replace(/\/$/, '');
  }

  // Then Vite build-time variable
  const envBase = import.meta.env?.VITE_API_BASE_URL;
  if (envBase) return envBase.replace(/\/$/, '');

  // Fallbacks (development defaults only)
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    // When frontend served from port 5173 (Vite), backend expected on 5000
    return `${protocol}//${hostname}:5000/api`;
  }
  return 'http://localhost:5000/api';
}

export function apiUrl(path) {
  return `${getApiBase()}${path.startsWith('/') ? '' : '/'}${path}`;
}
