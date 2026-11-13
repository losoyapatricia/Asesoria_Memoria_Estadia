const API_URL = import.meta.env.PUBLIC_API_URL || 'http://localhost:3001';

export function getToken() {
  return typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
}

export async function api(path, { method = 'GET', body, formData } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload;
  if (formData) {
    payload = formData; // no fijar Content-Type, el navegador añade boundary
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const res = await fetch(`${API_URL}${path}`, { method, headers, body: payload });

  let data = null;
  try { data = await res.json(); } catch { /* sin cuerpo JSON */ }

  if (res.status === 401) {
    localStorage.removeItem('token');
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
  }

  if (!res.ok) {
    throw new Error(data?.error || `Error ${res.status}`);
  }
  return data;
}
