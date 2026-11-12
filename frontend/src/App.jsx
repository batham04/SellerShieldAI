import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { SellerLayout } from './layouts/SellerLayout';
import { CustomerLayout } from './layouts/CustomerLayout';
import { useAuth } from './context/AuthContext';
import { LoadingSpinner } from './components/UI';
import { LoginPage, RegisterPage } from './pages/AuthPages';
import { HomePage, ProductsPage, ProductDetailPage, CartPage, CheckoutPage, OrdersPage } from './pages/Storefront';
import { AssistantPage } from './pages/Assistant';
import { OverviewPage, ProductsAdminPage, OrdersAdminPage, TransactionsPage, RefundsPage, InsightsPage, SettingsPage } from './pages/SellerPages';
function Guard({ children, role }) { const {user,checkingSession}=useAuth(); if(checkingSession)return <LoadingSpinner label="Checking your session…"/>; if (!user) return <Navigate to="/login" replace/>; if(role && user.role!==role) return <Navigate to={user.role==='seller'?'/seller':'/'} replace/>; return children; }
export default function App() { return <Routes><Route path="/login" element={<LoginPage/>}/><Route path="/register" element={<RegisterPage/>}/><Route element={<CustomerLayout/>}><Route index element={<HomePage/>}/><Route path="products" element={<ProductsPage/>}/><Route path="products/:id" element={<ProductDetailPage/>}/><Route path="cart" element={<CartPage/>}/><Route path="checkout" element={<Guard><CheckoutPage/></Guard>}/><Route path="orders" element={<Guard><OrdersPage/></Guard>}/><Route path="assistant" element={<Guard><AssistantPage/></Guard>}/></Route><Route path="seller" element={<Guard role="seller"><SellerLayout/></Guard>}><Route index element={<OverviewPage/>}/><Route path="products" element={<ProductsAdminPage/>}/><Route path="orders" element={<OrdersAdminPage/>}/><Route path="transactions" element={<TransactionsPage/>}/><Route path="refunds" element={<RefundsPage/>}/><Route path="insights" element={<InsightsPage/>}/><Route path="settings" element={<SettingsPage/>}/></Route><Route path="*" element={<Navigate to="/" replace/>}/></Routes>; }
