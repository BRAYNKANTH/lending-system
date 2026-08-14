const BASE_URL = '/api';

/**
 * Perform an HTTP Request
 */
async function request(endpoint, options = {}) {
  const token = localStorage.getItem('lend_token');

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers,
  };

  if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body);
  }

  let response;
  try {
    response = await fetch(`${BASE_URL}${endpoint}`, config);
  } catch {
    // Network failure — offline, DNS, connection dropped mid-request, etc.
    // Never let the raw browser TypeError ("Failed to fetch") surface.
    throw new Error('Could not reach the server. Check your connection and try again.');
  }

  if (response.status === 401) {
    // JWT expired or missing
    localStorage.removeItem('lend_token');
    localStorage.removeItem('lend_user');
    window.dispatchEvent(new Event('auth-expired'));
  }

  // Not every failure comes back as our own JSON error body — a platform
  // timeout, a cold-start crash, or a proxy/edge error can return an HTML
  // error page instead. Parsing that as JSON throws a cryptic "Unexpected
  // token '<'..." SyntaxError, which would otherwise leak straight through
  // to the UI looking like a raw browser/Vercel error. Fall back to a
  // friendly message keyed off the HTTP status instead.
  let data;
  try {
    data = await response.json();
  } catch {
    if (!response.ok) {
      throw new Error(`Server error (${response.status}). Please try again in a moment.`);
    }
    data = null;
  }

  if (!response.ok) {
    throw new Error(data?.message || 'Something went wrong with the request.');
  }

  return data;
}

export const api = {
  get: (endpoint, headers = {}) => request(endpoint, { method: 'GET', headers }),
  post: (endpoint, body, headers = {}) => request(endpoint, { method: 'POST', body, headers }),
  put: (endpoint, body, headers = {}) => request(endpoint, { method: 'PUT', body, headers }),
  patch: (endpoint, body, headers = {}) => request(endpoint, { method: 'PATCH', body, headers }),
  delete: (endpoint, body, headers = {}) => request(endpoint, { method: 'DELETE', body, headers }),
};
