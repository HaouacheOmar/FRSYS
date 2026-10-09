export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname}:8000/api`;

// WebSocket URL for a backend path such as '/ws/video/stream/'. Same convention as
// API_BASE_URL: VITE_WS_URL if set, else this host with the dev port 3000 mapped to Django's 8000.
export const wsUrl = (path) => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const { hostname, port } = window.location;
  const fallback = `${protocol}//${hostname}${port === '3000' ? ':8000' : (port ? `:${port}` : '')}`;
  return `${(import.meta.env.VITE_WS_URL || fallback).replace(/\/$/, '')}${path}`;
};

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

// Auth endpoints that must never trigger a refresh-and-retry on 401.
const NO_RETRY_PATHS = ['/auth/login/', '/auth/refresh/', '/auth/logout/', '/auth/csrf/', '/auth/register-with-token/'];
let refreshPromise = null;
let onAuthLost = () => {};

export const setAuthLostHandler = (handler) => {
  onAuthLost = handler;
};

// One shared in-flight refresh: concurrent 401s (and StrictMode double effects)
// must not send several refreshes, since the backend rotates + blacklists tokens.
export const refreshSession = () => {
  if (!refreshPromise) {
    refreshPromise = rawFetch(`${API_BASE_URL}/auth/refresh/`, { method: 'POST' })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

const apiFetch = async (url, options = {}) => {
  const response = await rawFetch(url, options);
  if (response.status !== 401 || NO_RETRY_PATHS.some((path) => url.includes(path))) {
    return response;
  }
  if (await refreshSession()) {
    return rawFetch(url, options);
  }
  onAuthLost();
  return response;
};

const rawFetch = async (url, options = {}) => {
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
    throw new Error(error.detail || error.message || `HTTP error! status: ${response.status}`);
  }
  return response.json();
};

// DRF paginates lists (PAGE_SIZE=50) but no screen has paging UI, so collect every page.
// Only the query string of `next` is reused: its host is whatever Django saw, which may
// differ from API_BASE_URL behind a proxy.
// ponytail: sequential page fetches; add a page_size query param on the backend if lists get big.
const fetchAllPages = async (baseUrl, params) => {
  let qs = params && Object.keys(params).length ? `?${new URLSearchParams(params).toString()}` : '';
  const results = [];
  for (;;) {
    const data = await apiFetch(`${baseUrl}${qs}`).then(handleResponse);
    if (!Array.isArray(data?.results)) return data; // unpaginated endpoint: pass through
    results.push(...data.results);
    if (!data.next) return { count: results.length, results };
    qs = new URL(data.next).search;
  }
};

const createCrudAPI = (baseSegment) => ({
  list: (params = {}) => fetchAllPages(`${API_BASE_URL}/${baseSegment}/`, params),
  create: (data) => apiFetch(`${API_BASE_URL}/${baseSegment}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(handleResponse),
  get: (id) => apiFetch(`${API_BASE_URL}/${baseSegment}/${id}/`).then(handleResponse),
  update: (id, data) => apiFetch(`${API_BASE_URL}/${baseSegment}/${id}/`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(handleResponse),
  delete: (id) => apiFetch(`${API_BASE_URL}/${baseSegment}/${id}/`, {
    method: 'DELETE',
  }).then(response => response.ok),
});

// Compagnies API
export const compagniesAPI = {
  ...createCrudAPI('compagnies'),
  getPersons: (id) => apiFetch(`${API_BASE_URL}/compagnies/${id}/persons/`).then(handleResponse),
};

// Persons API
export const personsAPI = {
  ...createCrudAPI('persons'),
  getSpectacles: (id) => apiFetch(`${API_BASE_URL}/persons/${id}/spectacles/`).then(handleResponse),
  getRentrees: (id) => apiFetch(`${API_BASE_URL}/persons/${id}/rentrees/`).then(handleResponse),
};

// Cameras API
export const camerasAPI = {
  ...createCrudAPI('cameras'),
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
  ...createCrudAPI('spectacles'),
  // 🚀 FIXED: Added support for passing filtering params down to custom list sub-routes
  pending: (params = {}) => {
    const qs = params && Object.keys(params).length ? `?${new URLSearchParams(params).toString()}` : '';
    return apiFetch(`${API_BASE_URL}/spectacles/pending/${qs}`).then(handleResponse);
  },
  completed: (params = {}) => {
    const qs = params && Object.keys(params).length ? `?${new URLSearchParams(params).toString()}` : '';
    return apiFetch(`${API_BASE_URL}/spectacles/completed/${qs}`).then(handleResponse);
  },
  // Backend SpectacleViewSet.create switches to bulk import when a file is attached.
  importExcel: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiFetch(`${API_BASE_URL}/spectacles/`, {
      method: 'POST',
      body: formData,
    }).then(handleResponse);
  },
  markReturn: (id) => apiFetch(`${API_BASE_URL}/spectacles/${id}/mark_return/`, {
    method: 'POST',
  }).then(handleResponse),
  byTitle: (params = {}) => {
    const qs = params && Object.keys(params).length ? `?${new URLSearchParams(params).toString()}` : '';
    return apiFetch(`${API_BASE_URL}/spectacles/by_title/${qs}`).then(handleResponse);
  },
};

// Rentrees API
export const rentreesAPI = {
  ...createCrudAPI('rentrees'),
};

// Status API
export const statusAPI = {
  check: () => apiFetch(`${API_BASE_URL}/status/`).then(handleResponse),
};

// Config API for face-photo directory
export const configAPI = {
  getPhotoPath: () => apiFetch(`${API_BASE_URL}/config/photo-path/`).then(handleResponse),
  setPhotoPath: (dirPath) => apiFetch(`${API_BASE_URL}/config/photo-path/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dir_path: dirPath }),
  }).then(handleResponse),
  uploadPhotoZip: (file) => {
    const formData = new FormData();
    formData.append('zip', file);
    return apiFetch(`${API_BASE_URL}/config/photo-path/`, {
      method: 'POST',
      body: formData,
    }).then(handleResponse);
  },
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
  refresh: () => refreshSession().then((ok) => {
    if (!ok) throw new Error('Session expired');
    return ok;
  }),
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