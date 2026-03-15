// API service for backend communication
export const API_BASE_URL = 'http://localhost:8000/api';

const CSRF_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
let csrfFetchPromise = null;

const getCookie = (name) => {
  if (typeof document === 'undefined') return '';
  const cookie = document.cookie
    .split(';')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.split('=').slice(1).join('=')) : '';
};

const ensureCsrfCookie = async () => {
  if (getCookie('csrftoken')) return;
  if (!csrfFetchPromise) {
    csrfFetchPromise = fetch(`${API_BASE_URL}/auth/csrf/`, {
      credentials: 'include',
    }).finally(() => {
      csrfFetchPromise = null;
    });
  }
  await csrfFetchPromise;
};

const apiFetch = async (url, options = {}) => {
  const method = String(options.method || 'GET').toUpperCase();
  const headers = {
    ...(options.headers || {}),
  };

  if (CSRF_METHODS.has(method)) {
    await ensureCsrfCookie();
    const csrfToken = getCookie('csrftoken');
    if (csrfToken) {
      headers['X-CSRFToken'] = csrfToken;
    }
  }

  const merged = {
    credentials: 'include',
    ...options,
    headers,
  };
  return fetch(url, merged);
};

const handleResponse = async (response) => {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'An error occurred' }));
    throw new Error(error.message || `HTTP error! status: ${response.status}`);
  }
  return response.json();
};

