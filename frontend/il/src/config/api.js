// Central API base resolution to avoid hardcoding IPs that may time out.
// Prefers explicit VITE_API_BASE_URL. Falls back to same host mapping (replace :5173 with :5000).
// If running from a LAN/mobile IP, ensure backend listens on 0.0.0.0 (default) and CORS allows the origin.

export function getApiBase() {
  // Prefer runtime-injected value from env.js (works with static hosting/Docker)
  if (typeof window !== 'undefined' && window.__ENV__?.API_BASE_URL) {
    const base = String(window.__ENV__.API_BASE_URL).replace(/\/$/, '');
    if (import.meta.env?.MODE !== 'development') {
      console.debug('[api] using runtime API_BASE_URL:', base);
    }
    return base;
  }

  // Then Vite build-time variable
  const envBase = import.meta.env?.VITE_API_BASE_URL;
  if (envBase) {
    const base = envBase.replace(/\/$/, '');
    if (import.meta.env?.MODE !== 'development') {
      console.debug('[api] using VITE_API_BASE_URL:', base);
    }
    return base;
  }

  // Fallbacks (development defaults only)
  if (typeof window !== 'undefined') {
    const { protocol, hostname, port } = window.location;
    // Only map :5173/5174 -> :5000 during local dev. In production, don't add a port.
    if (port === '5173' || port === '5174') {
      return `${protocol}//${hostname}:5000/api`;
    }
    // Safe default: same host without custom port (works if reverse-proxy is present)
    const fallback = `${protocol}//${hostname}/api`;
    if (import.meta.env?.MODE !== 'development') {
      console.warn('[api] using same-host fallback base:', fallback);
    }
    return fallback;
  }
  return 'http://localhost:5000/api';
}

export function apiUrl(path) {
  return `${getApiBase()}${path.startsWith('/') ? '' : '/'}${path}`;
}
