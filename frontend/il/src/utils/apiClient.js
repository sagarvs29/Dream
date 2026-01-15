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

// Response guard: if backend accidentally returns HTML, convert to a friendly error
apiClient.interceptors.response.use(
  (response) => {
    const ct = response.headers?.["content-type"] || "";
    if (ct.includes("text/html")) {
      // This typically happens when a server error or proxy serves an HTML page
      return Promise.reject(new Error("Unexpected HTML response from API. Check server logs and CORS/env."));
    }
    return response;
  },
  (error) => {
    // Normalize network/cors errors
    if (error?.response) {
      const ct = error.response.headers?.["content-type"] || "";
      if (ct.includes("text/html")) {
        error.message = `API error ${error.response.status}: non-JSON response`;
      }
    } else if (error?.message?.includes("Network Error")) {
      error.message = "Network error calling API (possible CORS or wrong base URL).";
    }
    return Promise.reject(error);
  }
);
