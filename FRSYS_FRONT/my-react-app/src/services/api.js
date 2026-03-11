// API service for backend communication
const API_BASE_URL = 'http://localhost:8000/api';

const handleResponse = async (response) => {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'An error occurred' }));
    throw new Error(error.message || `HTTP error! status: ${response.status}`);
  }
  return response.json();
};

// Compagnies API
export const compagniesAPI = {
  list: () => fetch(`${API_BASE_URL}/compagnies/`).then(handleResponse),
  create: (data) => fetch(`${API_BASE_URL}/compagnies/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(handleResponse),
  get: (id) => fetch(`${API_BASE_URL}/compagnies/${id}/`).then(handleResponse),
  update: (id, data) => fetch(`${API_BASE_URL}/compagnies/${id}/`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(handleResponse),
  delete: (id) => fetch(`${API_BASE_URL}/compagnies/${id}/`, {
    method: 'DELETE',
  }).then(response => response.ok),
  getPersons: (id) => fetch(`${API_BASE_URL}/compagnies/${id}/persons/`).then(handleResponse),
};

// Persons API
export const personsAPI = {
  list: () => fetch(`${API_BASE_URL}/persons/`).then(handleResponse),
  create: (data) => fetch(`${API_BASE_URL}/persons/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(handleResponse),
  get: (id) => fetch(`${API_BASE_URL}/persons/${id}/`).then(handleResponse),
  update: (id, data) => fetch(`${API_BASE_URL}/persons/${id}/`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(handleResponse),
  delete: (id) => fetch(`${API_BASE_URL}/persons/${id}/`, {
    method: 'DELETE',
  }).then(response => response.ok),
  getSpectacles: (id) => fetch(`${API_BASE_URL}/persons/${id}/spectacles/`).then(handleResponse),
  getRentrees: (id) => fetch(`${API_BASE_URL}/persons/${id}/rentrees/`).then(handleResponse),
};

// Cameras API
export const camerasAPI = {
  list: () => fetch(`${API_BASE_URL}/cameras/`).then(handleResponse),
  create: (data) => fetch(`${API_BASE_URL}/cameras/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(handleResponse),
  get: (id) => fetch(`${API_BASE_URL}/cameras/${id}/`).then(handleResponse),
  update: (id, data) => fetch(`${API_BASE_URL}/cameras/${id}/`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(handleResponse),
  delete: (id) => fetch(`${API_BASE_URL}/cameras/${id}/`, {
    method: 'DELETE',
  }).then(response => response.ok),
  activate: (id) => fetch(`${API_BASE_URL}/cameras/${id}/activate/`, {
    method: 'POST',
  }).then(handleResponse),
  deactivate: (id) => fetch(`${API_BASE_URL}/cameras/${id}/deactivate/`, {
    method: 'POST',
  }).then(handleResponse),
};

// Spectacles API
export const spectaclesAPI = {
  list: () => fetch(`${API_BASE_URL}/spectacles/`).then(handleResponse),
  pending: () => fetch(`${API_BASE_URL}/spectacles/pending/`).then(handleResponse),
  completed: () => fetch(`${API_BASE_URL}/spectacles/completed/`).then(handleResponse),
  create: (data) => fetch(`${API_BASE_URL}/spectacles/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(handleResponse),
  get: (id) => fetch(`${API_BASE_URL}/spectacles/${id}/`).then(handleResponse),
  update: (id, data) => fetch(`${API_BASE_URL}/spectacles/${id}/`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(handleResponse),
  delete: (id) => fetch(`${API_BASE_URL}/spectacles/${id}/`, {
    method: 'DELETE',
  }).then(response => response.ok),
  markReturn: (id) => fetch(`${API_BASE_URL}/spectacles/${id}/mark_return/`, {
    method: 'POST',
  }).then(handleResponse),
};

// Rentrees API
export const rentreesAPI = {
  list: () => fetch(`${API_BASE_URL}/rentrees/`).then(handleResponse),
  lateReturns: () => fetch(`${API_BASE_URL}/rentrees/late_returns/`).then(handleResponse),
  create: (data) => fetch(`${API_BASE_URL}/rentrees/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(handleResponse),
  get: (id) => fetch(`${API_BASE_URL}/rentrees/${id}/`).then(handleResponse),
  update: (id, data) => fetch(`${API_BASE_URL}/rentrees/${id}/`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(handleResponse),
  delete: (id) => fetch(`${API_BASE_URL}/rentrees/${id}/`, {
    method: 'DELETE',
  }).then(response => response.ok),
};

// Status API
export const statusAPI = {
  check: () => fetch(`${API_BASE_URL}/status/`).then(handleResponse),
};
