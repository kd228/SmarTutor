const TOKEN_KEY = 'tutoring_token';

export const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
};
export const setToken = (token) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* storage unavailable */ }
};

// Calls the backend. Failures throw an Error whose message is safe to show, with `status` set
// (0 means the server could not be reached at all).
export async function api(path, { method = 'GET', body } = {}) {
  const token = getToken();
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw Object.assign(new Error('Could not reach the server. Check your connection and try again.'), { status: 0 });
  }

  let data = null;
  try { data = await res.json(); } catch { /* the body was not JSON */ }

  if (!res.ok) {
    const fallback = res.status === 404 || res.status >= 500
      ? 'The server is not responding correctly right now. Please try again in a minute.'
      : `Request failed (${res.status})`;
    throw Object.assign(new Error(data?.error || fallback), { status: res.status });
  }
  return data || {};
}

export const dollars = (cents) => `$${(cents / 100).toFixed(2).replace(/\.00$/, '')}`;

export const formatWhen = (value) =>
  new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export const formatDay = (value) => new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' });

export const browserTimeZone = () => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
};
