import axios from 'axios';

// One place for the API address.
// - Local development: VITE_API_BASE=http://localhost:5000/api in frontend/.env.development.
// - Production on Vercel: leave it unset. The site calls its own /api, which vercel.json
//   forwards to the API server, so the session cookie stays first-party.
export const API_BASE = import.meta.env.VITE_API_BASE || '/api';

// withCredentials sends the HTTP-only session cookie, so the server knows who is asking.
export const api = axios.create({ baseURL: API_BASE, withCredentials: true });

export const errorMessage = (error, fallback) => error?.response?.data?.error || fallback;
