import { createContext, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken } from './api.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(getToken()));

  useEffect(() => {
    if (!getToken()) return;
    api('/auth/me')
      .then((d) => setUser(d.user))
      // Only a rejected token ends the session; a network blip or server error must not log people out.
      .catch((err) => { if (err.status === 401) setToken(null); })
      .finally(() => setLoading(false));
  }, []);

  const authenticate = async (path, body) => {
    const data = await api(path, { method: 'POST', body });
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const value = {
    user,
    loading,
    login: (email, password) => authenticate('/auth/login', { email, password }),
    register: (form) => authenticate('/auth/register', form),
    logout: () => { setToken(null); setUser(null); },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
