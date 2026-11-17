import axios from 'axios';

const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
  withCredentials: true
});

// Function to get a cookie by name
const getCookie = (name) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
};

// Attach Auth token and CSRF token to every request
API.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  const csrfToken = getCookie('csrf-token');
  if (csrfToken) config.headers['X-CSRF-Token'] = csrfToken;
  return config;
});

// Helper to check if a route is public (does not require authentication)
const isPublicRoute = (pathname) => {
  if (!pathname) return false;
  const p = pathname.toLowerCase();
  return (
    p === '/login' ||
    p === '/suspended' ||
    p === '/admission' ||
    p.startsWith('/admission') ||
    p.startsWith('/admissions') ||
    p.startsWith('/apply') ||
    p.startsWith('/public/admission') ||
    p.startsWith('/public-admission') ||
    p.startsWith('/new-admission') ||
    p.startsWith('/online-admission') ||
    p.startsWith('/status')
  );
};

// Intercept 423 (Service Suspended) and 401 (Unauthorized)
API.interceptors.response.use(
  res => res,
  err => {
    // 423 Locked / Suspended
    if (err.response?.status === 423) {
      if (err.response.data) {
        try {
          sessionStorage.setItem('erp_suspension_info', JSON.stringify(err.response.data));
        } catch (e) {}
      }
      if (window.location.pathname !== '/suspended') {
        window.location.href = '/suspended';
      }
    }

    // 401 Unauthorized
    if (err.response?.status === 401) {
      localStorage.removeItem('token');

      const isAuthCheck = err.config?.url?.includes('/auth/me');
      const currentPath = window.location.pathname || '';

      // Only redirect to /login if NOT on a public route and NOT an initial /auth/me check
      if (!isAuthCheck && !isPublicRoute(currentPath)) {
        window.location.href = '/login';
      }
    }

    return Promise.reject(err);
  }
);

export default API;
