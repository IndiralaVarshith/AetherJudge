import axios from 'axios';

// One place for the API address. Set VITE_API_BASE in frontend/.env.development (local)
// or in the hosting provider's settings (production).
export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost/api';

// withCredentials sends the HTTP-only session cookie, so the server knows who is asking.
export const api = axios.create({ baseURL: API_BASE, withCredentials: true });

export const errorMessage = (error, fallback) => error?.response?.data?.error || fallback;
