import axios from "axios";
import { getApiBase } from "../config/api";

// Centralized axios client for the app
// Base URL resolved at runtime via env.js or VITE env; avoids hardcoded localhost in production
const apiClient = axios.create({ baseURL: getApiBase() });

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