// Compagnies API
export const compagniesAPI = {
  list: () => apiFetch(`${API_BASE_URL}/compagnies/`).then(handleResponse),
  create: (data) => apiFetch(`${API_BASE_URL}/compagnies/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(handleResponse),
  get: (id) => apiFetch(`${API_BASE_URL}/compagnies/${id}/`).then(handleResponse),
  update: (id, data) => apiFetch(`${API_BASE_URL}/compagnies/${id}/`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(handleResponse),
  delete: (id) => apiFetch(`${API_BASE_URL}/compagnies/${id}/`, {
    method: 'DELETE',
  }).then(response => response.ok),
  getPersons: (id) => apiFetch(`${API_BASE_URL}/compagnies/${id}/persons/`).then(handleResponse),
};

// Persons API
export const personsAPI = {
  list: () => apiFetch(`${API_BASE_URL}/persons/`).then(handleResponse),
  create: (data) => apiFetch(`${API_BASE_URL}/persons/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(handleResponse),
  get: (id) => apiFetch(`${API_BASE_URL}/persons/${id}/`).then(handleResponse),
  update: (id, data) => apiFetch(`${API_BASE_URL}/persons/${id}/`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(handleResponse),
  delete: (id) => apiFetch(`${API_BASE_URL}/persons/${id}/`, {
    method: 'DELETE',
  }).then(response => response.ok),
  getSpectacles: (id) => apiFetch(`${API_BASE_URL}/persons/${id}/spectacles/`).then(handleResponse),
  getRentrees: (id) => apiFetch(`${API_BASE_URL}/persons/${id}/rentrees/`).then(handleResponse),
};

// Cameras API
export const camerasAPI = {
  list: () => apiFetch(`${API_BASE_URL}/cameras/`).then(handleResponse),
  create: (data) => apiFetch(`${API_BASE_URL}/cameras/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(handleResponse),
  get: (id) => apiFetch(`${API_BASE_URL}/cameras/${id}/`).then(handleResponse),
  update: (id, data) => apiFetch(`${API_BASE_URL}/cameras/${id}/`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(handleResponse),
  delete: (id) => apiFetch(`${API_BASE_URL}/cameras/${id}/`, {
    method: 'DELETE',
  }).then(response => response.ok),
  activate: (id) => apiFetch(`${API_BASE_URL}/cameras/${id}/activate/`, {
    method: 'POST',
  }).then(handleResponse),
  deactivate: (id) => apiFetch(`${API_BASE_URL}/cameras/${id}/deactivate/`, {
    method: 'POST',
  }).then(handleResponse),
  ping: (id) => apiFetch(`${API_BASE_URL}/cameras/${id}/ping/`).then(handleResponse),
  pingAll: () => apiFetch(`${API_BASE_URL}/cameras/ping_all/`).then(handleResponse),
};

// Spectacles API
export const spectaclesAPI = {
  list: () => apiFetch(`${API_BASE_URL}/spectacles/`).then(handleResponse),
  pending: () => apiFetch(`${API_BASE_URL}/spectacles/pending/`).then(handleResponse),
  completed: () => apiFetch(`${API_BASE_URL}/spectacles/completed/`).then(handleResponse),
  importExcel: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiFetch(`${API_BASE_URL}/spectacles/`, {
      method: 'POST',
      body: formData,
    }).then(handleResponse);
  },
  create: (data) => apiFetch(`${API_BASE_URL}/spectacles/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(handleResponse),
  get: (id) => apiFetch(`${API_BASE_URL}/spectacles/${id}/`).then(handleResponse),
  update: (id, data) => apiFetch(`${API_BASE_URL}/spectacles/${id}/`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(handleResponse),
  delete: (id) => apiFetch(`${API_BASE_URL}/spectacles/${id}/`, {
    method: 'DELETE',
  }).then(response => response.ok),
  markReturn: (id) => apiFetch(`${API_BASE_URL}/spectacles/${id}/mark_return/`, {
    method: 'POST',
  }).then(handleResponse),
};

// Rentrees API
export const rentreesAPI = {
  list: () => apiFetch(`${API_BASE_URL}/rentrees/`).then(handleResponse),
  lateReturns: () => apiFetch(`${API_BASE_URL}/rentrees/late_returns/`).then(handleResponse),
  create: (data) => apiFetch(`${API_BASE_URL}/rentrees/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(handleResponse),
  get: (id) => apiFetch(`${API_BASE_URL}/rentrees/${id}/`).then(handleResponse),
  update: (id, data) => apiFetch(`${API_BASE_URL}/rentrees/${id}/`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(handleResponse),
  delete: (id) => apiFetch(`${API_BASE_URL}/rentrees/${id}/`, {
    method: 'DELETE',
  }).then(response => response.ok),
};

// Status API
export const statusAPI = {
  check: () => apiFetch(`${API_BASE_URL}/status/`).then(handleResponse),
};

export const authAPI = {
  login: (payload) => apiFetch(`${API_BASE_URL}/auth/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then(handleResponse),
  logout: () => apiFetch(`${API_BASE_URL}/auth/logout/`, {
    method: 'POST',
  }).then(handleResponse),
  me: () => apiFetch(`${API_BASE_URL}/auth/me/`).then(handleResponse),
  refresh: () => apiFetch(`${API_BASE_URL}/auth/refresh/`, {
    method: 'POST',
  }).then(handleResponse),
  createGrantToken: (payload) => apiFetch(`${API_BASE_URL}/auth/grant-token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then(handleResponse),
  registerWithToken: (payload) => apiFetch(`${API_BASE_URL}/auth/register-with-token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then(handleResponse),
  grantRole: (payload) => apiFetch(`${API_BASE_URL}/auth/grant-role/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then(handleResponse),
  getCsrf: () => apiFetch(`${API_BASE_URL}/auth/csrf/`).then(handleResponse),
  listGuests: () => apiFetch(`${API_BASE_URL}/auth/guests/`).then(handleResponse),
  createGuest: (payload) => apiFetch(`${API_BASE_URL}/auth/guests/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then(handleResponse),
  updateGuest: (userId, payload) => apiFetch(`${API_BASE_URL}/auth/guests/${userId}/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then(handleResponse),
  deleteGuest: (userId) => apiFetch(`${API_BASE_URL}/auth/guests/${userId}/`, {
    method: 'DELETE',
  }).then((response) => response.ok),
};
