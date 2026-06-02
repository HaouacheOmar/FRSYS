
// export const API_BASE_URL = '/api';
// Inside your ../services/api.js or api.tsx file:
// export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname}:8000/api`;
// const CSRF_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
// let csrfFetchPromise = null;

// const getCookie = (name) => {
//   if (typeof document === 'undefined') return '';
//   const cookie = document.cookie
//     .split(';')
//     .map((entry) => entry.trim())
//     .find((entry) => entry.startsWith(`${name}=`));
//   return cookie ? decodeURIComponent(cookie.split('=').slice(1).join('=')) : '';
// };

// const ensureCsrfCookie = async () => {
//   if (getCookie('csrftoken')) return;
//   if (!csrfFetchPromise) {
//     csrfFetchPromise = fetch(`${API_BASE_URL}/auth/csrf/`, {
//       credentials: 'include',
//     }).finally(() => {
//       csrfFetchPromise = null;
//     });
//   }
//   await csrfFetchPromise;
// };

// const apiFetch = async (url, options = {}) => {
//   const method = String(options.method || 'GET').toUpperCase();
//   const headers = {
//     ...(options.headers || {}),
//   };

//   if (CSRF_METHODS.has(method)) {
//     await ensureCsrfCookie();
//     const csrfToken = getCookie('csrftoken');
//     if (csrfToken) {
//       headers['X-CSRFToken'] = csrfToken;
//     }
//   }

//   const merged = {
//     credentials: 'include',
//     ...options,
//     headers,
//   };
//   return fetch(url, merged);
// };

// const handleResponse = async (response) => {
//   if (!response.ok) {
//     const error = await response.json().catch(() => ({ message: 'An error occurred' }));
//     throw new Error(error.message || `HTTP error! status: ${response.status}`);
//   }
//   return response.json();
// };

// const createCrudAPI = (baseSegment) => ({
//   list: (params = {}) => {
//     const qs = params && Object.keys(params).length ? `?${new URLSearchParams(params).toString()}` : '';
//     return apiFetch(`${API_BASE_URL}/${baseSegment}/${qs}`).then(handleResponse);
//   },
//   create: (data) => apiFetch(`${API_BASE_URL}/${baseSegment}/`, {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify(data),
//   }).then(handleResponse),
//   get: (id) => apiFetch(`${API_BASE_URL}/${baseSegment}/${id}/`).then(handleResponse),
//   update: (id, data) => apiFetch(`${API_BASE_URL}/${baseSegment}/${id}/`, {
//     method: 'PUT',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify(data),
//   }).then(handleResponse),
//   delete: (id) => apiFetch(`${API_BASE_URL}/${baseSegment}/${id}/`, {
//     method: 'DELETE',
//   }).then(response => response.ok),
// });

// // Compagnies API
// export const compagniesAPI = {
//   ...createCrudAPI('compagnies'),
//   getPersons: (id) => apiFetch(`${API_BASE_URL}/compagnies/${id}/persons/`).then(handleResponse),
// };

// // Persons API
// export const personsAPI = {
//   ...createCrudAPI('persons'),
//   getSpectacles: (id) => apiFetch(`${API_BASE_URL}/persons/${id}/spectacles/`).then(handleResponse),
//   getRentrees: (id) => apiFetch(`${API_BASE_URL}/persons/${id}/rentrees/`).then(handleResponse),
// };

// // Cameras API
// export const camerasAPI = {
//   ...createCrudAPI('cameras'),
//   activate: (id) => apiFetch(`${API_BASE_URL}/cameras/${id}/activate/`, {
//     method: 'POST',
//   }).then(handleResponse),
//   deactivate: (id) => apiFetch(`${API_BASE_URL}/cameras/${id}/deactivate/`, {
//     method: 'POST',
//   }).then(handleResponse),
//   ping: (id) => apiFetch(`${API_BASE_URL}/cameras/${id}/ping/`).then(handleResponse),
//   pingAll: () => apiFetch(`${API_BASE_URL}/cameras/ping_all/`).then(handleResponse),
// };

