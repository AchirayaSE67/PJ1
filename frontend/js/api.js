const TOKEN_KEY = 'pc_rental_token';
const USER_KEY = 'pc_rental_user';

// Clear legacy persistent login data from older versions. Login is session-only.
localStorage.removeItem(TOKEN_KEY);
localStorage.removeItem(USER_KEY);

export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function getUser() {
  const raw = sessionStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function setSession(token, user) {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}

export async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const requestOptions = { ...options, headers };
  if (requestOptions.body && typeof requestOptions.body !== 'string') {
    requestOptions.body = JSON.stringify(requestOptions.body);
  }
  const res = await fetch(`/api${path}`, requestOptions);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || 'เกิดข้อผิดพลาด');
  }
  return data;
}

export function requireLogin(nextPath) {
  if (!getToken()) {
    const next = encodeURIComponent(nextPath || location.pathname + location.search);
    location.href = `/pages/login.html?next=${next}`;
    return false;
  }
  return true;
}
