const BASE_URL = window.location.port === '5173' ? 'http://localhost:5000/api' : '/api';

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

  const response = await fetch(`${BASE_URL}${endpoint}`, config);

  if (response.status === 401) {
    // JWT expired or missing
    localStorage.removeItem('lend_token');
    localStorage.removeItem('lend_user');
    window.dispatchEvent(new Event('auth-expired'));
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Something went wrong with the request.');
  }

  return data;
}

export const api = {
  get: (endpoint, headers = {}) => request(endpoint, { method: 'GET', headers }),
  post: (endpoint, body, headers = {}) => request(endpoint, { method: 'POST', body, headers }),
  put: (endpoint, body, headers = {}) => request(endpoint, { method: 'PUT', body, headers }),
  patch: (endpoint, body, headers = {}) => request(endpoint, { method: 'PATCH', body, headers }),
  delete: (endpoint, headers = {}) => request(endpoint, { method: 'DELETE', headers }),
};
