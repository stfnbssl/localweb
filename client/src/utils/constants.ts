// In sviluppo le chiamate a /api vengono inoltrate al server tramite il proxy di Vite
// (vedi vite.config.ts). Si può forzare un URL diverso con VITE_API_URL.
export const API_URL = import.meta.env.VITE_API_URL || '/api';
export const APP_NAME = import.meta.env.VITE_APP_NAME || 'localweb';
