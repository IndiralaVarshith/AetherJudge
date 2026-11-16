import axios from 'axios';
import { getUser } from './lib/storage.js';

// One place for the API address. Set VITE_API_BASE in frontend/.env.development (local)
// or in the hosting provider's settings (production).
export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost/api';

export const api = axios.create({ baseURL: API_BASE, withCredentials: true });

// The id the backend uses for "this visitor": the signed-in user, or the guest account.
export const currentUserParam = () => {
  const user = getUser();
  return user ? String(user.id) : 'null';
};

export const errorMessage = (error, fallback) => error?.response?.data?.error || fallback;
