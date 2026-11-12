import React from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { services } from '../services/api';

const CartContext = createContext(null);
const STORAGE_KEY = 'sellerShieldGuestCart';
const readLocalCart = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || localStorage.getItem('sellerShieldCart')) || []; } catch { return []; }
};

export function CartProvider({ children }) {
  const { user } = useAuth();
  const [items, setItems] = useState(readLocalCart);
  const [syncError, setSyncError] = useState('');
  const [cartReady, setCartReady] = useState(false);
  const userKey = user?.role === 'customer' ? user.id : null;
  const hydratedFor = useRef(null);
  const skipSync = useRef(false);

  useEffect(() => {
    let active = true;
    setSyncError('');
    if (!userKey) {
      hydratedFor.current = null;
      setItems(readLocalCart());
      setCartReady(true);
      return () => { active = false; };
    }
    setCartReady(false);
    services.cart.get().then(async response => {
      if (!active) return;
      const serverItems = (response.data?.items || []).map(item => ({ ...item, quantity: Math.min(Number(item.quantity), Number(item.stock ?? item.quantity)) })).filter(item => item.quantity > 0);
      const serverById = new Map(serverItems.map(item => [item.id || item.productId, item]));
      const merged = [...serverItems];
      for (const guestItem of readLocalCart()) {
        const id = guestItem.id || guestItem.productId;
        const existing = serverById.get(id);
        if (existing) { const stock = Number.isFinite(Number(existing.stock)) ? Number(existing.stock) : 100; existing.quantity = Math.min(Number(existing.quantity) + Number(guestItem.quantity || 1), stock); }
        else merged.push({ ...guestItem, productId: id });
      }
      let valid = merged.filter(item => item.quantity > 0 && item.productId);
      try {
        await services.cart.update({ items: valid.map(item => ({ productId: item.productId || item.id, quantity: item.quantity })) });
      } catch (mergeError) {
        valid = serverItems;
        await services.cart.update({ items: valid.map(item => ({ productId: item.productId || item.id, quantity: item.quantity })) });
        if (active) setSyncError('Some saved guest cart items are no longer available and were not added.');
      }
      if (!active) return;
      skipSync.current = true;
      setItems(valid.map(item => ({ ...item, id: item.id || item.productId })));
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem('sellerShieldCart');
      hydratedFor.current = userKey;
    }).catch(error => {
      if (active) setSyncError(error.message || 'Could not load your saved cart.');
    }).finally(() => { if (active) setCartReady(true); });
    return () => { active = false; };
  }, [userKey]);

  useEffect(() => {
    if (!userKey) localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    if (!userKey || hydratedFor.current !== userKey) return;
    if (skipSync.current) { skipSync.current = false; return; }
    const timer = setTimeout(() => {
      services.cart.update({ items: items.map(item => ({ productId: item.productId || item.id, quantity: item.quantity })) })
        .then(() => setSyncError(''))
        .catch(error => setSyncError(error.message || 'Could not save your cart.'));
    }, 250);
    return () => clearTimeout(timer);
  }, [items, userKey]);

  const save = useCallback(next => setItems(next), []);
  const add = useCallback(product => setItems(current => {
    const id = product.id || product.productId;
    const found = current.find(item => (item.id || item.productId) === id);
    return found
      ? current.map(item => (item.id || item.productId) === id ? { ...item, quantity: item.quantity + 1 } : item)
      : [...current, { ...product, id, productId: id, quantity: 1 }];
  }), []);
  const quantity = useCallback((id, amount) => setItems(current => current.map(item => (item.id || item.productId) === id ? { ...item, quantity: amount } : item).filter(item => item.quantity > 0)), []);
  const remove = useCallback(id => setItems(current => current.filter(item => (item.id || item.productId) !== id)), []);
  const refresh = useCallback(async () => {
    if (!userKey) return;
    const response = await services.cart.get();
    const serverItems = response.data?.items || [];
    skipSync.current = true;
    setItems(serverItems.map(item => ({ ...item, id: item.id || item.productId })));
  }, [userKey]);
  const clear = useCallback(() => save([]), [save]);
  const value = useMemo(() => ({ items, add, quantity, remove, clear, refresh, loading: !cartReady, syncError, count: items.reduce((n, item) => n + item.quantity, 0), total: items.reduce((n, item) => n + Number(item.price || 0) * item.quantity, 0) }), [items, add, quantity, remove, clear, refresh, cartReady, syncError]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
