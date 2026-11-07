import { createSupabaseApi } from './supabaseApi';
import { createDemoApi } from './demoApi';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** Jeśli brak konfiguracji Supabase – aplikacja startuje w trybie DEMO (dane w przeglądarce). */
export const api = url && key ? createSupabaseApi(url, key) : createDemoApi();
export const isDemo = api.mode === 'demo';
