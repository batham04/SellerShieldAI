import axios from 'axios';

export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api', timeout: 15000, headers: { 'Content-Type': 'application/json' } });
api.interceptors.request.use(config => { const token = sessionStorage.getItem('sellerShieldToken'); if (token) config.headers.Authorization = `Bearer ${token}`; return config; });
api.interceptors.response.use(response => response, error => { const message = error.response?.data?.message || error.message || 'Unable to reach the service.'; return Promise.reject(new Error(message)); });

export const services = {
  auth: { login: body => api.post('/auth/login', body), register: body => api.post('/auth/register', body), me: () => api.get('/auth/me') },
  products: { list: params => api.get('/products', { params }), get: id => api.get(`/products/${id}`), create: body => api.post('/products', body), update: (id, body) => api.put(`/products/${id}`, body), remove: id => api.delete(`/products/${id}`) },
  ai: { chat: body => api.post('/ai/chat', body), history: () => api.get('/ai/conversations'), analyzeRefund: body => api.post('/ai/refund/analyze', body), businessInsights: params => api.get('/ai/business-insights', { params }) },
  cart: { get: () => api.get('/cart'), update: body => api.put('/cart', body) },
  orders: { list: params => api.get('/orders', { params }), create: body => api.post('/orders', body), get: id => api.get(`/orders/${id}`) },
  payments: { createPayPalOrder: body => api.post('/payments/paypal/create', body), capturePayPalOrder: body => api.post('/payments/paypal/capture', body), cancelPayPalOrder: body => api.post('/payments/paypal/cancel', body), transactions: params => api.get('/transactions', { params }) },
  refunds: { list: params => api.get('/refunds', { params }), create: body => api.post('/refunds', body), decide: (id, decision) => api.patch(`/refunds/${id}`, { decision }) },
  analytics: { overview: params => api.get('/analytics/overview', { params }) },
  settings: { get: () => api.get('/settings'), update: body => api.put('/settings', body) }
};

export const getError = error => error?.message || 'Something went wrong. Please try again.';
