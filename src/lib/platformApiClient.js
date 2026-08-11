// API client for the platform-admin control plane. Deliberately separate
// from src/lib/apiClient.js (the tenant app's client) — different
// localStorage keys and a different expiry event name, so a
// platform-admin session and a tenant-app session can never be confused
// with each other even if both happen to be open in the same browser.
const BASE_URL = '/api/platform-admin';

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('platform_admin_token');

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = { ...options, headers };

  if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, config);

  if (response.status === 401) {
    localStorage.removeItem('platform_admin_token');
    localStorage.removeItem('platform_admin');
    window.dispatchEvent(new Event('platform-auth-expired'));
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Something went wrong with the request.');
  }

  return data;
}

export const platformApi = {
  get: (endpoint, headers = {}) => request(endpoint, { method: 'GET', headers }),
  post: (endpoint, body, headers = {}) => request(endpoint, { method: 'POST', body, headers }),
  patch: (endpoint, body, headers = {}) => request(endpoint, { method: 'PATCH', body, headers }),
};
