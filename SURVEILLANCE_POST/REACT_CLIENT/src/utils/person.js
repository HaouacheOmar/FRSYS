import { API_BASE_URL } from '../services/api';

const PLACEHOLDER_PHOTO = '/main.svg';

// "Prénom Nom", or `fallback` when the person or both names are missing.
export const personName = (person, fallback = '') =>
  `${person?.prenom || ''} ${person?.nom || ''}`.trim() || fallback;

// Main photo URL for a person id; placeholder when there is no id.
export const personPhotoUrl = (personId) =>
  personId ? `${API_BASE_URL}/persons/${personId}/main-photo/` : PLACEHOLDER_PHOTO;

// <img onError>: fall back to the placeholder once (no loop if that fails too).
export const showPlaceholderPhoto = (event) => {
  event.currentTarget.onerror = null;
  event.currentTarget.setAttribute('src', PLACEHOLDER_PHOTO);
};
