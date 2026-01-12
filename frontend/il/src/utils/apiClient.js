import axios from "axios";

// Centralized axios client for the app
// Base URL: VITE_API_BASE_URL or fallback to local dev server
const baseURL = import.meta.env?.VITE_API_BASE_URL || "http://localhost:5000/api";

const apiClient = axios.create({ baseURL });

// Attach auth token automatically when present
apiClient.interceptors.request.use((config) => {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token && !config.headers?.Authorization) {
      config.headers = { ...(config.headers || {}), Authorization: `Bearer ${token}` };
    }
  } catch (_) {}
  return config;
});

export default apiClient;
