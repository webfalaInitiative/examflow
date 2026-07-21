import axios from 'axios';
import Router from 'next/router';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
});

// Attach JWT to every request
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// --- 401 handling with debounce to prevent cascading logouts ---
let isLoggingOut = false;

function handleUnauthorized() {
  // Prevent multiple parallel 401s from all triggering logouts
  if (isLoggingOut) return;
  isLoggingOut = true;

  localStorage.removeItem('token');
  // Use Next.js router instead of window.location.href to avoid full page reload
  Router.push('/login').finally(() => {
    // Reset after a short delay so future real 401s are still caught
    setTimeout(() => { isLoggingOut = false; }, 2000);
  });
}

// Auth endpoints that should never trigger a global logout
const AUTH_ENDPOINTS = ['/auth/login', '/auth/register'];

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (typeof window !== 'undefined' && err.response?.status === 401) {
      const url = err.config?.url || '';
      // Don't auto-logout when login/register itself returns 401 (bad credentials)
      const isAuthEndpoint = AUTH_ENDPOINTS.some((ep) => url.includes(ep));
      if (!isAuthEndpoint) {
        handleUnauthorized();
      }
    }
    return Promise.reject(err);
  }
);

export default api;
