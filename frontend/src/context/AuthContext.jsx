import React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import { services } from '../services/api';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => { try { return JSON.parse(sessionStorage.getItem('sellerShieldUser')); } catch { return null; } });
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(() => Boolean(sessionStorage.getItem('sellerShieldToken')));
  useEffect(() => {
    const token = sessionStorage.getItem('sellerShieldToken');
    if (!token) { setCheckingSession(false); return; }
    let active = true;
    services.auth.me().then(response => {
      if (!active) return;
      const currentUser = response.data?.user;
      if (!currentUser) throw new Error('The server did not return the signed-in user.');
      sessionStorage.setItem('sellerShieldUser', JSON.stringify(currentUser));
      setUser(currentUser);
    }).catch(() => {
      if (!active) return;
      sessionStorage.removeItem('sellerShieldToken');
      sessionStorage.removeItem('sellerShieldUser');
      setUser(null);
    }).finally(() => { if (active) setCheckingSession(false); });
    return () => { active = false; };
  }, []);
  const persist = data => { const u = data.user; if (!u || !data.token) throw new Error('The server response is missing a user or access token.'); sessionStorage.setItem('sellerShieldToken', data.token); sessionStorage.setItem('sellerShieldUser', JSON.stringify(u)); setUser(u); return u; };
  const login = async credentials => { setLoading(true); try { return persist((await services.auth.login(credentials)).data); } finally { setLoading(false); } };
  const register = async values => { setLoading(true); try { return persist((await services.auth.register(values)).data); } finally { setLoading(false); } };
  const logout = () => { sessionStorage.removeItem('sellerShieldToken'); sessionStorage.removeItem('sellerShieldUser'); setUser(null); };
  return <AuthContext.Provider value={{ user, loading, checkingSession, login, register, logout }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