// // Spectacles API
// export const spectaclesAPI = {
//   ...createCrudAPI('spectacles'),
//   pending: () => apiFetch(`${API_BASE_URL}/spectacles/pending/`).then(handleResponse),
//   completed: () => apiFetch(`${API_BASE_URL}/spectacles/completed/`).then(handleResponse),
//   importExcel: (file) => {
//     const formData = new FormData();
//     formData.append('file', file);
//     return apiFetch(`${API_BASE_URL}/spectacles/`, {
//       method: 'POST',
//       body: formData,
//     }).then(handleResponse);
//   },
//   markReturn: (id) => apiFetch(`${API_BASE_URL}/spectacles/${id}/mark_return/`, {
//     method: 'POST',
//   }).then(handleResponse),
//   byTitle: (params = {}) => {
//     const qs = params && Object.keys(params).length ? `?${new URLSearchParams(params).toString()}` : '';
//     return apiFetch(`${API_BASE_URL}/spectacles/by_title/${qs}`).then(handleResponse);
//   },
// };

// // Rentrees API
// export const rentreesAPI = {
//   ...createCrudAPI('rentrees'),
//   lateReturns: () => apiFetch(`${API_BASE_URL}/rentrees/late_returns/`).then(handleResponse),
// };

// // Status API
// export const statusAPI = {
//   check: () => apiFetch(`${API_BASE_URL}/status/`).then(handleResponse),
// };

// // Config API for face-photo directory
// export const configAPI = {
//   getPhotoPath: () => apiFetch(`${API_BASE_URL}/config/photo-path/`).then(handleResponse),
//   setPhotoPath: (dirPath) => apiFetch(`${API_BASE_URL}/config/photo-path/`, {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({ dir_path: dirPath }),
//   }).then(handleResponse),
//   uploadPhotoZip: (file) => {
//     const formData = new FormData();
//     formData.append('zip', file);
//     return apiFetch(`${API_BASE_URL}/config/photo-path/`, {
//       method: 'POST',
//       body: formData,
//     }).then(handleResponse);
//   },
// };

// export const authAPI = {
//   login: (payload) => apiFetch(`${API_BASE_URL}/auth/login/`, {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify(payload),
//   }).then(handleResponse),
//   logout: () => apiFetch(`${API_BASE_URL}/auth/logout/`, {
//     method: 'POST',
//   }).then(handleResponse),
//   me: () => apiFetch(`${API_BASE_URL}/auth/me/`).then(handleResponse),
//   refresh: () => apiFetch(`${API_BASE_URL}/auth/refresh/`, {
//     method: 'POST',
//   }).then(handleResponse),
//   createGrantToken: (payload) => apiFetch(`${API_BASE_URL}/auth/grant-token/`, {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify(payload),
//   }).then(handleResponse),
//   registerWithToken: (payload) => apiFetch(`${API_BASE_URL}/auth/register-with-token/`, {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify(payload),
//   }).then(handleResponse),
//   grantRole: (payload) => apiFetch(`${API_BASE_URL}/auth/grant-role/`, {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify(payload),
//   }).then(handleResponse),
//   getCsrf: () => apiFetch(`${API_BASE_URL}/auth/csrf/`).then(handleResponse),
//   listGuests: () => apiFetch(`${API_BASE_URL}/auth/guests/`).then(handleResponse),
//   createGuest: (payload) => apiFetch(`${API_BASE_URL}/auth/guests/`, {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify(payload),
//   }).then(handleResponse),
//   updateGuest: (userId, payload) => apiFetch(`${API_BASE_URL}/auth/guests/${userId}/`, {
//     method: 'PATCH',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify(payload),
//   }).then(handleResponse),
//   deleteGuest: (userId) => apiFetch(`${API_BASE_URL}/auth/guests/${userId}/`, {
//     method: 'DELETE',
//   }).then((response) => response.ok),
// };


export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname}:8000/api`;
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

const createCrudAPI = (baseSegment) => ({
  list: (params = {}) => {
    const qs = params && Object.keys(params).length ? `?${new URLSearchParams(params).toString()}` : '';
    return apiFetch(`${API_BASE_URL}/${baseSegment}/${qs}`).then(handleResponse);
  },
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
  // 🚀 FIXED: Pointed action to dedicated upload sub-route instead of colliding with base POST
  importExcel: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiFetch(`${API_BASE_URL}/spectacles/import_excel/`, {
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
  lateReturns: () => apiFetch(`${API_BASE_URL}/rentrees/late_returns/`).then(handleResponse),
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